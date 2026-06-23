---
phase: 24-sync-status-foundation
plan: 04
subsystem: database
tags: [supabase, migration, db-push, integration-test, real-db, rls, reconciliation, prod-ref-guard]

# Dependency graph
requires:
  - phase: 24-sync-status-foundation (Plans 01, 02, 03)
    provides: canonical reader (getSyncStatusForExternalIds), additive sync_jobs migration + org RLS, NULL source_call_id backfill, orphan-report reconciliation migration (all write-only until this plan)
provides:
  - "All three Phase 24 migrations applied to PROD (ref vltmrnjsubfzrgrtdqey) and to the TEST project (ref swjzxiddcrtaqixsfaac)"
  - "Real-DB integration test (phase24-sync-status-foundation.integration.test.ts) proving IMP-01/02/03/04 against the live TEST DB, TEST-project-guarded, zero mocks"
  - "Live RLS regression green with sync_jobs cross-org isolation"
affects: [25-durable-selection, 26-unified-import-surface, 27-observable-jobs, 28-server-side-sync-all, 29-partial-success-retry]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Prod-ref-guarded supabase db push: assert DATABASE_URL contains vltmrnjsubfzrgrtdqey before connecting; TEST push asserts the ref is NOT prod"
    - "Real-DB-only verification for the UUID/BIGINT reconciliation bug class (mocks forbidden per Phase 30/BUG-01); donor pattern + randomUUID seeds + afterAll try/catch cleanup"
    - "Mirror-the-reader query in the test: assert the canonical TEXT IN match against recordings via the service-role client (reader runs on the anon client)"

key-files:
  created:
    - src/test/migrations/phase24-sync-status-foundation.integration.test.ts
  modified: []

key-decisions:
  - "Task 1 push used `supabase db push --linked` for PROD (linked project = prod ref) and `supabase db push --db-url $SUPABASE_TEST_DB_URL` for TEST — both prod-ref-guarded before connecting"
  - "fathom_calls is a VIEW over fathom_raw_calls (title + created_at NOT NULL) — the IMP-04 orphan seed inserts into the base table fathom_raw_calls and surfaces through the view the reconciliation reads"
  - "IMP-03 realtime-membership in the test falls back to the durable-resource round-trip when pg_catalog is not exposed via PostgREST; publication membership is independently verified at push time and in the migration DO-block guard"

patterns-established:
  - "Two-target prod-ref-guarded migration push (PROD + separate TEST project) gated behind an approved BLOCKING checkpoint"
  - "Integration test mirrors the canonical reader's query shape rather than invoking the anon-bound reader, proving the TEXT IN match directly against the source-of-truth table"

requirements-completed: [IMP-01, IMP-02, IMP-03, IMP-04]

# Metrics
duration: ~8min
completed: 2026-06-23
---

# Phase 24 Plan 04: Sync-Status Foundation Push + Real-DB Test Summary

**Applied all three Phase 24 migrations to PROD (ref `vltmrnjsubfzrgrtdqey`) and the separate TEST project, then proved IMP-01/02/03/04 against the real TEST DB with a TEST-project-guarded, zero-mock integration test; live RLS regression green with `sync_jobs` cross-org isolation.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-23T18:08:38Z
- **Completed:** 2026-06-23T18:16:11Z
- **Tasks:** 2 (1 BLOCKING checkpoint — pre-approved; 1 auto)
- **Files modified:** 1 (1 created)

## Accomplishments

- **Task 1 (BLOCKING, pre-approved): prod-ref-guarded `supabase db push` to PROD + TEST.**
  - Verified `.env` `DATABASE_URL` targets `db.vltmrnjsubfzrgrtdqey.supabase.co` (prod) BEFORE connecting; the linked project is `vltmrnjsubfzrgrtdqey`.
  - Pushed the three additive Phase 24 migrations to PROD with zero errors. NOTICEs confirmed correct behavior: `60 live, 60 persisted` orphans (matches the RESEARCH live fact), backfill ran (residual 167 NULL `source_call_id` = the documented bounded both-NULL gap).
  - Verified TEST DB URL targets `swjzxiddcrtaqixsfaac` (NOT prod) before connecting; pushed the same migrations to TEST (it also caught up 4 older missing migrations — additive/idempotent, no errors).
  - Confirmed on BOTH databases via `pg` introspection: 9/9 new `sync_jobs` columns, `fathom_calls_orphan_report` table exists, `sync_jobs` in `supabase_realtime`, `recording_ids` stays TEXT[] (`_text`). On TEST additionally confirmed `sync_jobs_org_isolation` policy + the live `recordings_source_dedup UNIQUE (organization_id, source_app, source_call_id)` constraint.
