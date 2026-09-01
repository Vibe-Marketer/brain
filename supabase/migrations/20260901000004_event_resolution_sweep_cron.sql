-- Migration: Event-resolution sweep cron (Phase 31 Plan 02)
-- Purpose:   Schedule the resolve-events edge function via pg_cron on a timer, so the
--            deterministic-resolution shadow sweep runs on its own without touching the
--            hot ingest path. Mirrors 20260512000002_fathom_daily_reconcile_cron.sql's
--            structure exactly -- same extensions, same unschedule-first idempotency,
--            same graceful degradation when pg_cron is unavailable, same shared-secret
--            header pattern (X-Reconcile-Secret / RECONCILE_SECRET, already shared with
--            fathom-reconcile).
-- Date:      2026-09-01
-- Author:    Claude (GSD Phase 31 Plan 02 executor)
--
-- Idempotent: unschedules existing job first, then schedules new one.
-- Graceful: if pg_cron extension unavailable (Free tier), emits NOTICE and continues.
-- Fallback: operator must schedule via Supabase Scheduled Functions dashboard.
--
-- SAFE-01/SAFE-02 note: this cron only ever POSTs {"mode":"shadow"} to resolve-events,
-- which (per _shared/event-resolver.ts's runShadowSweep) computes and RECORDS proposed
-- merges but never applies one and never calls the apply/reverse RPC pair (this plan's
-- other migration, 20260901000003_create_event_match_apply_reverse_rpcs.sql). Until
-- app.reconcile_secret is configured (deferred to Plan 04, same outstanding manual
-- dashboard step as the existing resume-heartbeat GUC), this job's net.http_post calls
-- will 401 harmlessly against resolve-events' shared-secret gate -- flag off, safe by
-- construction either way (SAFE-01: no organization_feature_flags row has
-- flag_key='event_resolution' AND enabled=true yet).

-- ============================================================================
-- ENABLE pg_cron + pg_net extensions (idempotent)
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- ============================================================================
-- UNSCHEDULE existing job (idempotent - safe to re-run)
-- ============================================================================
DO $outer$
BEGIN
  PERFORM cron.unschedule('event-resolution-sweep');
  RAISE NOTICE 'Unscheduled existing event-resolution-sweep job';
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE 'pg_cron not available - skipping unschedule';
  WHEN OTHERS THEN
    NULL;
END $outer$;

-- ============================================================================
-- SCHEDULE new sweep job every 15 minutes
-- ============================================================================
-- Required DB settings (set externally via ALTER DATABASE postgres SET ...
-- or Supabase Dashboard -> Settings -> Database -> Custom postgres settings):
--   app.supabase_url       — e.g. 'https://<PROJECT_REF>.supabase.co'
--   app.reconcile_secret   — must match RECONCILE_SECRET env var on the
--                            resolve-events edge function (already shared with
--                            fathom-reconcile)
--
-- Operator runbook (run ONCE per environment after this migration; deferred to
-- Plan 04, same as the existing outstanding resume-heartbeat GUC step):
--   ALTER DATABASE postgres SET app.supabase_url = 'https://<PROJECT_REF>.supabase.co';
--   ALTER DATABASE postgres SET app.reconcile_secret = '<random-32-byte-hex>';
--   SELECT pg_reload_conf();
-- Then deploy resolve-events with RECONCILE_SECRET=<same-value> in its env
-- (`supabase functions deploy resolve-events --use-api --no-verify-jwt`).
--
-- Conservative 15-minute cadence (31-RESEARCH.md Assumption A2) -- shadow mode
-- has no user-facing latency requirement; tunable later via cron.alter_job.

DO $outer$
BEGIN
  PERFORM cron.schedule(
    'event-resolution-sweep',
    '*/15 * * * *',
    $body$
    SELECT net.http_post(
      url := current_setting('app.supabase_url', true) || '/functions/v1/resolve-events',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Reconcile-Secret', current_setting('app.reconcile_secret', true)
      ),
      body := '{"mode": "shadow"}'::jsonb
    );
    $body$
  );
  RAISE NOTICE 'Scheduled event-resolution-sweep cron (every 15 minutes)';
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE 'pg_cron not available - resolution sweep disabled. Use Supabase Scheduled Functions dashboard as fallback.';
  WHEN OTHERS THEN
    RAISE NOTICE 'Failed to schedule event-resolution-sweep: %', SQLERRM;
END $outer$;

-- ============================================================================
-- VERIFICATION (run manually after migration + DB setting configuration)
-- ============================================================================
-- 1. Confirm extensions loaded:
--      SELECT extname FROM pg_extension WHERE extname IN ('pg_cron', 'pg_net');
--    Expected: 2 rows.
--
-- 2. Confirm job registered:
--      SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'event-resolution-sweep';
--    Expected: 1 row with schedule '*/15 * * * *' and active = true.
--
-- 3. Confirm DB settings:
--      SHOW app.supabase_url;
--      SHOW app.reconcile_secret;
--
-- 4. Manual trigger:
--      SELECT cron.alter_job(
--        job_id := (SELECT jobid FROM cron.job WHERE jobname = 'event-resolution-sweep'),
--        schedule := '* * * * *'
--      );
--    Wait 1 minute, check cron.job_run_details for status='succeeded', then revert.
