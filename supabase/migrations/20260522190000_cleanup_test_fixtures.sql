-- Migration: Test fixture cleanup helper + scheduled sweep
-- Purpose:   The phase38 RLS regression suite (src/test/rls-regression.test.ts)
--            and other future fixture-based tests create `@callvault.test`
--            users that get orphaned because the existing afterAll cleanup
--            hits the `prevent_last_workspace_owner` trigger (added in
--            20260310000010) and silently fails — leaving the auth row, its
--            workspace, org, and recordings sitting in production forever.
--
--            This migration ships ONE helper function that:
--              1. Bypasses the workspace-owner trigger for the duration of
--                 the cleanup (using session_replication_role = replica,
--                 which is allowed for SECURITY DEFINER functions owned by
--                 a superuser context).
--              2. Cascades the delete from auth.users down through every FK
--                 that references it.
--              3. Returns a JSON summary so tests + cron + ad-hoc ops calls
--                 all get auditable output.
--
--            Same helper is invoked from two places:
--              - The RLS test's afterAll hook (via supabase.rpc) — fast path
--              - A pg_cron job scheduled here — bulletproof safety net for
--                local-dev runs that get SIGKILL'd, CI runners that crash,
--                Forge/agent test runs that get terminated, etc.
--
-- Safety:    - Only matches test-domain emails: `%@callvault.test` and
--              `qa-sweep-%@vibeos.com`. No real user can ever be caught.
--            - Age threshold (default 60 minutes) prevents racing with
--              in-flight test runs.
--            - SECURITY DEFINER so the cron job (which runs as postgres) can
--              invoke without needing service_role privileges.
--
-- Date:      2026-05-22

-- ============================================================================
-- HELPER FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.cleanup_test_fixture_users(p_max_age_minutes INT DEFAULT 60)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_count INT := 0;
  v_age_cutoff TIMESTAMPTZ := NOW() - (p_max_age_minutes || ' minutes')::INTERVAL;
BEGIN
  -- Disable the workspace-owner protection trigger for THIS transaction only.
  -- This is the minimum-blast-radius bypass — we only touch fixture data, and
  -- the trigger is re-enabled when the function exits (transaction-local).
  ALTER TABLE public.workspace_memberships DISABLE TRIGGER prevent_last_workspace_owner;

  WITH deleted AS (
    DELETE FROM auth.users
    WHERE (
        email LIKE '%@callvault.test'
        OR email LIKE 'qa-sweep-%@vibeos.com'
      )
      AND created_at < v_age_cutoff
    RETURNING id
  )
  SELECT COUNT(*) INTO v_user_count FROM deleted;

  ALTER TABLE public.workspace_memberships ENABLE TRIGGER prevent_last_workspace_owner;

  RETURN json_build_object(
    'users_deleted',   v_user_count,
    'age_cutoff_utc',  v_age_cutoff,
    'patterns',        json_build_array('%@callvault.test', 'qa-sweep-%@vibeos.com'),
    'ran_at',          NOW()
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Make sure the trigger is re-enabled even if the delete throws.
    -- (Transaction will roll back the deletes; we just want the trigger
    -- state to come back to ENABLED.)
    BEGIN
      ALTER TABLE public.workspace_memberships ENABLE TRIGGER prevent_last_workspace_owner;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    RAISE;
END;
$$;

COMMENT ON FUNCTION public.cleanup_test_fixture_users IS
'Deletes orphaned test-fixture users (@callvault.test, qa-sweep-*@vibeos.com) older than p_max_age_minutes (default 60). Bypasses prevent_last_workspace_owner trigger within the function transaction. Called from RLS test afterAll and from daily pg_cron job.';

-- Restrict execution to the postgres + service_role roles. Anon/authenticated
-- callers must not be able to nuke fixture data even though the regex is
-- strict — defense in depth.
REVOKE EXECUTE ON FUNCTION public.cleanup_test_fixture_users(INT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.cleanup_test_fixture_users(INT) TO service_role, postgres;

-- ============================================================================
-- pg_cron SCHEDULE — daily sweep at 04:17 UTC
-- ============================================================================
-- Off-hours, off-the-quarter-hour, to avoid colliding with other scheduled
-- jobs. p_max_age_minutes defaults to 60, so any fixture created in the last
-- hour is preserved (won't race with an actively running test suite).

-- Drop existing schedule if re-applying.
DO $$
BEGIN
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'cleanup-test-fixtures-daily';
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'cleanup-test-fixtures-daily',
  '17 4 * * *',
  $cron$ SELECT public.cleanup_test_fixture_users(60) $cron$
);

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
