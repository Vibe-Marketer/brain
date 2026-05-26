---
phase: 12-import-flows-source-details
plan: "01"
subsystem: ui
tags: [react, import, fathom, zoom, alertdialog, radix-ui]

# Dependency graph
requires:
  - phase: 11-org-segregation-4-pane
    provides: ImportPage with secondaryPane wired, ImportSourcePane, ImportOverviewDashboard
provides:
  - FathomImportDetail wired into ImportPage Pane 3 (isConnected/accountEmail/onConnect/onDisconnect props)
  - ZoomImportDetail wired into ImportPage Pane 3 (same props)
  - Disconnect confirmation dialog via AlertDialog
  - Failed imports alert is now clickable (navigates to import-history)
  - YouTube shows "Connected" status in overview (always available)
affects: [14-onboarding-e2e, import-flows]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Detail components receive isConnected+onConnect+onDisconnect — they own their own connected/disconnected UI states"
    - "AlertDialog disconnect confirmation pattern: setDisconnectTarget(row) opens dialog, confirmed disconnect calls mutate"

key-files:
  created: []
  modified:
    - src/pages/ImportPage.tsx
    - src/components/import/ImportOverviewDashboard.tsx

key-decisions:
  - "FathomImportDetail/ZoomImportDetail own their connected/disconnected UI — ImportPage passes props, not wrapper markup"
  - "Disconnect flows through AlertDialog confirmation before mutating — preserves call data messaging baked in"
  - "YouTube deriveSourceStatus returns 'connected' unconditionally — no OAuth required, always available to any user"

patterns-established:
  - "Import detail components handle their own header bar (icon, account email, Disconnect button) — no duplication in page"
  - "AlertDialog at root level of page component for disconnect confirmation — one dialog, two sources (fathom/zoom)"

requirements-completed: [IMPORT-01, IMPORT-02, IMPORT-03, IMPORT-04, IMPORT-05, IMPORT-06, IMPORT-07, IMPORT-08]

# Metrics
duration: 8min
completed: 2026-03-30
---

# Phase 12 Plan 01: Import Source Detail Wiring Summary

**FathomImportDetail and ZoomImportDetail wired into ImportPage Pane 3 with connect/disconnect props; failed imports alert made actionable with one-click navigation to retry view**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-30T21:25:00Z
- **Completed:** 2026-03-30T21:33:50Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Replaced SourceCard-only rendering with full FathomImportDetail/ZoomImportDetail components in ImportPage Pane 3 — users can now search, select, and import from Fathom and Zoom
- Wired disconnect confirmation dialog (AlertDialog) — "Disconnect Fathom/Zoom?" with "Your imported calls will remain in CallVault" copy
- Made failed imports alert in overview dashboard clickable — "Review & retry failed imports" button navigates to FailedImportsSection
- Fixed YouTube showing "Setup needed" — now correctly shows "Connected" (no OAuth, always available)

## Task Commits

1. **Task 1: Wire FathomImportDetail and ZoomImportDetail into ImportPage Pane 3** - `e533903e` (feat)
2. **Task 2: Surface failed imports in overview dashboard with actionable link** - `4faad893` (feat)

**Plan metadata:** (final doc commit below)

## Files Created/Modified
- `src/pages/ImportPage.tsx` - Replaced SourceCard with FathomImportDetail/ZoomImportDetail; added AlertDialog disconnect confirmation; removed handleFathomSync/handleZoomSync
- `src/components/import/ImportOverviewDashboard.tsx` - Added clickable "Review & retry" button to failed imports alert; fixed YouTube status to 'connected'

## Decisions Made
- FathomImportDetail and ZoomImportDetail own their own header bar (connected badge, account email, Disconnect button) — ImportPage only needs to pass `isConnected`, `onConnect`, and `onDisconnect` props. No wrapper markup needed in ImportPage.
- Disconnect dialog lives at the ImportPage root level and serves both Fathom and Zoom — one dialog, dynamic label based on `disconnectTarget.source_app`.
- `handleFathomSync` and `handleZoomSync` removed entirely — the detail components invoke their own edge functions internally.

## Deviations from Plan

**1. [Rule 1 - Bug] Adapted disconnect UI to component's built-in header**

The plan specified adding a separate header bar in ImportPage wrapping each detail component. On reading `FathomImportDetail.tsx` and `ZoomImportDetail.tsx`, both components already render their own sticky header bar with icon, account email, and Disconnect button internally. Adding another header from ImportPage would double the header. Instead, the components receive `onDisconnect` as a prop, which ImportPage sets to `() => setDisconnectTarget(row)` to trigger the confirmation dialog. Functionally identical outcome, cleaner composition.

- **Found during:** Task 1
- **Fix:** Pass `onDisconnect` prop to detail components (they call it from their internal Disconnect button); AlertDialog confirmation dialog remains in ImportPage
- **Files modified:** src/pages/ImportPage.tsx
- **Committed in:** e533903e (Task 1 commit)

---

**Total deviations:** 1 auto-adapted (Rule 1 — existing component structure)
**Impact on plan:** Cleaner outcome — no duplicate header bars. Functional behavior identical. Both IMPORT-01/02 truths satisfied.

## Issues Encountered

**Pre-existing build failure (out of scope):** `src/pages/OAuthCallback.tsx` imports `@/lib/zoom-api-client` which does not exist — causes `npm run build` to fail with ENOENT. This pre-dates Phase 12. Logged to `deferred-items.md` for resolution before production deployment. TypeScript compiles cleanly (`tsc --noEmit` passes).

## Known Stubs

None — all import flows are wired to real edge functions. No placeholder data or TODO stubs.

## Next Phase Readiness
- Import flows are end-to-end: Fathom search/select/import, Zoom search/select/import, YouTube URL import, File Upload, Failed Imports retry — all wired
- Phase 14 (Onboarding E2E) dependency on Phase 12 is now met
- Pre-existing build failure in OAuthCallback.tsx must be resolved before pushing to production

---
*Phase: 12-import-flows-source-details*
*Completed: 2026-03-30*
