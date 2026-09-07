-- Migration: Fix get_identity_evidence authz gap (CR-01) and speakers view gap (WR-02)
-- Purpose: Phase 34 code review (34-REVIEW.md) found two gaps in the identity spine
--          introduced by 20260905140000_create_identities_and_link_tables.sql:
--          CR-01 (Critical): get_identity_evidence(p_identity_id) is
--          GRANT EXECUTE TO authenticated with zero caller-authorization check --
--          any authenticated user in any org can pull evidence for any identity_id
--          UUID by hand-typing it, bypassing the same user_can_view_identity() check
--          that already gates the identities table's own RLS two sections away in the
--          same migration. Fix: gate the RPC's WHERE clause through
--          user_can_view_identity(p_identity_id, auth.uid()), exactly as the review's
--          suggested SQL specifies -- a non-authorized caller now gets zero rows
--          (denied entirely), not a redacted-but-present row.
--          WR-02 (Warning): user_can_view_identity() checks identities.owner_user_id,
--          call_participants (via is_organization_member), and contacts (via
--          is_organization_member) -- but never checks speakers.identity_id, despite
--          that same migration extending speakers with identity_id (IDENT-01) and
--          documenting it as "user-scoped". Fix: add a fourth EXISTS branch checking
--          speakers.identity_id = p_identity_id AND speakers.user_id = p_user_id
--          (speakers.user_id confirmed against 00000000000000_consolidated_schema.sql
--          -- NOT SECURITY DEFINER-dependent since speakers has no RLS gate on this
--          column, but the check itself must run under this function's own
--          SECURITY DEFINER context to match the other three branches).
--          Both fixes are CREATE OR REPLACE against the exact original function
--          bodies -- the three pre-existing user_can_view_identity() branches and
--          get_identity_evidence()'s verified=true filter/ORDER BY are preserved
--          byte-for-byte; nothing else changes.
-- Author: Claude (GSD Phase 34 gap-closure executor)
-- Date: 2026-09-06

-- ============================================================================
-- 1. FUNCTION: user_can_view_identity — add speakers.identity_id branch (WR-02)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.user_can_view_identity(p_identity_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM identities i
    WHERE i.id = p_identity_id AND i.owner_user_id = p_user_id
  ) OR EXISTS (
    SELECT 1 FROM call_participants cp
    WHERE cp.identity_id = p_identity_id
      AND is_organization_member(cp.organization_id, p_user_id)
  ) OR EXISTS (
    SELECT 1 FROM contacts c
    WHERE c.identity_id = p_identity_id
      AND is_organization_member(c.org_id, p_user_id)
  ) OR EXISTS (
    SELECT 1 FROM speakers s
    WHERE s.identity_id = p_identity_id
      AND s.user_id = p_user_id
  );
$$;

COMMENT ON FUNCTION public.user_can_view_identity(UUID, UUID) IS
  'SECURITY DEFINER check for identities RLS: owner OR a participant/contact linked to this '
  'identity via an organization the user belongs to, OR a speakers row the user owns linked to '
  'this identity (WR-02 fix, Phase 34 gap closure). Reads call_participants/contacts/speakers '
  'under definer privileges so this check is reachable regardless of those tables'' own RLS -- '
  'mirrors the events/user_participates_in_event CR-01 fix, applied here from the start rather '
  'than bolted on after a leak.';

-- ============================================================================
-- 2. FUNCTION: get_identity_evidence — gate through user_can_view_identity (CR-01)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_identity_evidence(p_identity_id UUID)
RETURNS TABLE(alias_type TEXT, confidence NUMERIC, evidence TEXT)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT alias_type, confidence, evidence
  FROM identity_aliases
  WHERE identity_id = p_identity_id
    AND verified = true
    AND public.user_can_view_identity(p_identity_id, auth.uid())
  ORDER BY confidence DESC NULLS LAST;
$$;

COMMENT ON FUNCTION public.get_identity_evidence(UUID) IS
  'Redacted evidence RPC (IDENT-08): returns only alias_type/confidence/evidence, NEVER the raw '
  '`value` column (email/provider-id PII). Gated by user_can_view_identity(p_identity_id, '
  'auth.uid()) (CR-01 fix, Phase 34 gap closure) -- a caller with no ownership/participation/'
  'speaker link to p_identity_id now gets zero rows, not a redacted-but-present row. Previously '
  'callable by any authenticated user for any identity_id; the review found this to be a '
  'cross-org IDOR independent of current content.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
