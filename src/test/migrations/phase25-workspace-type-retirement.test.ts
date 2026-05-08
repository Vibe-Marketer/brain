/**
 * Phase 25 Nyquist coverage — migration structure + data-transformation logic.
 *
 * Verifies the workspace_type_retirement migration:
 *
 * Structural invariants (WS-04 / WS-05):
 *   - DROPs the workspace_type CHECK constraint
 *   - ADDs workspace_memberships.sort_order
 *   - Deterministically backfills sort_order per user (ROW_NUMBER ORDER BY created_at, id)
 *   - Deterministically backfills is_default per org (DISTINCT ON ... ORDER BY is_home DESC,
 *     workspace_type='personal' DESC, created_at ASC, id ASC)
 *   - DEMOTEs duplicate personals to workspace_type='team'
 *   - Creates the partial UNIQUE index workspaces_one_default_per_org_idx
 *   - Updates ensure_home_workspace() to set is_default=TRUE on new orgs
 *   - Patches delete_workspace RPC with an is_default guard ("Cannot delete the default workspace.")
 *     as the FIRST check (before the role check)
 *
 * Data-transformation logic (re-implements the SQL backfill in JS and asserts the same outputs
 * the migration would produce against a known dataset, including Andrew's "AI Simple" multi-personal
 * case).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(__dirname, '../../..');
const MIGRATION_PATH = resolve(
  REPO_ROOT,
  'supabase/migrations/20260507052421_workspace_type_retirement.sql',
);

const sql = readFileSync(MIGRATION_PATH, 'utf-8');

// ─── Structural invariants ────────────────────────────────────────────────

describe('migration structure (WS-04 / WS-05 schema invariants)', () => {
  it('drops the workspace_type CHECK constraint', () => {
    expect(sql).toMatch(
      /ALTER TABLE workspaces DROP CONSTRAINT IF EXISTS workspaces_workspace_type_check/,
    );
  });

  it('adds sort_order on workspace_memberships with NOT NULL DEFAULT 0', () => {
    expect(sql).toMatch(
      /ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0/,
    );
  });

  it('backfills sort_order with deterministic per-user rank (ROW_NUMBER ORDER BY created_at ASC, id ASC)', () => {
    expect(sql).toMatch(
      /ROW_NUMBER\s*\(\s*\)\s*OVER\s*\(\s*PARTITION BY user_id\s+ORDER BY created_at ASC,\s*id ASC\s*\)/,
    );
  });

  it('creates an index on (user_id, sort_order) to support ordered queries', () => {
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS idx_workspace_memberships_user_sort\s+ON workspace_memberships \(user_id, sort_order\)/,
    );
  });

  it('backfills is_default deterministically (is_home DESC, personal DESC, created_at ASC, id ASC)', () => {
    expect(sql).toMatch(/DISTINCT ON \(organization_id\)/);
    expect(sql).toMatch(/ORDER BY organization_id,\s*is_home DESC/);
    expect(sql).toMatch(/\(workspace_type = 'personal'\) DESC/);
    expect(sql).toMatch(/created_at ASC,\s*id ASC/);
    // Idempotent — only sets is_default when org has none yet
    expect(sql).toMatch(
      /AND NOT EXISTS\s*\(\s*SELECT 1 FROM workspaces w2[\s\S]*w2\.is_default = TRUE/,
    );
  });

  it('demotes duplicate personals: workspace_type=personal AND NOT is_default → workspace_type=team', () => {
    expect(sql).toMatch(
      /UPDATE workspaces\s+SET workspace_type = 'team'\s+WHERE workspace_type = 'personal'\s+AND COALESCE\(is_default, FALSE\) = FALSE/,
    );
  });

  it('creates the partial UNIQUE index enforcing one is_default per organization', () => {
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS workspaces_one_default_per_org_idx\s+ON workspaces \(organization_id\)\s+WHERE is_default = TRUE/,
    );
  });

  it('updates ensure_home_workspace() to insert is_default=TRUE on new orgs', () => {
    // Pull the function body
    const fnMatch = sql.match(
      /CREATE OR REPLACE FUNCTION public\.ensure_home_workspace\(\)[\s\S]*?\$\$;/,
    );
    expect(fnMatch).not.toBeNull();
    const body = fnMatch![0];
    expect(body).toMatch(/INSERT INTO workspaces\s*\(\s*organization_id,\s*name,\s*workspace_type,\s*is_home,\s*is_default\s*\)/);
    expect(body).toMatch(/VALUES\s*\(\s*NEW\.id,\s*'Home Workspace',\s*'team',\s*TRUE,\s*TRUE\s*\)/);
    // Preserves search_path hardening
    expect(body).toMatch(/SET search_path = public/);
  });

  it('patches delete_workspace RPC: is_default guard is the FIRST check (before role check)', () => {
    const fnMatch = sql.match(
      /CREATE OR REPLACE FUNCTION public\.delete_workspace\([\s\S]*?\$\$;/,
    );
    expect(fnMatch).not.toBeNull();
    const body = fnMatch![0];

    // Guard must be present
    expect(body).toMatch(/Cannot delete the default workspace\./);
    expect(body).toMatch(/IF v_is_default THEN/);

    // Position check: the is_default guard must come BEFORE the role check
    const guardIdx = body.indexOf('Cannot delete the default workspace');
    const roleIdx = body.indexOf('You are not a member of this workspace');
    expect(guardIdx).toBeGreaterThan(-1);
    expect(roleIdx).toBeGreaterThan(-1);
    expect(guardIdx).toBeLessThan(roleIdx);

    // Hardened search_path
    expect(body).toMatch(/SET search_path = public/);
  });
});

// ─── Data-transformation logic (JS port of the SQL) ──────────────────────

type MembershipRow = { id: string; user_id: string; created_at: string };

/** JS port of: ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC, id ASC) - 1 */
function backfillSortOrder(rows: MembershipRow[]): Map<string, number> {
  const byUser = new Map<string, MembershipRow[]>();
  for (const r of rows) {
    if (!byUser.has(r.user_id)) byUser.set(r.user_id, []);
    byUser.get(r.user_id)!.push(r);
  }
  const out = new Map<string, number>();
  for (const [, arr] of byUser) {
    arr.sort((a, b) => {
      const t = a.created_at.localeCompare(b.created_at);
      return t !== 0 ? t : a.id.localeCompare(b.id);
    });
    arr.forEach((r, i) => out.set(r.id, i));
  }
  return out;
}

