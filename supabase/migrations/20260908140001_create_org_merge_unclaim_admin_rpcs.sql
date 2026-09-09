-- Migration: Admin-only atomic merge + unclaim RPCs
-- Purpose: ORG-03/ORG-04 -- platform-operator-only, reversible, atomic
--          mutations for merging duplicate organizations and unclaiming a
--          domain. Both RPCs mirror kill_switch_revert_event_merges
--          (20260902000002) and apply_event_match_atomic
--          (20260901000003): SECURITY DEFINER, authority validated BY
--          PARAMETER (p_admin_user_id) rather than auth.uid() -- these RPCs
--          are invoked with the service-role key from an edge function,
--          where auth.uid() is NULL -- and EXECUTE revoked from
--          PUBLIC/anon/authenticated so a forged parameter cannot be sent
--          directly via PostgREST. The service role bypasses EXECUTE
--          grants entirely, so a future admin-review edge function (and
--          this plan's own direct integration test) still works.
--
--          Authorization uses has_role(p_admin_user_id, 'ADMIN') --
--          platform-scoped -- NEVER the org-scoped membership helper used
--          elsewhere in this schema for self-serve org actions (invitations,
--          the domain-claim RPC in 20260908130001). This codebase has
--          already shipped one real incident from exactly that class of
--          confusion (20260316120000_fix_admin_role_leak.sql) -- a platform
--          operator merging two customer orgs is not necessarily a member
--          of either, so org-membership gating would be both wrong and
--          insecure here.
--
--          merge_organizations_atomic writes ONLY
--          organizations.canonical_organization_id/merged_at/merged_by on
--          the losing org -- it does not touch recordings, org membership
--          rows, or any other table. Chain/self-reference safety is
--          enforced by the organizations_prevent_canonical_chain trigger
--          from 20260908140000, not repeated here.
--
--          unclaim_organization_domain_atomic deletes the
--          organization_domains row outright -- this is reversible in the
--          product sense (the domain can be re-claimed by any org with a
--          verified email on it via claim_organization_domain), not via a
--          soft-delete flag; organization_domains has no verified/pending
--          state to toggle (every row is a confirmed claim by construction,
--          per 20260908130000).
-- Author: Claude (GSD Phase 36 Plan 02 executor)
-- Date: 2026-09-09

-- ============================================================================
-- 1. FUNCTION: merge_organizations_atomic
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
  statement -- no other table anywhere in the schema is touched. Reversible
  by clearing canonical_organization_id/merged_at/merged_by. Chain/cycle
  rejection is the organizations_prevent_canonical_chain trigger''s job, not
  this function''s. EXECUTE revoked from PUBLIC/anon/authenticated --
  service-role only, reachable via an edge function that has already
  independently verified has_role.';

-- ============================================================================
-- 2. FUNCTION: unclaim_organization_domain_atomic
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
END;
$$;

COMMENT ON FUNCTION public.unclaim_organization_domain_atomic(UUID, UUID) IS
  'ORG-02/ORG-03: platform-admin-only (has_role ADMIN, checked BY PARAMETER
  -- never auth.uid()). Deletes the organization_domains row outright --
  reversible in the product sense (any org with a verified email on the
  domain can claim it again later via claim_organization_domain), not via a
  soft-delete flag. EXECUTE revoked from PUBLIC/anon/authenticated --
  service-role only, reachable via an edge function that has already
  independently verified has_role.';

-- ============================================================================
-- 3. PERMISSIONS
-- ============================================================================
-- Service-role-only, mirroring apply_event_match_atomic /
-- kill_switch_revert_event_merges exactly. Without this, any authenticated
-- user could call either function directly via PostgREST with a forged
-- p_admin_user_id.

REVOKE EXECUTE ON FUNCTION public.merge_organizations_atomic FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.merge_organizations_atomic FROM anon;
REVOKE EXECUTE ON FUNCTION public.merge_organizations_atomic FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.unclaim_organization_domain_atomic FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.unclaim_organization_domain_atomic FROM anon;
REVOKE EXECUTE ON FUNCTION public.unclaim_organization_domain_atomic FROM authenticated;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
