-- Migration: Phase 24 RLS hardening (CR-01 + WR-03 from 24-REVIEW.md)
-- Purpose: Close two RLS gaps shipped by the Phase 24 migrations:
--          1. CR-01 -- fathom_calls_orphan_report was created in `public` with
--             NO row-level security, violating the "RLS on every table" hard rule.
--          2. WR-03 -- sync_jobs gained an org-scoped SELECT (USING) policy but
--             no INSERT/UPDATE WITH CHECK, so a client could write a sync_jobs row
--             scoped to an org it does not belong to.
-- Author: GSD code-fixer (Phase 24 review-fix)
-- Date: 2026-06-20
--
-- STRICTLY ADDITIVE + IDEMPOTENT. Re-runnable. No DROP POLICY, no column changes.
-- Verified posture against live prod (ref vltmrnjsubfzrgrtdqey).

-- ============================================================================
-- 1. CR-01 -- fathom_calls_orphan_report: ENABLE RLS, deny-all to clients
-- ============================================================================
-- This is an INTERNAL diagnostic report table (Phase 24 / IMP-04). It has NO
-- organization_id and is written ONLY by migrations / service-role. The correct
-- posture is: RLS enabled with ZERO permissive policies for authenticated/anon.
--
--   * service_role BYPASSES RLS by design -> migrations + operator queries still
--     read/write it freely.
--   * With RLS on and no policy, every authenticated/anon JWT gets zero rows
--     through PostgREST -> client deny-all. This matches "manual operator review
--     only; no authenticated read path needed".
--
-- If admins ever need to read it via an authed JWT, ADD an explicit admin-scoped
-- SELECT policy in a future migration -- do not weaken this default.
ALTER TABLE public.fathom_calls_orphan_report ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.fathom_calls_orphan_report IS
  'Phase 24 / IMP-04: fathom_calls rows that match recordings by NEITHER bridge path
   (recording_id BIGINT -> recordings.fathom_provider_id, AND canonical_recording_id UUID
   -> recordings.id). Operator-locked decision: these orphans are EXCLUDED from the
   canonical reader and surfaced here for MANUAL review -- they are NOT backfilled into
   recordings (no row fabrication). fathom_call_id is the PK arbiter for idempotent re-runs.
   SECURITY (24-REVIEW CR-01): RLS is ENABLED with NO permissive policy -- service_role
   (which bypasses RLS) is the only access path. This is intentional client deny-all: the
   table has no organization_id and is written only by migrations/service-role.';

-- ============================================================================
-- 2. WR-03 -- sync_jobs: add org-scoped WITH CHECK for INSERT + UPDATE
-- ============================================================================
-- The existing SELECT policies (the retained "Users can read own sync jobs"
-- user_id policy AND sync_jobs_org_isolation, both PERMISSIVE/OR-combined) are
-- NOT touched. This migration ADDS write-side enforcement so an authenticated
-- client cannot INSERT or UPDATE a sync_jobs row into an org it does not belong
-- to. Mirrors the SELECT org predicate. organization_id IS NULL is allowed so
-- legacy/in-flight rows (org unknown) remain writable by the owning user path.
--
-- Both policies are PERMISSIVE and TO authenticated, so they OR-combine with any
-- retained user_id-based write policy -- this is additive, not a replacement.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sync_jobs'
      AND policyname = 'sync_jobs_org_insert'
  ) THEN
    CREATE POLICY sync_jobs_org_insert
      ON public.sync_jobs FOR INSERT
      TO authenticated
      WITH CHECK (
        organization_id IS NULL
        OR is_organization_member(organization_id, auth.uid())
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sync_jobs'
      AND policyname = 'sync_jobs_org_update'
  ) THEN
    CREATE POLICY sync_jobs_org_update
      ON public.sync_jobs FOR UPDATE
      TO authenticated
      USING (
        organization_id IS NULL
        OR is_organization_member(organization_id, auth.uid())
      )
      WITH CHECK (
        organization_id IS NULL
        OR is_organization_member(organization_id, auth.uid())
      );
  END IF;
END $$;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
