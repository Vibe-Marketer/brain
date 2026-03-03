# Home Page Bug Fixes & Pane Architecture Corrections

**Date:** 2026-03-02
**Status:** Ready for implementation
**Scope:** brain repo (v1 frontend) — `src/` directory
**Priority:** High — core navigation and data filtering are broken

---

## Context

The home page (`TranscriptsNew.tsx`) has accumulated multiple bugs from features being added at different times. The org/workspace/folder hierarchy exists in the store and UI components, but the actual call filtering is broken — switching orgs, workspaces, or folders doesn't properly filter the displayed calls. The pane architecture also has layout issues.

**Reference:** See `project-decisions/17-unified-home-navigation.md` for the target navigation architecture.

---

## Hard Rules (Read First)

Each element has exactly ONE job:

| Element | Job | What it must NOT do |
|---------|-----|---------------------|
| **TopBar org dropdown** | Switch organizations ("which company am I in?") | Must NOT contain workspace switching, breadcrumbs, or any other UI |
| **Pane 1 (Sidebar)** | Switch between app sections (Home, Import, Settings) | — |
| **Pane 2** | Navigate workspaces and folders ("which project/folder?") | Must NOT have glassmorphism, must NOT contain org switching |
| **Pane 3** | View content (call list, filtered by Pane 2 selections) | Must NOT contain Pane 4 content inline |
| **Pane 4** | Inspect details (call detail, bulk actions, workspace members) | Must be rendered via AppShell's detail pane system, NOT inline in Pane 3 |

**Org switching = TopBar. Workspace/folder switching = Pane 2. Never mix these.**

---

## Bug 1: Workspace/Folder Filtering Is Broken

### What's wrong

The call list query in `TranscriptsTab` fetches ALL calls for the org. The query key is:
```
["tag-calls", searchQuery, combinedFilters, page, pageSize, activeOrganizationId, isPersonalOrganization]
```

`activeWorkspaceId` is NOT in the query key. Switching workspaces updates the store but does NOT trigger a new query or filter the results.

Folder filtering is client-side via `folderAssignments`, but `useFolderAssignments(activeWorkspaceId)` returns `{}` when `activeWorkspaceId` is null — so folder selection shows empty results unless a workspace is explicitly selected.

### What to fix

1. **Add `activeWorkspaceId` to the query key** in `TranscriptsTab` so workspace switching triggers a re-fetch or re-filter
2. **Filter calls by workspace** — either:
   - Server-side: add workspace scoping to the Supabase query (preferred — fewer calls transferred)
   - Client-side: filter the results by workspace membership after fetch
3. **Fix folder filtering** — `folderAssignments` must load correctly for the active workspace. When no workspace is selected ("All Calls" / Home view), show all calls across all workspaces in the active org
4. **Verify the full chain works:**
   - Switch org in TopBar → call list shows only that org's calls
   - Click workspace in Pane 2 → call list shows only that workspace's calls
   - Click folder in Pane 2 → call list shows only that folder's calls
   - Click "Home" or deselect all → call list shows all calls for the active org

### Files to check
- `src/components/transcripts/TranscriptsTab.tsx` — query key and filtering logic (lines ~241-372)
- `src/pages/TranscriptsNew.tsx` — how `activeFolderId` and `folderAssignments` are passed down
- `src/hooks/useOrganizationContext.ts` — the bridge hook
- `src/hooks/useWorkspaces.ts` — workspace data fetching
- `src/lib/folder-icons.ts` or related — folder assignment lookups

---

## Bug 2: BulkActionToolbarEnhanced Is Not in Pane 4

### What's wrong

`BulkActionToolbarEnhanced` is currently rendered as a flex sibling INSIDE `TranscriptsTab` (Pane 3). It slides in from the right within the main content area, compressing the table. This is wrong — it should be a proper Pane 4 that pushes in from the right as a full-height panel via the AppShell's detail pane system.

Currently, `TranscriptsNew.tsx` does NOT pass `showDetailPane: true` to the AppShell config. The detail pane system (`DetailPaneOutlet`) is not being used for this panel.

### What to fix

1. **Remove** `BulkActionToolbarEnhanced` from inside `TranscriptsTab`
2. **Wire it into the Pane 4 system** — when calls are selected, open the detail pane via the panel store (`usePanelStore` or equivalent):
   - Panel type: `'bulk-actions'` (add this to the panel type union if needed)
   - Panel data: the selected call IDs
3. **Pass `showDetailPane: true`** to the AppShell config in `TranscriptsNew.tsx`
4. **Render `BulkActionToolbarEnhanced`** inside `DetailPaneOutlet` when panel type is `'bulk-actions'`
5. The panel must be **full height**, push in from the right as a Pane 4, and cause Pane 3 to **shrink** to make room (same z-plane, no overlay)
6. When selection is cleared (0 calls selected), close the detail pane

### Files to check
- `src/components/transcript-library/BulkActionToolbarEnhanced.tsx` — the component itself
- `src/components/transcripts/TranscriptsTab.tsx` — where it's currently rendered inline
- `src/pages/TranscriptsNew.tsx` — AppShell config (needs `showDetailPane: true`)
- `src/components/panels/` — where detail panel components live
- AppShell component — detail pane outlet rendering

---

## Bug 3: Pane 2 Has Wrong Styling (Glassmorphism)

### What's wrong

