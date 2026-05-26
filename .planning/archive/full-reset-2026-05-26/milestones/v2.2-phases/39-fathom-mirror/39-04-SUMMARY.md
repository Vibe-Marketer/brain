# Plan 39-04 Summary — pg_cron Daily Reconcile Schedule

**Status:** COMPLETE (code) / PENDING-DEPLOY (migration + DB settings)
**Date:** 2026-05-12

## Deliverables

- `supabase/migrations/20260512000002_fathom_daily_reconcile_cron.sql`
  - Idempotent unschedule + schedule of `fathom-daily-reconcile` at `0 7 * * *`.
  - Uses existing pattern from `20260110000008_scheduled_rules_fields.sql`:
    `DO $outer$ ... PERFORM cron.schedule(...) ... EXCEPTION WHEN undefined_function`.
  - Calls `net.http_post` to `/functions/v1/fathom-reconcile` with
    `X-Reconcile-Secret` header (reads from `current_setting('app.reconcile_secret')`).
  - Graceful no-op on Free tier where `pg_cron` is missing.
  - Documented fallback: Supabase Scheduled Functions dashboard (NOT GitHub
    Actions, per Andrew's call).
  - Embedded operator runbook in migration comments.
- `src/test/migrations/phase39-fathom-reconcile-cron.integration.test.ts`
  - 3 tests: multi-account coexistence, global iteration, 5-row gap-fill via
    composite-PK upsert.

## Operator action required (per migration runbook)

```bash
supabase db push --linked --include-all       # applies cron migration
```

Then in Supabase SQL Editor:

```sql
-- Set the URL and secret (one-time per environment)
ALTER DATABASE postgres SET app.supabase_url = 'https://vltmrnjsubfzrgrtdqey.supabase.co';
ALTER DATABASE postgres SET app.reconcile_secret = '<RECONCILE_SECRET value>';
SELECT pg_reload_conf();

-- Verify
SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'fathom-daily-reconcile';

-- Manual test trigger (revert immediately after one run)
SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'fathom-daily-reconcile'),
  schedule := '* * * * *'
);
-- Wait 1 min, check cron.job_run_details, revert:
SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'fathom-daily-reconcile'),
  schedule := '0 7 * * *'
);
```
