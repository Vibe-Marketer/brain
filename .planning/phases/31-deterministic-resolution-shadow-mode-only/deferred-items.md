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

## Plan 02, Task 2 — root-caused the "full-suite parallel run corrupts in-flight
   fixtures" mechanism Plan 01 could only guess at

**Found during:** Running `npm run test:integration -- event-match-apply-reverse.integration.test.ts`
(2026-09-01), the plan's own literal acceptance command. As Plan 01 already documented,
the npm script's hardcoded glob runs the FULL integration suite regardless of the extra
CLI argument. This time the fallout was more precise and now has a confirmed root cause:

**Root cause (confirmed, not guessed):** Every integration test file's `afterAll` in this
repo calls `admin.rpc("cleanup_test_fixture_users", { p_max_age_minutes: 0 })`. That
RPC's own migration (`20260522190000_cleanup_test_fixtures.sql`) documents the age
threshold's entire purpose: *"Age threshold (default 60 minutes) prevents racing with
in-flight test runs"* and *"p_max_age_minutes defaults to 60, so any fixture created in
the last hour is preserved (won't race with an actively running test suite)"* -- but
every call site in the test suite passes `0`, which sets `v_age_cutoff = NOW()` and
deletes EVERY `%@callvault.test` / `%@example.invalid` / `qa-sweep-%@vibeos.com` user
`created_at < NOW()`, i.e. effectively all of them, regardless of which test file
created them or whether that file's `it()` blocks are still running. Vitest runs test
files in parallel by default, so any file whose `afterAll` fires first deletes every
OTHER still-running file's fixture `auth.users` rows out from under it -- cascading to
their `recordings` (and everything FK'd off `recordings`, including
`event_match_decisions`) mid-test. This is a genuine cross-transaction race (each
statement in a SECURITY DEFINER PL/pgSQL function sees newly-committed data from other
sessions under READ COMMITTED), not a logic bug in any one test file.

**Directly observed:** In this run, `event-match-apply-reverse.integration.test.ts`
(this plan's own new file) failed on its `reverse_event_match_atomic(owner)` test with
`23503` (`recording_id_a` no longer present in `recordings`) -- the ownership check had
passed moments earlier in the same function call, then the row vanished mid-transaction.
`event-resolution-shadow.integration.test.ts` (Plan 01's file) and
`event-schema-noop.integration.test.ts` (Phase 30's file) failed the same run for the
identical reason (their fixture rows disappeared mid-suite). `event-schema-noop`'s
failure additionally left 7 orphaned `organizations` on TEST -- confirming Plan 01's own
prediction in 31-01-SUMMARY.md ("has the same unchecked-`.error` pattern... worth a look
if TEST accumulates orphaned Phase-30 fixture data over time"). Swept manually (workspace_entries
-> recordings -> organizations, mirroring the established cleanup order); TEST confirmed
clean afterward (0 rows matching `%phase-30-03 event-schema-noop%`).

**Confirmed not caused by this plan:** Running ONLY
`event-match-apply-reverse.integration.test.ts` in isolation (bypassing the npm script's
broad glob) passes 6/6 cleanly against TEST, twice, before and after the cleanup sweep
above -- this plan's own deliverable (MATCH-10's apply/reverse round trip) is fully green
and deterministic. The race is triggered by ANY two-or-more integration test files
running together, pre-dates this plan, and would reproduce identically with any other
pair of integration test files that both seed `@callvault.test` fixture users.

**Status:** Deferred. Not fixed (repo-wide pattern spanning every integration test file
in `src/test/` and `supabase/functions/**/__tests__/` -- well outside this plan's file
list). The real fix is either (a) every call site should pass a non-zero
`p_max_age_minutes` (e.g. 5) so only fixtures old enough to be truly abandoned get swept,
or (b) `vitest.config.ts` should force integration test files to run sequentially
(`fileParallelism: false` or `poolOptions.threads.singleThread: true`) for the
`*.integration.test.ts` glob specifically. Flagging for whoever next owns integration
test infrastructure hygiene.
