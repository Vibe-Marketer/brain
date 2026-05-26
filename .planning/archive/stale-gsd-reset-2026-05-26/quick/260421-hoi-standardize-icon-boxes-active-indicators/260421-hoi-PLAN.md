---
quick_id: 260421-hoi
description: Standardize icon boxes, active indicators, and spacing across all panes
date: 2026-04-21
plan_count: 1
---

# Plan 1: Standardize Icons, Indicators, and Spacing

## Standards to enforce

### Icon Box Standard (THE standard — from sidebar nav items)
```
w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0
bg-card border border-border
```
- 32x32px, rounded-md (6px), solid bg-card, visible border
- Icon inside: `h-4 w-4`
- Active state on icon: `text-vibe-orange`
- Inactive: `text-muted-foreground`

### Icon Box — Header variant (Pane 2 headers, Pane 4 panel headers)
Same box treatment but with vibe-orange tint for the page/section icon:
```
w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0
bg-card border border-border
```
Icon inside headers: `h-4 w-4 text-vibe-orange`

### Icon Box — Folder variant (half-size spacing)
```
w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0
bg-card border border-border
```
- 24x24px — smaller for nested items
- Icon inside: `h-3.5 w-3.5`

### Active Indicator Standard (THE standard — from sidebar)
```
before:content-[''] before:absolute before:left-1 before:top-1/2 before:-translate-y-1/2 
before:w-1 before:h-[65%] before:rounded-full before:bg-vibe-orange
```
- Uses CSS pseudo-element (before:)
- Position: left-1 (4px from left edge)
- Height: 65% of parent
- Shape: rounded-full (both ends rounded)
- All `<span>` element indicators must be converted to this pseudo pattern
- All `h-3/5` (60%), `h-[60%]`, `h-3` (12px fixed) must become `h-[65%]`
- All `rounded-r-full` must become `rounded-full`
- All `left-0` must become `left-1`

### PageHeader Icon — wrap in icon box
Currently: raw `<Icon className="h-4 w-4 text-muted-foreground" />`
Change to: wrapped in the standard icon box div

## Task 1: Standardize Pane 2 header icon badges

**Files:**
- `src/components/panes/WorkspaceSidebarPane.tsx` (line 508)
- `src/components/panes/PeopleCategoryPane.tsx` (line 92)
- `src/components/panes/ImportSourcePane.tsx` (line 78)
- `src/components/panes/AnalyticsCategoryPane.tsx` (line 173)
- `src/components/panes/SortingCategoryPane.tsx` (line 175)
- `src/components/panes/SettingsCategoryPane.tsx` (line 192)
- `src/components/panes/SharedWithMePane.tsx` (line 41)
- `src/components/panes/OrganizationCategoryPane.tsx` (line 55)

**Action:** All currently use `w-8 h-8 rounded-lg bg-cb-border/40` (no border, rounder).
Change ALL to: `w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 bg-card border border-border`
Keep icons as `text-vibe-orange` (header icons stay orange).

**Verify:** grep for `rounded-lg bg-cb-border` in panes/ — should return 0 results.

## Task 2: Standardize Pane 2 list item icon boxes and active indicators

**Files:**
- `src/components/panes/WorkspaceSidebarPane.tsx` — workspace icons (w-7 rounded-lg), folder icons (w-1 h-3 left-0 rounded-r-full), Home icon
- `src/components/panes/PeopleCategoryPane.tsx` — category items (span left-1 h-3/5 rounded-r-full)
- `src/components/panes/ImportSourcePane.tsx` — source items (span left-1 h-3/5 rounded-r-full)
- `src/components/panes/OrganizationCategoryPane.tsx` — org items (span left-1 h-3/5 rounded-r-full)
- `src/components/panes/AnalyticsCategoryPane.tsx` — category items (before: left-1 h-[65%] rounded-full) — ALREADY CORRECT
- `src/components/panes/SortingCategoryPane.tsx` — category items (before: left-1 h-[65%] rounded-full) — ALREADY CORRECT
- `src/components/panes/SettingsCategoryPane.tsx` — category items (before: left-1 h-[65%] rounded-full) — ALREADY CORRECT

**Action for icon boxes in list items:**
- Workspace icons: `w-7 h-7 rounded-lg` → `w-8 h-8 rounded-md` (same as sidebar). Keep border treatment.
- Home icon: `w-7 h-7 rounded-lg` → `w-8 h-8 rounded-md`
- Shared With Me icon: `w-7 h-7 rounded-lg` → `w-8 h-8 rounded-md`
- Category list items that DON'T have icon boxes (People, Import, Org): the icons are currently raw `<Icon size={15}>`. Wrap in `w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 bg-card border border-border` box.

**Action for active indicators:**
Convert ALL `<span>` indicators to `before:` pseudo-element pattern:
- `<span className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-3/5 rounded-r-full bg-vibe-orange" />` → remove the span, add to parent button: `before:content-[''] before:absolute before:left-1 before:top-1/2 before:-translate-y-1/2 before:w-1 before:h-[65%] before:rounded-full before:bg-vibe-orange`
- `<span className="absolute left-0 ... h-3 rounded-r-full ...">` (folders) → same pattern but keep as-is for now since folders use half-size spacing

**Action for folder items (WorkspaceSidebarPane):**
- Folder icon: keep smaller but standardize to `w-6 h-6 rounded-md` (not rounded-lg)
- Folder active indicator: `left-0 h-3 rounded-r-full` → `left-1 h-[65%] rounded-full` (same pattern, just naturally smaller because parent is smaller)

## Task 3: Standardize Pane 3 PageHeader icon

**Files:**
- `src/components/ui/page-header.tsx` (line 54)

**Action:** Wrap the icon in the standard box:
Change from:
```tsx
{Icon && <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
```
To:
```tsx
{Icon && (
  <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 bg-card border border-border">
    <Icon className="h-4 w-4 text-vibe-orange" />
  </div>
)}
```

## Task 4: Standardize Pane 4 panel header icons

**Files:**
- `src/components/panels/FolderDetailPanel.tsx` (line 261) — has `rounded-lg bg-vibe-orange/10` no border
- `src/components/panels/TagDetailPanel.tsx` (line 230) — has `rounded-lg` no border, no bg
- `src/components/panels/SettingHelpPanel.tsx` (line 164) — has `rounded-lg bg-vibe-orange/10`
- `src/components/panels/UserDetailPanel.tsx` (line 209) — has `rounded-lg bg-vibe-orange/10`
- `src/components/panels/WorkspaceMemberPanel.tsx` (line 208) — has `rounded-xl bg-vibe-orange/10 border-vibe-orange/20`
- `src/components/panels/OrganizationMemberPanel.tsx` (line 181) — has `rounded-xl bg-vibe-orange/10 border-vibe-orange/20`

**Action:** Standardize ALL to:
```
w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 bg-card border border-border
```
Icon: `h-4 w-4 text-vibe-orange`

AutomationRulePanel and RoutingRulePanel headers — check if they have icon boxes, standardize if so.

## Execution Rules
- Read each file before editing
- Commit after each task: `fix(quick-260421-hoi): description`
- Create SUMMARY.md at `.planning/quick/260421-hoi-standardize-icon-boxes-active-indicators/260421-hoi-SUMMARY.md`
- Do NOT commit docs artifacts
