# Folders & Workspace Filtering — Root Cause Diagnosis and Fixes

**Date:** 2026-03-03
**Status:** In Progress
**Scope:** brain repo — frontend queries + database migration

## Summary

Two separate systems are broken:

1. **Folders show 0 calls** despite the user having organized hundreds of calls into them previously. The assignment data still exists in the database — the query can't find it because `folders.workspace_id` is NULL (failed migration backfill).

2. **Workspace switching does nothing** — clicking YouTube, Fathom, or any other workspace still shows the same unfiltered call list. Three compounding bugs prevent workspace filtering from ever executing.

---

## PART 1: FOLDERS — Why All Folders Show 0 Calls

### Root Cause
The folder-to-call assignment data is **still in the database**. It was NOT deleted. The query silently returns empty because `folders.workspace_id` is NULL on existing folders.

### Fix Status
- [x] Create Supabase migration `20260303000002_fix_orphaned_folders.sql` to backfill `workspace_id` on folders that have `organization_id` but NULL `workspace_id`.
- [x] In `src/services/folders.service.ts`, the `getFolderAssignments` function falls back to querying by `organization_id` when no workspace match is found.
- [x] In `src/hooks/useFolders.ts`, verified `enabled` guard passes `organizationId`.
- [x] QuickCreateFolderDialog enforces workspace_id on creation.

---

## PART 2: WORKSPACES — Why Switching Workspaces Does Nothing

### Root Cause
Three bugs work together to prevent workspace filtering from ever executing:
Bug 2A — Personal Org Guard Blocks ALL Workspace Filtering
Bug 2B — YouTube Records Don't Exist in `fathom_calls`
Bug 2C — Unconditional YouTube Exclusion Filter

### Correct Architecture
Each workspace type should have its own rendering path:
- Fathom: `fathom_calls`
- YouTube/Zoom/Uploads: `recordings` via `workspace_entries`

### Current Status
In `TranscriptsTab.tsx`:
- [ ] Remove `!isPersonalOrganization` guard
- [ ] Use `useWorkspaceRecordings(workspaceId)` when workspace is selected
- [ ] Remove unconditional YouTube exclusion