`WorkspaceSidebarPane` has glassmorphism styling that doesn't match the rest of the app:
- Container: `bg-card/10 border-r border-border/20`
- Org card inside it: `bg-card/60 backdrop-blur-sm`
- AppShell wraps it in: `bg-card/80 backdrop-blur-md rounded-2xl`

There should be no `backdrop-blur`, no transparency (`/10`, `/60`, `/80`), no glass effects.

### What to fix

1. **Remove all glassmorphism** from the Pane 2 container:
   - No `backdrop-blur-sm` or `backdrop-blur-md`
   - No partial opacity backgrounds (`bg-card/10`, `bg-card/60`, `bg-card/80`)
2. **Match sidebar styling** — Pane 2 should use the same visual treatment as Pane 1 (the sidebar nav):
   - Solid `bg-card` background
   - Standard `border-border` borders (not `/20` or `/40` opacity)
3. **Active item styling** should match the sidebar's active state pattern — vibe-orange tint, highlighted text, clear selected state
4. Check both `WorkspaceSidebarPane.tsx` AND the AppShell's wrapper for the secondary pane — glass styling may come from either level

### Files to check
- `src/components/panes/WorkspaceSidebarPane.tsx` — component-level glass styles
- AppShell component — the wrapper div around the secondary pane
- `src/components/ui/sidebar-nav.tsx` — reference for correct active item styling

---

## Bug 4: TopBar Org Dropdown Has Extra UI

### What's wrong

The org dropdown currently contains workspace items (showing "Workspaces in [OrgName]" with individual workspace entries and an "All Recordings" option). It may also contain breadcrumb-like elements. The dropdown should ONLY show organizations.

Additionally, the dropdown visually blends in with the rest of the TopBar — it should stand out as an interactive element.

### What to fix

1. **Remove ALL workspace references** from the org dropdown:
   - No "Workspaces in..." section
   - No individual workspace items
   - No "All Recordings" option
   - ONLY: list of orgs (personal + business), active org checkmark, "Create Organization" at bottom
2. **Visual treatment** — the org dropdown trigger button should:
   - Have a `bg-card` (white) background
   - Have a `border border-border` border
   - Look like a card/pill that stands out from the TopBar background
   - NOT blend in with the headline text color
3. **Remove any breadcrumbs** from the dropdown itself (breadcrumbs in the page header / Pane 3 are fine)

### Files to check
- `src/components/header/OrganizationSwitcher.tsx` — the dropdown component
- TopBar / header component — where the switcher is placed

---

## Bug 5: Sidebar Toggle Label Is Wrong

### What's wrong

The sidebar toggle button in `SidebarNav` says "Library Panel" — this doesn't accurately describe what it toggles (the workspace/folder navigation pane).

### What to fix

Rename "Library Panel" to **"Workspace Panel"** (or "Navigation Panel").

**File:** `src/components/ui/sidebar-nav.tsx`, line ~384:
```tsx
// BEFORE:
{!isCollapsed && <span className="text-sm text-muted-foreground truncate">Library Panel</span>}

// AFTER:
{!isCollapsed && <span className="text-sm text-muted-foreground truncate">Workspace Panel</span>}
```

---

## Bug 6: Visual Overflow Issues in Pane 2 and Main Page

### What's wrong

Multiple elements are overflowing their container bounds on the home page. Content is visually "spilling out" of the panes it should be contained in.

### What to fix

1. **Audit all pane containers** for proper `overflow-hidden` or `overflow-y-auto` on the outer wrapper
2. **Pane 2 (`WorkspaceSidebarPane`):**
   - The outer container must have `overflow-hidden` with an inner scrollable area (`overflow-y-auto`) for the workspace/folder list
   - Header (workspace label + add button) should be sticky/fixed at top, not scroll with content
3. **Pane 3 (main content area):**
   - The table container must clip to its bounds
   - Check that the page header and tab bar don't push content outside the pane
4. **Test at different viewport sizes** to ensure panes don't overflow at narrower widths

---

## Implementation Order

Do these in sequence — each one builds on the previous:

1. **Bug 5** (sidebar label) — trivial rename, 1 line
2. **Bug 4** (TopBar org dropdown) — clean up the dropdown, remove workspace items
3. **Bug 3** (Pane 2 glass styling) — remove glassmorphism, match sidebar styling
4. **Bug 6** (overflow issues) — fix container bounds after styling is corrected
5. **Bug 1** (filtering) — the core data flow fix, most complex
6. **Bug 2** (BulkActionToolbarEnhanced → Pane 4) — architectural change, do last

---

## Verification Checklist

After all fixes, verify these scenarios work:

- [ ] Switch org in TopBar → call list updates to show only that org's calls
- [ ] Click a workspace in Pane 2 → call list filters to that workspace's calls
- [ ] Click a folder in Pane 2 → call list filters to that folder's calls
- [ ] Click Home / deselect → shows all calls for the active org
- [ ] Calls previously assigned to folders appear in those folders
- [ ] Select multiple calls → BulkActionToolbarEnhanced opens as Pane 4 (full height, pushes from right)
- [ ] Deselect all calls → Pane 4 closes
- [ ] Pane 2 has no glass/blur effects, matches sidebar styling
- [ ] Org dropdown shows ONLY orgs, has white card background with border
- [ ] Org dropdown has NO workspace items, NO breadcrumbs
- [ ] No content overflows pane boundaries
- [ ] Sidebar toggle says "Workspace Panel" not "Library Panel"
