# Phase 31 — Deferred Items

Out-of-scope discoveries surfaced during execution. Not fixed (Scope Boundary rule:
only auto-fix issues directly caused by the current task's changes).

## Plan 01, Task 3 — pre-existing unrelated integration test failures on TEST

**Found during:** Running `npm run test:integration -- event-resolution-shadow.integration.test.ts`
(2026-09-01). The npm script's hardcoded glob (`src/**/*.integration.test.ts
supabase/functions/**/__tests__/*.integration.test.ts`) runs the FULL integration
suite regardless of the extra CLI argument, so this surfaced pre-existing failures
unrelated to Phase 31's changes:

- `src/test/qa-ticket-ingestion.integration.test.ts` — "dedups by fingerprint without
  overwriting first severity or context": `ingest_qa_ticket` RPC returns error code
  `22023` ("ingest_qa_ticket rejects high/critical severity (route to qa_review lane)")
  on a call the test expects to succeed.
- `src/test/reporter-comms.integration.test.ts` — 5 tests fail on ticket fixture
  creation: `insert or update on table "tickets" violates foreign key constraint
  "tickets_reporter_id_fkey"`.

**Verified unrelated:** Phase 31 Plan 01 touches only `organization_feature_flags`,
`event_match_decisions`, `_shared/event-resolver.ts`, `resolve-events/index.ts`, and
its own integration test. Zero overlap with `tickets`, `ingest_qa_ticket`, or
reporter-comms code/schema (Phase 20/23 territory). These almost certainly reflect
TEST-project fixture/schema drift unrelated to this phase (e.g. a stale FK target or
an RPC signature change) that predates this plan's execution.

**Confirmed not caused by this plan:** Running ONLY the new
`event-resolution-shadow.integration.test.ts` file in isolation (bypassing the npm
script's broad glob) passes 3/3 cleanly against TEST — this phase's own deliverable
is fully green.

**Status:** Deferred. Not fixed (out of scope for Phase 31). Flagging for whoever
next touches `qa-ticket-ingestion` or `reporter-comms` on TEST.
