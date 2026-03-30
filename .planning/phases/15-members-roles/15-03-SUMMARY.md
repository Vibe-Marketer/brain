---
phase: 15-members-roles
plan: 03
subsystem: workspace-settings
tags: [workspace, danger-zone, deletion, settings, type-selection]
dependency_graph:
  requires: [15-01]
  provides: [workspace-advanced-settings, workspace-deletion, workspace-type-creation]
  affects: [WorkspaceDetailPanel, CreateWorkspaceDialog]
tech_stack:
  added: []
  patterns: [collapsible-section, owner-only-gate, dialog-trigger, select-enum]
key_files:
  created: []
  modified:
    - src/components/panels/WorkspaceDetailPanel.tsx
    - src/components/dialogs/CreateWorkspaceDialog.tsx
decisions:
  - "Advanced settings collapsible uses useState toggle — same pattern as SourceInfoSection, not Radix Collapsible"
  - "Danger Zone hidden (not disabled) for non-owners — consistent with hide-what-you-cant-do philosophy"
  - "Default workspace shows cannot-delete message rather than a disabled button — clearer UX"
  - "Type selector placed above name input — choose type first, then name logical ordering"
metrics:
  duration: 93s
  tasks_completed: 2
  files_modified: 2
  completed_date: 2026-03-30
---

# Phase 15 Plan 03: Advanced Settings and Workspace Type Selection Summary

Advanced settings panel in Pane 4 with collapsible workspace info, Owner-only danger zone wired to DeleteWorkspaceDialog, and Personal/Team type selection added to workspace creation.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Wire advanced settings into WorkspaceDetailPanel with danger zone | cb0d92df |
| 2 | Add workspace type selection to CreateWorkspaceDialog | f02dfe31 |

## What Was Built

### Task 1 — WorkspaceDetailPanel Advanced Settings

Replaced the placeholder "Advanced Settings" button with a real collapsible section using `useState` toggle (same pattern as `SourceInfoSection`):

- **Workspace Info subsection:** Type displayed as a `Badge` (capitalized), created date formatted with `date-fns`
- **Danger Zone subsection:** Only rendered when `workspace.user_role === 'workspace_owner'` (hidden for all other roles)
  - Red-tinted container: `bg-destructive/5 border border-destructive/20 rounded-xl`
  - Default workspaces show "Default workspaces cannot be deleted." text instead of the delete button
  - Non-default workspaces show a destructive "Delete Workspace" button that opens `DeleteWorkspaceDialog`
- `DeleteWorkspaceDialog` imported and rendered in the panel with `workspace` prop and state toggle

### Task 2 — CreateWorkspaceDialog Type Selection

- Added `workspaceType` state (`useState<'personal' | 'team'>('team')`)
- Added `Select` component above workspace name input with "Personal" and "Team" options
- Selected type passed directly to `useCreateWorkspace.mutate()` (no longer hardcoded `'team'`)
- State reset to `'team'` on successful creation
- Coach, community, client, youtube types excluded per REQUIREMENTS.md out-of-scope

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all functionality is fully wired with real data.

## Self-Check: PASSED

- `src/components/panels/WorkspaceDetailPanel.tsx` — FOUND
- `src/components/dialogs/CreateWorkspaceDialog.tsx` — FOUND
- Commit `cb0d92df` — FOUND
- Commit `f02dfe31` — FOUND
- `npx tsc --noEmit` — PASSED