type WorkspaceRow = {
  id: string;
  organization_id: string;
  name: string;
  workspace_type: 'personal' | 'team' | 'youtube';
  is_home: boolean;
  is_default: boolean | null;
  created_at: string;
};

/** JS port of: DISTINCT ON (organization_id) ... ORDER BY is_home DESC, (workspace_type='personal') DESC, created_at ASC, id ASC */
function backfillIsDefault(rows: WorkspaceRow[]): WorkspaceRow[] {
  const byOrg = new Map<string, WorkspaceRow[]>();
  for (const r of rows) {
    if (!byOrg.has(r.organization_id)) byOrg.set(r.organization_id, []);
    byOrg.get(r.organization_id)!.push(r);
  }
  const result = rows.map((r) => ({ ...r }));
  const orgHasDefault = new Map<string, boolean>();
  for (const r of result) {
    if (r.is_default === true) orgHasDefault.set(r.organization_id, true);
  }
  for (const [orgId, candidates] of byOrg) {
    if (orgHasDefault.get(orgId)) continue;
    const sorted = [...candidates].sort((a, b) => {
      // is_home DESC: home first
      if (a.is_home !== b.is_home) return a.is_home ? -1 : 1;
      // (workspace_type='personal') DESC
      const aP = a.workspace_type === 'personal';
      const bP = b.workspace_type === 'personal';
      if (aP !== bP) return aP ? -1 : 1;
      // created_at ASC
      const t = a.created_at.localeCompare(b.created_at);
      if (t !== 0) return t;
      // id ASC
      return a.id.localeCompare(b.id);
    });
    const winner = sorted[0];
    const found = result.find((r) => r.id === winner.id)!;
    found.is_default = true;
  }
  return result;
}

/** JS port of demote step: UPDATE ... SET workspace_type='team' WHERE workspace_type='personal' AND NOT is_default */
function demoteDuplicatePersonals(rows: WorkspaceRow[]): WorkspaceRow[] {
  return rows.map((r) =>
    r.workspace_type === 'personal' && !r.is_default
      ? { ...r, workspace_type: 'team' as const }
      : r,
  );
}

describe('sort_order backfill — JS port matches SQL determinism', () => {
  it('assigns 0..N-1 per user, ordered by created_at then id', () => {
    const rows: MembershipRow[] = [
      { id: 'm-3', user_id: 'u1', created_at: '2024-03-01' },
      { id: 'm-1', user_id: 'u1', created_at: '2024-01-01' },
      { id: 'm-2', user_id: 'u1', created_at: '2024-02-01' },
      { id: 'n-1', user_id: 'u2', created_at: '2024-01-01' },
    ];
    const out = backfillSortOrder(rows);
    expect(out.get('m-1')).toBe(0);
    expect(out.get('m-2')).toBe(1);
    expect(out.get('m-3')).toBe(2);
    expect(out.get('n-1')).toBe(0); // separate user, separate sequence
  });

  it('deterministically tie-breaks by id when created_at is identical', () => {
    const rows: MembershipRow[] = [
      { id: 'm-b', user_id: 'u1', created_at: '2024-01-01' },
      { id: 'm-a', user_id: 'u1', created_at: '2024-01-01' },
      { id: 'm-c', user_id: 'u1', created_at: '2024-01-01' },
    ];
    const out = backfillSortOrder(rows);
    expect(out.get('m-a')).toBe(0);
    expect(out.get('m-b')).toBe(1);
    expect(out.get('m-c')).toBe(2);
  });
});

