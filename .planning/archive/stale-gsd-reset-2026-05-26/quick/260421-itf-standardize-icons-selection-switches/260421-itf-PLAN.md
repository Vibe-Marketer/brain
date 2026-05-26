---
title: "Standardize active states, icons, and switch visibility"
slug: standardize-icons-selection-switches
quick_id: 260421-itf
date: 2026-04-21
status: planned
---

# Plan: Standardize Active States, Icons, and Switch Visibility

## Task 1: Standardize active selection states across all Pane 2 components

**Standard:** Active items get ONLY:
- Orange pill on left via `before:` pseudo
- Orange outer border on icon box: `border-vibe-orange/40`
- Background: `bg-muted` (NO orange tint)
- Icon stays `text-foreground` (NOT `text-vibe-orange`)
- Label stays `text-foreground` (NOT `text-vibe-orange`)
- No orange shadow, no glass treatment

**Files:**

### SortingCategoryPane.tsx
- Line 239: `isActive && "border-vibe-orange/30 bg-vibe-orange/10"` → `isActive && "border-vibe-orange/40"`
- Line 246: `isActive ? "text-vibe-orange"` → `isActive ? "text-foreground"`
- Line 258: `isActive ? "text-vibe-orange"` → leave as `"text-foreground"` (same active/inactive)
- Line 267: `isActive ? "text-vibe-orange/70"` → `isActive ? "text-muted-foreground"` (same active/inactive)
- Line 292: arrow SVG `text-vibe-orange` → `text-muted-foreground`

### AnalyticsCategoryPane.tsx
- Line 232: `isActive && "border-vibe-orange/30 bg-vibe-orange/10"` → `isActive && "border-vibe-orange/40"`
- Line 239: `isActive ? "text-vibe-orange"` → `isActive ? "text-foreground"`
- Line 250: `isActive ? "text-vibe-orange"` → leave as `"text-foreground"`
- Line 272: arrow SVG `text-vibe-orange` → `text-muted-foreground`

### PeopleCategoryPane.tsx
- Line 151: `isActive ? 'text-vibe-orange'` → `isActive ? 'text-foreground'`
- Line 191: `isFolderActive ? 'text-vibe-orange'` → `isFolderActive ? 'text-foreground'`

### ImportSourcePane.tsx
- Line 142: `isActive && !comingSoon ? 'text-vibe-orange'` → `isActive && !comingSoon ? 'text-foreground'`
- Line 205: `isActive ? 'text-vibe-orange'` → `isActive ? 'text-foreground'`

### OrganizationCategoryPane.tsx
- Line 102: `isActive ? 'text-vibe-orange'` → `isActive ? 'text-foreground'`

### SharedWithMePane.tsx
- Line 79: `isActive ? "text-vibe-orange"` → `isActive ? "text-foreground"`

### SettingsCategoryPane.tsx
- Line 255: `isActive && "bg-muted dark:bg-white/10"` — icon box treatment. Change to: `isActive && "border-vibe-orange/40"`
- Line 262: icon color `isActive ? "text-foreground"` — already correct, keep

### WorkspaceSidebarPane.tsx
- Line 310: `isActive && 'border-vibe-orange/20 bg-vibe-orange/10'` → `isActive && 'border-vibe-orange/40'`
- Line 316: `isActive ? 'text-vibe-orange'` → `isActive ? 'text-foreground'`
- Line 564: `isHomeActive ? 'border-vibe-orange/20 bg-vibe-orange/10'` → `isHomeActive ? 'border-vibe-orange/40'`
- Line 566: `isHomeActive ? 'text-vibe-orange'` → `isHomeActive ? 'text-foreground'`
- Line 594-595: `'bg-vibe-orange/5 text-vibe-orange font-semibold...'` → `'bg-muted text-foreground font-semibold...'`
- Line 599: folder icon `activeFolderId === folder.id ? "text-vibe-orange"` → `"text-foreground"`
- Line 693: `isSharedView ? 'border-vibe-orange/20 bg-vibe-orange/10'` → `isSharedView ? 'border-vibe-orange/40'`
- Line 695: `isSharedView ? 'text-vibe-orange'` → `isSharedView ? 'text-foreground'`

### FolderSidebar.tsx (transcript-library)
- Line 205: `"text-vibe-orange bg-vibe-orange/10 hover:bg-vibe-orange/20"` — remove orange bg treatment for active folder tags. Change to: `"text-foreground bg-muted hover:bg-muted/80"`

**action:** Edit each file to apply standard active state
**verify:** `npx tsc --noEmit` on all changed files
**done:** All active states use orange pill + orange border only, no orange interior

---

## Task 2: Fix Switch component visibility

**File:** `src/components/ui/switch.tsx`

The switch has `border-2 border-transparent` when unchecked, making it almost invisible. Add a visible border for the unchecked state.

**Change:** In the Root className, change:
`border-2 border-transparent` → `border-2 border-transparent data-[state=unchecked]:border-border`

This gives the off-state switch a visible outline matching the app's border color.

**action:** Edit switch.tsx
**verify:** Visual check — the switch should have a subtle border when OFF
**done:** Switch is visible in both states

---

## Task 3: Wrap remaining unwrapped icons in standard boxes

Check and wrap any icons that appear in section headers or info rows within panels/detail views that don't have the standard `w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 bg-card border border-border` wrapper.

NOTE: This does NOT apply to:
- Icons inside buttons (close, delete, edit buttons)
- Icons used as inline decorators in text
- Icons in badges
- Progress/loading spinners
- Chart/analytics icons

This DOES apply to:
- Section header icons (like the bolt in "Apply to existing calls")
- Info row leading icons in detail panels
- List item leading icons that represent categories/types

**Files to audit and fix as needed:**
- RoutingRulePanel.tsx — "Apply to existing calls" bolt icon at line ~226
- UserDetailPanel.tsx — stat/info row icons (Calendar, Checkbox, etc.)
- YouTube import components
- Fathom destination list icons
- Contact detail panels

**action:** Audit and wrap icons
**verify:** `npx tsc --noEmit` on changed files
**done:** All structural icons wrapped in standard box
