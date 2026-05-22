-- Migration: Test fixture cleanup helper + scheduled sweep
-- Purpose:   Multiple test suites in this repo create fixture auth.users
--            that get orphaned because the existing afterAll cleanup hits
--            protective DELETE triggers (prevent_last_workspace_owner,
--            protect_recording_delete, protect_default_workspace) and
--            silently fails — leaving auth rows, workspaces, orgs, and
--            recordings sitting in production forever.
--
--            Known leaky test families (as of 2026-05-22):
--              - `%@callvault.test`        — phase38 RLS regression suite
--              - `%@example.invalid`       — mcp-debug-*, codex-usage-gate-*,
--                                            codex-browser-trial-*, any
--                                            future IANA-reserved test users
--              - `qa-sweep-%@vibeos.com`   — phase29 QA sweep regression suite
--
--            This migration ships ONE helper function that:
--              1. Bypasses the three protective DELETE triggers for the
--                 duration of the cleanup (re-enables them in the EXCEPTION
--                 block too, so a partial failure can't leave triggers off).
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
-- Safety:    - Only matches test-domain emails. No real user can ever match
--              `%@callvault.test`, `%@example.invalid` (IANA-reserved), or
--              `qa-sweep-%@vibeos.com`.
--            - Age threshold (default 60 minutes) prevents racing with
--              in-flight test runs.
--            - Triggers are re-enabled in the EXCEPTION block too — a
--              partial failure can never leave production with protective
--              triggers disabled.
--            - SECURITY DEFINER + REVOKE FROM PUBLIC + GRANT to service_role
--              and postgres only.
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
  -- Disable all three protective DELETE triggers within this transaction.
  -- Minimum-blast-radius bypass: only test-domain rows are touched, and
  -- the triggers are re-enabled below (including in the exception path).
  ALTER TABLE public.workspace_memberships DISABLE TRIGGER prevent_last_workspace_owner;
  ALTER TABLE public.recordings            DISABLE TRIGGER protect_recording_delete;
  ALTER TABLE public.workspaces            DISABLE TRIGGER protect_default_workspace;

  WITH deleted AS (
    DELETE FROM auth.users
    WHERE (
        email LIKE '%@callvault.test'
        OR email LIKE '%@example.invalid'
        OR email LIKE 'qa-sweep-%@vibeos.com'
      )
      AND created_at < v_age_cutoff
    RETURNING id
  )
  SELECT COUNT(*) INTO v_user_count FROM deleted;

  ALTER TABLE public.workspace_memberships ENABLE TRIGGER prevent_last_workspace_owner;
  ALTER TABLE public.recordings            ENABLE TRIGGER protect_recording_delete;
  ALTER TABLE public.workspaces            ENABLE TRIGGER protect_default_workspace;

  RETURN json_build_object(
    'users_deleted',     v_user_count,
    'age_cutoff_utc',    v_age_cutoff,
    'patterns',          json_build_array('%@callvault.test', '%@example.invalid', 'qa-sweep-%@vibeos.com'),
    'triggers_bypassed', json_build_array('prevent_last_workspace_owner', 'protect_recording_delete', 'protect_default_workspace'),
    'ran_at',            NOW()
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Always re-enable triggers, even if the delete fails. Transaction
    -- rollback handles the data side; this just guarantees we never leave
    -- prod with protective triggers disabled.
    BEGIN ALTER TABLE public.workspace_memberships ENABLE TRIGGER prevent_last_workspace_owner; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER TABLE public.recordings            ENABLE TRIGGER protect_recording_delete;     EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER TABLE public.workspaces            ENABLE TRIGGER protect_default_workspace;    EXCEPTION WHEN OTHERS THEN NULL; END;
    RAISE;
END;
$$;

COMMENT ON FUNCTION public.cleanup_test_fixture_users IS
'Deletes orphaned test-fixture users (@callvault.test, @example.invalid, qa-sweep-*@vibeos.com) older than p_max_age_minutes (default 60). Bypasses three protective DELETE triggers within the function transaction and re-enables them on exit. Called from test afterAll hooks and from the daily pg_cron job.';

-- Restrict execution. Anon/authenticated callers must not be able to
-- nuke fixture data even though the patterns are strict — defense in depth.
REVOKE EXECUTE ON FUNCTION public.cleanup_test_fixture_users(INT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.cleanup_test_fixture_users(INT) TO service_role, postgres;

-- ============================================================================
-- pg_cron SCHEDULE — daily sweep at 04:17 UTC
-- ============================================================================
-- Off-hours, off-the-quarter-hour, to avoid colliding with other jobs.
-- p_max_age_minutes defaults to 60, so any fixture created in the last
-- hour is preserved (won't race with an actively running test suite).

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
