---
phase: 14-foundation
plan: 03
subsystem: ui
tags: [motion, zustand, tanstack-router, breakpoints, layout, appshell, spring-animation, responsive]

requires:
  - phase: 14-02
    provides: AuthProvider + useAuth hook already wired in __root.tsx; auth guard protecting all _authenticated/ routes

provides:
  - AppShell.tsx: 4-pane layout component with Motion spring animations and typed AppShellProps interface
  - SidebarToggle.tsx: 24x24px edge-mounted circular toggle button (rounded-full, RiArrowLeftSLine)
  - SidebarNav.tsx: Navigation rail with org/workspace switcher placeholders and TanStack Router Link items
  - DetailPaneOutlet.tsx: AnimatePresence-powered detail pane (spring stiffness 260, damping 28)
  - panelStore.ts: Zustand v5 store for panel type/data (create<PanelState>()() syntax)
  - preferencesStore.ts: Zustand v5 store for sidebar/secondary state with localStorage cross-tab sync
  - useBreakpoint.ts: matchMedia breakpoint hook exporting useBreakpointFlags()
  - Authenticated home at / renders 4-pane AppShell proving props interface works

affects:
  - 14-04 (all route pages use AppShell with real panel components replacing stubs)
  - 14-05 (billing gating UI wraps within AppShell main content pane)
  - 15+ (all v2 pages nest under _authenticated/ and use AppShell for layout)

tech-stack:
  added: []
  patterns:
    - AppShell props interface — { children, secondaryPane?, showDetailPane? } — route-level pane composition
    - Motion spring physics — stiffness 260, damping 28 for all pane transitions (from motion/react not framer-motion)
    - Zustand v5 double-invocation — create<T>()((set, get) => ...) for TypeScript correctness
    - initial={false} on all Motion elements to suppress entry animation on page load
    - usePreferencesStore.setSidebarExpanded(false) in useEffect when isTablet to auto-collapse
    - AnimatePresence wraps DetailPaneOutlet for spring slide-in/out of detail pane
    - data-tour attributes on SidebarNav elements for future driver.js onboarding tour hooks

key-files:
  created:
    - /Users/Naegele/dev/callvault/src/components/layout/AppShell.tsx
    - /Users/Naegele/dev/callvault/src/components/layout/SidebarToggle.tsx
    - /Users/Naegele/dev/callvault/src/components/layout/SidebarNav.tsx
    - /Users/Naegele/dev/callvault/src/components/layout/DetailPaneOutlet.tsx
    - /Users/Naegele/dev/callvault/src/stores/panelStore.ts
    - /Users/Naegele/dev/callvault/src/stores/preferencesStore.ts
    - /Users/Naegele/dev/callvault/src/hooks/useBreakpoint.ts
  modified:
    - /Users/Naegele/dev/callvault/src/routes/_authenticated/index.tsx

key-decisions:
  - "motion/react (not framer-motion) for all animations — motion is the correct import for Motion for React v12"
  - "AppShellProps flattened (not config object) — secondaryPane and showDetailPane as direct props per plan spec"
  - "preferencesStore persists isSidebarExpanded to localStorage for cross-tab sync; isSecondaryOpen is session-only"
  - "Mobile layout is route-based stack (header + full-screen main), not overlay/drawer — per CONTEXT.md locked decision"
  - "SidebarNav uses TanStack Router Link (not react-router-dom) for navigation items"
  - "PanelData is discriminated union with type field as discriminator for type-safe narrowing in Plan 04 panel components"

patterns-established:
  - "Pattern 8: AppShellProps interface — all v2 routes use secondaryPane and showDetailPane props for pane composition"
  - "Pattern 9: Motion spring constant — const SPRING = { type: 'spring', stiffness: 260, damping: 28 } as const"
  - "Pattern 10: usePanelStore.openPanel(type, data) — opens detail pane; data is discriminated union for type safety"

duration: 3min
completed: 2026-02-27
---

# Phase 14 Plan 03: AppShell Layout Summary

