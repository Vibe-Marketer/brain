---
phase: 18-source-attribution
plan: 02
subsystem: testing-services
tags: [tickets, source-attribution, supabase-edge-functions, service-layer, vitest]

requires:
  - phase: 18-source-attribution
    provides: ticket_source enum values unknown, nightly_qa, internal and regenerated Supabase types
provides:
  - regression coverage that browser support-ticket requests cannot control ticket source
  - preserved server-side manual source stamping for person-reported tickets
  - nullable reporter handling for system tickets in the ticket list service
  - source filter coverage for nightly_qa, internal, and unknown
affects: [phase-18, phase-20, phase-23, tickets-service, admin-tickets]

tech-stack:
  added: []
  patterns:
    - static Edge Function contract tests for Deno-only handlers
    - service-local system reporter fallback for null reporter_id rows

key-files:
  created:
    - supabase/functions/send-support-ticket/__tests__/source-stamping.test.ts
  modified:
    - src/services/tickets.service.ts
    - src/services/__tests__/tickets.service.test.ts

key-decisions:
  - "send-support-ticket remains a person-report intake and always stamps source as manual server-side."
  - "System tickets with reporter_id null display as System in the service layer and do not trigger profile lookups."

patterns-established:
  - "Browser-facing support-ticket source ownership is verified at the schema and insert boundary."
  - "Ticket reporter profile batches must filter nullable IDs before Supabase .in() calls."

requirements-completed: [SRC-01, SRC-02]

duration: 4min
completed: 2026-06-13
---

# Phase 18 Plan 02: Source Attribution Intake and Ticket List Summary

**Server-owned support-ticket source stamping plus null-safe, source-aware ticket list reads.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-06-13T17:47:04Z
- **Completed:** 2026-06-13T17:51:25Z
- **Tasks:** 2 completed
- **Files modified:** 3

## Accomplishments

- Added `send-support-ticket` regression coverage proving the browser request schema does not expose `source`, the insert boundary stamps `source: 'manual'`, and shared auth runs before body parsing.
- Updated `getTickets()` to filter null reporter IDs before querying `user_profiles`.
- Added service tests for the new generated source values: `nightly_qa`, `internal`, and `unknown`.
- Returned a stable `System` reporter label for system tickets with `reporter_id = null`.

## Task Commits

1. **Task 1: Prove support-ticket source is server-owned** - `d7536f2d` (`test(18): lock support ticket source stamping`)
2. **Task 2: Make ticket list service source-aware and nullable-reporter safe** - `5804bb5c` (`fix(18): handle system ticket reporters`)

## Files Created/Modified

- `supabase/functions/send-support-ticket/__tests__/source-stamping.test.ts` - Static Edge Function contract test for server-owned source stamping.
- `src/services/tickets.service.ts` - Filters nullable reporter IDs and uses `System` for null-reporter tickets.
- `src/services/__tests__/tickets.service.test.ts` - Covers new source filters and nullable reporter behavior.

## Verification

- `npm test -- supabase/functions/send-support-ticket/__tests__/source-stamping.test.ts` passed: 3 tests.
- `grep -n "source:" supabase/functions/send-support-ticket/index.ts` returned only `source: 'manual'`.
- `npm test -- src/services/__tests__/tickets.service.test.ts` passed: 20 tests.
- `npm run type-check` passed with 0 new errors; existing baseline remains 347/776.
- Task 2 RED check failed before the service fix with `Unexpected table: user_profiles`, proving the nullable reporter regression test covered the bug.

## Decisions Made

- Kept `send-support-ticket` unchanged functionally because it already ignored client-supplied `source` and stamped `manual` server-side.
- Used `System` as the service-local reporter label for null reporter rows, avoiding UI imports and keeping table rendering stable.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Task 1 RED did not fail because the implementation already had the desired behavior. The new test suite now locks that behavior and would fail if `source` were added to the request schema or wired from client input.
- Task 2 RED failed as expected on the nullable reporter path, then passed after filtering reporter IDs.

## Known Stubs

None.

## Threat Flags

None beyond the plan threat model. No new endpoint, auth path, schema object, or network surface was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 03 can update the external `~/dev/autopilot` source stamping paths knowing the brain-side person-report intake is server-owned and the ticket list service tolerates null-reporter operational tickets.

## Self-Check: PASSED

- Found created summary file and Task 1 test file.
- Found task commits: `d7536f2d` and `5804bb5c`.
- Confirmed no tracked file deletions in either task commit.

---
*Phase: 18-source-attribution*
*Completed: 2026-06-13*
