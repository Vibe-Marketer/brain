---
phase: quick
plan: 260421-hoi
subsystem: ui/design-system
tags: [icon-boxes, active-indicators, visual-consistency]
key-files:
  modified:
    - src/components/panes/WorkspaceSidebarPane.tsx
    - src/components/panes/PeopleCategoryPane.tsx
    - src/components/panes/ImportSourcePane.tsx
    - src/components/panes/AnalyticsCategoryPane.tsx
    - src/components/panes/SortingCategoryPane.tsx
    - src/components/panes/SettingsCategoryPane.tsx
    - src/components/panes/SharedWithMePane.tsx
    - src/components/panes/OrganizationCategoryPane.tsx
    - src/components/ui/page-header.tsx
    - src/components/panels/FolderDetailPanel.tsx
    - src/components/panels/TagDetailPanel.tsx
    - src/components/panels/SettingHelpPanel.tsx
    - src/components/panels/UserDetailPanel.tsx
    - src/components/panels/WorkspaceMemberPanel.tsx
    - src/components/panels/OrganizationMemberPanel.tsx
metrics:
  duration: 285s
  completed: 2026-04-21
  tasks: 4/4
  files: 15
---

# Quick Task 260421-hoi: Standardize Icon Boxes, Active Indicators, and Spacing Summary

Unified icon box treatment (w-8 h-8 rounded-md bg-card border border-border) and before: pseudo active indicators across all panes and panels.

## Task Results

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Pane 2 header icon badges | cbe3cfce | 8 pane files |
| 2 | Pane 2 list icons and active indicators | 28fd62db | 4 pane files |
| 3 | PageHeader icon box (Pane 3) | 3bd5ba75 | page-header.tsx |
| 4 | Pane 4 panel header icon boxes | df12515a | 6 panel files |

## Changes Made

### Task 1: Pane 2 Header Icon Badges (8 files)
- Replaced `rounded-lg bg-cb-border/40` with `rounded-md bg-card border border-border` in all 8 pane headers
- Standardized icon size from `h-4.5 w-4.5` to `h-4 w-4`
- Added `flex-shrink-0` to all header icon boxes

### Task 2: Pane 2 List Item Icons and Active Indicators (4 files)
- WorkspaceSidebarPane: workspace/home/shared icons from `w-7 h-7 rounded-lg` to `w-8 h-8 rounded-md`
- WorkspaceSidebarPane: folder icons wrapped in `w-6 h-6 rounded-md` boxes (folder variant)
- WorkspaceSidebarPane: folder span indicator converted to before: pseudo, workspace indicator `h-[60%]` to `h-[65%]`
- PeopleCategoryPane: raw `<Icon size={15}>` wrapped in standard icon boxes, span indicator to before: pseudo
- ImportSourcePane: both primary and secondary nav icons wrapped in boxes, both span indicators to before: pseudo
- OrganizationCategoryPane: raw icons wrapped in boxes, span indicator to before: pseudo

### Task 3: PageHeader Icon Box (1 file)
- Wrapped raw `<Icon>` in standard `w-8 h-8 rounded-md` icon box
- Changed icon color from `text-muted-foreground` to `text-vibe-orange`

### Task 4: Pane 4 Panel Header Icons (6 files)
- FolderDetailPanel: `rounded-lg bg-vibe-orange/10` to standard box, icon `h-5 w-5` to `h-4 w-4`
- TagDetailPanel: `rounded-lg` with inline bg to standard box (kept inner color swatch)
- SettingHelpPanel: `rounded-lg bg-vibe-orange/10` to standard box
- UserDetailPanel: `rounded-lg bg-vibe-orange/10` to standard box, icon `h-5 w-5` to `h-4 w-4`
- WorkspaceMemberPanel: `rounded-xl bg-vibe-orange/10 border-vibe-orange/20` to standard box
- OrganizationMemberPanel: `rounded-xl bg-vibe-orange/10 border-vibe-orange/20` to standard box
- AutomationRulePanel and RoutingRulePanel checked -- no icon boxes present, no changes needed

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

- `grep "rounded-lg bg-cb-border" src/components/panes/` -- 0 results
- `grep "rounded-r-full bg-vibe-orange" src/components/panes/` -- 0 results
- `grep "rounded-(lg|xl).*bg-vibe-orange" src/components/panels/` -- 0 results
- TypeScript build: clean (no errors)

## Self-Check: PASSED

All 15 modified files exist and all 4 commit hashes verified in git log.
