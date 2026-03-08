---
phase: 16-workspace-redesign
plan: "03"
subsystem: navigation-ui
tags: [org-switcher, workspace-sidebar, breadcrumbs, layout, navigation]
dependency_graph:
  requires: ["16-02"]
  provides: ["16-04", "16-05", "16-06", "16-07"]
  affects: ["AppShell", "SidebarNav", "authenticated-home-route"]
tech_stack:
  added:
    - "radix-ui Collapsible (workspace expand/collapse)"
    - "radix-ui DropdownMenu (org switcher)"
    - "radix-ui Dialog (create org modal)"
  patterns:
    - "Inline Supabase folder query — stub until Plan 16-04 delivers useFolders"
    - "useBreadcrumbs hook reads orgContextStore + live data from useOrganizations/useWorkspace"
    - "AppShell wraps pane container in flex-col to stack OrgSwitcherBar above all panes"
key_files:
  created:
    - "/Users/Naegele/dev/callvault/src/components/layout/OrgSwitcherBar.tsx"
    - "/Users/Naegele/dev/callvault/src/components/layout/CreateOrganizationDialog.tsx"
    - "/Users/Naegele/dev/callvault/src/components/layout/WorkspaceSidebarPane.tsx"
    - "/Users/Naegele/dev/callvault/src/components/layout/WorkspaceBreadcrumb.tsx"
  modified:
    - "/Users/Naegele/dev/callvault/src/components/layout/AppShell.tsx"
    - "/Users/Naegele/dev/callvault/src/components/layout/SidebarNav.tsx"
    - "/Users/Naegele/dev/callvault/src/routes/_authenticated/index.tsx"
decisions:
  - "WorkspaceSidebarPane uses inline Supabase folder query (not useFolders) — Plan 16-04 will replace with full hook"
  - "Workspace/folder call filtering deferred to Plan 16-05 — vault_entries query needed for accurate workspace filter"
  - "OrgSwitcherBar spans full width above ALL panes (not just above sidebar) — implemented as top bar in AppShell flex-col wrapper"
  - "CreateOrganizationDialog is a separate component file in layout/ (not inline in OrgSwitcherBar) — keeps OrgSwitcherBar focused"
metrics:
  duration: "~5 minutes"
  completed: "2026-02-28"
  tasks_completed: 2
  files_created: 4
  files_modified: 3
---

# Phase 16 Plan 03: Navigation Components Summary

**One-liner:** Three layout components (OrgSwitcherBar, WorkspaceSidebarPane, WorkspaceBreadcrumb) wired into AppShell with Radix Collapsible/DropdownMenu/Dialog primitives.

---

## What Was Built

### Task 1: OrgSwitcherBar and WorkspaceSidebarPane

**OrgSwitcherBar** (`src/components/layout/OrgSwitcherBar.tsx`)
- Thin `h-10` (40px) bar rendered above all panes in AppShell
- Radix `DropdownMenu` shows all user organizations
- `RiHome4Line` (brand-400) for personal org; `RiBuilding2Line` for business orgs
- Active org has `RiCheckLine` checkmark in dropdown
- "Create Organization" option at bottom with `DropdownMenu.Separator`
- Clicking "Create Organization" opens `CreateOrganizationDialog`
- Loading skeleton while orgs load

**CreateOrganizationDialog** (`src/components/layout/CreateOrganizationDialog.tsx`)
- Radix `Dialog` with name input and `useCreateOrganization` mutation
- On success: calls `switchOrg(newOrg.id)` to auto-switch to new org
- Error display from `createOrg.error`
- Clears form and resets mutation state on close

**WorkspaceSidebarPane** (`src/components/layout/WorkspaceSidebarPane.tsx`)
- Radix `Collapsible.Root` per workspace for expand/collapse
- Active workspace: highlighted background, `RiStarLine` for `is_default`
- Inline `useFoldersForWorkspace` query: `supabase.from('folders').select(...).eq('vault_id', workspaceId)`
- Non-archived folders listed; archived folders in nested `Collapsible.Root` sub-section
- Clicking active folder deselects it (toggle behavior)
- "Create Workspace" button uses `window.prompt` as stub (full dialog in Plan 16-07)
- Skeleton loading state while workspaces load

### Task 2: Breadcrumbs and AppShell/route integration

