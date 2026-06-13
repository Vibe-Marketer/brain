---
phase: 17-activation-per-run-observability-go-live-hardening
plan: 02
subsystem: ui
tags: [react, tanstack-query, supabase, admin-dashboard, runner-runs]

requires:
  - phase: 17-01
    provides: runner_runs ledger schema and generated Supabase types
provides:
  - Admin service reads for recent and per-ticket runner_runs rows
  - TanStack Query hooks and keys for runner run observability
  - Existing AdminTab Autopilot card populated with recent run summaries
  - Ticket detail evidence enriched with admin-only run diff/test/gate/rebase/replay detail
affects: [phase-17, ACT-04, admin-dashboard, ticket-evidence, runner-runs]

tech-stack:
  added: []
  patterns:
    - service + hook separation for runner_runs reads
    - text-safe React rendering for run ledger detail JSON
    - existing AdminTab surfaces only; no new route or tab

key-files:
  created:
    - .planning/phases/17-activation-per-run-observability-go-live-hardening/17-02-SUMMARY.md
  modified:
    - src/services/admin-dashboard.service.ts
    - src/services/__tests__/admin-dashboard.service.test.ts
    - src/hooks/useAdminDashboard.ts
    - src/lib/query-config.ts
    - src/pages/admin/DashboardSection.tsx
    - src/components/settings/TicketDetailDialog.tsx
    - src/components/settings/__tests__/TicketDetailDialog.test.tsx
    - src/components/admin/TicketEvidence.tsx
    - src/components/admin/__tests__/TicketEvidence.test.tsx

key-decisions:
  - "Runner run reads stay inside admin-dashboard.service.ts and useAdminDashboard.ts to preserve service + hook separation."
  - "Cost is labeled as Budget est. and displayed as the ledger value only; no per-token or dollar-meter copy was introduced."
  - "TicketDetailDialog requests runner run rows only for admins and renders them through the existing TicketEvidence surface."

patterns-established:
  - "queryKeys.admin.runnerRuns() and queryKeys.admin.runnerRunsForTicket(ticketId) are the canonical cache keys for runner_runs."
  - "TicketEvidence accepts optional runnerRuns and renders ledger detail as React text/pre content only."

requirements-completed: [ACT-04]

duration: 1h12m
completed: 2026-06-13
---

# Phase 17 Plan 02: Admin Run Observability Summary

**AdminTab now reads the runner_runs ledger, shows recent run status in the existing Autopilot card, and folds per-ticket run detail into the existing evidence view.**

## Performance

- **Duration:** 1h12m
- **Started:** 2026-06-13T16:22:28Z
- **Completed:** 2026-06-13T17:34:00Z
- **Tasks:** 3 completed
- **Files modified:** 9 code/test files plus this summary

## Accomplishments

- Added typed `runner_runs` service reads for recent runs and ticket-scoped rows, with stable TanStack Query keys and polling hooks.
- Extended the existing AdminTab Autopilot card with a compact recent-run list showing pass/fail, status/outcome, gate verdict/stage, duration, budget estimate, and fix SHA.
- Extended `TicketDetailDialog` and `TicketEvidence` so admins can inspect run-level diff, test command/exit/output tail, gate reasoning, rebase result, and repro replay outcome without a new modal or tab.
- Verified the populated run-list UI in desktop and mobile browser screenshots using a Playwright REST mock for `runner_runs`; live production currently returned no run rows, so the real page showed the quiet empty state.

## Task Commits

1. **Task 1 RED: Add runner-run service coverage** - `9cf2f24b` (`test(17-02)`)
2. **Task 1 GREEN: Add runner-run admin reads** - `7a206c4f` (`feat(17-02)`)
3. **Task 2: Render the runner card run list** - `ff69016f` (`feat(17-02)`)
4. **Task 3 RED: Add runner run evidence coverage** - `0daaf5ed` (`test(17-02)`)
5. **Task 3 GREEN: Fold runner runs into ticket evidence** - `444dedee` (`feat(17-02)`)
6. **Runtime fix from browser verification** - `ca8da854` (`fix(17-02)`)

Note: `eb1bfb06` (`docs(17-03)`) landed on `main` between this plan's Task 3 RED and GREEN commits. It was unrelated and was preserved.

## Files Created/Modified