- **Task 2: real-DB integration test for IMP-01/02/03/04 + RLS regression.**
  - Created `src/test/migrations/phase24-sync-status-foundation.integration.test.ts` (5 tests, all green un-skipped against the real TEST DB).
  - IMP-01: Zoom (UUID), Fathom (BIGINT-as-string), and paste recordings all resolve from ONE `.in("source_call_id", [...])` query; the Fathom id round-trips as a string (no coercion).
  - IMP-02: a second insert of the same `(organization_id, source_app, source_call_id)` is rejected with PostgREST `23505`; exactly one row persists.
  - IMP-03: the new `sync_jobs` columns round-trip (`source_app`, `organization_id`, `mode`, `provider_cursor`, `last_heartbeat_at`); `recording_ids` accepts and round-trips a TEXT[]; realtime membership verified.
  - IMP-04: a synthetic orphan (BIGINT `recording_id`, no `recordings.fathom_provider_id` match, `canonical_recording_id` NULL) is classified an orphan by the migration's dual-bridge definition, reported, and NOT fabricated into `recordings`.
  - RLS regression: 46/46 pass, including both `sync_jobs` cross-org isolation assertions.

## Task Commits

1. **Task 1: BLOCKING prod + TEST `supabase db push`** — no source files (migrations were committed in Plans 02/03); push output captured below.
2. **Task 2: real-DB integration test for IMP-01/02/03/04** - `6f13cbc` (test)

## Push Output (Task 1, captured)

PROD (`supabase db push --linked`, ref `vltmrnjsubfzrgrtdqey`):
```
Applying migration 20260620120000_sync_jobs_durable_resource.sql...
Applying migration 20260620120500_backfill_null_source_call_id.sql...
NOTICE: [24-03 backfill] residual recordings with NULL source_call_id: 167 total (167 fathom/fathom-paste)
Applying migration 20260620121000_reconcile_orphan_fathom_calls.sql...
NOTICE: [24-03 reconcile] truly-orphan fathom_calls: 60 live, 60 persisted in fathom_calls_orphan_report (EXCLUDED from canonical reader; manual review only -- NOT backfilled)
Finished supabase db push.
```

TEST (`supabase db push --db-url $SUPABASE_TEST_DB_URL`, ref `swjzxiddcrtaqixsfaac`): all three Phase 24 migrations applied (plus 4 older catch-up migrations), zero errors. TEST NOTICEs show 0 orphans / 0 NULL-backfill (TEST is a near-empty project with no Fathom data) — the DDL is what matters and was verified present.

Post-push introspection (both DBs): sync_jobs new cols 9/9; `fathom_calls_orphan_report` exists; `sync_jobs` in `supabase_realtime`; `recording_ids` = `_text`. TEST also: `sync_jobs_org_isolation` policy present, `recordings_source_dedup UNIQUE (organization_id, source_app, source_call_id)` live.

## Decisions Made

- **Two prod-ref guards, both enforced before connect.** PROD push only ran after confirming `DATABASE_URL` contains `vltmrnjsubfzrgrtdqey`; TEST push only ran after confirming `SUPABASE_TEST_DB_URL` does NOT contain it. The integration test additionally asserts `VITE_SUPABASE_TEST_URL` does not contain the prod ref.
- **`fathom_calls` is a VIEW over `fathom_raw_calls`.** The IMP-04 orphan seed therefore inserts into `fathom_raw_calls` (with `title` + `created_at`, both NOT NULL) and surfaces through the view the reconciliation query reads. Discovered at runtime (Rule 3 blocking-issue fix) and confirmed via `pg_get_viewdef`.
- **Test mirrors the reader's query, not the reader itself.** `getSyncStatusForExternalIds` runs on the anon client bound to the authed user; the integration test asserts the same canonical TEXT IN match against `recordings` via the service-role client (recordings is the single source of truth), per the plan's IMP-01 instruction.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] IMP-04 orphan seed targeted a VIEW, not a table**
- **Found during:** Task 2 (first integration run)
- **Issue:** Inserting into `fathom_calls` failed — it is a VIEW over `fathom_raw_calls`, whose `title` and `created_at` are NOT NULL (errors `23502`). The plan's action text refers to seeding "a synthetic orphan fathom_calls row".
- **Fix:** Insert the orphan into the base table `fathom_raw_calls` with `title` + `created_at`; it surfaces through the `fathom_calls` view the reconciliation reads. Cleanup updated to delete from `fathom_raw_calls`.
- **Files modified:** src/test/migrations/phase24-sync-status-foundation.integration.test.ts
- **Commit:** 6f13cbc

