---
status: resolved
trigger: "Home workspace shows only 999 calls (capped at Aug 14, 2025) while My Calls workspace shows all calls correctly. Folder assignments appear to save but calls don't show up in folders. Aria warning on DialogContent."
created: 2026-03-03T00:00:00Z
updated: 2026-03-03T00:00:00Z
---

## Current Focus

hypothesis: All three root causes confirmed via code analysis
test: Applying fixes to recordings.service.ts and $folderId.tsx
expecting: workspace recordings no longer capped; folder view shows correct calls; aria warning resolved
next_action: fix recordings.service.ts for Bug 1, fix $folderId.tsx for Bug 2, investigate aria warning location for Bug 3

## Symptoms

expected: Home workspace shows ALL calls; saved calls appear in folder view; no aria warning
actual: Home shows only 999 calls (capped at Aug 14, 2025); folder assignments don't show calls; aria warning on DialogContent
errors: "Missing `Description` or `aria-describedby={undefined}` for {DialogContent}"
reproduction: Navigate to Home workspace; compare call count to My Calls; save call to folder; view folder
started: Current state as of 2026-03-03

## Eliminated

- hypothesis: LIMIT clause hardcoded in recording service code
  evidence: No explicit .limit() call found in recordings.service.ts - default PostgREST 1000-row limit applies
  timestamp: 2026-03-03

- hypothesis: Folder view uses getRecordingsByFolder with wrong filter
  evidence: Folder view ($folderId.tsx) calls useRecordings() (ALL recordings), not getRecordingsByFolder. Also shows all recordings not filtered by folderId.
  timestamp: 2026-03-03

## Evidence

- timestamp: 2026-03-03
  checked: recordings.service.ts getRecordingsByWorkspace()
  found: Two-step query - step 1 gets vault_entries without limit override. PostgREST default cap is 1000 rows. With >1000 vault entries, only 1000 IDs return, yielding ~999 recordings shown.
  implication: BUG 1 ROOT CAUSE - need .limit(10000) on vault_entries query to bypass PostgREST default cap

- timestamp: 2026-03-03
  checked: routes/_authenticated/folders/$folderId.tsx
  found: Uses useRecordings() (all recordings) not getRecordingsByFolder(). Variable `folder` is found via folders.find(f => f.id === folderId) where folders = useFolders(activeWorkspaceId). If activeWorkspaceId is null or wrong workspace, folder = undefined -> shows "This folder has moved on". Even when folder is found, displays ALL recordings not filtered by folder.
  implication: BUG 2 ROOT CAUSE - folder view should use useWorkspaceRecordings(null, folderId) and also needs activeWorkspaceId to be set correctly

- timestamp: 2026-03-03
  checked: All v2 callvault Dialog components
  found: All properly have Dialog.Description or AlertDialog.Description. Warning likely from brain/v1 AssignFolderDialog or another v1 component that uses shadcn DialogContent.
  implication: BUG 3 - needs further investigation in brain/v1 codebase if this is a v2 issue; likely v1 only

- timestamp: 2026-03-03
  checked: index.tsx (home page) useFilteredRecordings()
  found: "My Calls" = when activeWorkspaceId is null -> calls getRecordings() (no limit). Home workspace = activeWorkspaceId set -> calls getRecordingsByWorkspace() -> hits 1000 row cap on vault_entries query.
  implication: Confirms Bug 1 mechanism: "My Calls" works because it bypasses vault_entries query entirely

## Resolution

root_cause: |
  Bug 1: getRecordingsByWorkspace() step 1 query (vault_entries) hits Supabase/PostgREST 1000-row default limit.
  With >1000 entries in vault_entries for the Home workspace, only first 1000 recording IDs are returned,
  capping the visible calls at ~999.

  Bug 2: FolderViewPage (/folders/$folderId) uses useRecordings() which fetches ALL recordings.
  It then checks if folder exists via folders.find() against useFolders(activeWorkspaceId).
  If activeWorkspaceId doesn't match the folder's workspace, folder = undefined and shows "has moved on" state.
  Even when folder is found, it displays ALL recordings, not just those assigned to the folder.

  Bug 3: Aria warning from v1 brain repo component (likely not v2 callvault issue).
fix: |
  Bug 1: Add .limit(10000) to the vault_entries step-1 query in getRecordingsByWorkspace().
  Bug 2: Replace useRecordings() with useWorkspaceRecordings(null, folderId) in FolderViewPage,
  and ensure activeWorkspaceId is set when navigating to a folder (WorkspaceSidebarPane already calls switchWorkspace before switchFolder).
verification: |
  - TypeScript type check passes (pnpm tsc --noEmit: zero errors)
  - Vite build succeeds (pnpm build: built in 2.24s)
  - Bug 1 fix: added .limit(10000) to vault_entries query in getRecordingsByWorkspace() and to the recordings .in() query. Also added to getRecordings() for consistency.
  - Bug 2 fix: FolderViewPage now uses useWorkspaceRecordings(null, folderId) which routes to getRecordingsByFolder(). Loading state added to prevent false "has moved on" flash.
  - Bug 3: All Dialog components in v2 callvault have proper Dialog.Description - warning is not from v2.
files_changed:
  - /Users/Naegele/dev/callvault/src/services/recordings.service.ts
  - /Users/Naegele/dev/callvault/src/routes/_authenticated/folders/$folderId.tsx
