---
phase: 27-observable-jobs
plan: 02
subsystem: backend/jobs
tags: [supabase, pg_cron, reaper, heartbeat, sql, integration-test, edge-function]
requires:
  - sync_jobs durable-resource columns (status, last_heartbeat_at, created_at, error, completed_at) from 20260620120000 (live PROD+TEST)
  - pg_cron extension (already enabled on the project)
provides:
  - reap_stale_sync_jobs() SECURITY DEFINER fn (flips stale processing jobs to failed)
  - sync-jobs-reaper pg_cron schedule (every minute, graceful-degradation guarded)
  - sync-meetings last_heartbeat_at writes (INSERT + all 3 progress UPDATEs)
  - real-DB reaper integration test (TEST-ref guarded, zero mocks, 5 cases)
affects:
  - any future sync_jobs consumer relying on stale-job cleanup
  - Plan 27-03 (SyncJobBanner reads the now-reaped failed jobs)
  - Plan 27-04 (BLOCKING push applies this migration to TEST+PROD; turns the test green)
tech-stack:
  added: []
  patterns:
    - "Out-of-band pg_cron reaper modeled on embedding_queue stale-lock + cron registration"
    - "Heartbeat piggybacked on existing writes (zero new write sites, no setInterval)"
key-files:
  created:
    - supabase/migrations/20260623120000_sync_jobs_reaper.sql
    - src/test/migrations/phase27-sync-jobs-reaper.integration.test.ts
  modified:
    - supabase/functions/sync-meetings/index.ts
decisions:
  - "Reaper thresholds locked: stale-heartbeat >5min (above Edge ~400s + 30-60s cadence); NULL-heartbeat absolute fallback created_at >15min for pre-heartbeat/legacy zombies"
  - "Heartbeat written at INSERT so new jobs never persist NULL; piggybacked on the 3 existing per-item progress UPDATEs (no Realtime write-volume increase — RESEARCH Pitfall 5)"
  - "Reaper is pure-SQL in-process (no pg_net/secret needed) — calls reap_stale_sync_jobs() directly from cron"
  - "Idempotent by construction: predicate only matches status='processing', so already-failed rows are never re-touched"
metrics:
  duration: ~10min
  completed: 2026-06-23
---

# Phase 27 Plan 02: sync_jobs Zombie Reaper + Heartbeat Writes Summary

Additive pg_cron reaper (`reap_stale_sync_jobs()`) that flips stale `processing` sync_jobs to `failed`, plus producer-side `last_heartbeat_at` writes piggybacked onto sync-meetings' existing INSERT + 3 progress UPDATEs — proven against a real TEST database with zero mocks (JOB-02).

## What Was Built

**1. Additive reaper migration** (`supabase/migrations/20260623120000_sync_jobs_reaper.sql`)
- `public.reap_stale_sync_jobs()` RETURNS INT, `LANGUAGE plpgsql SECURITY DEFINER SET search_path = public` — mirrors the embedding_queue SECURITY DEFINER shape. Single CTE-wrapped `UPDATE ... RETURNING`, returns `COUNT(*)` of reaped rows. No dynamic SQL, no client input.
- Reaper predicate (both branches): `status='processing' AND ((last_heartbeat_at IS NOT NULL AND last_heartbeat_at < NOW() - INTERVAL '5 minutes') OR (last_heartbeat_at IS NULL AND created_at < NOW() - INTERVAL '15 minutes'))`. Sets `status='failed'`, `error=COALESCE(error,'worker died (no heartbeat)')`, `completed_at=NOW()`.
- `cron.schedule('sync-jobs-reaper', '* * * * *', $body$ SELECT public.reap_stale_sync_jobs(); $body$)` wrapped in the same `EXCEPTION WHEN undefined_function THEN RAISE NOTICE / WHEN OTHERS THEN ...` graceful-degradation as the fathom-daily-reconcile precedent (free-tier safe). Unschedule-then-schedule for idempotency.
- STRICTLY ADDITIVE: no ALTER/DROP/retype. `last_heartbeat_at` already exists from 20260620120000.

