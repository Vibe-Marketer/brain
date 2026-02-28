---
phase: 16-workspace-redesign
plan: "08"
subsystem: ui
tags: [react, tanstack-query, supabase, vault_entries, folder_assignments, breadcrumb]

# Dependency graph
requires:
  - phase: 16-workspace-redesign
    provides: WorkspaceBreadcrumb, useFolders, orgContextStore, vault_entries table, folder_assignments table

provides:
  - getRecordingsByWorkspace() — vault_entries two-step query for workspace-scoped calls list
  - getRecordingsByFolder() — folder_assignments two-step query for folder-scoped calls list
  - useWorkspaceRecordings(workspaceId, folderId) — single hook that selects correct queryFn based on context
  - Folder breadcrumb level — Org > Workspace > Folder trail when folder is active

affects: [phase-17, phase-18, MCP-context-assembly]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-step Supabase query pattern: get IDs from join table, then fetch records by ID"
    - "Single useQuery call with derived queryKey/queryFn avoids conditional hook violations"
    - "useFolders cache reuse — same workspaceId param hits TanStack Query cache from sidebar query"

key-files:
  created: []
  modified:
    - src/services/recordings.service.ts
    - src/hooks/useRecordings.ts
    - src/routes/_authenticated/index.tsx
    - src/components/layout/WorkspaceBreadcrumb.tsx

key-decisions:
  - "Two-step query (get IDs, then fetch recordings) rather than join — explicit, debuggable, avoids Supabase JS client join limitations on non-FK relationships"
  - "Single useQuery call in useWorkspaceRecordings with ternary-derived queryKey/queryFn — avoids React Rules of Hooks violation from conditional hook returns"
  - "useFolders(activeWorkspaceId) in useBreadcrumbs reuses TanStack Query cache already populated by WorkspaceSidebarPane — zero extra network requests"

patterns-established:
  - "Two-step ID lookup pattern for vault_entries and folder_assignments joins"
  - "Ternary-derived queryKey/queryFn for context-aware hook without conditional hook calls"

# Metrics
duration: 1min
completed: 2026-02-28
---

# Phase 16 Plan 08: Workspace Filtering + Folder Breadcrumb Summary

**Workspace/folder-scoped calls list via vault_entries and folder_assignments two-step queries, plus live folder name in Org > Workspace > Folder breadcrumb trail**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-02-28T05:17:10Z
- **Completed:** 2026-02-28T05:22:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Selecting a workspace in the sidebar now narrows the calls list to recordings linked via vault_entries (not all org recordings)
- Selecting a folder further narrows to recordings assigned via folder_assignments
- Deselecting both returns all org recordings — full tri-mode awareness in a single hook
- Folder name now appears as Level 3 in breadcrumb: Org > Workspace > Folder Name (was always missing)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add workspace/folder-scoped recording queries and wire into calls list** - `ad25ad9` (feat)
2. **Task 2: Wire folder name into breadcrumb trail** - `5060479` (feat)

## Files Created/Modified

- `/Users/Naegele/dev/callvault/src/services/recordings.service.ts` - Added getRecordingsByWorkspace() and getRecordingsByFolder() two-step query functions
- `/Users/Naegele/dev/callvault/src/hooks/useRecordings.ts` - Added useWorkspaceRecordings() hook with single useQuery call; added imports for new service functions
- `/Users/Naegele/dev/callvault/src/routes/_authenticated/index.tsx` - Replaced useRecordings passthrough with useWorkspaceRecordings(activeWorkspaceId, activeFolderId); removed stale TODO comments
- `/Users/Naegele/dev/callvault/src/components/layout/WorkspaceBreadcrumb.tsx` - Added useFolders import, folder lookup in useBreadcrumbs, Level 3 folder breadcrumb push; removed stale Plan 16-04 TODO comments

## Decisions Made

- **Two-step query pattern:** Chose `vault_entries → recording IDs → recordings.in('id', ids)` over Supabase join syntax. The join table (`vault_entries`) is typed in supabase.ts but cross-table joins on non-FK relationships are awkward in the Supabase JS client. Two-step is explicit and debuggable.
- **Single useQuery (no conditional returns):** React's Rules of Hooks prohibits conditional `return useQuery(...)` calls. Derived queryKey/queryFn via ternary expressions before the single `useQuery({...})` call is the correct pattern.
- **Cache reuse for useFolders:** Calling `useFolders(activeWorkspaceId)` inside `useBreadcrumbs` hits the same TanStack Query cache key as WorkspaceSidebarPane's call — no extra network request.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Refactored conditional hook returns to single useQuery call**
- **Found during:** Task 1 (implementing useWorkspaceRecordings)
- **Issue:** Initial implementation used `if (folderId) return useQuery(...)` — violates React's Rules of Hooks which prohibit conditional hook calls
- **Fix:** Derived `queryKey` and `queryFn` via ternary expressions before a single unconditional `useQuery({queryKey, queryFn, enabled})` call
- **Files modified:** src/hooks/useRecordings.ts
- **Verification:** pnpm build passes with no errors; no ESLint rules-of-hooks warnings
- **Committed in:** ad25ad9 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug fix for Rules of Hooks violation in initial implementation)
**Impact on plan:** Required deviation for correctness. No scope creep.

## Issues Encountered

None — build passed cleanly after the hooks fix.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 16 gap closure complete: all 8 plans finished
- Calls list correctly scopes to active workspace or folder — navigational promise of Phase 16 fulfilled
- Breadcrumb trail shows full Org > Workspace > Folder hierarchy
- Ready for Phase 17 (Import Pipeline) and Phase 18 (Import Routing Rules) to build on this workspace context

---

## Self-Check

**Files created/modified verification:**
- `/Users/Naegele/dev/callvault/src/services/recordings.service.ts` - FOUND
- `/Users/Naegele/dev/callvault/src/hooks/useRecordings.ts` - FOUND
- `/Users/Naegele/dev/callvault/src/routes/_authenticated/index.tsx` - FOUND
- `/Users/Naegele/dev/callvault/src/components/layout/WorkspaceBreadcrumb.tsx` - FOUND

**Commits verification:**
- ad25ad9 — Task 1: workspace/folder-scoped recording queries
- 5060479 — Task 2: folder breadcrumb

## Self-Check: PASSED

---
*Phase: 16-workspace-redesign*
*Completed: 2026-02-28*
