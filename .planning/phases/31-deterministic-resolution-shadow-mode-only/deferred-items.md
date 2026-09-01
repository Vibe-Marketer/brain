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

## Plan 03, Task 1 — `rls-regression.test.ts`'s own `organizations` cleanup step
   silently leaves orphaned test orgs on TEST (pre-existing, not caused by this plan)

**Found during:** Verifying the `event_match_decisions` + `organization_feature_flags`
deny-table registration (running `src/test/rls-regression.test.ts` directly against TEST,
3 times, 2026-09-01). After each run, a direct service-role query for
`organizations` rows matching `%phase-38-01%` (this suite's `SUITE_TAG`) returned **96
rows**, ages spanning 2026-06-11 through the run just completed -- i.e. 90 rows predating
this plan's session by up to ~3 months, plus 6 rows (3 Org A/B pairs) from this plan's own
3 verification runs.

**Root cause (partially confirmed):** `rls-regression.test.ts`'s own `afterAll` step 1e
(`if (orgAId) await admin.from("organizations").delete().eq("id", orgAId); ...`) has the
same unchecked-`.error` pattern already documented in Plan 01's and Plan 02's entries
above (Supabase-js resolves a query error rather than throwing, so a failed delete is
silent). However, a direct manual re-delete of this plan's own 6 orphaned org rows
(minutes after the run that created them, no special handling) **succeeded immediately
with no error** -- so the delete call itself is not structurally broken. This points to
the 90 pre-existing orphans being a symptom of *interrupted* runs (agent timeout, Ctrl-C,
crashed process) that never reached `afterAll` at all, or were killed mid-`afterAll` --
exactly the failure mode `20260522190000_cleanup_test_fixtures.sql`'s own comment names
as its reason for existing ("local-dev runs that get SIGKILL'd, CI runners that crash,
Forge/agent test runs that get terminated"). The gap: `cleanup_test_fixture_users` sweeps
`auth.users` and cascades from there, but `organizations` has no direct FK to
`auth.users` (only `organization_memberships` does), so an org orphaned by an interrupted
run is never swept by the existing safety net and accumulates forever.

**Confirmed not caused by this plan:** This plan's own files
(`event_match_decisions`, `organization_feature_flags`) leave **zero** trace after 3
consecutive full-suite runs against TEST (verified via direct service-role query after
each run). The 90 pre-existing orphaned orgs (oldest: 2026-06-11) predate this plan by
~3 months and are unrelated to the `CLIENT_DENY_TABLES` registration this plan adds.
This plan's own 6 orphaned orgs (from verification runs) were manually swept via the
service role as a courtesy cleanup -- confirmed 0 remaining afterward (90 pre-existing
rows left untouched, out of scope).

**Status:** Deferred. Not fixed (pre-existing, repo-wide test-infrastructure hygiene gap
in a cleanup step this plan's task did not touch or need to touch -- `orgAId`/`orgBId`
cleanup is unrelated to the `CLIENT_DENY_TABLES` array or the bespoke
`event_match_decisions`/`organization_feature_flags` isolation block this plan added).
The real fix is either (a) extend `cleanup_test_fixture_users` to also sweep
`organizations` rows matching the same test-domain naming convention independent of any
`auth.users` FK, or (b) add `.error` checks to `rls-regression.test.ts`'s own `afterAll`
steps so a future failure is at least visible in test output instead of silent. Flagging
for whoever next owns integration test infrastructure hygiene (same owner as the Plan 02
entry above).
