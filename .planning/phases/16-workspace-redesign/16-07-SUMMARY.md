---
phase: 16-workspace-redesign
plan: 07
subsystem: ui
tags: [react, tanstack-router, dnd-kit, tanstack-query, zustand, radix-ui]

# Dependency graph
requires:
  - phase: 16-03
    provides: WorkspaceSidebarPane, WorkspaceBreadcrumb, OrgSwitcherBar, AppShell layout
  - phase: 16-04
    provides: useFolders hook, DndCallProvider, DraggableCallRow, FolderDropZone, useAssignToFolder
  - phase: 16-05
    provides: WorkspaceMemberPanel, WorkspaceInviteDialog, useInvitations
  - phase: 16-06
    provides: ModelExplorer, useOnboarding, SidebarNav How it works link

provides:
  - "All route pages wired: index, calls/$callId, folders/$folderId, workspaces/index, workspaces/$workspaceId, settings/$category, import/index"
  - "DnD-enabled calls list with DraggableCallRow and FolderDropZone drop targets"
  - "CallActionMenu on every call row with Move to Folder folder picker"
  - "WorkspaceSidebarPane using useFolders hook (cache-coherent real-time folder updates)"
  - "WorkspaceMemberPanel wired into workspace detail page"
  - "Organizations settings category in settings page"
  - "Zero Bank/Vault/Hub user-facing strings (WKSP-01/02/03 complete)"
  - "Workspaces nav item in SidebarNav"
  - "Breadcrumbs on calls list, call detail, workspace detail, folder view"

affects: [17, 18, Phase-17-MCP, Phase-20-sharing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useFolders hook (not inline query) for sidebar folder data — cache-coherent with mutations"
    - "DndCallProvider wraps any page with a draggable calls list"
    - "FolderDropZone wraps each sidebar folder item as a drop target"
    - "CallActionMenu pattern: 3-dot button, folder picker sub-list, uses useAssignToFolder"

key-files:
  created: []
  modified:
    - src/routes/_authenticated/index.tsx
    - src/routes/_authenticated/calls/$callId.tsx
    - src/routes/_authenticated/folders/$folderId.tsx
    - src/routes/_authenticated/workspaces/index.tsx
    - src/routes/_authenticated/workspaces/$workspaceId.tsx
    - src/routes/_authenticated/settings/$category.tsx
    - src/routes/_authenticated/import/index.tsx
    - src/components/layout/WorkspaceSidebarPane.tsx
    - src/components/layout/SidebarNav.tsx
    - src/components/dialogs/WorkspaceInviteDialog.tsx

key-decisions:
  - "useFolders hook replaces inline folder query in WorkspaceSidebarPane for cache coherence"
  - "RiFolderTransferLine used instead of non-existent RiFolderMoveLine for folder assignment icon"
  - "RiFileCopyLine replaces non-existent RiCopyLine in WorkspaceInviteDialog"
  - "settings/$category.tsx uses Link for nav items (not div) for proper routing"
  - "Supabase Auth email templates cannot be verified programmatically — manual step in Task 3"
  - "Import page renamed from Import Hub to Import Calls to eliminate Hub terminology"

patterns-established:
  - "DnD pattern: DndCallProvider > DraggableCallRow > FolderDropZone (sidebar folders)"
  - "Action menu pattern: relative div + useEffect outside click + folder picker sub-state"
  - "Folder breadcrumbs: useBreadcrumbs() hook with optional callTitle param for call detail"

# Metrics
duration: 45min
completed: 2026-02-28
---

# Phase 16 Plan 07: Integration + Terminology Sweep Summary

**Full Phase 16 assembly: DnD calls list, cache-coherent sidebar folders, action menus, member management wired to workspace detail, Organizations settings, zero Bank/Vault/Hub in UI**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-02-28T04:20:51Z
- **Completed:** 2026-02-28T~05:05Z
- **Tasks:** 2 automated complete, 1 awaiting human verification
- **Files modified:** 10

## Accomplishments

- WorkspaceSidebarPane now uses `useFolders(workspaceId)` hook — folder mutations (create, rename, archive) invalidate the same TanStack Query cache key, so the sidebar updates in real-time without a page refresh
- Home page (`/`) fully wired: DndCallProvider wraps calls list, DraggableCallRow on every row, FolderDropZone on sidebar folders, CallActionMenu with "Move to Folder" folder picker for all devices
- Call detail page has breadcrumbs (Org > Workspace > Call Title) and inline "Move to Folder" action
- Folder route page has breadcrumbs, DnD, inline rename, and archive confirm button
- Workspace detail page wires WorkspaceMemberPanel (Plan 16-05) with Invite Member + Pending Invites tabs
- Settings page has working Organizations category showing org list with active indicator
- Zero user-facing Bank/Vault/Hub strings — WKSP-01/02/03 complete
- Workspaces nav item added to SidebarNav

## Task Commits

Each task committed atomically:

1. **Task 1: DnD integration, action menus, sidebar folder query fix, and calls list enhancement** - `905cc3b` (feat)
2. **Task 2: Terminology sweep and remaining route updates** - `5d52bf5` (feat)
3. **Task 3: Human verification** - awaiting checkpoint

## Files Created/Modified

- `src/routes/_authenticated/index.tsx` — DndCallProvider, DraggableCallRow, CallActionMenu, useFolders for folder picker
- `src/routes/_authenticated/calls/$callId.tsx` — WorkspaceBreadcrumb, MoveToFolderAction with folder picker
- `src/routes/_authenticated/folders/$folderId.tsx` — Full folder page: breadcrumbs, DnD, rename, archive
- `src/routes/_authenticated/workspaces/index.tsx` — Real workspace grid with org sidebar, Create Workspace
- `src/routes/_authenticated/workspaces/$workspaceId.tsx` — WorkspaceMemberPanel wired
- `src/routes/_authenticated/settings/$category.tsx` — Organizations category, OrganizationsSettings component
- `src/routes/_authenticated/import/index.tsx` — Renamed to "Import Calls" (not "Import Hub")
- `src/components/layout/WorkspaceSidebarPane.tsx` — Replaced inline query with useFolders/useArchivedFolders; FolderDropZone wraps each folder item
- `src/components/layout/SidebarNav.tsx` — Added Workspaces nav item (RiGroup2Line, /workspaces)
- `src/components/dialogs/WorkspaceInviteDialog.tsx` — Fixed RiCopyLine → RiFileCopyLine (icon unavailable in remixicon@4.9.0)

## Decisions Made

- Used `useFolders(workspaceId)` hook in WorkspaceSidebarPane instead of inline query to share TanStack Query cache with folder mutations
- `RiFolderTransferLine` replaces `RiFolderMoveLine` (not available in remixicon@4.9.0)
- `RiFileCopyLine` replaces `RiCopyLine` (not available in remixicon@4.9.0)
- Import page heading changed from "Import Hub" to "Import Calls" to align with WKSP-01/02/03 sweep
- Settings nav items use `<Link>` components for proper TanStack Router navigation
- Supabase Auth email templates require manual verification in Dashboard (step 14 in Task 3 checkpoint)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] RiFolderMoveLine missing from remixicon@4.9.0**
- **Found during:** Task 1 (DnD integration)
- **Issue:** `RiFolderMoveLine` is not exported by `@remixicon/react` v4.9.0 — build failed
- **Fix:** Replaced with `RiFolderTransferLine` which expresses the same "move to folder" concept
- **Files modified:** src/routes/_authenticated/index.tsx, src/routes/_authenticated/calls/$callId.tsx
- **Verification:** Build passes
- **Committed in:** 905cc3b (Task 1 commit)

