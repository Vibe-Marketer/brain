---
phase: 28-server-side-sync-all
plan: 05
subsystem: api
tags: [supabase-edge, pg-cron, pg-net, integration-test, recordings-dedup, 23505, prod-deploy, per-environment-host, vitest, real-db]

# Dependency graph
requires:
  - phase: 28-server-side-sync-all (Plan 01)
    provides: listPage contract + the all-6 unit suite + RED integration scaffolds (resume/idempotency)
  - phase: 28-server-side-sync-all (Plan 02)
    provides: connector-sync-all dual-auth checkpoint/resume pager (USER-START + service-role RESUME branch)
  - phase: 28-server-side-sync-all (Plan 03)
    provides: 6 populated listPage impls + connector-list-page-registry the pager resolves against
  - phase: 28-server-side-sync-all (Plan 04)
    provides: additive per-environment sync-all-resume-heartbeat cron + 6 adapter syncAll + Sync-all button
  - phase: 27-observable-jobs
    provides: sync_jobs reaper (5-min) + the proven 27-04 prod-push procedure mirrored here
  - phase: 24-sync-status-foundation
    provides: recordings_source_dedup org-scoped UNIQUE (organization_id, source_app, source_call_id)
provides:
  - "connector-sync-all DEPLOYED to TEST + PROD via --use-api (Docker-less), live (PROD OPTIONS 200)"
  - "sync-all-resume-heartbeat resume cron migration applied to TEST + PROD; cron active on both (jobid 7 TEST / jobid 8 PROD), prod-ref-free per-environment host derivation verified"
  - "Truthful real-DB SYNC-03 proof: concurrent recordings_source_dedup race -> exactly ONE row; loser 23505 classified skip (isUniqueViolation), never failed; crash-retry no-dup"
  - "Truthful real-DB SYNC-01 proof: RESUME branch loads seeded job + runs slice; terminal-job guard rejects; durable failed_ids/skipped_count present"
  - "All-6 listPage unit suite GREEN (Fathom/Grain/Zoom/Read.ai/Fireflies/Plaud paginate to exhaustion, opaque cursor round-trip verbatim)"
affects: [29-fail-retry-surfacing (failed_ids/skipped_count surface), milestone-end frontend origin push]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Real-DB correctness proof without live provider creds: exercise the org-scoped UNIQUE constraint + the exact isUniqueViolation() predicate directly against recordings (the BUG-01 risk lives in the DB constraint + skip-not-fail reclassification, not the provider fetch)"
    - "Honest-gap test: a sub-claim that genuinely needs external creds is recorded with a loud warning + a pinned condition (never a vacuous soft-pass); a fixture gap throws loudly"
    - "27-04 prod-push procedure mirrored: TEST-first (link TEST + db push with SUPABASE_TEST_DB_PASSWORD), then prod-ref guard (DATABASE_URL must contain vltmrnjsubfzrgrtdqey, booleans only) -> link PROD -> db push -> functions deploy --use-api"

key-files:
  created: []
  modified:
    - supabase/functions/connector-sync-all/__tests__/idempotency.integration.test.ts
    - supabase/functions/connector-sync-all/__tests__/resume.integration.test.ts
    - supabase/functions/_shared/connector-list-page.ts

key-decisions:
  - "Proved SYNC-03 dedup correctness (the BUG-01 class) on the real TEST DB WITHOUT provider creds by racing the recordings_source_dedup constraint directly — because the constraint + isUniqueViolation reclassification IS the correctness claim, not the provider fetch. This is a truthful GREEN, the opposite of the soft-skip the prior uncommitted diffs would have claimed."
  - "Rewrote the two integration tests to remove the setupUnavailable soft-return that produced a fake-pass; they now assert real DB behaviour on every run and throw loudly on a fixture gap. Fixed error_message->error (the real sync_jobs column)."
  - "The full multi-slice cursor-advance-to-terminal sub-claim genuinely requires a live Fathom token (the slice fetches a real page); TEST has zero provider creds, so it is recorded as a documented gap with a loud warning + pinned condition — NOT a vacuous pass, NOT silently implied as proven."
  - "The per-environment GUC app.supabase_url could NOT be set on TEST or PROD via the pooler `postgres` user (permission denied to set parameter). The cron is registered + active + prod-ref-FREE on both; it activates once the GUC is set via the dashboard SQL editor (superuser) — the same operator step the existing prod fathom-daily-reconcile cron already needs (also NULL today)."

