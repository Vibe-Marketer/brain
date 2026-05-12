-- Migration: Fathom daily reconcile cron (Phase 39)
-- Purpose:   Schedule fathom-reconcile edge function via pg_cron at 07:00 UTC daily.
-- Date:      2026-05-12
-- Author:    Claude (Phase 39 plan 39-04)
--
-- Idempotent: unschedules existing job first, then schedules new one.
-- Graceful: if pg_cron extension unavailable (Free tier), emits NOTICE and continues.
-- Fallback: operator must schedule via Supabase Scheduled Functions dashboard.

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
  PERFORM cron.unschedule('fathom-daily-reconcile');
  RAISE NOTICE 'Unscheduled existing fathom-daily-reconcile job';
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE 'pg_cron not available - skipping unschedule';
  WHEN OTHERS THEN
    NULL;
END $outer$;

-- ============================================================================
-- SCHEDULE new daily reconcile job at 07:00 UTC
-- ============================================================================
-- Required DB settings (set externally via ALTER DATABASE postgres SET ...
-- or Supabase Dashboard -> Settings -> Database -> Custom postgres settings):
--   app.supabase_url       — e.g. 'https://vltmrnjsubfzrgrtdqey.supabase.co'
--   app.reconcile_secret   — must match RECONCILE_SECRET env var on edge function
--
-- Operator runbook (run ONCE per environment after this migration):
--   ALTER DATABASE postgres SET app.supabase_url = 'https://<PROJECT_REF>.supabase.co';
--   ALTER DATABASE postgres SET app.reconcile_secret = '<random-32-byte-hex>';
--   SELECT pg_reload_conf();
-- Then deploy fathom-reconcile with RECONCILE_SECRET=<same-value> in its env.

DO $outer$
BEGIN
  PERFORM cron.schedule(
    'fathom-daily-reconcile',
    '0 7 * * *',
    $body$
    SELECT net.http_post(
      url := current_setting('app.supabase_url', true) || '/functions/v1/fathom-reconcile',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Reconcile-Secret', current_setting('app.reconcile_secret', true)
      ),
      body := '{"mode": "reconcile"}'::jsonb
    );
    $body$
  );
  RAISE NOTICE 'Scheduled fathom-daily-reconcile cron (07:00 UTC daily)';
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE 'pg_cron not available - reconcile cron disabled. Use Supabase Scheduled Functions dashboard as fallback.';
  WHEN OTHERS THEN
    RAISE NOTICE 'Failed to schedule fathom-daily-reconcile: %', SQLERRM;
END $outer$;

-- ============================================================================
-- VERIFICATION (run manually after migration + DB setting configuration)
-- ============================================================================
-- 1. Confirm extensions loaded:
--      SELECT extname FROM pg_extension WHERE extname IN ('pg_cron', 'pg_net');
--    Expected: 2 rows.
--
-- 2. Confirm job registered:
--      SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'fathom-daily-reconcile';
--    Expected: 1 row with schedule '0 7 * * *' and active = true.
--
-- 3. Confirm DB settings:
--      SHOW app.supabase_url;
--      SHOW app.reconcile_secret;
--
-- 4. Manual trigger:
--      SELECT cron.alter_job(
--        job_id := (SELECT jobid FROM cron.job WHERE jobname = 'fathom-daily-reconcile'),
--        schedule := '* * * * *'
--      );
--    Wait 1 minute, check cron.job_run_details for status='succeeded', then revert.
