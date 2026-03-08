---
phase: 16-workspace-redesign
plan: "04"
subsystem: folder-management
tags: [folders, dnd, tanstack-query, drag-drop, workspace]
dependency_graph:
  requires: ["16-02"]
  provides: [folders.service, useFolders, useFolderAssignment, FolderDropZone, DndCallProvider, DraggableCallRow]
  affects: ["16-03", "16-05", "16-06"]
tech_stack:
  added: ["@dnd-kit/core@6.3.1"]
  patterns: [service+hook separation, optimistic updates with rollback, desktop-only DnD with action menu fallback]
key_files:
  created:
    - /Users/Naegele/dev/callvault/src/services/folders.service.ts
    - /Users/Naegele/dev/callvault/src/hooks/useFolders.ts
    - /Users/Naegele/dev/callvault/src/hooks/useFolderAssignment.ts
    - /Users/Naegele/dev/callvault/src/components/dnd/FolderDropZone.tsx
    - /Users/Naegele/dev/callvault/src/components/dnd/DndCallProvider.tsx
  modified:
    - /Users/Naegele/dev/callvault/package.json
    - /Users/Naegele/dev/callvault/pnpm-lock.yaml
decisions:
  - "DB column is parent_id (not parent_folder_id) — mapped at service layer; Folder interface uses parent_folder_id for consistency"
  - "is_archived/archived_at not in generated supabase.ts types — use any casts with Folder interface from workspace.ts"
  - "folder_assignments uses call_recording_id: number (legacy fathom numeric ID), not UUID"
  - "DndCallProvider renders children without DnD context on mobile/tablet — action menu is the fallback assignment method"
  - "@dnd-kit/core installed via Rule 3 auto-fix (blocking dependency for Task 2)"
metrics:
  duration: "~20 minutes"
  completed: "2026-02-28T04:04:15Z"
  tasks_completed: 2
  files_created: 5
  files_modified: 2
---

# Phase 16 Plan 04: Folder Management Summary

**One-liner:** Workspace-scoped folder CRUD with archive/restore, depth enforcement, and @dnd-kit drag-to-folder assignment (desktop) plus action menu hooks (all devices).

## What Was Built

### Task 1: Folder Service Layer and TanStack Query Hooks

**`src/services/folders.service.ts`** — Complete folder service with 10 functions:
- `getFolders(workspaceId, includeArchived?)` — workspace-scoped query with `vault_id` filter, `is_archived` toggle, position ordering
- `getArchivedFolders(workspaceId)` — archived-only query ordered by `archived_at DESC`
- `createFolder(workspaceId, bankId, userId, name, parentFolderId?)` — creates folder with nesting depth enforcement (max 2 levels via `parent_id` check on parent)
- `renameFolder(folderId, name)` — simple name update
- `archiveFolder(folderId)` — sets `is_archived = true`, `archived_at = NOW()`
- `restoreFolder(folderId)` — sets `is_archived = false`, `archived_at = null`
- `deleteFolder(folderId)` — hard delete with pre-check: refuses if folder has assignments
- `assignCallToFolder(callRecordingId, folderId, userId)` — upsert into `folder_assignments`
- `removeCallFromFolder(callRecordingId, folderId)` — delete from `folder_assignments`
- `moveCallToFolder(callRecordingId, fromFolderId, toFolderId, userId)` — remove + upsert

**`src/hooks/useFolders.ts`** — TanStack Query hooks:
- `useFolders(workspaceId)` — active folders, session-gated, `queryKeys.folders.list(workspaceId)`
- `useArchivedFolders(workspaceId)` — archived folders, separate `['folders', 'archived', workspaceId]` key
- `useCreateFolder()` — mutation with success toast
- `useRenameFolder()` — mutation with optimistic update (immediate name change, rollback on error)
- `useArchiveFolder()` — invalidates both active + archived lists, toast "Folder archived"
- `useRestoreFolder()` — invalidates both lists, toast "Folder restored"

