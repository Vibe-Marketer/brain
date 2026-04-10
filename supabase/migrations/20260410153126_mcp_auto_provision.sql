-- Migration: MCP Token Auto-Provisioning
-- Purpose: Auto-provision MCP tokens for PRO+ orgs on org creation and plan upgrade.
--          Provides atomic token regeneration RPC for frontend use.
-- Author: Claude
-- Date: 2026-04-10

-- ============================================================================
-- FUNCTION: is_paid_tier
-- ============================================================================
-- Pure helper that ports deriveTier() from src/hooks/useSubscription.ts into SQL.
-- Returns TRUE if the given subscription represents an active PRO+ tier.
CREATE OR REPLACE FUNCTION is_paid_tier(
  p_product_id TEXT,
  p_status     TEXT,
  p_period_end TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- No product → free
  IF p_product_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- pro-trial: only paid if actively trialing and period has not expired
  IF lower(p_product_id) = 'pro-trial' THEN
    RETURN (p_status = 'trialing' AND (p_period_end IS NULL OR p_period_end > now()));
  END IF;

  -- pro* or team* prefixes → paid if active or trialing
  IF lower(p_product_id) LIKE 'pro%' OR lower(p_product_id) LIKE 'team%' THEN
    RETURN p_status IN ('active', 'trialing');
  END IF;

  RETURN FALSE;
END;
$$;

-- ============================================================================
-- FUNCTION: auto_provision_mcp_token (trigger function)
-- ============================================================================
-- Fires AFTER INSERT ON organizations. Checks if the org owner is on a PRO+
-- plan and inserts an mcp_tokens row if none exists yet (D-01).
CREATE OR REPLACE FUNCTION auto_provision_mcp_token()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id   UUID;
  v_product_id TEXT;
  v_status     TEXT;
  v_period_end TIMESTAMPTZ;
BEGIN
  -- Look up the org owner from organization_memberships
  SELECT user_id INTO v_owner_id
  FROM organization_memberships
  WHERE organization_id = NEW.id
    AND role = 'organization_owner'
  LIMIT 1;

  -- No owner found yet — skip (D-02 upgrade path handles later)
  IF v_owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Look up billing tier from user_profiles
  SELECT product_id, subscription_status, current_period_end
  INTO v_product_id, v_status, v_period_end
  FROM user_profiles
  WHERE user_id = v_owner_id;

  -- Free tier — skip; D-02 upgrade path will provision when they upgrade
  IF NOT FOUND OR NOT is_paid_tier(v_product_id, v_status, v_period_end) THEN
    RETURN NEW;
  END IF;

  -- One-token-per-org guard: only insert if no token exists for this org
  IF NOT EXISTS (SELECT 1 FROM mcp_tokens WHERE org_id = NEW.id) THEN
    INSERT INTO mcp_tokens (user_id, org_id, workspace_id, name, scope)
    VALUES (v_owner_id, NEW.id, NULL, 'Auto-provisioned MCP Token', 'organization');
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger: fire after each org INSERT
DROP TRIGGER IF EXISTS tr_auto_provision_mcp_token ON organizations;
CREATE TRIGGER tr_auto_provision_mcp_token
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION auto_provision_mcp_token();

-- ============================================================================
-- FUNCTION: maybe_provision_mcp_token
-- ============================================================================
-- Called by polar-webhook on subscription.active / subscription.created (D-02).
-- Idempotent — does nothing if a token already exists for the org.
CREATE OR REPLACE FUNCTION maybe_provision_mcp_token(p_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id   UUID;
  v_product_id TEXT;
  v_status     TEXT;
  v_period_end TIMESTAMPTZ;
BEGIN
  -- Look up the org owner
  SELECT user_id INTO v_owner_id
  FROM organization_memberships
  WHERE organization_id = p_org_id
    AND role = 'organization_owner'
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    RETURN;
  END IF;

  -- Look up billing tier
  SELECT product_id, subscription_status, current_period_end
  INTO v_product_id, v_status, v_period_end
  FROM user_profiles
  WHERE user_id = v_owner_id;

  IF NOT FOUND OR NOT is_paid_tier(v_product_id, v_status, v_period_end) THEN
    RETURN;
  END IF;

  -- Idempotency guard: insert only if no token exists for this org
  IF NOT EXISTS (SELECT 1 FROM mcp_tokens WHERE org_id = p_org_id) THEN
    INSERT INTO mcp_tokens (user_id, org_id, workspace_id, name, scope)
    VALUES (v_owner_id, p_org_id, NULL, 'Auto-provisioned MCP Token', 'organization');
  END IF;
END;
$$;

-- ============================================================================
-- FUNCTION: regenerate_mcp_token
-- ============================================================================
-- Atomically replaces the token hex for a given token row.
-- IDOR protection: WHERE clause includes auth.uid() so users can only
-- regenerate their own tokens (T-19-02).
CREATE OR REPLACE FUNCTION regenerate_mcp_token(p_token_id UUID)
RETURNS TABLE (
  id          UUID,
  user_id     UUID,
  org_id      UUID,
  workspace_id UUID,
  name        TEXT,
  token       TEXT,
  scope       TEXT,
  last_used_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
  UPDATE mcp_tokens
  SET token = encode(gen_random_bytes(32), 'hex')
  WHERE mcp_tokens.id = p_token_id
    AND mcp_tokens.user_id = auth.uid()
  RETURNING mcp_tokens.*;
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON FUNCTION is_paid_tier(TEXT, TEXT, TIMESTAMPTZ) IS
  'Returns TRUE if the given Polar subscription represents an active PRO+ tier. Mirrors deriveTier() in useSubscription.ts.';

COMMENT ON FUNCTION auto_provision_mcp_token() IS
  'Trigger function: auto-provisions an MCP token for PRO+ orgs on organization creation (D-01).';

COMMENT ON FUNCTION maybe_provision_mcp_token(UUID) IS
  'Idempotent RPC called by polar-webhook on plan upgrade to provision MCP token for existing orgs (D-02).';

COMMENT ON FUNCTION regenerate_mcp_token(UUID) IS
  'Atomically swaps the token hex for the caller-owned token row. Returns the updated row (D-08).';

COMMENT ON TRIGGER tr_auto_provision_mcp_token ON organizations IS
  'Fires AFTER INSERT on organizations to auto-provision MCP tokens for PRO+ orgs.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
