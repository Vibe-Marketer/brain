---
status: resolved
trigger: "CallVault debug panel warning: [N+1 DETECTED] 4+ identical requests in 2s: /rest/v1/folders?select=id&workspace_id=eq.* on https://app.callvaultai.com/ generated 2026-06-16T03:07:59.858Z"
created: 2026-06-16T03:08:55Z
updated: 2026-06-16T03:13:00Z
---

# Debug Session: n-1-detected-folders

## Symptoms

- expected_behavior: "Loading the call list/detail view should batch folder metadata requests and avoid repeated identical `/rest/v1/folders?select=id&workspace_id=eq.*` calls."
- actual_behavior: "Debug panel reports 4 identical folder ID requests in a 2 second window."
- error_messages: "[N+1 DETECTED] 4+ identical requests in 2s: /rest/v1/folders; URL Pattern: /rest/v1/folders?select=id&workspace_id=eq.*; Calls in window: 4."
- timeline: "Observed in production on 2026-06-16T03:06:23.476Z from Chrome 148 on macOS."
- reproduction: "Open https://app.callvaultai.com/, load call list/detail data around recording 7f06b769-5ef9-43b1-b33c-f453b47ecf97, then inspect debug panel network warnings."

## Current Focus

- hypothesis: "A folder membership/existence helper issues `.from('folders').select('id').eq('workspace_id', ...)` once per selected/visible item instead of using shared cached folder data or a batched query."
- test: "Search source for exact `select('id')` folder queries and trace callers from UI load paths."
- expecting: "One component/service path invoked multiple times during call list/detail rendering."
- next_action: "resolved"
- reasoning_checkpoint:
- tdd_checkpoint:

## Evidence

- timestamp: 2026-06-16T03:08:55Z
  observation: "User-provided debug panel report shows one warning group and no JavaScript errors."
  source: "CallVault debug panel report"
- timestamp: 2026-06-16T03:10:00Z
  observation: "`getFolderAssignments()` first fetches folder IDs with `supabase.from('folders').select('id')` scoped by `workspace_id` when a workspace ID is provided."
  source: "src/services/folders.service.ts"
- timestamp: 2026-06-16T03:10:00Z
  observation: "Mounted surfaces call `useFolderAssignments(activeWorkspaceId, activeOrganizationId)` and `useFolderAssignments(activeWorkspaceId)`, producing separate query keys for the same service request."
  source: "src/pages/TranscriptsNew.tsx; src/components/tags/FoldersTab.tsx; src/components/panels/FolderDetailPanel.tsx; src/components/panes/WorkspaceSidebarPane.tsx"
- timestamp: 2026-06-16T03:13:00Z
  observation: "Focused regression test mounts both call styles and confirms only one `folders` query and one `folder_assignments` query occur."
  source: "src/hooks/__tests__/useFolders.test.ts"

## Eliminated

- hypothesis: "The warning is caused by per-row call detail transcript, tag, participant, or contact loading."
  reason: "The reported URL pattern is exactly the folder ID prefetch used by folder assignment loading, not the per-recording detail endpoints shown in the user journey."
- hypothesis: "The service behavior differs when organizationId is supplied alongside workspaceId."
  reason: "`getFolderAssignments()` ignores organizationId whenever workspaceId is present, so the different hook arguments produce identical Supabase requests."

## Resolution

- root_cause: "The same workspace folder-assignment query was mounted under multiple TanStack Query keys. `TranscriptsNew` passed both `workspaceId` and `organizationId`, while other surfaces passed only `workspaceId`; the service ignores `organizationId` when `workspaceId` exists, so those distinct cache keys generated identical `/rest/v1/folders?select=id&workspace_id=eq.*` requests."
- fix: "Canonicalized `useFolderAssignments()` to use `queryKeys.folderAssignments.list(workspaceId)` whenever a workspace ID is present, and to use an organization-scoped fallback key only for organization-only calls."
- verification: "`npm test -- src/hooks/__tests__/useFolders.test.ts` passed; `npm run type-check` passed with 0 new errors; `npm run lint` exited 0 with existing warnings; `npm run build` passed."
- files_changed: "src/hooks/useFolders.ts; src/hooks/__tests__/useFolders.test.ts; .planning/debug/resolved/n-1-detected-folders.md"
