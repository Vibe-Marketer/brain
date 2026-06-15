---
phase: 23-reporter-comms-in-app
plan: 02
subsystem: database
tags: [postgres, supabase, ticket_events, user_notifications, integration-test]

requires:
  - phase: 23-01
    provides: in_app_user ticket_source enum and server-side in-app support ticket stamping
provides:
  - fail-closed ticket_events trigger for reporter lifecycle notifications
  - real-DB integration coverage for source gates, safe templates, status-audit fan-out, and idempotency
affects: [reporter-comms, ticket-lifecycle, notifications, phase-23-plan-04]

tech-stack:
  added: []
  patterns:
    - SECURITY DEFINER ticket_events trigger
    - user_notifications outbox reuse
    - real Supabase integration test

key-files:
  created:
    - supabase/migrations/20260614130000_phase23_reporter_lifecycle_notify.sql
    - src/test/reporter-comms.integration.test.ts
  modified: []

key-decisions:
  - "Reporter lifecycle notifications are centralized in a ticket_events trigger and fail closed unless tickets.source is in_app_user and reporter_id is present."
  - "Resolution status remains silent in this trigger; resolved reporter summaries stay reserved for the verified deploy hook in Plan 04."
  - "The test asserts the locked DB-emitted copy exactly and blocks internal/agent/autopilot/path/SHA terms."

patterns-established:
  - "Reporter comms trigger maps only created, in_progress, and escalated lifecycle events to locked safe notification templates."
  - "Status-change notification tests must drive UPDATE tickets.status to prove ticket_status_audit -> ticket_events -> notify trigger behavior."

requirements-completed: [RSP-01, RSP-03]

duration: 5min
completed: 2026-06-15
---

# Phase 23 Plan 02: Reporter Lifecycle Notifications Summary

**Fail-closed Postgres reporter notifications for received, in-progress, and escalated in-app tickets, with real-DB proof of safe copy and idempotency**

## Performance

- **Duration:** 5 min
- **Started:** 2026-06-15T04:43:39Z
- **Completed:** 2026-06-15T04:48:19Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added `notify_in_app_reporter_from_event()` and `ticket_event_reporter_lifecycle_notify` on `ticket_events`.
- Inserted exactly one `user_notifications` row per reporter/ticket/kind for `created`, `in_progress`, and `escalated`.
- Added real Supabase integration tests for in-app fan-out, non-in-app fail-closed behavior, null reporter silence, resolved silence, safe locked copy, and idempotency.
- Applied Phase 23 migrations to both the linked live Supabase project and the dedicated integration test project before verification.

## Task Commits

1. **Task 1: Create notify_in_app_reporter_from_event() trigger function + trigger** - `e4483d70` (`feat(23)`)
2. **Task 2: Real-DB integration test for source gate + idempotency fan-out** - `f8479987` (`test(23)`)

## Files Created/Modified

- `supabase/migrations/20260614130000_phase23_reporter_lifecycle_notify.sql` - Adds the fail-closed lifecycle notification trigger and locked templates.
- `src/test/reporter-comms.integration.test.ts` - Verifies real DB behavior for source gating, status update trigger chains, safe copy, resolved silence, and idempotency.

## Decisions Made

- Used `v_ticket.source IS DISTINCT FROM 'in_app_user'` so null or uncertain source values fail closed even though the current schema keeps `tickets.source` `NOT NULL`.
- Kept resolution handling out of the lifecycle trigger; Plan 04 owns resolved reporter summaries through verified deploy.
- Used the exact 23-UI-SPEC strings in SQL and asserted exact equality in the integration test.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Replaced the blanket resolved grep with a specific branch assertion**
- **Found during:** Task 1 static verification
- **Issue:** The plan's `! grep -q "resolved"` check conflicted with W1 because comments or test documentation may mention resolved while the real invariant is no `new_value = 'resolved'` handling branch.
- **Fix:** Verified `! grep -Eq "new_value\\s*=\\s*'resolved'"` and relied on the integration test's resolved-silence case.
- **Files modified:** none beyond planned task files
- **Verification:** Task 1 static check passed; integration test resolved case passed.
- **Committed in:** `e4483d70` and `f8479987`

**2. [Rule 3 - Blocking] Applied pending Phase 23 migrations to the dedicated test Supabase project**
- **Found during:** Task 2 integration verification
- **Issue:** The dedicated test project lacked the `in_app_user` enum value, so real-DB tests failed with `invalid input value for enum ticket_source: "in_app_user"`.
- **Fix:** Ran `supabase db push --db-url "$SUPABASE_TEST_DB_URL"` to apply `20260614120000_phase23_source_gate_in_app_user.sql` and `20260614130000_phase23_reporter_lifecycle_notify.sql` to the test project.
- **Files modified:** none
- **Verification:** `npm run test:integration -- --testNamePattern "phase-23-02|reporter-comms"` passed.
- **Committed in:** n/a

---

**Total deviations:** 2 auto-fixed (1 missing critical verification adjustment, 1 blocking test-project schema setup)
**Impact on plan:** No scope expansion; both deviations were required to prove the locked invariants accurately.

## Issues Encountered

- `tickets.source` is currently `NOT NULL`, so a literal null source ticket cannot be created in the integration test without changing schema. The trigger uses a null-safe source condition, and the test covers all executable fail-closed paths: manual, sentry, nightly_qa, internal, unknown, omitted/default source, and null reporter.
- Running the unfiltered integration script initially executed unrelated suites and exposed pre-existing donor fixture failures. The Phase 23 verification was rerun through the npm entrypoint with a test-name filter, yielding only Phase 23 tests as passing.

## Verification

- `grep -q "notify_in_app_reporter_from_event" ... && grep -q "source IS DISTINCT FROM 'in_app_user'" ... && grep -q "NOT EXISTS" ... && ! grep -Eq "new_value\\s*=\\s*'resolved'" ... && echo OK` -> `OK`
- `supabase db push --linked` -> applied `20260614130000_phase23_reporter_lifecycle_notify.sql` to linked project `vltmrnjsubfzrgrtdqey`
- `supabase db push --db-url "$SUPABASE_TEST_DB_URL"` -> applied Phase 23 enum + lifecycle migrations to dedicated test project
- `npm run build` -> passed
- `VITEST_INTEGRATION_OK=true ./node_modules/.bin/vitest run --reporter=verbose src/test/reporter-comms.integration.test.ts` -> 6 passed
- `npm run test:integration -- --testNamePattern "phase-23-02|reporter-comms"` -> 6 passed, 54 skipped

## Known Stubs

None.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: customer-visible-db-write | `supabase/migrations/20260614130000_phase23_reporter_lifecycle_notify.sql` | New SECURITY DEFINER trigger writes customer-visible `user_notifications`; mitigated by source/reporter fail-closed gate, locked templates, and idempotency. |

## User Setup Required

None.

## Next Phase Readiness

Plan 03 can consume the `user_notifications` outbox knowing the DB only emits reporter-safe lifecycle rows for in-app reports. Plan 04 must keep using verified deploy as the resolution authority and must not reuse this trigger for resolved summaries.

## Self-Check: PASSED

- Found `supabase/migrations/20260614130000_phase23_reporter_lifecycle_notify.sql`
- Found `src/test/reporter-comms.integration.test.ts`
- Found `.planning/phases/23-reporter-comms-in-app/23-02-SUMMARY.md`
- Found task commit `e4483d70`
- Found task commit `f8479987`

---
*Phase: 23-reporter-comms-in-app*
*Completed: 2026-06-15*
