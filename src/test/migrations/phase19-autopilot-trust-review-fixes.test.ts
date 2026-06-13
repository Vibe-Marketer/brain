import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function migration(path: string): string {
  return readFileSync(path, "utf8");
}

describe("Phase 19 autopilot trust review-fix migrations", () => {
  it("matures pending survival rows only after due date and without reopen events", () => {
    const sql = migration("supabase/migrations/20260613201000_phase19_survival_maturation_rollup.sql");

    expect(sql).toMatch(/UPDATE public\.runner_runs rr[\s\S]*SET survival_status = 'held'/);
    expect(sql).toMatch(/rr\.survival_due_at <= now\(\)/);
    expect(sql).toMatch(/rr\.survival_status = 'pending'/);
    expect(sql).toMatch(/NOT EXISTS \([\s\S]*te\.event_type = 'canary_regression_reopened'/);
    expect(sql).toMatch(/te\.event_type = 'status_change' AND te\.new_value = 'reopened'/);
    expect(sql).toMatch(/WHERE er\.survival_status = 'held'[\s\S]*AND NOT er\.has_reopen_event/);
  });

  it("audits every auto to manual rollup transition without requiring prior promotion events", () => {
    const sql = migration("supabase/migrations/20260613202000_phase19_unconditional_auto_demote_audit.sql");

    expect(sql).toMatch(/existing_before AS \([\s\S]*act\.rung[\s\S]*FOR UPDATE OF act/);
    expect(sql).toMatch(/JOIN existing_before old ON old\.category = u\.category/);
    expect(sql).toMatch(/WHERE old\.rung = 'auto'\s+AND u\.rung = 'manual'/);
    expect(sql).not.toMatch(/admin_promoted|admin_set_rung/);
  });
});
