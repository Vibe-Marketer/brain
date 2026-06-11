-- Migration: qa_runs request queue (Admin Center "Run now" → "Request scan", punch item 5)
-- Purpose:   The Admin Center QA "Run now" button was dead-grayed because no
--            browser-reachable crawl trigger exists. Rather than leave it
--            disabled, make it HONEST: an admin can queue a scan request that
--            the nightly crawl harness picks up.
--
--            Smallest reliable change:
--              1. Extend the qa_runs.status CHECK to allow 'requested'.
--              2. Add an admin-only INSERT policy, narrowly scoped so admins
--                 can ONLY insert a 'requested' placeholder row (triggered_by
--                 = 'admin-request') — never a fake 'completed'/'failed' run.
--              3. The crawler claims requested rows and overwrites them with
--                 real results (it already writes via service-role, which
--                 bypasses RLS).
--
-- Safety:    - The INSERT policy is gated by has_role(auth.uid(),'ADMIN') AND
--              forces status='requested' AND triggered_by='admin-request', so
--              a compromised admin client cannot fabricate run results.
--            - No UPDATE/DELETE policy is added — admins cannot mutate or
--              remove rows; the append-only read posture is preserved.
--            - Existing service-role writes are unaffected (RLS-exempt).
-- Author:    Admin Center UX punch list (item 5 — Run now)
-- Date:      2026-06-13

-- ============================================================================
-- 1. Allow the 'requested' status
-- ============================================================================
ALTER TABLE public.qa_runs DROP CONSTRAINT IF EXISTS qa_runs_status_check;
ALTER TABLE public.qa_runs
  ADD CONSTRAINT qa_runs_status_check
  CHECK (status IN ('requested', 'running', 'completed', 'failed'));

-- ============================================================================
-- 2. Admin-only, tightly-scoped INSERT policy for queueing a scan request
-- ============================================================================
DROP POLICY IF EXISTS "Admins can queue a qa run request" ON public.qa_runs;
CREATE POLICY "Admins can queue a qa run request"
  ON public.qa_runs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'ADMIN')
    AND status = 'requested'
    AND triggered_by = 'admin-request'
  );

COMMENT ON COLUMN public.qa_runs.status IS
  'requested = admin queued a scan (picked up by the nightly crawler); '
  'running/completed/failed = real crawler lifecycle.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
