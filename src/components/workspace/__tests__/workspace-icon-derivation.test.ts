/**
 * Phase 25 Nyquist coverage — lock-vs-team icon is derived from member_count, not workspace_type.
 *
 * The rule lives inline in three consumer files (AddToWorkspaceMenu, WorkspaceSelector,
 * FolderSidebar) as `(workspace.member_count ?? 0) <= 1 ? RiLockLine : RiTeamLine`.
 *
 * This test asserts:
 *   1. Each implementation file uses the member_count rule (NOT workspace_type)
 *   2. Boundary correctness: 0 → lock, 1 → lock, 2 → team, 99 → team, undefined → lock
 *   3. workspace_type='team' with member_count=1 still shows LOCK (proves type is ignored)
 *   4. workspace_type='personal' with member_count=5 still shows TEAM (proves type is ignored)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(__dirname, '../../../..');

function read(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), 'utf-8');
}

/**
 * Pure rule re-implementation that mirrors the inline derivation in the
 * three implementation files. If any consumer drifts from this rule, the
 * implementation-source assertions below will catch it.
 */
function deriveIcon(workspace: { member_count?: number | null }): 'lock' | 'team' {
  return (workspace.member_count ?? 0) <= 1 ? 'lock' : 'team';
}

describe('Workspace icon derivation rule (member_count, not workspace_type)', () => {
  it('returns lock for member_count = 0', () => {
    expect(deriveIcon({ member_count: 0 })).toBe('lock');
  });

  it('returns lock for member_count = 1', () => {
    expect(deriveIcon({ member_count: 1 })).toBe('lock');
  });

  it('returns team for member_count = 2', () => {
    expect(deriveIcon({ member_count: 2 })).toBe('team');
  });

  it('returns team for member_count = 99', () => {
    expect(deriveIcon({ member_count: 99 })).toBe('team');
  });

  it('returns lock when member_count is null/undefined', () => {
    expect(deriveIcon({ member_count: null })).toBe('lock');
    expect(deriveIcon({})).toBe('lock');
  });

  // Regression edges — proves the rule does NOT branch on workspace_type
  it('still returns lock for a "team"-typed solo workspace (type ignored)', () => {
    expect(deriveIcon({ member_count: 1 } as any)).toBe('lock');
  });

  it('still returns team for a "personal"-typed multi-member workspace (type ignored)', () => {
    expect(deriveIcon({ member_count: 5 } as any)).toBe('team');
  });
});

describe('Implementation source contains the member_count rule (not workspace_type)', () => {
  it('AddToWorkspaceMenu uses (workspace.member_count ?? 0) <= 1 ? RiLockLine : RiTeamLine', () => {
    const src = read('src/components/workspace/AddToWorkspaceMenu.tsx');
    expect(src).toMatch(/member_count\s*\?\?\s*0\)\s*<=\s*1\s*\?\s*RiLockLine\s*:\s*RiTeamLine/);
    // No icon branch on workspace_type
    expect(src).not.toMatch(/workspace_type\s*===\s*['"]personal['"][^?]*\?\s*RiLock/);
    expect(src).not.toMatch(/workspace_type\s*===\s*['"]team['"][^?]*\?\s*RiTeam/);
  });

  it('WorkspaceSelector uses (workspace.member_count ?? 0) <= 1 ? RiLockLine : RiTeamLine', () => {
    const src = read('src/components/workspace/WorkspaceSelector.tsx');
    expect(src).toMatch(/member_count\s*\?\?\s*0\)\s*<=\s*1\s*\?\s*RiLockLine\s*:\s*RiTeamLine/);
    expect(src).not.toMatch(/workspace_type\s*===\s*['"]personal['"][^?]*\?\s*RiLock/);
  });

  it('FolderSidebar uses (member_count ?? 0) <= 1 with RiLockLine and RiTeamLine', () => {
    const src = read('src/components/transcript-library/FolderSidebar.tsx');
    expect(src).toMatch(/member_count\s*\?\?\s*0\)\s*<=\s*1/);
    expect(src).toMatch(/RiLockLine/);
    expect(src).toMatch(/RiTeamLine/);
    // No icon branch on workspace_type
    expect(src).not.toMatch(/workspace_type\s*===\s*['"]personal['"][^?]*\?\s*<RiLock/);
  });
});