**`src/hooks/useFolderAssignment.ts`** — Assignment hooks:
- `useAssignToFolder()` — mutation wrapping `assignCallToFolder`; toast "Call moved to {folderName}"; invalidates folder detail + recordings
- `useRemoveFromFolder()` — mutation wrapping `removeCallFromFolder`; toast "Call removed from folder"
- `useMoveToFolder()` — mutation wrapping `moveCallToFolder`; invalidates both folder details

### Task 2: Drag-and-Drop Infrastructure

**`src/components/dnd/DndCallProvider.tsx`** — DndContext wrapper with:
- `DndContext` wrapping calls list
- `MouseSensor` with 10px activation distance (prevents accidental drags)
- `TouchSensor` with 250ms delay and 5px tolerance
- `onDragEnd` handler: extracts `recording-{id}` and `folder-{id}` prefixes, calls `useAssignToFolder`
- `DragOverlay` showing lightweight card preview
- Mobile/tablet passthrough (renders children without DnD context — action menu used instead)
- Exported: `DndCallProvider`, `DraggableCallRow`

**`src/components/dnd/FolderDropZone.tsx`** — Drop target with:
- `useDroppable({ id: 'folder-{folder.id}' })`
- Visual hover feedback: `bg-brand-400/10 ring-1 ring-brand-400/40`
- `aria-dropeffect="move"` for screen reader accessibility

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `@dnd-kit/core` not installed**
- **Found during:** Task 2 setup
- **Issue:** `@dnd-kit/core` was not in `package.json`; Task 2 cannot compile without it
- **Fix:** `pnpm add @dnd-kit/core` — installed v6.3.1
- **Files modified:** `package.json`, `pnpm-lock.yaml`
- **Commit:** `c98e4a9` (included with Task 1 commit)

**2. [Rule 1 - Schema discovery] DB uses `parent_id` not `parent_folder_id`**
- **Found during:** Reading `src/types/supabase.ts` (folders table schema)
- **Issue:** Plan specified `parent_folder_id` but the actual DB column is `parent_id`
- **Fix:** Service layer reads `parent_id` from DB and maps to `parent_folder_id` on the `Folder` interface for consistency with the type definition in `workspace.ts`
- **Files modified:** `src/services/folders.service.ts`

**3. [Rule 1 - Schema discovery] `folder_assignments` uses `call_recording_id: number`**
- **Found during:** Reading `src/types/supabase.ts` (folder_assignments table schema)
- **Issue:** Plan mentioned `recording_id` but actual column is `call_recording_id` (a numeric legacy ID from fathom_calls)
- **Fix:** Service functions use `callRecordingId: number` parameter type; hooks pass the legacy numeric ID
- **Files modified:** `src/services/folders.service.ts`, `src/hooks/useFolderAssignment.ts`

**4. [Rule 2 - Missing validation] `is_archived`/`archived_at` not in generated types**
- **Found during:** Checking `src/types/supabase.ts` folders schema
- **Issue:** Phase 16 migration added these columns but supabase types haven't been regenerated; TypeScript would error without casting
- **Fix:** All archive-related queries use `(supabase as any)` cast; `Folder` interface from `workspace.ts` already defines these fields correctly
- **Files modified:** `src/services/folders.service.ts`

## Self-Check

### Files Exist
- `src/services/folders.service.ts` — FOUND
- `src/hooks/useFolders.ts` — FOUND
- `src/hooks/useFolderAssignment.ts` — FOUND
- `src/components/dnd/FolderDropZone.tsx` — FOUND
- `src/components/dnd/DndCallProvider.tsx` — FOUND

### Commits Exist
- `c98e4a9` — Task 1: folder service, useFolders, useFolderAssignment hooks
- `604fb21` — Task 2: DnD infrastructure

### Build
- `pnpm build` — PASSED (clean, zero TypeScript errors)

## Self-Check: PASSED
