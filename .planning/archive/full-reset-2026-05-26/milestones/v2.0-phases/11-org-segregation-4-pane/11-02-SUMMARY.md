---
phase: 11-org-segregation-4-pane
plan: "02"
subsystem: org-context
tags: [org-switch, state-reset, fade-transition, pane-4, search, navigation]
dependency_graph:
  requires: []
  provides: [clean-org-switch, fade-on-org-switch]
  affects: [src/hooks/useOrgContext.ts, src/components/layout/AppShell.tsx]
tech_stack:
  added: []
  patterns: [zustand-getState-outside-hook, css-transition-opacity, useRef-prev-value]
key_files:
  modified:
    - src/hooks/useOrgContext.ts
    - src/components/layout/AppShell.tsx
key_decisions:
  - "Force-unpinned Pane 4 on org switch — pin state should not survive an org context change"
  - "CSS transition-opacity (not motion/react springs) for org switch fade — utility transition, not UI element animation"
  - "Filter/sort reset via navigation to '/' — state is URL-based, navigation naturally clears it"
  - "Panes 2/3/4 wrapped in flex container for fade — sidebar (Pane 1) intentionally excluded"
metrics:
  duration: "~8 minutes"
  completed_date: "2026-03-30"
  tasks_completed: 2
  files_modified: 2
---

# Phase 11 Plan 02: Org Switch State Reset + Fade Transition Summary

**One-liner:** Org switch now resets all transient UI state (panel, search, URL-filters) and fades the content area for 250ms, leaving the sidebar stable.

## What Was Built

### Task 1: Full state reset on org switch (commit `16df0d3f`)

Enhanced `useOrgContext.ts` to make `switchOrg` a true clean-slate operation:

- Imported `useNavigate` (react-router-dom), `usePanelStore`, and `useSearchStore`
- `switchOrg` now orchestrates four sequential resets:
  1. `setActiveOrg(orgId)` — resets workspace + folder (locked pre-existing behavior)
  2. Force-unpins and closes Pane 4 via `usePanelStore.getState()` / `closePanel()`
  3. Resets search query/results via `useSearchStore.getState().resetSearch()`
  4. Navigates to `'/'` — URL-based filter/sort state cleared by route change
- The bridge hook `useOrganizationContext` already delegates `switchOrganization` → `switchOrg`, so `OrganizationSwitcher.tsx` required no changes

### Task 2: Fade transition on org switch (commit `abeea569`)

Enhanced `AppShell.tsx` with a 250ms opacity fade on the content area:

- Imported `useOrgContextStore` to watch `activeOrgId`
- `prevOrgRef` tracks the previous org ID to detect genuine org changes (not initial mount)
- `isSwitching` state drives a 250ms timer: true → opacity-0, false → opacity-100
- Panes 2/3/4 wrapped in `<div className="flex flex-1 gap-3 transition-opacity duration-250">` with `opacity-0` when switching
- Sidebar (Pane 1) is outside this wrapper — remains fully visible during switch

## Acceptance Criteria Verified

- [x] `src/hooks/useOrgContext.ts` contains `switchOrg` that calls `navigate('/')`
- [x] `src/hooks/useOrgContext.ts` imports from `panelStore` and `searchStore`
- [x] `switchOrg` resets panel state (force-unpins + `closePanel`)
- [x] `switchOrg` resets search state (`resetSearch`)
- [x] `orgContextStore.setActiveOrg` still sets `activeWorkspaceId: null, activeFolderId: null`
- [x] `OrganizationSwitcher.tsx` calls `switchOrganization` → `switchOrg` (bridge pattern, unchanged)
- [x] `AppShell.tsx` contains `isSwitching` state and `prevOrgRef`
- [x] `AppShell.tsx` contains `transition-opacity` and `duration-250`
- [x] Fade wraps Panes 2/3/4 only — sidebar excluded
- [x] TypeScript compiles cleanly (`npx tsc --noEmit` — zero errors)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Force-unpin Pane 4 before closing on org switch**
- **Found during:** Task 1 implementation
- **Issue:** `closePanel()` silently exits if `isPinned === true`, meaning Pane 4 would stay open after org switch for pinned panels — violating D-12
- **Fix:** Added explicit unpin step (`usePanelStore.setState({ isPinned: false })`) before calling `closePanel()`
- **Files modified:** `src/hooks/useOrgContext.ts`
- **Commit:** `16df0d3f`

## Known Stubs

None.

## Self-Check: PASSED

- `src/hooks/useOrgContext.ts` — exists and contains `switchOrg`, `navigate`, `panelStore`, `searchStore`
- `src/components/layout/AppShell.tsx` — exists and contains `isSwitching`, `prevOrgRef`, `transition-opacity`, `duration-250`
- Commits `16df0d3f` and `abeea569` verified in git log