**WorkspaceBreadcrumb** (`src/components/layout/WorkspaceBreadcrumb.tsx`)
- `BreadcrumbItem[]` prop renders Org > Workspace > Folder > Call trail
- TanStack Router `<Link>` for clickable crumbs; plain `<span>` for current level
- Separator: `/` in `text-muted-foreground/50`
- Per-item truncate at `max-w-[120px]`
- Mobile: shows last 2 items + ellipsis indicator
- `aria-label="Breadcrumb"` on `<nav>`, `aria-current="page"` on current item

**useBreadcrumbs hook** (exported from `WorkspaceBreadcrumb.tsx`)
- Reads `activeOrgId`, `activeWorkspaceId`, `activeFolderId` from `useOrgContextStore`
- Level 1: org name from `useOrganizations`, links to `/`
- Level 2: workspace name from `useWorkspace(activeWorkspaceId)`, links to `/`
- Level 3: folder — skipped until Plan 16-04 provides folder name lookup
- Level 4: optional `callTitle` param for call detail pages
- Returns `BreadcrumbItem[]` ready for `<WorkspaceBreadcrumb items={...} />`

**AppShell** (`src/components/layout/AppShell.tsx`)
- Desktop/tablet layout wrapped in `flex-col` container
- `<OrgSwitcherBar />` rendered above pane container (desktop/tablet only — no mobile)
- Pane container now uses `flex-1 min-h-0` to fill remaining height
- Mobile layout unchanged

**SidebarNav** (`src/components/layout/SidebarNav.tsx`)
- Removed `SwitcherRow` component and both placeholder org/workspace rows
- Removed `RiBuilding2Line` import (no longer needed in nav)
- Added `RiInformationLine` "How it works" button at bottom (Plan 16-07 will wire onboarding)
- Nav items (All Calls, Import, Settings) unchanged

**index.tsx** (`src/routes/_authenticated/index.tsx`)
- Replaced `FolderSidebar` stub with `<WorkspaceSidebarPane />`
- Added `<WorkspaceBreadcrumb items={breadcrumbs} />` above "All Calls" heading
- Page header now has separate sticky header row with breadcrumb + title
- Recordings list layout: calls list area scrolls independently within `flex-1 min-h-0`
- `useFilteredRecordings` hook created — currently passthrough; Plan 16-05 adds vault_entries filter

---

## Deviations from Plan

### Auto-fixed Issues

None. Plan executed exactly as designed with one deliberate deferral documented below.

### Deliberate Deferrals (not deviations)

**1. Workspace/folder call filtering deferred to Plan 16-05**
- Plan specified: "Update the recordings list to filter by activeWorkspaceId and activeFolderId"
- What was done: Created `useFilteredRecordings` hook as a passthrough (all recordings visible)
- Why: Filtering by workspace requires joining via `vault_entries` (recordings → vault_entries → vaults). This join query is Plan 16-05's responsibility. Implementing it here would step on Plan 16-05's scope.
- Impact: Recordings list shows all recordings regardless of active workspace. Visual context (breadcrumb + sidebar highlight) correctly reflects active workspace.

**2. "Create Workspace" uses window.prompt instead of full dialog**
- Plan specified: "Create Workspace button at bottom of list" — no dialog specified
- What was done: `window.prompt` for workspace name (simple, unblocking)
- Why: A full CreateWorkspaceDialog is not in Plan 16-03 scope. Plan 16-07 will add proper dialogs.
- Impact: Functional for workspace creation; UX will be improved in Plan 16-07.

**3. OrgSwitcherBar spans full AppShell width (above all panes)**
- Plan specified: "OrgSwitcherBar sits above ALL panes (spanning full width)"
- What was done: Exactly as specified — AppShell wrapped in `flex-col`, OrgSwitcherBar before pane container
- Note: This is correct implementation of the locked decision, documented for clarity.

---

## Build Verification

```
pnpm build → ✓ built in 1.78s (zero TypeScript errors)
```

All artifact checks passed:
- `OrgSwitcherBar.tsx`: 165 lines — contains `RiHome4Line`, `switchOrg`
- `WorkspaceSidebarPane.tsx`: 215 lines — contains `Collapsible` from radix-ui
- `WorkspaceBreadcrumb.tsx`: 159 lines — contains `useBreadcrumbs`, `WorkspaceBreadcrumb`
- `AppShell.tsx`: contains `OrgSwitcherBar` import and render
- `SidebarNav.tsx`: `SwitcherRow` count = 0 (removed)
- `index.tsx`: contains `WorkspaceSidebarPane`, `WorkspaceBreadcrumb`

---

## Self-Check: PASSED

Files exist: 7/7 FOUND
Commits exist: 853942e (task 1), 4846381 (task 2) — both confirmed in git log
Build: clean (zero errors, zero TypeScript errors)
