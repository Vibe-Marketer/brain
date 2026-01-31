# Phase 07 Plan 02: Folder-Level Chat Summary

**Completed:** 2026-01-31
**Duration:** ~25 minutes

## One-Liner

Folder-level chat scoping with backend filter resolution, UI selection, and removable header pills.

## What Was Built

### Task 1: Database Migration + Backend Update
- **Migration:** `20260131000002_add_folder_filter_to_chat_sessions.sql`
  - Added `filter_folder_ids UUID[]` column to `chat_sessions` table
  - Created GIN index for array queries
- **Backend updates to `chat-stream-v2/index.ts`:**
  - Added `folder_ids` to `RequestBody.filters` and `SessionFilters` interfaces
  - Created `resolveFolderFilter()` helper function to convert folder IDs to recording IDs
  - Folder filter resolution queries `folder_assignments` table
  - Intersects folder recordings with any existing recording_ids filter
  - Updated session loading to include `filter_folder_ids` from database
  - Enhanced system prompt to mention folder scope when active

### Task 2: Frontend Filter UI
- **Type updates:**
  - Added `folderIds: string[]` to `ChatFilters` interface
  - Added `folder_ids?: string[]` to `ChatApiFilters` interface
  - Added `filter_folder_ids?: string[]` to `ChatSession` interface
- **Hook updates:**
  - Added `toggleFolder()` function to `useChatFilters` hook
  - Updated `apiFilters` memoization to include `folder_ids`
  - Updated `hasActiveFilters` to check `folderIds`
  - Added `filter_folder_ids` to session creation mutation
- **UI updates:**
  - Added Folders section to `ChatFilterPopover.tsx`
  - Folders displayed with colored icons matching folder color
  - Selection toggles folder in/out of filter
- **Wire-up:**
  - Added `useFolders` hook import to `Chat.tsx`
  - Passed `folders` and `toggleFolder` to ChatFilterPopover

### Task 3: Active Folder Scope Display
- Individual folder pills displayed in chat header (not just count)
- Each pill shows:
  - Folder icon with actual folder color
  - Folder name (truncated to 100px with ellipsis)
  - Removable X button to quickly clear that folder
- Pills appear between Categories and Calls badges

## Technical Decisions

| Decision | Rationale |
|----------|-----------|
| Resolve folders to recording_ids at request time | Search pipeline already handles recording_ids filter; keeps folder logic isolated |
| Intersection with existing recording_ids | If both folders and specific calls selected, only calls in both sets match |
| Individual folder pills (not count) | Users need to see which folders are active and remove specific ones |
| filter_folder_ids as optional | Column won't exist until migration runs; prevents type errors |

## Files Changed

### Created
- `supabase/migrations/20260131000002_add_folder_filter_to_chat_sessions.sql`

### Modified
- `supabase/functions/chat-stream-v2/index.ts` (folder filter resolution)
- `src/types/chat.ts` (folderIds in interfaces)
- `src/hooks/useChatFilters.ts` (toggleFolder function)
- `src/hooks/useChatSession.ts` (filter_folder_ids support)
- `src/components/chat/ChatFilterPopover.tsx` (Folders section)
- `src/pages/Chat.tsx` (wire-up + header pills)

## Commits

| Hash | Message |
|------|---------|
| a0383c6 | feat(07-02): add folder filter support to chat backend |
| 7ad326a | feat(07-02): add folder filter UI to chat popover |
| 15fb934 | feat(07-02): add active folder scope display in chat header |

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- [x] TypeScript compilation passes (`npx tsc --noEmit`)
- [x] All tasks committed atomically
- [x] Backend resolves folder_ids to recording_ids
- [x] Frontend displays folder selection in popover
- [x] Active folders show as removable pills in header

## Next Steps

- Run database migration on Supabase to add `filter_folder_ids` column
- Test folder filtering in development environment
- Proceed to 07-04 (Call Sharing) or 07-05 (Export & Reporting)