patterns-established:
  - "Constraint-level dedup proof: race two concurrent inserts on (org, source_app, source_call_id) against the real UNIQUE constraint to prove exactly-one-row + 23505 surfacing, then assert isUniqueViolation() classifies the loser as skip"
  - "Workspace-entry-aware cleanup: a trigger auto-creates workspace_entries on recordings insert and blocks a bare delete — clear child rows (workspace_entries/call_speakers/call_participants) before the recording in afterAll"

requirements-completed: [SYNC-01, SYNC-02, SYNC-03]

# Metrics
duration: 11min
completed: 2026-06-30
---

# Phase 28 Plan 05: Real-DB Proofs + Backend Prod Push Summary

**Deployed connector-sync-all to TEST + PROD (--use-api, live) and applied the per-environment sync-all-resume-heartbeat cron to both (active, prod-ref-free); proved SYNC-03 dedup correctness and SYNC-01 RESUME-branch behaviour truthfully on the real TEST DB (not guard-skipped); all-6 listPage unit suite GREEN; build exit 0; zero new test failures; frontend NOT pushed.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-06-30T23:29:46Z
- **Completed:** 2026-06-30T23:40:55Z
- **Tasks:** 2 (Task 1 auto; Task 2 the operator-pre-approved [BLOCKING] prod push, executed without re-pausing per the approval)
- **Files modified:** 3

## Accomplishments

- **Backend live on PROD.** `connector-sync-all` deployed to PROD via `--use-api` (Docker-less) and verified live (OPTIONS preflight 200 = function boots). Also deployed to TEST. The resume-heartbeat migration applied to TEST then PROD (prod-ref-guarded); `sync-all-resume-heartbeat` cron active on both (`* * * * *`, active=true; jobid 7 TEST / jobid 8 PROD).
- **SYNC-03 proven on a REAL DB, truthfully (the BUG-01 go/no-go).** Two concurrent writers on the same `(organization_id, source_app, source_call_id)` produce EXACTLY ONE `recordings` row; the loser's error is a Postgres 23505 that the pager's exact `isUniqueViolation()` predicate classifies as a SKIP (never `failed_ids`); a crash-retry produces no duplicate. Real DB round-trips (timings 67–264ms), zero mocks, fully self-cleaning.
- **SYNC-01 RESUME contract proven on the real DB vs the deployed fn.** The service-role RESUME branch loads a seeded `processing`/`mode='all'` job, authorizes off its stored org/user, and runs a slice; the guard REJECTS a terminal job; the durable `failed_ids`/`skipped_count` columns are present.
- **All-6 listPage unit safety net GREEN.** Fathom, Grain, Zoom, Read.ai, Fireflies, Plaud each paginate to exhaustion across multiple pages with the opaque cursor round-tripped verbatim (11 tests).
- **Removed a fake-pass.** The prior uncommitted integration diffs would have reported GREEN while every assertion was bypassed via a `setupUnavailable` soft-return ("live assertion not run") — exactly the fake-pass the plan forbids. Rewrote both tests to assert real DB behaviour on every run.

## Advertised-vs-Live Coverage (BLOCKER-2 acceptance criterion — STATED, not silent)

**6 advertised syncAll providers. 0 of 6 live-proven end-to-end; 6 of 6 unit-only (listPage suite); SYNC-03 dedup correctness proven on the real DB provider-agnostically.**

| Provider  | listPage unit (paginate-to-exhaustion) | Live end-to-end sync-all on TEST | Reason / note |
|-----------|----------------------------------------|----------------------------------|---------------|
| Fathom    | GREEN (3 pages, opaque cursor)         | NOT live-proven                  | No Fathom TEST credentials in this environment (0 active import_sources; 0 provider keys in any env file) |
| Grain     | GREEN (2 pages, opaque cursor)         | NOT live-proven                  | No Grain TEST credentials |
| Zoom      | GREEN (window + page-token, no truncation) | NOT live-proven              | No Zoom TEST credentials |
| Read.ai   | GREEN (last-id cursor, limit ≤ 10)     | NOT live-proven                  | No Read.ai TEST credentials |
| Fireflies | GREEN (offset/skip)                    | NOT live-proven                  | No Fireflies TEST credentials |
| Plaud     | GREEN (offset/skip + post-fetch date filter) | NOT live-proven            | No Plaud TEST credentials |

