-- Migration: sync-all resume-heartbeat cron (Phase 28, plan 28-04, SYNC-01)
-- Purpose:   Belt-and-suspenders for the connector-sync-all self-chain. The
--            self-chain (functions.invoke, fire-and-forget) is the fast loop;
--            if a slice dies BEFORE it self-chains, the job sits in
--            status='processing' with a live cursor until the Phase 27 reaper
--            (5-min stale-heartbeat) eventually FAILS it. This cron re-KICKS
--            such a job EARLIER (2-min stale heartbeat) so a dropped self-chain
--            link is re-advanced instead of failed — the job finishes instead
--            of dying silently.
-- Author:    Claude (Phase 28 plan 28-04)
-- Date:      2026-06-25
--
-- STRICTLY ADDITIVE: this migration only registers ONE new pg_cron job
-- ('sync-all-resume-heartbeat'). It does NOT create/alter/drop any table,
-- column, function, or the existing 'sync-jobs-reaper' / 'embedding-worker-backup'
-- crons. Zero destructive DDL.
--
-- Modeled on:
--   - 20251128100000_embedding_queue_system.sql (lines 257-278) — the
--     cron.schedule + net.http_post graceful-degradation shape (NO Authorization
--     header in the POST → connector-sync-all takes its service-role RESUME
--     branch, which authorizes off the job row's stored org/user).
--   - 20260512000002_fathom_daily_reconcile_cron.sql — the PER-ENVIRONMENT host
--     derivation via current_setting('app.supabase_url', true). This is the
--     canonical, prod-ref-free mechanism in this codebase: the resolved host is
--     whatever the project the migration is applied to has configured, so a
--     TEST-applied cron POSTs to the TEST function and a PROD-applied cron POSTs
--     to PROD. We deliberately do NOT use the google-poll-cron fallback that
--     hardcodes the prod ref — that would let a TEST cron drive PROD (T-28-18).
--   - 20260623120000_sync_jobs_reaper.sql — the LIVE reaper (5-min fail
--     threshold). This resume-heartbeat MUST fire earlier (2 min) so it
--     re-advances a stalled job BEFORE the reaper gives up on it.
--
-- ============================================================================
-- PER-ENVIRONMENT HOST (T-28-18 — TEST cron must NOT drive PROD)
-- ============================================================================
-- The cron resolves the connector-sync-all URL from current_setting(
-- 'app.supabase_url', true). The host is NEVER a hardcoded project ref. Each
-- environment must set this GUC ONCE after the migration (same operator step
-- the fathom-reconcile cron already documents):
--
--   ALTER DATABASE postgres SET app.supabase_url = 'https://<THIS_PROJECT_REF>.supabase.co';
--   SELECT pg_reload_conf();
--
-- If app.supabase_url is unset, current_setting(..., true) returns NULL and the
-- net.http_post URL becomes NULL — the cron no-ops harmlessly (it never falls
-- back to a prod literal). The Phase 27 reaper remains the safety net in that
-- case. Plan 05 sets the GUC on TEST then PROD and verifies the TEST cron
-- targets the TEST host.
--
-- This migration is NOT pushed to any database here — the prod-ref-guarded
-- `supabase db push` happens in the [BLOCKING] Plan 28-05.

-- ============================================================================
-- ENABLE pg_cron + pg_net extensions (idempotent, free-tier safe)
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- ============================================================================
-- UNSCHEDULE existing job (idempotent re-registration - safe to re-run)
-- ============================================================================
DO $outer$
BEGIN
  PERFORM cron.unschedule('sync-all-resume-heartbeat');
  RAISE NOTICE 'Unscheduled existing sync-all-resume-heartbeat job';
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE 'pg_cron not available - skipping unschedule';
  WHEN OTHERS THEN
    -- Job might not exist yet, that's ok
    NULL;
END $outer$;

-- ============================================================================
-- SCHEDULE resume-heartbeat: every minute (pg_cron minimum interval)
-- ============================================================================
-- Predicate: re-kick every sync-all job that is still processing, has begun
-- (provider_cursor IS NOT NULL — a slice ran at least once), and whose
-- heartbeat is stale > 2 minutes (the self-chain link likely dropped) but is
-- not yet reaper-failed (the 5-min reaper hasn't fired). One POST per stalled
-- job, body = { jobId }, NO Authorization header → service-role RESUME branch.
--
-- Idempotency under double-driving (T-28-12, accepted): if the self-chain and
-- this cron both fire, connector-sync-all reclassifies the duplicate-slice
-- 23505 as `skipped`, never `failed`. The 2-min stale gate bounds the overlap.
DO $outer$
BEGIN
  PERFORM cron.schedule(
    'sync-all-resume-heartbeat',
    '* * * * *',  -- Every minute
    $body$
    SELECT net.http_post(
      url := current_setting('app.supabase_url', true) || '/functions/v1/connector-sync-all',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := jsonb_build_object('jobId', sj.id)
    )
    FROM public.sync_jobs sj
    WHERE sj.status = 'processing'
      AND sj.mode = 'all'
      AND sj.provider_cursor IS NOT NULL
      AND sj.last_heartbeat_at IS NOT NULL
      AND sj.last_heartbeat_at < NOW() - INTERVAL '2 minutes'
      -- Only POST when a per-environment host is configured; never a prod literal.
      AND current_setting('app.supabase_url', true) IS NOT NULL
      AND current_setting('app.supabase_url', true) <> '';
    $body$
  );
  RAISE NOTICE 'Scheduled sync-all-resume-heartbeat cron (every minute, 2-min stale)';
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE 'pg_cron not available - sync-all-resume-heartbeat disabled. Self-chain + Phase 27 reaper still apply.';
  WHEN OTHERS THEN
    RAISE NOTICE 'Failed to schedule sync-all-resume-heartbeat: %', SQLERRM;
END $outer$;

-- ============================================================================
-- VERIFICATION (run manually after migration + GUC config - Plan 28-05)
-- ============================================================================
-- 1. Confirm extensions loaded:
--      SELECT extname FROM pg_extension WHERE extname IN ('pg_cron', 'pg_net');
--    Expected: 2 rows.
--
-- 2. Confirm job registered:
--      SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'sync-all-resume-heartbeat';
--    Expected: 1 row, schedule '* * * * *', active = true.
--
-- 3. Confirm the per-environment host is THIS project (NOT prod from TEST):
--      SHOW app.supabase_url;   -- must equal the project this migration is applied to.
--
-- 4. Manual smoke (TEST only): seed a sync-all job with status='processing',
--    a non-null provider_cursor, and last_heartbeat_at 3 minutes in the past;
--    wait 1 minute; confirm cron.job_run_details shows a succeeded run and the
--    job advanced (cursor/heartbeat moved).
--
-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
