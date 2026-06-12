import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(__dirname, '../../..');

function readMigration(filename: string): string {
  return readFileSync(resolve(REPO_ROOT, 'supabase/migrations', filename), 'utf-8');
}

describe('workspace slug tombstone cascade guard', () => {
  const migration = readMigration('20260613150000_fix_workspace_slug_tombstone_org_cascade.sql');

  it('keeps standalone default-workspace deletion protection', () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.prevent_default_workspace_delete\(\)/);
    expect(migration).toMatch(/IF OLD\.is_default = TRUE/);
    expect(migration).toMatch(/RAISE EXCEPTION 'Cannot delete the default workspace'/);
  });

  it('allows default workspace deletion when it is part of an org-delete cascade', () => {
    const defaultWorkspaceFunction = migration.match(
      /CREATE OR REPLACE FUNCTION public\.prevent_default_workspace_delete\(\)[\s\S]*?\$\$;/,
    );
    expect(defaultWorkspaceFunction).not.toBeNull();
    expect(defaultWorkspaceFunction![0]).toMatch(
      /EXISTS\s*\(\s*SELECT 1\s+FROM public\.organizations\s+WHERE id = OLD\.organization_id\s*\)/,
    );
    expect(migration).toMatch(/Allows org-delete cascades/);
  });

  it('keeps standalone workspace-delete tombstoning behavior', () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.tombstone_workspace_slug\(\)/);
    expect(migration).toMatch(/IF OLD\.slug IS NOT NULL/);
    expect(migration).toMatch(/INSERT INTO public\.workspace_slug_tombstone \(org_id, slug\)/);
    expect(migration).toMatch(/VALUES \(OLD\.organization_id, OLD\.slug\)/);
    expect(migration).toMatch(/ON CONFLICT \(org_id, slug\) DO NOTHING/);
  });

  it('skips workspace tombstones when the parent org is already gone in a cascade', () => {
    expect(migration).toMatch(
      /EXISTS\s*\(\s*SELECT 1\s+FROM public\.organizations\s+WHERE id = OLD\.organization_id\s*\)/,
    );
    expect(migration).toMatch(/Skips org-delete cascades to avoid FK 23503/);
  });
});