describe('is_default backfill — JS port matches SQL determinism', () => {
  it('picks is_home=TRUE workspace as default for a business org with a Home', () => {
    const rows: WorkspaceRow[] = [
      { id: 'a', organization_id: 'o1', name: 'Other', workspace_type: 'team', is_home: false, is_default: null, created_at: '2024-01-01' },
      { id: 'b', organization_id: 'o1', name: 'Home Workspace', workspace_type: 'team', is_home: true, is_default: null, created_at: '2024-02-01' },
    ];
    const out = backfillIsDefault(rows);
    const def = out.filter((r) => r.is_default === true);
    expect(def).toHaveLength(1);
    expect(def[0].id).toBe('b');
  });

  it('picks the single workspace_type=personal workspace as default for a personal org', () => {
    const rows: WorkspaceRow[] = [
      { id: 'a', organization_id: 'o1', name: 'My Calls', workspace_type: 'personal', is_home: false, is_default: null, created_at: '2024-01-01' },
      { id: 'b', organization_id: 'o1', name: 'Other', workspace_type: 'team', is_home: false, is_default: null, created_at: '2024-01-15' },
    ];
    const out = backfillIsDefault(rows);
    const def = out.filter((r) => r.is_default === true);
    expect(def).toHaveLength(1);
    expect(def[0].id).toBe('a');
  });

  it("Andrew's AI Simple case: oldest personal becomes is_default; duplicate personals are NOT default", () => {
    // Andrew has two personals in AI Simple — the migration should pick the oldest.
    const rows: WorkspaceRow[] = [
      { id: 'p2', organization_id: 'oS', name: 'Duplicate Personal', workspace_type: 'personal', is_home: false, is_default: null, created_at: '2024-08-01' },
      { id: 'p1', organization_id: 'oS', name: 'My Calls', workspace_type: 'personal', is_home: false, is_default: null, created_at: '2024-01-01' },
      { id: 't1', organization_id: 'oS', name: 'Team Stuff', workspace_type: 'team', is_home: false, is_default: null, created_at: '2024-03-01' },
    ];
    const afterDefault = backfillIsDefault(rows);
    const def = afterDefault.filter((r) => r.is_default === true);
    expect(def).toHaveLength(1);
    expect(def[0].id).toBe('p1'); // oldest personal wins

    // Demote step: the other personal becomes 'team' (deletable)
    const afterDemote = demoteDuplicatePersonals(afterDefault);
    const p2After = afterDemote.find((r) => r.id === 'p2')!;
    expect(p2After.workspace_type).toBe('team');
    expect(p2After.is_default).toBeFalsy();
    // The default personal stays personal AND is_default
    const p1After = afterDemote.find((r) => r.id === 'p1')!;
    expect(p1After.workspace_type).toBe('personal');
    expect(p1After.is_default).toBe(true);
  });

  it('deterministically tie-breaks by id when timestamps are identical', () => {
    const rows: WorkspaceRow[] = [
      { id: 'b', organization_id: 'o1', name: 'B', workspace_type: 'team', is_home: false, is_default: null, created_at: '2024-01-01' },
      { id: 'a', organization_id: 'o1', name: 'A', workspace_type: 'team', is_home: false, is_default: null, created_at: '2024-01-01' },
    ];
    const out = backfillIsDefault(rows);
    expect(out.find((r) => r.id === 'a')!.is_default).toBe(true);
    expect(out.find((r) => r.id === 'b')!.is_default).toBeFalsy();
  });

  it('idempotency: skip orgs that already have an is_default workspace', () => {
    const rows: WorkspaceRow[] = [
      { id: 'a', organization_id: 'o1', name: 'A', workspace_type: 'team', is_home: false, is_default: true, created_at: '2024-01-01' },
      { id: 'b', organization_id: 'o1', name: 'B', workspace_type: 'personal', is_home: true, is_default: null, created_at: '2024-02-01' },
    ];
    const out = backfillIsDefault(rows);
    // 'a' already had is_default=true, 'b' (which would normally win on is_home priority) is NOT touched.
    expect(out.find((r) => r.id === 'a')!.is_default).toBe(true);
    expect(out.find((r) => r.id === 'b')!.is_default).toBeFalsy();
  });

  it('exactly one is_default per organization across mixed orgs', () => {
    const rows: WorkspaceRow[] = [
      { id: 'a1', organization_id: 'o1', name: 'A1', workspace_type: 'team', is_home: true, is_default: null, created_at: '2024-01-01' },
      { id: 'a2', organization_id: 'o1', name: 'A2', workspace_type: 'team', is_home: false, is_default: null, created_at: '2024-02-01' },
      { id: 'b1', organization_id: 'o2', name: 'B1', workspace_type: 'personal', is_home: false, is_default: null, created_at: '2024-01-01' },
      { id: 'b2', organization_id: 'o2', name: 'B2', workspace_type: 'team', is_home: false, is_default: null, created_at: '2024-02-01' },
    ];
    const out = backfillIsDefault(rows);
    const byOrg = new Map<string, number>();
    for (const r of out) {
      if (r.is_default === true) byOrg.set(r.organization_id, (byOrg.get(r.organization_id) ?? 0) + 1);
    }
    expect(byOrg.get('o1')).toBe(1);
    expect(byOrg.get('o2')).toBe(1);
  });
});
