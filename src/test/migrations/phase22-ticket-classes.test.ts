import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MIGRATION_PATHS = [
  "supabase/migrations/20260614010000_phase22_ticket_classes.sql",
  "supabase/migrations/20260614020000_fix_phase22_rollup_ticket_classes.sql",
  "supabase/migrations/20260614021000_fix_phase22_rollup_write_barrier.sql",
  "supabase/migrations/20260614022000_fix_phase22_rollup_explicit_steps.sql",
];
const REPLACEMENT_MIGRATION_PATH = "supabase/migrations/20260614022000_fix_phase22_rollup_explicit_steps.sql";

function migration(): string {
  return MIGRATION_PATHS.map((path) => readFileSync(path, "utf8")).join("\n");
}

function replacementMigration(): string {
  return readFileSync(REPLACEMENT_MIGRATION_PATH, "utf8");
}

function executableSql(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--.*$/gm, "");
}

describe("Phase 22 ticket class migration", () => {
  it("creates admin-readable, service-written ticket_classes state", () => {
    const sql = migration();
    const body = executableSql(sql);

    expect(body).toMatch(/CREATE TABLE IF NOT EXISTS public\.ticket_classes \(/);
    expect(body).toMatch(/class_key text PRIMARY KEY/);
    expect(body).toMatch(/threshold_count integer NOT NULL DEFAULT 3/);
    expect(body).toMatch(/threshold_window_days integer NOT NULL DEFAULT 30/);
    expect(body).toMatch(/resolved_count_30d integer NOT NULL DEFAULT 0/);
    expect(body).toMatch(/occurrence_count_30d integer NOT NULL DEFAULT 0/);
    expect(body).toMatch(/fresh_ticket_rate_30d numeric\([0-9]+,\s*[0-9]+\) NOT NULL DEFAULT 0/);
    expect(body).toMatch(/baseline_rate_30d numeric\([0-9]+,\s*[0-9]+\)/);
    expect(body).toMatch(/post_fix_rate_30d numeric\([0-9]+,\s*[0-9]+\)/);
    expect(body).toMatch(/structural_ticket_id uuid REFERENCES public\.tickets\(id\) ON DELETE SET NULL/);
    expect(body).toMatch(/structural_fix_landed_at timestamptz/);
    expect(body).toMatch(/killed_at timestamptz/);
    expect(body).toMatch(/ALTER TABLE public\.ticket_classes ENABLE ROW LEVEL SECURITY/);
    expect(body).toMatch(/CREATE POLICY "Admins can read ticket classes"[\s\S]*USING \(public\.has_role\(auth\.uid\(\), 'ADMIN'\)\)/);
    expect(body).toMatch(/REVOKE INSERT, UPDATE, DELETE ON public\.ticket_classes FROM anon, authenticated/);
    expect(body).toMatch(/GRANT SELECT ON public\.ticket_classes TO authenticated/);
    expect(body).toMatch(/GRANT SELECT, INSERT, UPDATE, DELETE ON public\.ticket_classes TO service_role/);
  });

  it("keeps rollup service-role-only and metrics admin-guarded", () => {
    const body = executableSql(migration());

    expect(body).toMatch(/CREATE OR REPLACE FUNCTION public\.rollup_ticket_classes\(\)/);
    expect(body).toMatch(/SECURITY DEFINER/);
    expect(body).toMatch(/REVOKE ALL ON FUNCTION public\.rollup_ticket_classes\(\) FROM PUBLIC, anon, authenticated/);
    expect(body).toMatch(/GRANT EXECUTE ON FUNCTION public\.rollup_ticket_classes\(\) TO service_role/);
    expect(body).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.rollup_ticket_classes\(\) TO authenticated/);

    expect(body).toMatch(/CREATE OR REPLACE FUNCTION public\.ticket_class_metrics\(\)/);
    expect(body).toMatch(/IF NOT public\.has_role\(auth\.uid\(\), 'ADMIN'\) THEN\s+RAISE EXCEPTION 'forbidden'/);
    expect(body).toMatch(/REVOKE ALL ON FUNCTION public\.ticket_class_metrics\(\) FROM PUBLIC, anon/);
    expect(body).toMatch(/GRANT EXECUTE ON FUNCTION public\.ticket_class_metrics\(\) TO authenticated/);
  });

  it("forms class keys from source, error class, and source-namespaced fingerprint root", () => {
    const body = executableSql(migration());

    expect(body).toMatch(/CREATE OR REPLACE FUNCTION public\.ticket_class_key\(/);
    expect(body).toMatch(/source:[^']*'\s*\|\|\s*public\.normalize_ticket_class_part\(p_source::text,\s*'unknown'\)/);
    expect(body).toMatch(/error:[^']*'\s*\|\|\s*public\.ticket_error_class\(COALESCE\(p_context,\s*'\{\}'::jsonb\)\)/);
    expect(body).toMatch(/fingerprint:[^']*'\s*\|\|\s*public\.normalize_ticket_class_part\(p_source::text,\s*'unknown'\)\s*\|\|\s*':'\s*\|\|\s*public\.ticket_fingerprint_root\(p_fingerprint,\s*COALESCE\(p_context,\s*'\{\}'::jsonb\)\)/);
    expect(body).not.toMatch(/fingerprint:[^']*'\s*\|\|\s*public\.ticket_fingerprint_root\(/);
  });

  it("creates one internal escalated structural task carrying class-root rate context", () => {
    const body = executableSql(migration());

    expect(body).toMatch(/INSERT INTO public\.tickets \([\s\S]*type,[\s\S]*status,[\s\S]*source,[\s\S]*context/);
    expect(body).toMatch(/SELECT[\s\S]*'task'[\s\S]*'escalated'[\s\S]*'internal'/);
    expect(body).toMatch(/jsonb_build_object\([\s\S]*'ticket_class_key'[\s\S]*'class_root'[\s\S]*'baseline_rate_30d'[\s\S]*'fresh_ticket_rate_30d'[\s\S]*'recurrence_action'/);
    expect(body).toMatch(/structural_ticket_id IS NULL/);
    expect(body).toMatch(/NOT EXISTS \([\s\S]*FROM public\.tickets open_structural[\s\S]*open_structural\.type = 'task'[\s\S]*open_structural\.source = 'internal'[\s\S]*open_structural\.status IN \('new', 'in_progress', 'awaiting_approval', 'escalated'\)/);
    expect(body).not.toMatch(/tier2_auto_fix_queued|auto_push|autonomous_push/);
  });

  it("tracks landed, post-fix measurement, and killed lifecycle without overwriting baseline", () => {
    const body = executableSql(replacementMigration());

    expect(body).toMatch(/structural_fix_landed_at = COALESCE\(tc\.structural_fix_landed_at, now\(\)\)/);
    expect(body).toMatch(/baseline_rate_30d = COALESCE\(tc\.baseline_rate_30d, tc\.fresh_ticket_rate_30d\)/);
    expect(body).toMatch(/COALESCE\(linked_task\.status::text, ''\) = 'resolved'/);
    expect(body).toMatch(/linked_task\.context->>'fix_outcome' = 'verified-stable'/);
    expect(body).not.toMatch(/linked_task\.context::text ILIKE '%verified-stable%'/);
    expect(body).toMatch(/post_fix_rate_30d = CASE\s+WHEN tc\.structural_fix_landed_at IS NOT NULL/);
    expect(body).toMatch(/killed_at = COALESCE\(updated\.killed_at, now\(\)\)[\s\S]*status = 'killed'/);
    expect(body).toMatch(/updated\.structural_fix_landed_at IS NOT NULL[\s\S]*updated\.post_fix_rate_30d < updated\.killed_threshold_rate/);
  });

  it("keeps class rollups honest and threshold checks column-driven", () => {
    const body = executableSql(replacementMigration());

    expect(body).toMatch(/GROUP BY rt\.class_key, rt\.source, rt\.error_class, rt\.fingerprint_root/);
    expect(body).not.toMatch(/MIN\(rt\.source\) AS source/);
    expect(body).not.toMatch(/MIN\(rt\.error_class\) AS error_class/);
    expect(body).not.toMatch(/MIN\(rt\.fingerprint_root\) AS fingerprint_root/);
    expect(body).toMatch(/CASE WHEN r\.occurrence_count_30d >= r\.threshold_count THEN r\.fresh_ticket_rate_30d ELSE NULL END/);
    expect(body).toMatch(/CASE WHEN r\.occurrence_count_30d >= r\.threshold_count THEN now\(\) ELSE NULL END/);
    expect(body).toMatch(/CASE WHEN r\.occurrence_count_30d >= r\.threshold_count THEN 'recurring' ELSE 'watching' END/);
    expect(body).not.toMatch(/CASE WHEN r\.occurrence_count_30d >= 3 THEN/);
  });
});
