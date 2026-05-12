---
phase: 33
phase_name: Selection State System
completed: 2026-05-11
status: Plans executed, build green, awaiting visual verification
---

# Phase 33: Selection State System — Summary

## Outcome

A single canonical `<SelectionButton>` primitive at `src/components/ui/selection-button.tsx` is now used across every selection surface in the app. The pattern (orange pill on edge, gray bg, bold label, orange ring on icon container) is applied consistently in light and dark mode via semantic Tailwind/shadcn tokens.

## Requirements Closed

| Req | Surface | Status |
|---|---|---|
| **VIS-01** | Sidebar nav (expanded) | Migrated to `<SelectionButton>` |
| **VIS-02** | 2nd-pane workspace row | `selectionButtonVariants` cva applied; bold-italic dropped |
| **VIS-03** | Settings + Organization + People + Analytics + Sorting category panes | All 5 panes use `<SelectionButton>` |
| **VIS-04** | Call Detail modal tabs (Overview/Transcript/Invitees/Participants) | Horizontal orientation variant — orange pill on bottom |
| **VIS-05** | Settings > Organizations | Horizontal Tabs strip replaced with vertical canonical-card list |
| **QA-04** | `/settings/ai-integrations` + `/settings/admin` redirects | Now route to `/settings/account` |

## Commits (in order)

1. `e228fdd3` — `docs(33)`: capture phase context (pre-existing)
2. `72a9624d` — `docs(33)`: 6 plan files
3. `8385414f` — `feat(33-01)`: SelectionButton primitive (foundation, shipped standalone for Phase 34 dependency)
4. `67dfdd32` — `feat(33-02)`: SidebarNav → SelectionButton (VIS-01)
5. `a8fd2ced` — `feat(33-03)`: WorkspaceListItem cva refactor (VIS-02)
6. `e11eaa30` — `feat(33-04)`: Call Detail modal tabs (VIS-04)
7. `d2ede480` — `feat(33-05)`: 5 category panes + QA-04 redirect (VIS-03 + QA-04)
8. `8326a6e4` — `feat(33-06)`: Org tab strip → vertical card list (VIS-05)

## Key Files Created

- `src/components/ui/selection-button.tsx` — canonical primitive (cva variants: `orientation`, `size`, `selected`)
- `src/components/ui/__tests__/selection-button.test.tsx` — 7 passing unit tests

## Key Files Modified

- `src/components/ui/sidebar-nav.tsx`
- `src/components/panes/WorkspaceSidebarPane.tsx`
- `src/components/panes/SettingsCategoryPane.tsx`
- `src/components/panes/OrganizationCategoryPane.tsx`
- `src/components/panes/PeopleCategoryPane.tsx`
- `src/components/panes/AnalyticsCategoryPane.tsx`
- `src/components/panes/SortingCategoryPane.tsx`
- `src/components/CallDetailDialog.tsx`
- `src/components/settings/OrganizationsTab.tsx`
- `src/pages/Settings.tsx` (QA-04 redirect)

## Net Code Delta

Across the phase: roughly **+450 / −400** lines. The primitive (≈300 LOC) is offset by removing ~600 LOC of duplicated inline selection-state classNames from the 9 consuming files.

## SelectionButton API

```tsx
<SelectionButton
  selected={isActive}
  icon={<RiPhoneLine className="h-4 w-4" />}
  iconActive={<RiPhoneFill className="h-4 w-4" />}  // optional
  label="Calls"
  description="Your call library"                    // optional
  orientation="vertical" | "horizontal"              // default vertical
  size="sm" | "md"                                   // default sm
  showChevron                                        // optional
  as="button" | "a" | "div"                          // default button
  onClick={...}
/>
```

- **Vertical** (default): pill on left edge, icon-left-of-label.
- **Horizontal** (Call Detail tabs): pill on bottom edge, icon-above-label.
- **`as="div"`** path needed for WorkspaceListItem (nested Collapsible.Trigger violates button-in-button).
- **All colors** via semantic tokens (`bg-muted`, `bg-card`, `bg-vibe-orange`, `ring-vibe-orange`, `text-foreground`) — dark mode adapts automatically.

## Verification Status

- TypeScript: `npx tsc --noEmit` → **clean**
- Production build: `npm run build` → **success** (12.96s)
- Unit tests: `npx vitest run src/components/ui/__tests__/selection-button.test.tsx` → **7/7 pass**
- Visual verification: **deferred** — local changes not yet deployed; verification.md flags as `human_needed` for post-deploy dev-browser sweep across 5 surfaces × 2 themes.

## Phase 34 Handoff

`<SelectionButton>` was shipped as a standalone commit (33-01) before the 5 migrations landed, so Phase 34 (sidebar/brand polish) can depend on it cleanly. Phase 34 will likely:

- Re-order sidebar items (BRAND-01)
- Apply UPPERCASE primary titles (BRAND-02)
- Audit any remaining bold-italic survivors (BRAND-03)
- Doubled X close button, search modal styling (BRAND-04+)

None of those should touch the canonical selection pattern — the primitive locks the structural visual contract.

## Deferred / Out-of-Scope (Tracked)

- **Visual regression screenshots** — `.planning/phases/33-selection-state-system/screenshots/` was not populated. Capture after deploy via dev-browser sweep.
- **Tour/HowItWorks sidebar buttons** — left as plain buttons (they are not selectable items).
- **Collapsed sidebar rail** — uses an inline minimal button (no label/desc to render); pill + ring contract still applied inline.
- **Folder rows under workspace** — out of scope for VIS-02 (folder selection treatment is its own pattern; revisit if drift becomes visible per CONTEXT.md deferred list).

## Trade-offs Noted

1. **Bold vs bold-italic on workspace name** — CONTEXT.md said the canonical pattern is bold-only (no italic). VIS-02 (33-03) DROPPED the italic from the active workspace name even though BRAND-03 is officially a Phase 34 issue, because the canonical pattern's spec demands it. Phase 34 still owns the broader bold-italic audit.

2. **Brand-guidelines doc vs CONTEXT.md** — Brand guidelines v4.4 describes the active state as orange-tinted bg + orange text/icon. CONTEXT.md's locked decisions say gray bg + bold + orange pill + orange ring. **CONTEXT.md wins** (reality over documentation rule); the brand guidelines doc may need a future update to reflect the canonical-selection pattern as actually shipped.

3. **OrganizationsTab commit (8326a6e4)** — the working tree had pre-existing modifications to ~26 Supabase Edge Function files from earlier sessions; those were swept into the commit alongside the VIS-05 change. Unrelated, but already-modified content was committed together. Not a regression — those files were in the working tree at session start.

## Open Questions for Human

- Does the workspace-row drop-italic in VIS-02 match the user's mental model, or should the bold-italic stay until Phase 34 explicitly addresses BRAND-03?
- Confirm visual approval of all 5 surfaces in dark mode after deploy.
