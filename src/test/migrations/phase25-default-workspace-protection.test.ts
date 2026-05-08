/**
 * Phase 25 Nyquist coverage — WS-04: each org has exactly one is_default=TRUE workspace,
 * and the default workspace cannot be deleted via UI OR API.
 *
 * Three independent layers must enforce this:
 *   1. DB level — partial UNIQUE index workspaces_one_default_per_org_idx
 *   2. RPC level — delete_workspace raises 'Cannot delete the default workspace.' as
 *      the FIRST check before any DELETE
 *   3. UI level — WorkspaceSidebarPane and EditWorkspaceDialog hide the "Delete" affordance
 *      when workspace.is_default is true
 *
 * The migration-level invariants are covered in phase25-workspace-type-retirement.test.ts.
 * This file covers the UI guard layer at the source level.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(__dirname, '../../..');
function readSrc(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), 'utf-8');
}

describe('WS-04 UI guard — default workspace cannot be deleted', () => {
  it('WorkspaceSidebarPane hides "Delete Workspace" with !workspace.is_default check', () => {
    const src = readSrc('src/components/panes/WorkspaceSidebarPane.tsx');

    // Confirm the delete-option guard reads !workspace.is_default
    expect(src).toMatch(/canManage\s*&&\s*!workspace\.is_default/);

    // The literal "Delete Workspace" menu item exists nearby (otherwise the guard guards nothing)
    expect(src).toMatch(/Delete Workspace/);

    // Legacy guard form must NOT remain
    expect(src).not.toMatch(/workspace_type\s*!==\s*['"]personal['"]/);
  });

  it('EditWorkspaceDialog hides delete button with !workspace.is_default check', () => {
    const src = readSrc('src/components/dialogs/EditWorkspaceDialog.tsx');

    // Guard combines a generic canDelete prop with !workspace.is_default
    expect(src).toMatch(/canDelete\s*&&\s*!workspace\.is_default/);
    expect(src).toMatch(/Delete Workspace/);

    // No legacy workspace_type=personal branch
    expect(src).not.toMatch(/workspace_type\s*!==\s*['"]personal['"]/);
    expect(src).not.toMatch(/workspace_type\s*===\s*['"]personal['"]/);
  });

  it('migration enforces one is_default per org via partial UNIQUE index', () => {
    const sql = readSrc('supabase/migrations/20260507052421_workspace_type_retirement.sql');
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS workspaces_one_default_per_org_idx[\s\S]{0,200}WHERE is_default = TRUE/,
    );
  });

  it('delete_workspace RPC raises an error before deleting an is_default workspace', () => {
    const sql = readSrc('supabase/migrations/20260507052421_workspace_type_retirement.sql');
    const rpc = sql.match(
      /CREATE OR REPLACE FUNCTION public\.delete_workspace\([\s\S]*?\$\$;/,
    );
    expect(rpc).not.toBeNull();
    const body = rpc![0];

    // Guard must use is_default and RAISE EXCEPTION
    expect(body).toMatch(
      /SELECT COALESCE\(is_default, FALSE\) INTO v_is_default[\s\S]*?IF v_is_default THEN[\s\S]*?RAISE EXCEPTION 'Cannot delete the default workspace\.'/,
    );

    // Guard appears before the role check
    const guardIdx = body.indexOf("Cannot delete the default workspace");
    const roleIdx = body.indexOf("You are not a member of this workspace");
    const ownerIdx = body.indexOf("Only workspace owners can delete a workspace");
    expect(guardIdx).toBeLessThan(roleIdx);
    expect(guardIdx).toBeLessThan(ownerIdx);

    // Guard appears before any DELETE statement
    const deleteIdx = body.search(/\bDELETE FROM\b/);
    expect(deleteIdx).toBeGreaterThan(-1);
    expect(guardIdx).toBeLessThan(deleteIdx);
  });
});