**2. [Rule 3 - Gate hygiene] Reworded an IMP-01 comment to keep the no-coercion grep gate clean**
- **Found during:** Task 2 (acceptance grep)
- **Issue:** A documentation comment literally contained the substrings `parseInt` / `Number(`, tripping the `grep -cE "parseInt|Number\("` = 0 gate (a wording artifact, zero actual coercion in code).
- **Fix:** Reworded the comment to "No integer coercion …" (same approach Plan 01 used). Gate now returns 0; test still 5/5 green.
- **Commit:** 6f13cbc

## Issues Encountered

- **RTK filters blank vitest/grep/tsc output to "PASS (0) FAIL (0)"** (untrusted project filters at `.rtk/filters.toml`, not enabled). All verification was run via `rtk proxy` (unfiltered passthrough) to confirm real output, per the plan's key constraint.
- **The full `npm run test:integration` glob caught 4 pre-existing, unrelated integration failures** (`reporter-comms`, etc. — FK/seed issues on the TEST DB unrelated to Phase 24). Out of scope per the SCOPE BOUNDARY rule; not fixed. The Phase 24 file was verified in isolation (5/5 green) and the RLS regression was run directly (46/46 green).

## Verification Results

- PROD push: 3/3 Phase 24 migrations applied, zero errors; prod ref `vltmrnjsubfzrgrtdqey` confirmed in `DATABASE_URL` before connect.
- TEST push: same 3 migrations applied, zero errors; TEST ref `swjzxiddcrtaqixsfaac` confirmed (NOT prod) before connect.
- Post-push introspection green on BOTH databases (9/9 columns, orphan_report table, realtime membership, TEXT[] recording_ids; TEST also org policy + dedup constraint).
- `npx vitest run src/test/migrations/phase24-sync-status-foundation.integration.test.ts` (VITEST_INTEGRATION_OK=true) — **5/5 pass, un-skipped** (dotenv injected `.env.test`; guard test asserts `integrationDbReachable === true`).
- `npx vitest run src/test/rls-regression.test.ts` — **46/46 pass**, incl. both `sync_jobs` cross-org assertions.
- Acceptance greps on the test file: `describe.skipIf(!integrationDbReachable)` = 2 (>=1); `vltmrnjsubfzrgrtdqey` = 3 (>=1, inside `expect(testUrl).not.toContain(PROD_REF)`); `vi.mock` = 0; `parseInt|Number\(` = 0.

## User Setup Required

None — `.env.test` was already configured (TEST project `swjzxiddcrtaqixsfaac`, distinct from prod). `integrationDbReachable === true`.

## Next Phase Readiness

- Phase 24 is data-model complete: migrations live on prod + TEST, all four requirements proven against a real DB. Phases 25–29 can build on the canonical reader, the durable `sync_jobs` resource (org/workspace scope, mode, `provider_cursor`, `last_heartbeat_at`), the org-scoped dedup constraint, and the orphan report.

## Self-Check: PASSED

- FOUND: src/test/migrations/phase24-sync-status-foundation.integration.test.ts
- FOUND: .planning/phases/24-sync-status-foundation/24-04-SUMMARY.md
- FOUND commit: 6f13cbc (Task 2 test)
- VERIFIED: PROD + TEST schema introspection (9/9 sync_jobs cols, orphan_report table, realtime membership) on both ref vltmrnjsubfzrgrtdqey and swjzxiddcrtaqixsfaac

---
*Phase: 24-sync-status-foundation*
*Completed: 2026-06-23*
