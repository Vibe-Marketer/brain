-- Migration: sync_jobs zombie reaper (Phase 27, plan 27-02, JOB-02)
-- Purpose:   A dead Edge worker can't mark its own job failed. This adds an
--            out-of-band pg_cron reaper that flips stale `processing` sync_jobs
--            to `failed`, making a silently-dead import a VISIBLE failure.
-- Author:    Claude (Phase 27 plan 27-02)
-- Date:      2026-06-23
--
-- STRICTLY ADDITIVE: this migration creates ONE function and registers ONE
-- pg_cron job. It does NOT ALTER/DROP/retype any sync_jobs column.
-- `last_heartbeat_at`, `status`, `created_at`, `error`, `completed_at` already
-- exist (20260620120000_sync_jobs_durable_resource.sql) — do NOT re-add.
--
-- Modeled on the in-repo stale-lock precedent
-- (20251128100000_embedding_queue_system.sql — claim_embedding_tasks stale-lock
-- predicate + embedding-worker-backup cron registration) and the graceful pg_cron
-- degradation pattern (20260512000002_fathom_daily_reconcile_cron.sql).
--
-- Idempotent: re-running is safe (CREATE OR REPLACE fn; unschedule-then-schedule
-- cron). The reaper itself is idempotent — it only touches status='processing'
-- rows, so already-'failed' rows are never re-mutated (proven by integration
-- test case 5).
--
-- Prod-ref guard: this migration is applied to TEST/PROD only via the prod-ref
-- guarded `supabase db push` in the [BLOCKING] Plan 27-04. This plan (27-02) does
-- NOT push to any database.

-- ============================================================================
-- REAPER FUNCTION: reap_stale_sync_jobs()
-- ============================================================================
-- Flips stale `processing` jobs to `failed`. Two stale predicates:
--   1. Stale heartbeat: last_heartbeat_at IS NOT NULL AND older than 5 minutes.
--      (5 min sits well above Edge ~400s wall-clock + 30-60s write cadence, so
--       healthy in-flight jobs are never reaped.)
--   2. Absolute fallback: last_heartbeat_at IS NULL AND created_at older than
--      15 minutes. Catches pre-heartbeat / legacy zombies that never wrote a
--      heartbeat.
-- Deterministic predicate, no dynamic SQL, no client input.
CREATE OR REPLACE FUNCTION public.reap_stale_sync_jobs()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reaped_count INT := 0;
BEGIN
  WITH reaped AS (
    UPDATE public.sync_jobs
    SET
      status = 'failed',
      error = COALESCE(error, 'worker died (no heartbeat)'),
      completed_at = NOW()
    WHERE status = 'processing'
      AND (
        (last_heartbeat_at IS NOT NULL AND last_heartbeat_at < NOW() - INTERVAL '5 minutes')
        OR
        (last_heartbeat_at IS NULL AND created_at < NOW() - INTERVAL '15 minutes')
      )
    RETURNING id
  )
  SELECT COUNT(*) INTO reaped_count FROM reaped;

  RETURN reaped_count;
END;
$$;

COMMENT ON FUNCTION public.reap_stale_sync_jobs() IS
  'Phase 27 JOB-02: flips stale processing sync_jobs to failed (stale heartbeat >5min, or NULL-heartbeat absolute fallback created_at >15min). SECURITY DEFINER, deterministic, idempotent. Scheduled via sync-jobs-reaper pg_cron.';

-- ============================================================================
-- ENABLE pg_cron (idempotent, free-tier safe via guarded blocks below)
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- ============================================================================
-- UNSCHEDULE existing reaper job (idempotent - safe to re-run)
-- ============================================================================
DO $outer$
BEGIN
  PERFORM cron.unschedule('sync-jobs-reaper');
  RAISE NOTICE 'Unscheduled existing sync-jobs-reaper job';
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE 'pg_cron not available - skipping unschedule';
  WHEN OTHERS THEN
    -- Job might not exist yet, that's ok
    NULL;
END $outer$;

-- ============================================================================
-- SCHEDULE reaper: every minute (pg_cron minimum interval)
-- ============================================================================
-- No pg_net / secret needed — this calls a pure-SQL function in-process.
DO $outer$
BEGIN
  PERFORM cron.schedule(
    'sync-jobs-reaper',
    '* * * * *',  -- Every minute
    $body$
    SELECT public.reap_stale_sync_jobs();
    $body$
  );
  RAISE NOTICE 'Scheduled sync-jobs-reaper cron (every minute)';
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE 'pg_cron not available - sync-jobs-reaper disabled. Schedule via Supabase Scheduled Functions dashboard as fallback.';
  WHEN OTHERS THEN
    RAISE NOTICE 'Failed to schedule sync-jobs-reaper: %', SQLERRM;
END $outer$;

-- ============================================================================
-- VERIFICATION (run manually after migration is applied to TEST/PROD - Plan 27-04)
-- ============================================================================
-- 1. Confirm function exists:
--      SELECT proname FROM pg_proc WHERE proname = 'reap_stale_sync_jobs';
--    Expected: 1 row.
--
-- 2. Confirm job registered:
--      SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'sync-jobs-reaper';
--    Expected: 1 row, schedule '* * * * *', active = true.
--
-- 3. Manual smoke (against TEST only):
--      -- seed a stale processing job, then:
--      SELECT public.reap_stale_sync_jobs();   -- returns count reaped
--
-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