**The delta, plainly:** the TEST project is empty (0 import_sources, 0 recordings, 0 sync_jobs at start) and NO provider credentials exist anywhere in `.env`/`.env.local`/`.env.test`. A genuine live provider-backed multi-slice sync-all (the slice makes a real provider API call) therefore cannot be exercised here for any provider without fabricating credentials — which would be dishonest and is explicitly out of bounds. What IS proven on the real DB, provider-agnostically: the org-scoped dedup constraint + the 23505→skip reclassification (SYNC-03, the actual BUG-01 risk class) and the RESUME-branch auth/guard contract (SYNC-01). The all-6 listPage unit suite is the safety net for the per-provider pagination dialects. The provider-credential-dependent claims (live cursor-advance across self-chained slices; concurrent selective-import-vs-sync-all over a live page) are recorded as KNOWN GAPS below, never implied as live-proven.

## Task Commits

1. **Task 1 (real-DB proofs) + Task 2 (deploy/prod-push) source change** — `e61393ae` (test): rewrote both integration tests to truthful real-DB proofs + Deno-decoupled the list-page types. (The deploy + migration push + cron verification are operations, not source changes — recorded below, not as separate commits.)

**Plan metadata:** (this docs commit)

## Files Created/Modified

- `supabase/functions/connector-sync-all/__tests__/idempotency.integration.test.ts` — Genuine real-DB SYNC-03 proof (concurrent dedup race, 23505→skip via `isUniqueViolation`, crash-retry no-dup). Workspace-entry-aware cleanup. Throws loudly on a fixture gap (never vacuous).
- `supabase/functions/connector-sync-all/__tests__/resume.integration.test.ts` — Real-DB SYNC-01 RESUME-branch proof vs the deployed fn (load job + run slice; terminal-job guard rejects; durable columns). `(d)` cursor-advance honestly recorded as needing live provider creds. Fixed `error_message`→`error` column.
- `supabase/functions/_shared/connector-list-page.ts` — Local `ConnectorSourceApp` union so Deno deploy doesn't pull frontend React types into the edge-fn graph (deploy unblock).

## Operations Performed (deploy / DB push / verification — not source commits)

- **TEST:** linked TEST ref `swjzxiddcrtaqixsfaac` (TEST DB password from `.env.local`); `supabase db push --linked` (migration already present from a prior session — cron jobid 7 active); deployed `connector-sync-all --use-api` to TEST. Verified the cron command derives host from `current_setting('app.supabase_url', true)` and contains **0** prod-ref literal and **0** TEST-ref literal (per-environment, T-28-18 holds).
- **PROD:** prod-ref guard (`DATABASE_URL` contains `vltmrnjsubfzrgrtdqey`, asserted booleans-only) → linked PROD → `supabase db push` ("Finished supabase db push") → cron `sync-all-resume-heartbeat` active (jobid 8, `* * * * *`, active=true), 0 prod-ref literal in command; deployed `connector-sync-all --use-api` to PROD, verified live (OPTIONS 200).
- **Build gate:** `npm run build` exit **0** (committed tree; only the pre-existing chunk-size warning).
- **Test baseline:** full unit suite = 6 files / 20 tests failed = ZERO new failures vs the documented 27-04 baseline (all pre-existing: MCPTab.permissions, McpConnectionsTab, McpSetupSnippets, rpc-type-smoke, generate-ai-titles auth-invariants, mcp-server sec-jwt-fix). The Phase 28 listPage unit suite (11) + both rewritten integration suites (7) are GREEN.

## Decisions Made

- **Proved the correctness claim at the layer it actually lives (the DB constraint), not through an un-credentialed provider fetch.** SYNC-03's BUG-01 risk is "a concurrent duplicate is mis-recorded as a failure." That is a property of `recordings_source_dedup` + the `isUniqueViolation`→skip reclassification — both exercised directly against the real TEST DB. This is a truthful real-DB GREEN.
- **Refused to claim a green I could not honestly prove.** The live multi-slice provider-backed run needs credentials that do not exist in this environment; rather than fabricate them or soft-skip a passing test, the cursor-advance sub-claim is recorded as a documented gap with a loud warning and a pinned condition.
- **Mirrored the 27-04 prod-push exactly**, including the prod-ref guard before connect.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fake-pass in the uncommitted integration tests (soft-skip claimed as a pass)**
- **Found during:** Task 1
- **Issue:** The prior uncommitted diffs added a `setupUnavailable` early-return so all assertions were bypassed ("live assertion not run") yet the suite reported GREEN — exactly the guard-skip/fake-pass the plan forbids ("not a guard skip; no fake-pass").
- **Fix:** Rewrote both tests to assert real DB behaviour on every run (SYNC-03 via the real dedup constraint; SYNC-01 via the deployed RESUME branch). Fixture gaps now throw loudly.
- **Files modified:** both integration test files
- **Committed in:** `e61393ae`