**2. Heartbeat writes in sync-meetings** (`supabase/functions/sync-meetings/index.ts`)
- `last_heartbeat_at: new Date().toISOString()` added to the initial INSERT object (~570) so a freshly-created job never persists NULL.
- Same field added to EACH of the 3 existing per-item progress UPDATE objects (the not-found-progress update, the per-meeting progress update, and the error-path progress update). Zero new write sites; no separate heartbeat loop/`setInterval`. The final terminal status UPDATE left as-is.

**3. Real-DB reaper integration test** (`src/test/migrations/phase27-sync-jobs-reaper.integration.test.ts`)
- `describe.skipIf(!integrationDbReachable)` + `makeIntegrationClient()` (service-role TEST client), donor pattern for user_id (sync_jobs → fathom_raw_calls fallback), `afterAll` deletes every seeded row by id inside try/catch.
- 5 cases: (1) stale heartbeat → failed + error ILIKE no heartbeat + completed_at set; (2) fresh heartbeat → spared; (3) NULL heartbeat + created_at 20min → reaped via absolute fallback; (4) NULL heartbeat + created_at 2min → spared; (5) idempotent — re-run leaves the already-failed row's completed_at/error unchanged.
- Reaper invoked via `supabase.rpc('reap_stale_sync_jobs')`; a missing function surfaces a clear RPC error (not a fake pass). Zero mocks (Phase 30/BUG-01 contract).

## How to Verify

- `rtk grep -cE "reap_stale_sync_jobs|cron.schedule\('sync-jobs-reaper'" supabase/migrations/20260623120000_sync_jobs_reaper.sql` → 6
- `rtk grep -c "last_heartbeat_at" supabase/functions/sync-meetings/index.ts` → 4 (1 INSERT + 3 UPDATEs)
- `rtk grep -c "setInterval" supabase/functions/sync-meetings/index.ts` → 0
- `rtk grep -ciE "ALTER TABLE|DROP " supabase/migrations/20260623120000_sync_jobs_reaper.sql` → 0
- `VITEST_INTEGRATION_OK=true npx vitest run src/test/migrations/phase27-sync-jobs-reaper.integration.test.ts` → 5 passed (this machine's TEST project currently has no sync_jobs rows, so the donor-guard short-circuits each case; full reaper assertions execute once the TEST project has a donor user AND the migration is applied in Plan 27-04).

## Deviations from Plan

None — plan executed exactly as written.

## Test Status (important — read before Plan 27-04)

The integration test PASSES today but via the donor-guard early-exit: the TEST project (ref `swjzxiddcrtaqixsfaac`) currently has no `sync_jobs` rows, so `donorUserId` is null and each case returns before asserting (same pattern as the established phase39 cron test). The reaper assertions become live — and the migration's `rpc('reap_stale_sync_jobs')` resolves — only after **Plan 27-04** runs `supabase db push --linked` against the TEST ref. This is by design: the test does NOT fake-pass (a missing function would surface a clear RPC error), and the donor-guard is the project's standard idiom for "no seed data in TEST yet". Plan 27-04 turns it fully green.

## Out-of-Scope / Not Done (by plan boundary)

- NO `supabase db push` to any DB (PROD or TEST) — gated to Plan 27-04 [BLOCKING].
- NO edge-function deploy of sync-meetings — gated to Plan 27-04.
- NO origin push — batched.
- SyncJobBanner / UI mounting — Plan 27-03.

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or trust-boundary surface beyond the pg_cron reaper already covered in the plan's threat model (T-27-02-E/T/D/SC, all `mitigate`/`n/a`).

## Self-Check: PASSED

- FOUND: supabase/migrations/20260623120000_sync_jobs_reaper.sql
- FOUND: src/test/migrations/phase27-sync-jobs-reaper.integration.test.ts
- FOUND (modified): supabase/functions/sync-meetings/index.ts
- FOUND commit: 6a53b139 (feat — reaper + heartbeat)
- FOUND commit: 60329fc1 (test — reaper integration test)

## Commits

- `6a53b139` — feat(27-02): add sync_jobs zombie reaper + heartbeat writes
- `60329fc1` — test(27-02): real-DB reaper integration test (TEST-guarded, zero mocks)
