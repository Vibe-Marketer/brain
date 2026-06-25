---
phase: 27-observable-jobs
plan: 04
subsystem: infra
tags: [supabase, pg_cron, edge-deploy, prod-push, reaper, heartbeat, phase-gate]

# Dependency graph
requires:
  - phase: 27-02
    provides: additive reaper migration (20260623120000_sync_jobs_reaper.sql), sync-meetings last_heartbeat_at writes, real-DB reaper integration test
  - phase: 27-03
    provides: SyncJobBanner + PerProviderSyncChip reading reaped failed jobs (frontend, batched to milestone end)
provides:
  - "sync-jobs-reaper pg_cron schedule LIVE on PROD (vltmrnjsubfzrgrtdqey) and TEST (swjzxiddcrtaqixsfaac) — every minute, active=true"
  - "reap_stale_sync_jobs() SECURITY DEFINER fn present on PROD + TEST"
  - "sync-meetings edge function (heartbeat-at-INSERT + 3 progress UPDATEs) deployed to PROD via --use-api"
  - "reaper SQL proven correct against the real TEST DB (5/5 live-asserted cases, zero mocks)"
  - "Phase 27 backend live in prod; phase gate green (build exit 0, zero NEW unit failures vs 26-04 baseline)"
affects: [phase-28-sync, phase-29-fail, any sync_jobs consumer relying on stale-job cleanup]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Prod-ref guard re-asserted at point-of-connect (DATABASE_URL must contain vltmrnjsubfzrgrtdqey) before every prod write — same guard class as the autopilot gsd-runner"
    - "TEST-first push + live reaper proof before any prod write; additive+idempotent migration so re-runs are no-ops"
    - "Edge deploy via --use-api (Docker-less) — the only reliable path on this machine"

key-files:
  created:
    - .planning/phases/27-observable-jobs/27-04-SUMMARY.md
  modified: []

key-decisions:
  - "Seeded a real auth-user donor row in TEST to run the reaper assertions LIVE (the donor-guard would otherwise skip — TEST had zero sync_jobs/fathom_raw_calls rows). Truthful GREEN, not a guard-skip pass."
  - "No source files changed this plan — it is a push/deploy + phase-gate plan; only the SUMMARY metadata commit lands in git. The migration/edge changes were authored in 27-02."

patterns-established:
  - "Push/deploy plans verify cron + fn presence directly via pg against both refs after push, not just from CLI success output"

requirements-completed: [JOB-02]

# Metrics
duration: ~20min
completed: 2026-06-25
---

# Phase 27 Plan 04: [BLOCKING] Backend Prod Push — Reaper Cron + Heartbeat Deploy Summary

**sync-jobs-reaper pg_cron + reap_stale_sync_jobs() pushed to PROD and TEST (prod-ref guarded), the heartbeat-writing sync-meetings deployed to PROD via --use-api, the reaper SQL proven live against the real TEST DB (5/5), and the phase gated green — Phase 27 backend is live in production.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-06-25T14:45Z (approx)
- **Completed:** 2026-06-25T15:05Z (approx)
- **Tasks:** 2 (1 blocking checkpoint auto-executed under operator pre-approval, 1 phase gate)
- **Files modified:** 0 source files (push/deploy + gate plan); 1 planning doc created

