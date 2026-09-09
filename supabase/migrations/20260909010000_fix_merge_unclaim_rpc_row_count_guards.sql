-- Migration: Row-count guards for merge_organizations_atomic /
--            unclaim_organization_domain_atomic
-- Purpose: Fixes WR-01 from the Phase 36 code review (36-REVIEW.md). Both
--          RPCs from 20260908140001 report success even when their single
--          write statement affects zero rows -- e.g. p_losing_org_id was
--          deleted between the admin loading the Organizations table and
--          clicking "Merge into..." (DeleteOrganizationDialog lets an org
--          owner self-delete at any time). The UPDATE/DELETE silently
--          no-ops, no exception is raised, and
--          merge-organizations/index.ts + unclaim-organization-domain/
--          index.ts see no error and return { success: true } -- the UI
--          toasts "Organizations merged" / "Domain unclaimed" even though
--          nothing changed.
--
--          This mirrors the pattern already used by the sibling
--          remove_organization_alias RPC in the very same migration file
--          (20260908130001_create_org_identity_self_serve_rpcs.sql:165-169),
--          which uses `DELETE ... RETURNING id INTO v_deleted_id` +
--          `IF v_deleted_id IS NULL THEN RAISE EXCEPTION` specifically to
--          catch this class of no-op.
--
--          CREATE OR REPLACE FUNCTION preserves the existing function OID,
--          owner, and ACL (per Postgres docs: "the ownership and
--          permissions of the function do not change" across a replace with
--          an identical argument signature) -- the REVOKE EXECUTE grants
--          from 20260908140001 remain intact without needing to be
--          reasserted. They are repeated below anyway, defensively, so this
--          migration file is self-contained and re-runnable against a fresh
--          restore without depending on 20260908140001 having run first in
--          the exact same session.
--
--          Out of scope (per 36-REVIEW.md WR-01's own fix scope): no new
--          "already merged" guard is added to merge_organizations_atomic
--          itself -- the review's fix section only asks for the NOT FOUND
--          guard here, plus surfacing canonical_organization_id/merged_at
--          in the Organizations table (AdminOrganization /
--          listAllOrganizations, admin-organizations.service.ts /
--          OrganizationsSection.tsx, shipped alongside this migration) so
--          already-merged rows are visibly labeled instead of offering a
--          fully-live "Merge into..." action. Chain/self-reference safety
--          remains organizations_prevent_canonical_chain's job
--          (20260908140000), not repeated here.
-- Author: Claude (gsd-code-fixer, Phase 36 REVIEW-FIX iteration 1)
-- Date: 2026-09-09

-- ============================================================================
-- 1. FUNCTION: merge_organizations_atomic (row-count guard added)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.merge_organizations_atomic(
  p_losing_org_id  UUID,
  p_winning_org_id UUID,
  p_admin_user_id  UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(p_admin_user_id, 'ADMIN') THEN
    RAISE EXCEPTION 'Access denied: platform admin required';
  END IF;

  IF p_losing_org_id = p_winning_org_id THEN
    RAISE EXCEPTION 'Cannot merge an organization into itself';
  END IF;

  UPDATE organizations
  SET canonical_organization_id = p_winning_org_id,
      merged_at = NOW(),
      merged_by = p_admin_user_id
  WHERE id = p_losing_org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization % not found', p_losing_org_id;
  END IF;
  -- Chain/self-reference safety enforced by
  -- organizations_prevent_canonical_chain (20260908140000), not repeated
  -- here. This UPDATE is the ONLY write this function performs -- no other
  -- table anywhere in the schema is touched (non-destructive, fully
  -- reversible by clearing the pointer).
END;
$$;

COMMENT ON FUNCTION public.merge_organizations_atomic(UUID, UUID, UUID) IS
  'ORG-03: platform-admin-only (has_role ADMIN, checked BY PARAMETER --
  never auth.uid()). Sets ONLY the losing org''s
  canonical_organization_id/merged_at/merged_by via a single UPDATE
  statement -- no other table anywhere in the schema is touched. Raises if
  p_losing_org_id does not exist (WR-01 fix, 20260909010000) instead of
  silently reporting success on a zero-row UPDATE. Reversible by clearing
  canonical_organization_id/merged_at/merged_by. Chain/cycle rejection is
  the organizations_prevent_canonical_chain trigger''s job, not this
  function''s. EXECUTE revoked from PUBLIC/anon/authenticated --
  service-role only, reachable via an edge function that has already
  independently verified has_role.';

-- ============================================================================
-- 2. FUNCTION: unclaim_organization_domain_atomic (row-count guard added)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.unclaim_organization_domain_atomic(
  p_domain_id     UUID,
  p_admin_user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(p_admin_user_id, 'ADMIN') THEN
    RAISE EXCEPTION 'Access denied: platform admin required';
  END IF;

  DELETE FROM organization_domains WHERE id = p_domain_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Domain % not found', p_domain_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.unclaim_organization_domain_atomic(UUID, UUID) IS
  'ORG-02/ORG-03: platform-admin-only (has_role ADMIN, checked BY PARAMETER
  -- never auth.uid()). Deletes the organization_domains row outright --
  reversible in the product sense (any org with a verified email on the
  domain can claim it again later via claim_organization_domain), not via a
  soft-delete flag. Raises if p_domain_id does not exist (WR-01 fix,
  20260909010000) instead of silently reporting success on a zero-row
  DELETE. EXECUTE revoked from PUBLIC/anon/authenticated -- service-role
  only, reachable via an edge function that has already independently
  verified has_role.';

-- ============================================================================
-- 3. PERMISSIONS (reasserted defensively -- see header note)
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.merge_organizations_atomic FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.merge_organizations_atomic FROM anon;
REVOKE EXECUTE ON FUNCTION public.merge_organizations_atomic FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.unclaim_organization_domain_atomic FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.unclaim_organization_domain_atomic FROM anon;
REVOKE EXECUTE ON FUNCTION public.unclaim_organization_domain_atomic FROM authenticated;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
