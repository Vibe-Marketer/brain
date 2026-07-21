---
phase: quick-260721-rcv
plan: 01
status: complete
subsystem: workspace-data-movement
tags: [workspaces, cross-org, move-dialog, tanstack-query]
dependency-graph:
  requires: []
  provides:
    - useAllUserWorkspaces
    - moveRecordingsToTargetWorkspace
    - useMoveRecordings
  affects:
    - src/components/dialogs/MoveToWorkspaceDialog.tsx
tech-stack:
  added: []
  patterns:
    - "cross-org query scope fix (drop client-side org filter, add dedicated query key)"
    - "same-org vs cross-org mutation dispatcher (route by target.organizationId === sourceOrgId)"
key-files:
  created: []
  modified:
    - src/hooks/useWorkspaces.ts
    - src/services/data-movement.service.ts
    - src/hooks/useDataMovement.ts
    - src/lib/query-config.ts
    - src/services/__tests__/data-movement.service.test.ts
    - src/components/dialogs/MoveToWorkspaceDialog.tsx
    - src/components/dialogs/__tests__/MoveToWorkspaceDialog.test.tsx
decisions:
  - "Kept useWorkspaces(orgId) and useOrganizationWorkspaces(orgId) untouched — added a new useAllUserWorkspaces() hook rather than modifying the org-scoped ones, so no other callers of the existing hooks are affected."
  - "Freshly created workspace (via 'Create new workspace…' in the picker) is assumed to belong to activeOrgId, since CreateWorkspaceDialog is scoped to activeOrgId — constructed a minimal WorkspaceWithMeta object with the known id/organization_id rather than waiting on a refetch."
metrics:
  duration: ~25min
  completed: 2026-07-21
---

# Phase quick-260721-rcv Plan 01: Fix cross-org workspace move picker Summary

Fixed the "Move to Workspace" picker sourcing its workspace list from a single active-org scoped query (which showed "no workspaces" for users whose active org only contained the source workspace), and added a same-org/cross-org routing dispatcher so cross-org moves go through the existing `copy_recording_to_org` RPC instead of a same-org-only `workspace_entries` write.

## What Was Built

**Task 1 — Data layer:**
- `useAllUserWorkspaces()` in `src/hooks/useWorkspaces.ts` — reuses the exact `workspace_memberships` select shape from `useWorkspaces()` but drops the `organization_id === orgId` filter, so it returns every workspace the caller has a membership row for across all organizations. RLS on `workspace_memberships` still scopes rows to the caller.
- `moveRecordingsToTargetWorkspace()` in `src/services/data-movement.service.ts` — dispatcher that checks `target.organizationId === options.sourceOrgId`. Same-org: delegates to the existing `moveRecordingsToWorkspace()` (unchanged workspace_entries upsert/delete). Cross-org: loops `copy_recording_to_org` RPC per recording with `p_delete_original: !keepInSource`, propagating RPC errors verbatim (`Failed to move recording N of M: <msg>`).
- `useMoveRecordings()` in `src/hooks/useDataMovement.ts` — mutation hook wrapping the dispatcher with the same cache-invalidation footprint as the existing move/copy hooks (workspaces, workspace-entries, calls, tag-calls, source+target workspace recordings) and a Moved/Copied toast.
- New `queryKeys.workspaces.allForUser()` key in `src/lib/query-config.ts`.
- Existing `useWorkspaces`, `useOrganizationWorkspaces`, `useMoveToWorkspace`, `useCopyToOrganization` left untouched — no other callers affected.

**Task 2 — Dialog wiring:**
- `MoveToWorkspaceDialog` now sources its picker from `useAllUserWorkspaces()` instead of `useWorkspaces(activeOrgId)`.
- Selected workspace tracked as the full `WorkspaceWithMeta` object (not just an id string) so `organization_id` is available for routing.
- Select options grouped by organization via Radix `SelectGroup`/`SelectLabel`, with the active org's group suffixed `(current)`; org display names resolved via `useOrganizations()`.
- Move now routes through `useMoveRecordings()`, passing `target: { workspaceId, organizationId }` and `options: { sourceOrgId: activeOrgId, sourceWorkspaceId, keepInSource }`.
- Info copy switches based on whether the selected target is cross-org, matching `CopyToOrganizationDialog`'s "metadata does not travel" wording for cross-org moves.
- "Create new workspace…" flow preserved — still scoped to `activeOrgId`.

## Deviations from Plan

None — plan executed exactly as written. Both tasks matched the plan's `<action>` blocks; no Rule 1-4 fixes were needed.

## Verification

```
npx vitest run src/services/__tests__/data-movement.service.test.ts src/components/dialogs/__tests__/MoveToWorkspaceDialog.test.tsx
→ PASS (20) FAIL (0)

npx tsc -p tsconfig.app.json --noEmit
→ 319 pre-existing errors in 97 unrelated files (panelStore.test.ts, tags.service.ts, preferencesStore.ts,
  types/folders.ts, types/index.ts — none touch this plan's files). Zero errors in any of the 6 files
  this plan modified (grep confirmed empty).
```

## Self-Check: PASSED

- FOUND: src/hooks/useWorkspaces.ts (useAllUserWorkspaces exported, verified via commit 85c7e8e0)
- FOUND: src/services/data-movement.service.ts (moveRecordingsToTargetWorkspace exported, verified via commit 85c7e8e0)
- FOUND: src/hooks/useDataMovement.ts (useMoveRecordings exported, verified via commit 85c7e8e0)
- FOUND: src/components/dialogs/MoveToWorkspaceDialog.tsx (wired to useAllUserWorkspaces/useMoveRecordings, verified via commit a4d0dc6c)
- FOUND commit 85c7e8e0 (git log --oneline -5)
- FOUND commit a4d0dc6c (git log --oneline -5)
