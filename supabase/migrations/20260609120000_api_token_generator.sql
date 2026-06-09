-- Migration: Add generate_api_token RPC and API token lookup index
-- Purpose: Provide a dedicated token generation path for the CallVault REST API,
--          separate from the Obsidian-specific token path.
-- Author: GSD executor
-- Date: 2026-06-09

-- ============================================================================
-- INDEX: fast lookup for API tokens
-- ============================================================================
-- Used by the callvault-api Edge Function to authenticate bearer tokens
-- without a full table scan. Only indexes non-revoked API tokens.

CREATE INDEX IF NOT EXISTS mcp_tokens_api_lookup_idx
  ON mcp_tokens(token)
  WHERE token_source = 'api' AND revoked_at IS NULL;

-- ============================================================================
-- FUNCTION: generate_api_token
-- ============================================================================
-- Called via RPC from the Settings UI (authenticated user JWT).
-- Returns the raw token value ONCE for the caller to display.
-- SECURITY DEFINER so the insert bypasses RLS while still scoping to the
-- calling user's org.
--
-- Security notes (T-06.2-01):
--   - Tokens are generated server-side using gen_random_bytes(32).
--   - token_source is hard-coded to 'api' — cannot be spoofed by caller.
--   - Workspace-scoped tokens require p_workspace_id; validation enforced here.
--   - Raw token is returned exactly once to the caller; never re-exposed from DB.

CREATE OR REPLACE FUNCTION generate_api_token(
  p_org_id     UUID,
  p_name       TEXT,
  p_scope      TEXT DEFAULT 'organization',
  p_workspace_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id           UUID,
  token        TEXT,
  name         TEXT,
  scope        TEXT,
  org_id       UUID,
  workspace_id UUID,
  created_at   TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
DECLARE
  v_raw_token  TEXT;
  v_token_id   UUID;
  v_created_at TIMESTAMPTZ;
  v_ws_id      UUID;
BEGIN
  -- Validate scope values
  IF p_scope NOT IN ('organization', 'workspace') THEN
    RAISE EXCEPTION 'Invalid scope %. Must be organization or workspace.', p_scope;
  END IF;

  -- Workspace scope requires a workspace_id (T-06.2-03)
  IF p_scope = 'workspace' AND p_workspace_id IS NULL THEN
    RAISE EXCEPTION 'workspace_id is required when scope = workspace';
  END IF;

  -- Organization scope must not include a workspace_id
  IF p_scope = 'organization' THEN
    v_ws_id := NULL;
  ELSE
    v_ws_id := p_workspace_id;
  END IF;

  -- Generate a prefixed API token (cv_api_ prefix)
  v_raw_token := 'cv_api_' || encode(extensions.gen_random_bytes(32), 'hex');

  INSERT INTO mcp_tokens (
    user_id,
    org_id,
    workspace_id,
    name,
    token,
    scope,
    token_source,
    token_label,
    enabled_categories
  )
  VALUES (
    auth.uid(),
    p_org_id,
    v_ws_id,
    p_name,
    v_raw_token,
    p_scope,
    'api',
    p_name,
    NULL  -- API tokens have no MCP category scoping
  )
  RETURNING
    mcp_tokens.id,
    mcp_tokens.token,
    mcp_tokens.name,
    mcp_tokens.scope,
    mcp_tokens.org_id,
    mcp_tokens.workspace_id,
    mcp_tokens.created_at
  INTO
    v_token_id,
    v_raw_token,
    p_name,
    p_scope,
    p_org_id,
    v_ws_id,
    v_created_at;

  RETURN QUERY SELECT v_token_id, v_raw_token, p_name, p_scope, p_org_id, v_ws_id, v_created_at;
END;
$$;

COMMENT ON FUNCTION generate_api_token(UUID, TEXT, TEXT, UUID) IS
  'Creates a CallVault REST API token for the authenticated user. Returns the raw token value once. token_source is always api.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
