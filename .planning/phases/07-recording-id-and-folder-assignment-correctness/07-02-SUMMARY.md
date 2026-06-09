---
phase: "07"
plan: "02"
subsystem: "folder-assignment-ui"
tags: [folder, uuid, workspace_entries, ui-layer, recording-ids, hooks]
dependency_graph:
  requires:
    - assignWorkspaceEntryToFolder (folders.service.ts) — from 07-01
    - removeWorkspaceEntryFromFolder (folders.service.ts) — from 07-01
    - getAssignedWorkspaceEntryFolderUuids (transcript-filters.service.ts) — from 07-01
  provides:
    - correct dual-source folder load in AssignFolderDialog
    - UUID-aware save in AssignFolderDialog (workspace_entries + folder_assignments dual-write)
    - widened folderingCallId type (number | string | null) in TranscriptsTab
    - UUID-aware unorganized filter in TranscriptsTab
    - UUID-aware useFolderAssignment hooks (all three: assign, remove, move)
  affects:
    - src/components/AssignFolderDialog.tsx
    - src/components/transcripts/TranscriptsTab.tsx
    - src/hooks/useFolderAssignment.ts
tech_stack:
  added: []
  patterns:
    - dual-source folder read (workspace_entries + folder_assignments) in dialog load
    - isLegacyId branch in mutation hooks for UUID vs legacy routing
    - writtenCount guard on success toast
key_files:
  created: []
  modified:
    - src/components/AssignFolderDialog.tsx
    - src/components/transcripts/TranscriptsTab.tsx
    - src/hooks/useFolderAssignment.ts
decisions:
  - "AssignFolderDialog UUID path fetches workspace_id from workspace_entries directly — avoids guessing workspace from allFolders which may be from a different workspace"
  - "UUID save path uses selectedFolders (all selected) not legacySelected (non-personal) — personal folder writes still deferred but UUID assignment should not be limited to non-personal scope"
  - "useFolderAssignment UUID path: moveToFolder = remove-then-assign (two workspace_entries writes) — matches moveCallToFolder behavior for legacy path"
  - "getAssignedFolderLegacyRecordingIds import retained in TranscriptsTab — still used at a separate call site (line 581); only the unorganized filter block (line 665) migrated to getAssignedWorkspaceEntryFolderUuids"
metrics:
  duration: "12 minutes"
  completed: "2026-06-09T16:52:00Z"
  tasks_completed: 2
  files_modified: 3
---

# Phase 07 Plan 02: UI and Hook Layer UUID-Aware Folder Assignment Summary

Fixed AssignFolderDialog (dual-source load + UUID-aware save), TranscriptsTab unorganized filter, and all three useFolderAssignment hooks to accept and route string | number recording IDs.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Fix AssignFolderDialog — dual-source load and UUID-aware save | e707d85, 2d9fae5 | src/components/AssignFolderDialog.tsx |
| 2 | Widen folderingCallId type, fix unorganized filter, widen useFolderAssignment hooks | ace9d2f | src/components/transcripts/TranscriptsTab.tsx, src/hooks/useFolderAssignment.ts |

## What Was Built

**AssignFolderDialog.tsx — two fixes:**
- `loadExistingAssignments`: removed `parseInt` on recording IDs. Now calls `toRecordingUuidBatch(targetRecordingIds)` to split inputs into `legacyIds` and `canonicalUuids`, then queries `folder_assignments` (for legacy) and `workspace_entries` (for UUID) in parallel and merges both result sets. Bulk-mode intersection counts across both sources.
- `handleSave`: removed `parseInt`-based path. Now calls `toRecordingUuidBatch` to resolve IDs; runs the legacy `folder_assignments` upsert/delete path using `legacyIds`; runs the UUID `workspace_entries` diff-write path using `canonicalUuids` (fetches current `folder_id` and `workspace_id` from `workspace_entries`, then assigns/removes based on `selectedFolders` diff). Success toast fires only when `writtenCount > 0`.

**TranscriptsTab.tsx — two fixes:**
- `folderingCallId` state type widened from `number | null` to `number | string | null` — UUID strings no longer truncated by integer type narrowing.
- `onFolderCall` callback: removed `as number` cast.
- Unorganized filter: replaced `getAssignedFolderLegacyRecordingIds()` call with `getAssignedWorkspaceEntryFolderUuids()` — now correctly excludes recordings assigned via `workspace_entries.folder_id` (Zoom, Grain, Read.ai, manual paste) from the "unorganized" bucket.

**useFolderAssignment.ts — three hooks updated:**
- `useAssignToFolder`: `callRecordingId: number | string`; branches on `isLegacyId` → `assignCallToFolder` (legacy) or `assignWorkspaceEntryToFolder` (UUID). Added optional `workspaceId` param.
- `useRemoveFromFolder`: `callRecordingId: number | string`; branches → `removeCallFromFolder` or `removeWorkspaceEntryFromFolder`.
- `useMoveToFolder`: `callRecordingId: number | string`; branches → `moveCallToFolder` (legacy) or `removeWorkspaceEntryFromFolder(from) + assignWorkspaceEntryToFolder(to)` (UUID). Added optional `workspaceId` param.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] AssignFolderDialog UUID save path — workspace_id resolution and selectedFolders scope**
- **Found during:** Task 1 (caught by git hook / linter after initial commit)
- **Issue:** Initial implementation used `allFolders.find(...)?.workspace_id` to look up workspace_id for UUID writes, but `allFolders` is loaded from the `folders` table scoped by org, not by workspace — workspace_id could be wrong or missing. Also used `legacySelected` (non-personal folders only) for the UUID path when it should use all `selectedFolders`.
- **Fix:** UUID path now fetches `workspace_id` directly from `workspace_entries` (the actual row for that recording), ensuring the correct workspace is used. Also switched from `legacySelected` to `selectedFolders` for the UUID assignment loop.
- **Files modified:** src/components/AssignFolderDialog.tsx
- **Commit:** 2d9fae5 (auto-committed by project hook)

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries. All DB writes use the existing authenticated `supabase` client; `isLegacyId`/`isRecordingUuid` validation in hooks enforces T-07-04 (Tampering) mitigation before DB branch. `writtenCount > 0` guard enforces T-07-03 (Spoofing success toast) mitigation.

## Self-Check: PASSED

Files exist:
- src/components/AssignFolderDialog.tsx — FOUND
- src/components/transcripts/TranscriptsTab.tsx — FOUND
- src/hooks/useFolderAssignment.ts — FOUND

Commits exist:
- e707d85 — FOUND (feat(07-02): dual-source load and UUID-aware save in AssignFolderDialog)
- 2d9fae5 — FOUND (feat(07-02): fix AssignFolderDialog handleSave — UUID-aware dual-path write)
- ace9d2f — FOUND (feat(07-02): widen folderingCallId type, fix unorganized filter, widen useFolderAssignment hooks)

npm run type-check — zero TS errors (confirmed)
