---
phase: "07"
plan: "01"
subsystem: "folder-assignment-service"
tags: [folder, uuid, workspace_entries, service-layer, recording-ids]
dependency_graph:
  requires: []
  provides:
    - assignWorkspaceEntryToFolder (folders.service.ts)
    - removeWorkspaceEntryFromFolder (folders.service.ts)
    - getAssignedWorkspaceEntryFolderUuids (transcript-filters.service.ts)
    - fixed getRecordingIdsForFolderFilter (transcript-filters.service.ts)
  affects:
    - src/services/folders.service.ts
    - src/services/transcript-filters.service.ts
tech_stack:
  added: []
  patterns:
    - dual-source folder read (workspace_entries + folder_assignments)
    - UUID-only workspace_entries upsert/update for non-Fathom recordings
key_files:
  created: []
  modified:
    - src/services/folders.service.ts
    - src/services/transcript-filters.service.ts
decisions:
  - "assignWorkspaceEntryToFolder writes only to workspace_entries — no folder_assignments touch, preventing FK violation against fathom_raw_calls for non-Fathom UUIDs"
  - "getRecordingIdsForFolderFilter now matches the dual-source getWorkspaceFolderRecordingIds pattern, querying both workspace_entries.folder_id and folder_assignments"
  - "getAssignedFolderLegacyRecordingIds retained for backward compat; call sites migrate in 07-02"
metrics:
  duration: "4 minutes"
  completed: "2026-06-09T16:35:36Z"
  tasks_completed: 2
  files_modified: 2
---

# Phase 07 Plan 01: UUID Folder Write/Remove Functions and Dual-Source Read Fix Summary

UUID-only folder assign/remove via workspace_entries plus dual-source folder filter read matching getWorkspaceFolderRecordingIds pattern.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add assignWorkspaceEntryToFolder + removeWorkspaceEntryFromFolder to folders.service.ts | 3af8a4c | src/services/folders.service.ts |
| 2 | Fix getRecordingIdsForFolderFilter + add getAssignedWorkspaceEntryFolderUuids in transcript-filters.service.ts | 2e0d10b | src/services/transcript-filters.service.ts |

## What Was Built

**folders.service.ts — two new exports:**
- `assignWorkspaceEntryToFolder(recordingUuid, folderId, workspaceId)`: upserts `workspace_entries` with `folder_id` set using `(workspace_id, recording_id)` conflict key. No `folder_assignments` write — the FK on that table points to `fathom_raw_calls`, which has no row for non-Fathom recordings. Writing `parseInt(uuid) = NaN` was silently filtered before, producing a false success toast.
- `removeWorkspaceEntryFromFolder(recordingUuid, folderId, workspaceId)`: nulls `workspace_entries.folder_id` for the matching triple.

**transcript-filters.service.ts — one fix, one new export:**
- `getRecordingIdsForFolderFilter` was only reading `folder_assignments` (legacy BIGINT path), so UUID-assigned recordings (Zoom, manual paste, MCP import) were invisible to the multi-folder filter. Fixed to query both `workspace_entries.folder_id` and `folder_assignments`, then merge and deduplicate — exactly matching the `getWorkspaceFolderRecordingIds` pattern at lines 59-90.
- `getAssignedWorkspaceEntryFolderUuids()` returns `Set<string>` of all recording UUIDs with a non-null `folder_id` in `workspace_entries` plus all legacy assignments resolved to UUIDs. Required by Plan 07-02 to fix the "unorganized" filter which currently misses UUID-assigned recordings.

## Verification

- `npm run type-check` — zero TS errors (confirmed twice, before and after both tasks)
- Both new `folders.service.ts` exports confirmed at lines 563 and 583
- `workspace_entries` appears in `getRecordingIdsForFolderFilter` (line 98) and `getAssignedWorkspaceEntryFolderUuids` (line 131)

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries introduced. Both functions use the existing authenticated `supabase` client; RLS on `workspace_entries` enforces org ownership (T-07-02 accepted).

Threat T-07-01 (recordingUuid must be validated by caller using `isRecordingUuid()` before passing): this is a caller-side obligation — no validation added inside the service functions per plan spec. Callers in 07-02 should enforce this.

## Self-Check: PASSED