**2. [Rule 1 - Bug] Tests referenced a non-existent `error_message` column on sync_jobs**
- **Found during:** Task 1 (seeding against real TEST schema)
- **Issue:** The uncommitted diffs tagged/cleaned via `.like('error_message', ...)`; the real `sync_jobs` table has **`error`**, no `error_message`. Cleanup would have errored / never matched.
- **Fix:** Switched to the real `error` column (matching the pager's own writes).
- **Committed in:** `e61393ae`

**3. [Rule 3 - Blocking] Deno deploy pulled frontend React types**
- **Found during:** Task 1 (deploy prep)
- **Issue:** `connector-list-page.ts` imported `ConnectorSourceApp` from the frontend registry; Deno's deploy-time check then pulls unrelated app TypeScript into the edge-fn graph.
- **Fix:** Defined a local `ConnectorSourceApp` union in the shared edge module.
- **Committed in:** `e61393ae`

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking). **Impact:** all necessary for a truthful proof and a clean deploy. No scope creep.

## Issues Encountered

- **No provider credentials anywhere in TEST.** TEST project empty (0 import_sources/recordings/sync_jobs); no Fathom/Grain/Zoom/Read.ai/Fireflies/Plaud keys in any env file. Resolved by proving the credential-independent correctness on the real DB and recording the credential-dependent live run as an explicit gap (see Advertised-vs-Live + Known Gaps).
- **Per-environment GUC `app.supabase_url` could not be set** on TEST or PROD via the pooler `postgres` user (`permission denied to set parameter`). The cron is registered, active, and prod-ref-FREE on both; it no-ops harmlessly until the GUC is set via the dashboard SQL editor. NOTE: the existing PROD `fathom-daily-reconcile` cron (same mechanism) also shows a NULL GUC today — so this is a pre-existing infra condition, not introduced here. The self-chain (the primary resume path) does not depend on the GUC.

## Known Gaps (explicit — NOT silently implied as done)

1. **Live multi-slice / kill-a-slice provider-backed sync-all** (resume test `(d)`): needs a live Fathom (or any provider) TEST credential. Currently recorded with a loud warning + pinned condition. Resolve by provisioning an active TEST import_source with real provider creds, then re-running `npm run test:integration`.
2. **Resume-heartbeat cron actually firing in either environment:** requires `ALTER DATABASE postgres SET app.supabase_url = 'https://<ref>.supabase.co'` run via the Supabase dashboard SQL editor (superuser) on TEST and PROD. Until then the cron no-ops; the self-chain + Phase-27 reaper remain the active safety nets.

## User Setup Required

**Operator step (dashboard SQL editor, superuser) to activate the resume-heartbeat cron — TEST and PROD:**
```sql
ALTER DATABASE postgres SET app.supabase_url = 'https://<THIS_PROJECT_REF>.supabase.co';
SELECT pg_reload_conf();
```
(TEST ref `swjzxiddcrtaqixsfaac`; PROD ref `vltmrnjsubfzrgrtdqey`. This also activates the pre-existing fathom-daily-reconcile cron, which shares the GUC.) The self-chain resume path works without this.

## Next Phase Readiness

- Backend (pager + resume cron) is live on PROD; SYNC-03 dedup correctness + SYNC-01 RESUME contract proven on a real DB. Phase 29 (FAIL/retry surfacing) can consume `failed_ids`/`skipped_count`.
- Frontend (Sync-all button, adapters) committed in 28-04 but NOT pushed to origin — batched to milestone-end per the milestone plan.
- Open items: provision a live TEST provider credential to close the live-multi-slice gap; set the per-environment GUC via the dashboard to activate the resume cron.

## Self-Check: PASSED

- All 4 key files verified present on disk (SUMMARY + 2 integration tests + connector-list-page).
- Task commit `e61393ae` verified in git log.

---
*Phase: 28-server-side-sync-all*
*Completed: 2026-06-30*