## Accomplishments
- Reaper migration applied to TEST (`swjzxiddcrtaqixsfaac`) then, after prod-ref guard, to PROD (`vltmrnjsubfzrgrtdqey`) — both report `Scheduled sync-jobs-reaper cron (every minute)`.
- `sync-jobs-reaper` cron verified present + active on BOTH projects via direct `pg` query (`cron.job` = 1 row, schedule `* * * * *`, active=true); `reap_stale_sync_jobs` fn present on both.
- Reaper SQL proven against the REAL TEST DB with live assertions on seeded rows: stale-heartbeat reaped, fresh spared, NULL+old reaped (absolute fallback), NULL+young spared, idempotent on re-run. Reaper returned exactly 3 reaped of 5 seeded. All seeded rows cleaned up (0 remaining).
- `sync-meetings` edge function (4 `last_heartbeat_at` write sites: 1 INSERT + 3 progress UPDATEs, 0 setInterval) deployed to PROD via `--use-api`.
- Phase gate green: `npm run build` exit 0; full unit suite 6 files / 20 tests failed = ZERO new failures vs the documented 26-04 baseline (7 files / 21 tests), and one fewer (the known TranscriptsTab isolation flake didn't trip).

## Task Commits

This plan changes no source files. The only git commit is the plan-metadata commit (SUMMARY + STATE + ROADMAP + REQUIREMENTS). The substantive changes are DB-side (migration pushed to PROD+TEST) and edge-runtime-side (function deployed to PROD) — neither is a git operation. The migration + edge source were committed in 27-02 (`6a53b139`, `60329fc1`).

**Plan metadata:** see final commit below (docs: complete plan)

## Files Created/Modified
- `.planning/phases/27-observable-jobs/27-04-SUMMARY.md` - This summary (only file created)
- _PROD DB_ `vltmrnjsubfzrgrtdqey` - reaper migration applied (cron + fn registered)
- _TEST DB_ `swjzxiddcrtaqixsfaac` - reaper migration applied (cron + fn registered)
- _PROD edge runtime_ - `sync-meetings` redeployed with heartbeat writes

## How It Was Verified
- **Additive check:** `grep -vE "^\s*--"` over the migration → 0 destructive DDL (the single raw-grep hit was a comment on line 9 stating it does NOT ALTER/DROP).
- **Prod-ref guard:** asserted `DATABASE_URL` in `.env` contains `vltmrnjsubfzrgrtdqey` (boolean only, no secret printed) immediately before linking + pushing to PROD; linked-ref file re-checked == prod before push.
- **Cron presence (direct pg):**
  - PROD: `cron.job` rows=1 [`sync-jobs-reaper` sched=`* * * * *` active=true] | `reap_stale_sync_jobs` rows=1
  - TEST: `cron.job` rows=1 [`sync-jobs-reaper` sched=`* * * * *` active=true] | `reap_stale_sync_jobs` rows=1
- **Reaper live proof (TEST, real DB, seeded donor user):** 5/5 cases PASS; reaper returned 3 reaped; cleanup left 0 seeded rows.
- **Edge deploy:** `Deployed Functions on project vltmrnjsubfzrgrtdqey: sync-meetings`.
- **Build gate:** `npm run build` → `BUILD_EXIT=0` (`✓ built in 9.96s`).
- **Unit suite:** 6 files / 20 tests failed; all 6 are pre-existing baseline areas (MCPTab.permissions, McpConnectionsTab, McpSetupSnippets, rpc-type-smoke, generate-ai-titles auth-invariants, mcp-server sec-jwt-fix). No phase-27 file in the failures. Net: one fewer failing file/test than the 26-04 baseline.

## Decisions Made
- **Seeded a real donor user to make the reaper test prove itself.** The TEST project had zero `sync_jobs`/`fathom_raw_calls` rows, so the integration test's donor-guard would early-exit (a "pass" with no assertions — exactly the caveat 27-02-SUMMARY flagged). I seeded `sync_jobs` rows under a genuine TEST `auth.users` id, ran the reaper RPC live, asserted all 5 cases against real DB state, and deleted every seeded row. This delivers the truthful GREEN proof the plan demands rather than a guard-skip.
- **No source commits.** This is a deploy/gate plan; the only git artifact is the metadata commit.

## Deviations from Plan
None - plan executed exactly as written. (The seed-a-donor step is the plan's intent made real, not a deviation: the plan's how-to-verify requires the reaper test to actually prove "stale + NULL-old reaped; fresh + NULL-young spared; idempotent" against TEST.)

## Issues Encountered
- **TEST db push needed the TEST DB password.** `supabase db push --linked` failed SASL auth using the PROD password. Resolved by passing `SUPABASE_TEST_DB_PASSWORD` (from `.env.local`) as `SUPABASE_DB_PASSWORD` for the TEST push, and the PROD `SUPABASE_DB_PASSWORD` (from `.env`) for the PROD push.
- **Integration test runner ignores a file-path arg.** `npm run test:integration -- <file>` ran the whole integration glob (the globs are hardcoded in the script), surfacing 4 PRE-EXISTING failures (qa-ticket-ingestion, reporter-comms FK — Phase 23). Re-ran the reaper test isolated via `VITEST_INTEGRATION_OK=true npx vitest run <file>`; then seeded + asserted live to get the real proof.

## User Setup Required
None - no external service configuration required. (Operator pre-approved the prod write + edge deploy.)

## Known Stubs
None.

## Threat Flags
None - no new network endpoints, auth paths, or trust-boundary surface beyond the pg_cron reaper already covered in the plan threat model (T-27-04-T/T2/D/SC). The prod-ref guard (T-27-04-T mitigation) was applied and matched before connecting.

## Next Phase Readiness
- Phase 27 is COMPLETE (4/4 plans). The reaper cron is live in prod and will flip dead `processing` jobs to `failed` every minute; sync-meetings now writes heartbeats so healthy jobs are never reaped.
- Frontend (27-01/27-03: useSyncJobs, SyncJobBanner, PerProviderSyncChip) builds green and is intentionally NOT pushed to origin — batched to milestone-end deploy per operator instruction.
- Phase 28 (SYNC) can write into the heartbeat/reaper contract; Phase 29 (FAIL) adds retry UI on the now-durable failures.

## Self-Check: PASSED

- FOUND: .planning/phases/27-observable-jobs/27-04-SUMMARY.md
- FOUND commit (27-02 source): 6a53b139 (feat — reaper + heartbeat)
- FOUND commit (27-02 source): 60329fc1 (test — reaper integration test)
- FOUND: supabase/migrations/20260623120000_sync_jobs_reaper.sql
- FOUND: supabase/functions/sync-meetings/index.ts
- VERIFIED on DB: sync-jobs-reaper cron active on PROD + TEST; reap_stale_sync_jobs fn present on both

---
*Phase: 27-observable-jobs*
*Completed: 2026-06-25*
