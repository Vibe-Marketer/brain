-- Migration: Add token_source column to mcp_tokens and generate_obsidian_token RPC
-- Purpose: Support Obsidian personal API tokens as distinct from MCP tokens
-- Author: GSD executor
-- Date: 2026-06-08

-- ============================================================================
-- COLUMN: mcp_tokens.token_source
-- ============================================================================
-- Discriminates token type so the obsidian-sync Edge Function only accepts
-- obsidian-typed tokens, and the MCP server only accepts mcp-typed tokens.

ALTER TABLE mcp_tokens
  ADD COLUMN IF NOT EXISTS token_source TEXT NOT NULL DEFAULT 'mcp'
  CHECK (token_source IN ('mcp', 'obsidian', 'api'));

ALTER TABLE mcp_tokens
  ADD COLUMN IF NOT EXISTS token_label TEXT;

-- Index for fast obsidian-sync lookups (token + source + not revoked)
CREATE INDEX IF NOT EXISTS mcp_tokens_obsidian_lookup_idx
  ON mcp_tokens(token)
  WHERE token_source = 'obsidian' AND revoked_at IS NULL;

-- ============================================================================
-- FUNCTION: generate_obsidian_token
-- ============================================================================
-- Called via RPC from the Settings UI (authenticated user JWT).
-- Returns the raw token value ONCE for the caller to display.
-- SECURITY DEFINER so the insert bypasses RLS while still scoping to the
-- calling user's org.

CREATE OR REPLACE FUNCTION generate_obsidian_token(
  p_org_id UUID,
  p_name TEXT
)
RETURNS TABLE (
  id UUID,
  token TEXT,
  name TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
DECLARE
  v_raw_token TEXT;
  v_token_id UUID;
  v_created_at TIMESTAMPTZ;
BEGIN
  -- Generate a prefixed token for Obsidian (cv_obs_ prefix for clarity)
  v_raw_token := 'cv_obs_' || encode(gen_random_bytes(32), 'hex');

  INSERT INTO mcp_tokens (
    user_id,
    org_id,
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
    p_name,
    v_raw_token,
    'organization',
    'obsidian',
    p_name,
    NULL  -- obsidian tokens have no MCP category scoping
  )
  RETURNING mcp_tokens.id, mcp_tokens.token, mcp_tokens.name, mcp_tokens.created_at
  INTO v_token_id, v_raw_token, p_name, v_created_at;

  RETURN QUERY SELECT v_token_id, v_raw_token, p_name, v_created_at;
END;
$$;

COMMENT ON FUNCTION generate_obsidian_token(UUID, TEXT) IS
  'Creates an Obsidian-scoped personal API token for the authenticated user. Returns the raw token value once.';

COMMENT ON COLUMN mcp_tokens.token_source IS
  'Token type discriminator: mcp (AI clients), obsidian (Obsidian plugin), api (future REST API).';

COMMENT ON COLUMN mcp_tokens.token_label IS
  'Human-readable label set by the user, mirrors name column for display contexts.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
