---
phase: 15-members-roles
plan: "01"
subsystem: workspace-roles
tags: [workspace, roles, migration, typescript, rls]
dependency_graph:
  requires: []
  provides: [4-role-workspace-model, contributor-type, role-migration]
  affects: [workspace_memberships, workspace_invitations, WorkspaceMemberPanel, ChangeRoleDialog, WorkspaceInviteDialog]
tech_stack:
  added: []
  patterns: [text-check-constraint-migration, owner-self-demotion-guard]
key_files:
  created:
    - supabase/migrations/20260330200000_align_workspace_roles_5_to_4.sql
  modified:
    - src/types/workspace.ts
    - src/hooks/useWorkspaces.ts
    - src/hooks/useWorkspaceMemberMutations.ts
    - src/components/panels/WorkspaceMemberPanel.tsx
    - src/components/dialogs/ChangeRoleDialog.tsx
    - src/components/dialogs/WorkspaceInviteDialog.tsx
decisions:
  - "contributor replaces manager — aligns with v2.0 4-role model decision"
  - "guest upgraded to member in migration (not dropped outright) — prevents data loss"
  - "organization_memberships constraint updated to org-specific roles only (not workspace roles)"
  - "ChangeRoleDialog owner self-demotion guard via isOwnerSelf flag hides radio group"
metrics:
  duration: ~8m
  completed: 2026-03-30
  tasks_completed: 2
  files_modified: 7
---

# Phase 15 Plan 01: Align Workspace Roles 5→4 Summary

**One-liner:** DB migration and full TypeScript + UI alignment converting 5-role workspace model (owner/admin/manager/member/guest) to 4-role model (owner/admin/contributor/member).

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | DB migration — rename manager to contributor, drop guest | 9661afa1 | supabase/migrations/20260330200000_align_workspace_roles_5_to_4.sql |
| 2 | Update TypeScript types and all role constants across codebase | c99f43bd | 6 frontend files |

## What Was Built

### Task 1: DB Migration

The migration at `supabase/migrations/20260330200000_align_workspace_roles_5_to_4.sql` does:

1. `UPDATE workspace_memberships SET role = 'contributor' WHERE role = 'manager'`
2. `UPDATE workspace_memberships SET role = 'member' WHERE role = 'guest'`
3. Drops old 5-role CHECK constraint, adds new 4-role constraint
4. Fixes `organization_memberships` constraint to org-specific roles (was including workspace-role names)
5. Updates `workspace_invitations` constraint: removes manager/guest, adds contributor
6. Recreates 3 RLS policies on `workspace_entries` that referenced 'manager': create/update/delete now use 'contributor'

### Task 2: TypeScript + UI Updates

- `WorkspaceRole` type: `'workspace_owner' | 'workspace_admin' | 'contributor' | 'member'`
- `WorkspaceInvitation.role`: `'member' | 'contributor' | 'workspace_admin'`
- All ROLE_ORDER/ROLE_POWER/ROLE_LABELS/ROLE_BADGE_STYLES records: 4 entries, contributor replaces manager
- `ChangeRoleDialog`: 4 role options with updated descriptions; owner self-demotion guard (isOwnerSelf check hides radio group when target is current user AND role is workspace_owner)
- `WorkspaceInviteDialog`: 3 role select options — Member/Contributor/Admin; manager option removed

## Decisions Made

- **contributor replaces manager** — The v2.0 decision locks this name. "Contributor" better describes the role (adding calls to workspace) vs the v1 "Manager" label which implied people management.
- **guest → member upgrade** — Rather than dropping guest rows, they're upgraded to member (safer, no data loss).
- **org_memberships constraint** — The original migration gave org_memberships roles of owner/admin/manager/member/guest. Fixed to use org-specific names (organization_owner/organization_admin/organization_member) since org and workspace roles are independent.
- **Owner self-demotion guard** — Implemented as `isOwnerSelf` boolean that hides the entire radio group and shows an informational message. Cleaner than disabling individual options since the entire concept is blocked.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing constraint fix] organization_memberships constraint included workspace role names**

- **Found during:** Task 1
- **Issue:** The original `20260301000001` migration set `organization_memberships` CHECK to include 'manager'/'member'/'guest' (workspace role names). Since org roles are a separate domain (organization_owner/admin/member), these workspace role names should never have been in the org constraint.
- **Fix:** Migration replaces org constraint with proper org-specific roles only.
- **Files modified:** supabase/migrations/20260330200000_align_workspace_roles_5_to_4.sql
- **Commit:** 9661afa1

## Known Stubs

None — all role references are wired through to the DB constraint and TypeScript types.

## Self-Check: PASSED

- Migration file exists: FOUND
- TypeScript compiles cleanly: PASSED (0 errors)
- No 'manager' or 'guest' role values in modified TS files: VERIFIED
- contributor appears in workspace.ts: 2 occurrences (WorkspaceRole type + WorkspaceInvitation.role)
