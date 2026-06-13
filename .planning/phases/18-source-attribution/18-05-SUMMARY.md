---
phase: 18-source-attribution
plan: 05
subsystem: ui
tags: [tickets, source-attribution, admin-dashboard, rpc, react, supabase]

requires:
  - phase: 18-source-attribution
    provides: ticket_source enum values, ticket_source_metrics RPC, source labels
provides:
  - Typed ticket source metrics service and Tickets hook
  - Dashboard Tickets by Source metrics card
  - Tickets Source mix metrics buttons with one-click filtering
affects: [phase-19-throughput, phase-20-nightly-qa, phase-21-sentry, phase-23-reporter-comms]

tech-stack:
  added: []
  patterns: [admin RPC service mapping, TanStack Query hook wrapper, plain-English source metrics UI]

key-files:
  created:
    - scripts/qa/verify-ticket-source-metrics-rpc.ts
    - .planning/phases/18-source-attribution/screenshots/18-05-dashboard-source-metrics.png
    - .planning/phases/18-source-attribution/screenshots/18-05-tickets-source-mix.png
  modified:
    - src/services/admin-dashboard.service.ts
    - src/services/__tests__/admin-dashboard.service.test.ts
    - src/hooks/useTickets.ts
    - src/lib/query-config.ts
    - src/pages/admin/DashboardSection.tsx
    - src/pages/admin/TicketsSection.tsx
    - src/types/supabase.ts

key-decisions:
  - "Source metrics are read from the admin-guarded ticket_source_metrics RPC, not recalculated from the current ticket page."
  - "Dashboard and Tickets reuse the same formatting helpers for whole-percent fixed rate and compact cycle time."
  - "Tickets Source mix keeps the fixed source order and uses zero values for sources absent from the current RPC result."

patterns-established:
  - "Admin metrics RPCs map snake_case database rows to camelCase service contracts before UI use."
  - "Operator-facing source metrics must render ticketSourceLabel() labels only."

requirements-completed: [SRC-02, SRC-03]

duration: 70min
completed: 2026-06-13
---

# Phase 18 Plan 05 Summary

**Per-source ticket metrics now appear in both Admin Dashboard and Tickets, backed by the live admin RPC and plain-English source labels.**

## Performance

- **Duration:** 70 min
- **Started:** 2026-06-13T18:10:28Z
- **Completed:** 2026-06-13T18:20:42Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- Added `TicketSourceMetrics`, `getTicketSourceMetrics()`, and `useTicketSourceMetrics()` around `ticket_source_metrics`.
- Rendered `Tickets by Source` in Dashboard with volume, fixed rate, and cycle time.
- Replaced Tickets page-local source mix estimates with global RPC metrics while preserving one-click source filtering.
- Added a live RPC verification script covering admin, anon, non-admin, and disposable-user cleanup.

## Task Commits

1. **Task 1: Add typed source metrics service and hook** - `d0625455`
2. **Task 2: Render Dashboard Tickets by Source metrics** - `698a1494`
3. **Task 3: Render Tickets Source mix summary with one-click filtering** - `af0f7053`

## Verification

- `supabase db push` - PASS; remote database already up to date.
- `supabase gen types typescript --linked > src/types/supabase.ts` - PASS; regenerated types confirmed `ticket_source_metrics` and enum values are live.
- `npm test -- src/services/__tests__/admin-dashboard.service.test.ts` - PASS, 26 tests.
- `npm test -- src/services/__tests__/admin-dashboard.service.test.ts src/lib/__tests__/ticket-display.test.ts` - PASS, 37 tests.
- `npm run type-check` - PASS, 0 new errors.
- `PATH="$PWD/node_modules/.bin:$PATH" tsx scripts/qa/verify-ticket-source-metrics-rpc.ts` - PASS, 4/4 live RPC checks.
- `npm run build` - PASS.
- Browser screenshots - PASS:
  - `.planning/phases/18-source-attribution/screenshots/18-05-dashboard-source-metrics.png`
  - `.planning/phases/18-source-attribution/screenshots/18-05-tickets-source-mix.png`
- Browser raw enum check on Tickets page - PASS; no visible `manual`, `nightly_qa`, `internal`, `unknown`, or `sentry` enum tokens.

## Files Created/Modified

- `src/services/admin-dashboard.service.ts` - Source metrics service, dashboard stats inclusion, shared metric formatters.
- `src/services/__tests__/admin-dashboard.service.test.ts` - RPC mapping, error, null cycle-time, and formatter coverage.
- `src/hooks/useTickets.ts` - `useTicketSourceMetrics()` TanStack Query wrapper.
- `src/lib/query-config.ts` - Stable admin query key for source metrics.
- `src/pages/admin/DashboardSection.tsx` - Dashboard `Tickets by Source` card.
- `src/pages/admin/TicketsSection.tsx` - RPC-backed `Source mix` buttons.
- `src/types/supabase.ts` - Regenerated Supabase types from the linked project.
- `scripts/qa/verify-ticket-source-metrics-rpc.ts` - Live RPC access probe.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Probe user cleanup fallback**
- **Found during:** Task 1 live RPC verification
- **Issue:** Direct `auth.admin.deleteUser()` returned `Database error deleting user` because this project protects auth user deletion.
- **Fix:** Added fallback to the existing service-role-only `cleanup_test_fixture_users(p_max_age_minutes := 0)` RPC for `@callvault.test` disposable users.
- **Files modified:** `scripts/qa/verify-ticket-source-metrics-rpc.ts`
- **Verification:** Live probe passed 4/4 and reported cleanup via the RPC fallback.
- **Committed in:** `d0625455`

**Total deviations:** 1 auto-fixed (Rule 3)
**Impact on plan:** No scope expansion; the fallback preserves the no-residue verification contract.

## Issues Encountered

- The shell did not have a global `tsx` command. The repo-local binary exists, so verification was run as `PATH="$PWD/node_modules/.bin:$PATH" tsx ...`.
- Build emitted existing Vite/Browserslist/chunk-size warnings; build exited 0.

## User Setup Required

None.

## Next Phase Readiness

Phase 19 can use the per-source metrics substrate for throughput and trust work. Phase 20 and Phase 21 can also rely on the same plain-English source labels and admin metrics surfaces for QA and Sentry-origin visibility.

## Self-Check: PASSED

---
*Phase: 18-source-attribution*
*Completed: 2026-06-13*
