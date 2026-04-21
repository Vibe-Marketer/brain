---
phase: quick
plan: 260421-itf
subsystem: ui/panes
tags: [design-system, active-states, visual-consistency]
key-files:
  modified:
    - src/components/panes/SortingCategoryPane.tsx
    - src/components/panes/AnalyticsCategoryPane.tsx
    - src/components/panes/PeopleCategoryPane.tsx
    - src/components/panes/ImportSourcePane.tsx
    - src/components/panes/OrganizationCategoryPane.tsx
    - src/components/panes/SharedWithMePane.tsx
    - src/components/panes/SettingsCategoryPane.tsx
    - src/components/panes/WorkspaceSidebarPane.tsx
decisions:
  - "FolderSidebar.tsx already uses correct pattern (cv-side-indicator-pill + bg-muted) — no changes needed"
  - "SettingsCategoryPane icon was already text-foreground — only icon box border needed updating"
metrics:
  completed: 2026-04-21
  tasks: 1
  files: 8
---

# Quick Task 260421-itf: Standardize Active Selection States

Removed orange interior tint and orange text from all Pane 2 active/selected states. Active items now show only: orange pill (left), orange outer border on icon box, neutral text colors.

## Changes Applied

### Pattern: Icon box active state
- **Before:** `border-vibe-orange/30 bg-vibe-orange/10` or `bg-muted dark:bg-white/10`
- **After:** `border-vibe-orange/40` (border only, no orange background)
- **Files:** SortingCategoryPane, AnalyticsCategoryPane, SettingsCategoryPane, WorkspaceSidebarPane (workspace row, home button, shared-with-me)

### Pattern: Icon color when active
- **Before:** `text-vibe-orange`
- **After:** `text-foreground`
- **Files:** All 8 pane files

### Pattern: Label/text color when active
- **Before:** `text-vibe-orange`
- **After:** `text-foreground`
- **Files:** SortingCategoryPane, AnalyticsCategoryPane

### Pattern: Count text when active
- **Before:** `text-vibe-orange/70`
- **After:** `text-muted-foreground`
- **Files:** SortingCategoryPane

### Pattern: Arrow indicator
- **Before:** `text-vibe-orange`
- **After:** `text-muted-foreground`
- **Files:** SortingCategoryPane, AnalyticsCategoryPane

### Pattern: Folder active background (WorkspaceSidebarPane)
- **Before:** `bg-vibe-orange/5 text-vibe-orange`
- **After:** `bg-muted text-foreground`
- **Files:** WorkspaceSidebarPane (FolderListItem + personal folders)

## Preserved (not changed)
- Orange pill (`before:` pseudo-element) on all active items
- Header icon boxes (`text-vibe-orange` in pane headers — brand accent)
- Loading spinners
- Analytics chart markers
- Footer hover effects (`group-hover:text-vibe-orange` on New Workspace/Org buttons)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] WorkspaceSidebarPane FolderListItem active state**
- **Found during:** Task 1
- **Issue:** FolderListItem component also had `bg-vibe-orange/5 text-vibe-orange` and `RiFolderOpenLine` with `text-vibe-orange`
- **Fix:** Changed to `bg-muted text-foreground` and `text-foreground`
- **Commit:** d63b871a

**2. [Rule 2 - Missing] PeopleCategoryPane workspace sub-item icon**
- **Found during:** Task 1
- **Issue:** Workspace sub-items under Members also used `text-vibe-orange` for active icon
- **Fix:** Changed to `text-foreground`
- **Commit:** d63b871a

### Skipped Files

**FolderSidebar.tsx** — No `text-vibe-orange bg-vibe-orange/10 hover:bg-vibe-orange/20` pattern found. The file already uses `cv-side-indicator-pill` and `bg-muted` for active states, which matches the standard.

## Commits

| Hash | Message |
|------|---------|
| d63b871a | fix(quick-260421-itf): standardize active states -- remove orange interior/text |

## Self-Check: PASSED
- All 8 modified files exist and are committed
- Commit d63b871a verified in git log
- TypeScript build passes (tsc --noEmit clean)
