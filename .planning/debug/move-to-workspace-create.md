---
slug: move-to-workspace-create
status: resolved
trigger: "Move to Workspace picker has no create-new-workspace path, unlike Move/Copy to Organization create-new-organization flow."
created: "2026-05-28"
updated: "2026-05-28"
---

# Debug: move-to-workspace-create

## Symptoms

- Expected behavior: From bulk/row Move to Workspace, if the target workspace does not exist, the user can create it inline and continue the move without exiting the flow.
- Actual behavior: The workspace picker only lists existing workspaces, so the user must close the move dialog, create a workspace elsewhere, then restart the move.
- Error messages: None.
- Timeline: Existing UI gap; the organization copy/move dialog already has the comparable create-new-organization path.
- Reproduction: Select one or more calls, choose Move to Workspace, open Target Workspace.

## Current Focus

- hypothesis: `MoveToWorkspaceDialog` has a static workspace `Select` and does not reuse `CreateWorkspaceDialog`, even though that dialog supports `onWorkspaceCreated`.
- test: Add a create-new sentinel item, open `CreateWorkspaceDialog`, set `targetWorkspaceId` from `onWorkspaceCreated`, then confirm the move mutation uses the created workspace id.
- expecting: User can create a workspace from the move flow and immediately click Move/Copy after creation.
- next_action: Run focused component test and build/type verification.

## Evidence

- timestamp: 2026-05-28
  finding: `CopyToOrganizationDialog` includes a `__create_new__` select item and auto-selects the created org id.
  files:
    - src/components/dialogs/CopyToOrganizationDialog.tsx
- timestamp: 2026-05-28
  finding: `CreateWorkspaceDialog` already exposes `onWorkspaceCreated?: (workspaceId: string) => void`.
  files:
    - src/components/dialogs/CreateWorkspaceDialog.tsx
- timestamp: 2026-05-28
  finding: `MoveToWorkspaceDialog` only rendered existing workspace options before the fix.
  files:
    - src/components/dialogs/MoveToWorkspaceDialog.tsx

## Eliminated

- hypothesis: A new workspace creation service is needed.
  reason: Existing `CreateWorkspaceDialog` and `useCreateWorkspace` already handle creation and cache invalidation.

## Resolution

- root_cause: `MoveToWorkspaceDialog` only rendered existing workspace options and had no create-workspace branch, while the comparable organization dialog already had a create-new sentinel path.
- fix: Added a `Create new workspace...` select item that opens the existing `CreateWorkspaceDialog`; when `onWorkspaceCreated` returns the new id, the move dialog stores it as `targetWorkspaceId` so the user can immediately finish the move/copy.
- verification: `npm test -- MoveToWorkspaceDialog.test.tsx`; `npm run build`; browser smoke against localhost confirmed the real Move to Workspace dropdown shows `Create new workspace...`.
- files_changed:
  - src/components/dialogs/MoveToWorkspaceDialog.tsx
  - src/components/dialogs/__tests__/MoveToWorkspaceDialog.test.tsx
