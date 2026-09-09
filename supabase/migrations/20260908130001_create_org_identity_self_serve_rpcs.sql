-- Migration: Create self-serve organization identity RPCs
-- Purpose: ORG-02 -- claim_organization_domain lets an org admin/owner claim
--          a domain for their org by proving ownership via an
--          already-verified email on that domain (Phase 34's identity_aliases
--          spine, alias_type='email' AND verified=true) -- reused as-is, no
--          new DNS-TXT flow, no new verification-email flow this phase.
--          add_organization_alias / remove_organization_alias give org
--          admins/owners self-serve control of display/search aliases.
--          All three are direct client-callable SECURITY DEFINER functions
--          (mirrors accept_organization_invite's shape read in
--          20260309210001_org_invitation_bugfixes.sql) -- GRANTed to
--          `authenticated`, using auth.uid() throughout (no p_user_id
--          parameter to spoof). They return a JSONB {success, code} contract
--          so the frontend gets distinguishable error variants instead of one
--          opaque RLS/constraint-violation error.
--          claim_organization_domain checks, in order: (1) caller is
--          org admin/owner -> FORBIDDEN; (2) domain not on the free-email
--          blocklist (LOWER(TRIM(...)) normalized, case/whitespace-
--          insensitive per Pitfall 4) -> BLOCKLISTED; (3) caller holds a
--          currently-verified email on that exact domain -> NO_VERIFIED_EMAIL;
--          (4) INSERT, catching unique_violation as CONFLICT (T-36-01: never
--          echoes the holding org's name/id -- the generic CONFLICT code is
--          the entire response, no raw Postgres error escapes to the client).
--          The blocklist array is the 36-RESEARCH.md Assumptions Log A1
--          starter list (MEDIUM confidence, cross-referenced 3 sources;
--          trivially extensible later without a schema change).
--          Reversibility-gate decision: option-a, auto-selected per the
--          yolo/auto_advance checkpoint posture (Phase 36 Plan 01, Task 1).
-- Author: Claude (GSD Phase 36 Plan 01 executor)
-- Date: 2026-09-09

-- ============================================================================
-- 1. FUNCTION: claim_organization_domain
-- ============================================================================

CREATE OR REPLACE FUNCTION public.claim_organization_domain(
  p_organization_id UUID,
  p_domain TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_domain TEXT := LOWER(TRIM(p_domain));
  v_identity_id UUID;
BEGIN
  IF NOT is_organization_admin_or_owner(p_organization_id, auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'code', 'FORBIDDEN');
  END IF;

  IF v_domain = ANY (ARRAY[
    'gmail.com', 'googlemail.com', 'yahoo.com', 'ymail.com', 'outlook.com',
    'hotmail.com', 'live.com', 'msn.com', 'icloud.com', 'me.com', 'mac.com',
    'aol.com', 'protonmail.com', 'proton.me', 'gmx.com', 'mail.com',
    'zoho.com', 'yandex.com', 'fastmail.com', 'tutanota.com', 'inbox.com',
    'qq.com', '163.com', 'naver.com'
  ]) THEN
    RETURN jsonb_build_object('success', false, 'code', 'BLOCKLISTED');
  END IF;

  SELECT id INTO v_identity_id FROM identities WHERE owner_user_id = auth.uid() LIMIT 1;

  IF v_identity_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM identity_aliases
    WHERE identity_id = v_identity_id
      AND alias_type = 'email'
      AND verified = true
      AND split_part(value, '@', 2) = v_domain
  ) THEN
    RETURN jsonb_build_object('success', false, 'code', 'NO_VERIFIED_EMAIL');
  END IF;

  BEGIN
    INSERT INTO organization_domains (organization_id, domain, claimed_by)
    VALUES (p_organization_id, v_domain, auth.uid());
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'code', 'CONFLICT');
  END;

  RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.claim_organization_domain(UUID, TEXT) IS
  'ORG-02: self-serve domain claim. Caller must be org admin/owner and hold '
  'a currently-verified email (identity_aliases) on the exact domain. '
  'CONFLICT never names the holding org (T-36-01) -- catches unique_violation '
  'instead of letting the raw Postgres error (which can include the '
  'conflicting value) escape to the client.';

GRANT EXECUTE ON FUNCTION public.claim_organization_domain(UUID, TEXT) TO authenticated;

-- ============================================================================
-- 2. FUNCTION: add_organization_alias
-- ============================================================================

CREATE OR REPLACE FUNCTION public.add_organization_alias(
  p_organization_id UUID,
  p_alias TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alias TEXT := TRIM(p_alias);
BEGIN
  IF NOT is_organization_admin_or_owner(p_organization_id, auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'code', 'FORBIDDEN');
  END IF;

  BEGIN
    INSERT INTO organization_aliases (organization_id, alias, created_by)
    VALUES (p_organization_id, v_alias, auth.uid());
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'code', 'CONFLICT');
  END;

  RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.add_organization_alias(UUID, TEXT) IS
  'ORG-01: self-serve alias add, gated to org admin/owner. Stores TRIM(p_alias); '
  'relies on organization_aliases_org_alias_unique (per-org, LOWER(alias)) for '
  'the race-safe duplicate guarantee -- CONFLICT on unique_violation.';

GRANT EXECUTE ON FUNCTION public.add_organization_alias(UUID, TEXT) TO authenticated;

-- ============================================================================
-- 3. FUNCTION: remove_organization_alias
-- ============================================================================
-- Existence is checked BEFORE authorization so a caller never learns
-- "you're not allowed" about an alias id that does not exist -- NOT_FOUND is
-- returned identically regardless of who asks. DELETE ... RETURNING guards
-- the rare TOCTOU race (alias removed between the lookup and the delete).

CREATE OR REPLACE FUNCTION public.remove_organization_alias(
  p_alias_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_organization_id UUID;
  v_deleted_id UUID;
BEGIN
  SELECT organization_id INTO v_organization_id
  FROM organization_aliases
  WHERE id = p_alias_id;

  IF v_organization_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_FOUND');
  END IF;

  IF NOT is_organization_admin_or_owner(v_organization_id, auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'code', 'FORBIDDEN');
  END IF;

  DELETE FROM organization_aliases WHERE id = p_alias_id
  RETURNING id INTO v_deleted_id;

  IF v_deleted_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_FOUND');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.remove_organization_alias(UUID) IS
  'ORG-01: self-serve alias removal, gated to org admin/owner of the alias''s '
  'own organization. NOT_FOUND for a non-existent alias id is returned before '
  'the authorization check runs, so the code never doubles as an FORBIDDEN '
  'signal about a resource that does not exist.';

GRANT EXECUTE ON FUNCTION public.remove_organization_alias(UUID) TO authenticated;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