**4-pane layout system with Motion spring animations (stiffness 260/damping 28): sidebar 220/72px, secondary 280px, main flex-1, detail 360/320px — all panes rounded-2xl with 12px gaps, responsive across desktop/tablet/mobile**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-27T15:36:04Z
- **Completed:** 2026-02-27T15:39:17Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- AppShell.tsx exports typed `AppShellProps` interface — all v2 route pages compose panes via `secondaryPane` and `showDetailPane` props; no per-page sidebar duplication
- Motion spring animations (`stiffness: 260, damping: 28`) on sidebar and secondary pane — feels native, not CSS slide transitions; `initial={false}` prevents entry animation on page load
- DetailPaneOutlet uses `AnimatePresence` from `motion/react` for spring slide-in/slide-out of Pane 4 — AnimatePresence handles unmount animation correctly
- Tablet auto-collapse: `useEffect` watching `isTablet` calls `setSidebarExpanded(false)` — sidebar drops to 72px icon rail automatically
- Mobile route-based stack: only main content renders full-screen with a minimal header bar — no overlay/drawer approach per CONTEXT.md locked decision
- All 7 stores/hooks/components compile with zero TypeScript errors; strict mode (`noUnusedLocals`, `noUnusedParameters`) passes clean

## Task Commits

Each task was committed atomically (in /dev/callvault repo):

1. **Task 1: Stores, hooks, and support components** — `339e423` (feat)
2. **Task 2: AppShell component with 4-pane Motion layout** — `0505e48` (feat)

## Files Created/Modified

- `/Users/Naegele/dev/callvault/src/components/layout/AppShell.tsx` — Master layout, exports AppShellProps, motion.nav sidebar + motion.div secondary + div main + DetailPaneOutlet (218 lines)
- `/Users/Naegele/dev/callvault/src/components/layout/SidebarToggle.tsx` — 24px rounded-full edge-mounted button, RiArrowLeftSLine rotates 180deg on collapse
- `/Users/Naegele/dev/callvault/src/components/layout/SidebarNav.tsx` — Org/workspace switcher stubs, TanStack Router Link nav items (All Calls, Import, Settings), data-tour attrs
- `/Users/Naegele/dev/callvault/src/components/layout/DetailPaneOutlet.tsx` — AnimatePresence, spring animation, placeholder panel content by type
- `/Users/Naegele/dev/callvault/src/stores/panelStore.ts` — Zustand v5 create<PanelState>()(), PanelData discriminated union
- `/Users/Naegele/dev/callvault/src/stores/preferencesStore.ts` — Zustand v5 create<PreferencesState>()(), localStorage cross-tab sync
- `/Users/Naegele/dev/callvault/src/hooks/useBreakpoint.ts` — matchMedia breakpoints, exports useBreakpointFlags
- `/Users/Naegele/dev/callvault/src/routes/_authenticated/index.tsx` — Updated to render AppShell with FolderSidebarStub + CallsListStub

## Decisions Made

- **motion/react (not framer-motion)**: All animations import from `motion/react`. The package is `motion` (v12), the import path is `motion/react`. Zero framer-motion imports in codebase.
- **AppShellProps flattened**: Plan specified `{ children, secondaryPane?, showDetailPane? }` as direct props (not nested config object like v1). This is cleaner for route-level JSX composition.
- **preferencesStore localStorage for sidebar only**: `isSidebarExpanded` persists to localStorage for cross-tab sync. `isSecondaryOpen` is session-only state (no persistence needed per plan).
- **PanelData discriminated union**: `type` field as discriminator enables Plan 04 panel components to safely narrow `panelData` without type assertions.
- **SidebarNav uses TanStack Router Link**: Important notes specified `<Link>` from `@tanstack/react-router`. No react-router-dom imports anywhere.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. The dev server at localhost:3000 will render the 4-pane AppShell immediately after Google OAuth sign-in.

## Next Phase Readiness

- AppShell foundation is complete — all v2 route pages wrap content in `<AppShell>` with appropriate props
- `usePanelStore().openPanel(type, data)` is ready to be called from any component to open the detail pane
- Plan 04 will replace stub components (FolderSidebarStub, CallsListStub, PanelPlaceholder) with real implementations
- TypeScript compiles clean with strict mode — no workarounds needed for Plan 04 development

## Self-Check: PASSED

| Item | Status |
|------|--------|
| src/components/layout/AppShell.tsx | FOUND |
| src/components/layout/SidebarToggle.tsx | FOUND |
| src/components/layout/SidebarNav.tsx | FOUND |
| src/components/layout/DetailPaneOutlet.tsx | FOUND |
| src/stores/panelStore.ts | FOUND |
| src/stores/preferencesStore.ts | FOUND |
| src/hooks/useBreakpoint.ts | FOUND |
| src/routes/_authenticated/index.tsx | FOUND (updated) |
| Commit 339e423 (Task 1) | FOUND |
| Commit 0505e48 (Task 2) | FOUND |
| TypeScript type check | PASS (zero errors) |
| No framer-motion imports | PASS |
| AppShellProps exported interface | PASS |
| motion/react imports | PASS |

---
*Phase: 14-foundation*
*Completed: 2026-02-27*