**2. [Rule 3 - Blocking] RiCopyLine missing from remixicon@4.9.0**
- **Found during:** Task 2 (when WorkspaceInviteDialog was first included in a workspace-scoped build path)
- **Issue:** `RiCopyLine` is not exported by `@remixicon/react` v4.9.0 — build failed. Pre-existing issue in WorkspaceInviteDialog from Plan 16-05
- **Fix:** Replaced with `RiFileCopyLine` which expresses the same copy-to-clipboard concept
- **Files modified:** src/components/dialogs/WorkspaceInviteDialog.tsx
- **Verification:** Build passes
- **Committed in:** 5d52bf5 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking icon imports)
**Impact on plan:** Both fixes necessary for build. Same visual semantics — different icon name variant.

## Email Template Audit (WKSP-01)

Supabase Auth email templates (confirmation, magic link, invite, password reset) are configured in the Supabase Dashboard under Authentication -> Email Templates and cannot be verified programmatically from source code.

**Status:** Requires manual verification in Task 3 (human checkpoint, step 14).

Default Supabase templates use generic text like "Confirm your email for {{.SiteURL}}" which would not contain Bank/Vault/Hub. However, any custom templates previously configured for this project must be manually reviewed.

**Action for human verifier:** If Task 2 flagged templates are not clean, update them in Dashboard. If default Supabase templates are in use, no action needed.

## Issues Encountered

None during planned work. Both icon issues were pre-existing build blockers uncovered by this plan's new route imports.

## User Setup Required

None for Tasks 1 and 2. Task 3 includes optional manual step:
- If Supabase Auth email templates contain "Bank"/"Vault"/"Hub" terminology: update in Supabase Dashboard -> Authentication -> Email Templates.

## Next Phase Readiness

- Phase 16 workspace redesign UX is feature-complete, pending human verification (Task 3)
- All building blocks assembled: navigation, folders, invites, onboarding, DnD, action menus
- Phase 17+ can use the WorkspaceMemberPanel, useFolders, DndCallProvider patterns freely
- Production URL verification (Task 3) is the final gate before Phase 16 is marked complete

---
*Phase: 16-workspace-redesign*
*Completed: 2026-02-28 (Tasks 1-2 complete; Task 3 awaiting human verification)*
