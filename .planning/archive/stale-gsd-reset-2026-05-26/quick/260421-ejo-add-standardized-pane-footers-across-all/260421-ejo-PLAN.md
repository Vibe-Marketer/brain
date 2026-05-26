---
quick_id: 260421-ejo
description: Add standardized pane footers across all panes and update spec doc with full pane behaviors
date: 2026-04-21
plan_count: 1
---

# Plan 1: Standardize Pane Footers + Update Spec Doc

## Task 1: Standardize Pane 1 sidebar footer

**Files:**
- `src/components/ui/sidebar-nav.tsx`

**Action:** The sidebar already has a footer (`mt-auto flex flex-col gap-0.5 pt-2 border-t border-border/40 px-2`) with Tour, How It Works, and Settings buttons. Standardize the border from `border-border/40` to `border-border` for consistency with all other footers. No other changes needed — this is already the model.

**Verify:** grep for `border-t` in sidebar-nav.tsx confirms `border-border` (not /40).

**Done:** Pane 1 footer standardized.

## Task 2: Add/standardize footers on ALL Pane 2 components

**Files (need new footer):**
- `src/components/panes/AnalyticsCategoryPane.tsx` — NO footer. Add empty footer placeholder.
- `src/components/panes/ImportSourcePane.tsx` — NO footer. Add empty footer placeholder.
- `src/components/panes/OrganizationCategoryPane.tsx` — NO footer. Add empty footer placeholder.
- `src/components/panes/PeopleCategoryPane.tsx` — NO footer. Add empty footer placeholder.
- `src/components/panes/SettingsCategoryPane.tsx` — NO footer. Add empty footer placeholder.
- `src/components/panes/SharedWithMePane.tsx` — NO footer. Add empty footer placeholder.
- `src/components/panes/SettingsDetailPane.tsx` — Check if it has footer, add if missing.
- `src/components/panes/AnalyticsDetailPane.tsx` — Check if it has footer, add if missing.
- `src/components/panes/SortingDetailPane.tsx` — Check if it has footer, add if missing.

**Files (already has footer — standardize):**
- `src/components/panes/WorkspaceSidebarPane.tsx` — HAS footer (`<footer className="p-3 border-t border-border bg-card space-y-1">`). Keep content, standardize classes.
- `src/components/panes/SortingCategoryPane.tsx` — HAS a bottom section. Standardize to footer pattern.

**Standard footer pattern for Pane 2:**

For panes WITH actions (like WorkspaceSidebarPane):
```tsx
<footer className="shrink-0 p-3 border-t border-border space-y-1">
  {/* action buttons */}
</footer>
```

For panes WITHOUT actions (empty placeholder):
```tsx
<footer className="shrink-0 px-4 py-3 border-t border-border">
  <div className="flex items-center justify-between text-[9px] text-muted-foreground/60 uppercase tracking-wider">
    {/* Empty — reserved for future use */}
  </div>
</footer>
```

The empty footer creates a ~36px visual base. The `shrink-0` ensures it never collapses. The `border-t` creates visual closure.

IMPORTANT: Each pane must have `h-full flex flex-col` on its root container for the footer to pin to the bottom. Verify this is present — if the root div doesn't have it, add it.

**Verify:** Every file in src/components/panes/ has a `<footer` tag with `shrink-0` and `border-t border-border`.

**Done:** All Pane 2 components have standardized footers.

## Task 3: Add/standardize footers on ALL Pane 4 panel components

**Files (already have footers — standardize):**
- `src/components/panels/FolderDetailPanel.tsx` — HAS `<footer className="p-4 border-t border-border space-y-2">`. Standardize to `shrink-0 px-4 py-3 border-t border-border`.
- `src/components/panels/TagDetailPanel.tsx` — Same, standardize.
- `src/components/panels/RoutingRulePanel.tsx` — HAS `shrink-0 flex items-center justify-between px-5 py-4 border-t border-border`. Standardize padding to `px-4 py-3`.

**Files (need new footer):**
- `src/components/panels/AutomationRulePanel.tsx` — NO footer. Add empty footer.
- `src/components/panels/ContactDetailPanel.tsx` — NO footer. Add empty footer.
- `src/components/panels/OrganizationMemberPanel.tsx` — NO footer. Add empty footer.
- `src/components/panels/SettingHelpPanel.tsx` — NO footer. Add empty footer.
- `src/components/panels/UserDetailPanel.tsx` — NO footer. Add empty footer.
- `src/components/panels/WorkspaceDetailPanel.tsx` — NO footer. Add empty footer.
- `src/components/panels/WorkspaceMemberPanel.tsx` — NO footer. Add empty footer.

**Standard footer pattern for Pane 4:**

For panels WITH save/delete actions:
```tsx
<footer className="shrink-0 px-4 py-3 border-t border-border space-y-2" role="group" aria-label="Panel actions">
  {/* Primary + destructive buttons */}
</footer>
```

For panels WITHOUT actions (empty placeholder):
```tsx
<footer className="shrink-0 px-4 py-3 border-t border-border" />
```

Self-closing empty footer — minimal but creates the visual base.

IMPORTANT: Panel components are rendered inside DetailPaneOutlet which is `flex flex-col h-full overflow-hidden`. The panel's own root must also be `flex flex-col h-full` for the footer to pin. Verify each panel's root container.

**Verify:** Every file in src/components/panels/ has a `<footer` tag or self-closing `<footer` with `shrink-0` and `border-t border-border`.

**Done:** All Pane 4 panels have standardized footers.

## Task 4: Standardize PaginationControls component to match footer pattern

**Files:**
- `src/components/ui/pagination-controls.tsx`

**Action:** The PaginationControls component currently has `border-t bg-white dark:bg-card` hardcoded. Update to use the standard footer pattern:
- Change `bg-white dark:bg-card` to just remove it (the footer's parent handles background)
- Keep `border-t` (it's the standard)
- The component is already well-structured with the count/size on left and navigation on right

Update the outer div classes to: `flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3`

Remove `border-t` from PaginationControls itself since it will live INSIDE a footer element that already has `border-t border-border`. If the component is used standalone (outside a footer), the parent should provide the border.

**Verify:** Read the file, confirm no `bg-white` or `dark:bg-card` hardcoded, and `border-t` is removed from the component itself.

**Done:** PaginationControls ready for use inside standard footer elements.

## Task 5: Update spec doc with full pane behaviors and footer standards

**Files:**
- `/Users/Naegele/Downloads/multi-pane-layout-spec.md`

**Action:** Major update to add:

1. **Section 0 (new): Top Bar Spec** — Document the h-[52px] fixed header with left/center/right sections
2. **Section 3 (expand): Pane Behaviors** — For each pane, document:
   - Purpose and role
   - Show/hide behavior and triggers
   - Use cases / what pages use it
   - Width states
3. **Section 6 (rewrite): Pane Footer Standards** — Replace the existing brief footer section with the full 4-footer standard:
   - Pane 1: Utility links (Tour, Help, Settings) — always present
   - Pane 2: Create actions or empty placeholder — always present
   - Pane 3: Pagination/count/status or empty placeholder — always present
   - Pane 4: Save/Delete actions or empty placeholder — always present
   - Include the "always present" philosophy and the template code for each

**Verify:** Read the updated file, confirm all 4 pane sections document behavior + footer.

**Done:** Spec doc is comprehensive with full pane behaviors and footer standards.
