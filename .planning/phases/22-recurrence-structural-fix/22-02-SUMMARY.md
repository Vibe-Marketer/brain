---
phase: 22-recurrence-structural-fix
plan: 02
subsystem: frontend-data
tags: [admin, recurrence, tanstack-query, supabase, tickets]

requires:
  - phase: 22-recurrence-structural-fix
    provides: ticket_class_metrics admin RPC and generated Supabase types
provides:
  - Brain service contract for ticket_class_metrics()
  - Admin TanStack Query hook for recurrence class metrics
  - Stable admin recurrence metrics query key
  - Plain-English recurrence class/status labels
affects: [phase-22-admin-surface, recurrence-metrics, admin-dashboard]

tech-stack:
  added: []
  patterns: [service-hook separation, typed RPC mapping, plain-English ticket display helpers]

key-files:
  created:
    - src/services/__tests__/admin-dashboard.recurrence.test.ts
    - src/lib/__tests__/ticket-display.recurrence.test.ts
  modified:
    - src/services/admin-dashboard.service.ts
    - src/hooks/useAdminDashboard.ts
    - src/lib/query-config.ts
    - src/lib/ticket-display.ts

key-decisions:
  - "Admin recurrence metrics remain behind the established service + hook boundary; components do not query Supabase directly."
  - "Recurrence labels intentionally omit raw class_key and fingerprint_root from operator copy."

patterns-established:
  - "getTicketClassMetrics() maps ticket_class_metrics() rows into camelCase fields for AdminTab consumers."
  - "useTicketClassMetrics() uses the same 30s stale / 60s refetch cadence as autopilot trust metrics."

requirements-completed: [REC-01, REC-02]

duration: 5min
completed: 2026-06-14
---

# Phase 22 Plan 02: Recurrence Metrics Service/Hook Summary

**Admin recurrence observability is exposed through typed service, hook, query-key, and display-helper contracts without component-side Supabase access.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-06-14T02:55:01Z
- **Completed:** 2026-06-14T02:59:25Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Added `TicketClassMetric` and `getTicketClassMetrics()` over the `ticket_class_metrics()` RPC.
- Added `queryKeys.admin.ticketClassMetrics()` and `useTicketClassMetrics()` with the trust-metrics cache cadence.
- Added recurrence class/status display helpers so AdminTab can render operator-safe labels without raw class keys.

## Task Commits

1. **Task 1 RED: Add recurrence metrics service contract** - `f31f148c` (test)
2. **Task 1 GREEN: Add recurrence metrics service mapper** - `9021612e` (feat)
3. **Task 2 RED: Add recurrence query and display contract** - `a90f707f` (test)
4. **Task 2 GREEN: Add recurrence metrics hook and labels** - `504846bd` (feat)

## Files Created/Modified

- `src/services/__tests__/admin-dashboard.recurrence.test.ts` - TDD coverage for recurrence RPC mapping and labeled error handling.
- `src/services/admin-dashboard.service.ts` - Typed recurrence metrics service contract and mapper.
- `src/lib/__tests__/ticket-display.recurrence.test.ts` - TDD coverage for query key, hook boundary, and display labels.
- `src/hooks/useAdminDashboard.ts` - `useTicketClassMetrics()` TanStack Query wrapper.
- `src/lib/query-config.ts` - Stable admin recurrence metrics query key.
- `src/lib/ticket-display.ts` - Plain-English recurrence class and status labels.

## Decisions Made

- The UI consumes recurrence metrics only through `useTicketClassMetrics()`; the service is the only browser-side caller of `ticket_class_metrics()`.
- `ticketClassLabel()` renders source + error class and deliberately omits `class_key` / `fingerprint_root` from display copy.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Verification

- `npm test -- src/services/__tests__/admin-dashboard.recurrence.test.ts` - passed (2 tests).
- `npm test -- src/lib/__tests__/ticket-display.recurrence.test.ts src/services/__tests__/admin-dashboard.recurrence.test.ts` - passed (11 tests).
- `npm run type-check` - passed with 0 new errors; existing baseline remains 322/346.
- `git diff -- package.json package-lock.json` - clean.
- `rg "from\\(\"ticket_classes\"|from\\('ticket_classes'|rpc\\(\"ticket_class_metrics\"|rpc\\('ticket_class_metrics'" src/pages src/components src/hooks src/lib src/services` - only the service RPC call exists.

## Known Stubs

None. Stub scan found only existing local accumulator/null-guard code in `src/services/admin-dashboard.service.ts`, not user-visible placeholders.

## User Setup Required

None.

## Next Phase Readiness

Phase 22 Plan 03 can render recurrence-rate observability in AdminTab by importing `useTicketClassMetrics()`, `ticketClassLabel()`, and `ticketClassStatusLabel()` without adding direct Supabase reads.

## Self-Check: PASSED

- Summary file exists at `.planning/phases/22-recurrence-structural-fix/22-02-SUMMARY.md`.
- Task commits exist: `f31f148c`, `9021612e`, `a90f707f`, `504846bd`.
- Required tests, type-check, package diff, and service-boundary grep passed.

---
*Phase: 22-recurrence-structural-fix*
*Completed: 2026-06-14*