- `src/services/admin-dashboard.service.ts` - Added `RunnerRun`, `fetchRunnerRuns(limit)`, and `fetchRunnerRunsForTicket(ticketId)`.
- `src/services/__tests__/admin-dashboard.service.test.ts` - Covered success, empty rows, Supabase error, and ticket filtering.
- `src/hooks/useAdminDashboard.ts` - Added `useRunnerRuns()` and `useRunnerRunsForTicket()`.
- `src/lib/query-config.ts` - Added stable admin runner-run query keys.
- `src/pages/admin/DashboardSection.tsx` - Extended the existing Autopilot card with the recent-run list.
- `src/components/settings/TicketDetailDialog.tsx` - Loads per-ticket run rows only for admins and passes them into `TicketEvidence`.
- `src/components/settings/__tests__/TicketDetailDialog.test.tsx` - Covered per-ticket hook use and evidence mounting for run rows.
- `src/components/admin/TicketEvidence.tsx` - Renders run diff/tests/gate/rebase/replay detail as text-safe React content.
- `src/components/admin/__tests__/TicketEvidence.test.tsx` - Covered run details present, absent state, and text-safe rendering.

## Decisions Made

- Reused `admin-dashboard.service.ts` rather than creating a new service file because the plan targets the existing AdminTab dashboard service/hook boundary.
- Kept the run list under `RunnerOpsCard`; no new admin navigation, route, tab, charting library, or package was added.
- Treated `est_cost` as a budget estimate display field only and labeled it `Budget est.`.
- Restricted the per-ticket `runner_runs` query to admin viewers while preserving existing reporter-visible agent evidence behavior.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed dashboard runtime ReferenceError**
- **Found during:** Browser screenshot verification after Task 3
- **Issue:** `DashboardSection.tsx` used `sectionLabelClass` in `RunnerOpsCard`, but that constant only existed in other files. `npm run build` passed, but the browser route hit the runtime error boundary.
- **Fix:** Added the local `sectionLabelClass` constant in `DashboardSection.tsx`.
- **Files modified:** `src/pages/admin/DashboardSection.tsx`
- **Verification:** Targeted tests + `npm run build` passed; authenticated browser route then rendered with `pageErrors=0`.
- **Committed in:** `ca8da854`

**Total deviations:** 1 auto-fixed (Rule 1 bug)
**Impact on plan:** Required for the AdminTab surface to render; no scope expansion.

## Issues Encountered

- `agent-browser` was not installed, so browser verification used the repo's Playwright dependency.
- The first authenticated `/admin/dashboard` screenshot showed no recent run rows because the live ledger query returned an empty list. A Playwright route mock for `runner_runs` was used only for visual verification of the populated run-list layout; no database writes were made.
- Existing Vite warnings remain: CJS Vite Node API deprecation, stale Browserslist data, and large chunk warnings. These were pre-existing build warnings, not new failures.

## Verification

- `npm test -- src/services/__tests__/admin-dashboard.service.test.ts` - passed, 22 tests.
- `npm test -- src/services/__tests__/admin-dashboard.service.test.ts src/components/settings/__tests__/TicketDetailDialog.test.tsx src/components/admin/__tests__/TicketEvidence.test.tsx` - passed, 47 tests.
- `npm run build` - passed.
- Authenticated browser route check: `http://127.0.0.1:3001/admin/dashboard` rendered with `hasAutopilot=true`, `hasRecentRuns=true`, `pageErrors=0`.
- Populated visual check with mocked `runner_runs`: `hasBudgetEstimate=true`, `hasGate=true`, `pageErrors=0`.
- Screenshots:
  - `/tmp/callvault-admin-dashboard-17-02-desktop.png` - live empty-state dashboard.
  - `/tmp/callvault-admin-dashboard-17-02-populated-desktop.png` - populated run-list dashboard.
  - `/tmp/callvault-admin-dashboard-17-02-run-card-desktop.png` - focused desktop run-card view.
  - `/tmp/callvault-admin-dashboard-17-02-run-card-mobile.png` - focused mobile run-card view.

## Known Stubs

None. Empty states are intentional for no `runner_runs` rows.

## Threat Flags

None. No new network endpoint, auth path, schema surface, file access, package, or HTML rendering path was introduced.

## Auth Gates

None. Browser verification used existing credentials from `.env` and did not require user action.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

ACT-04 is ready for the remaining Phase 17 work: the run ledger can now be scanned from AdminTab and inspected from ticket detail once real runs populate `runner_runs`.

## Self-Check: PASSED

- Summary and key modified files exist on disk.
- Commit hashes found: `9cf2f24b`, `7a206c4f`, `ff69016f`, `0daaf5ed`, `444dedee`, `ca8da854`.

---
*Phase: 17-activation-per-run-observability-go-live-hardening*
*Completed: 2026-06-13*
