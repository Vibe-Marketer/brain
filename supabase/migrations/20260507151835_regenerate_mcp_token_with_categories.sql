-- Migration: regenerate_mcp_token returns enabled_categories
-- Purpose: Phase 27 D-04 — original RPC predates Phase 23's enabled_categories column.
--          After regenerate, optimistic cache patch was missing the column → deriveToggleState
--          showed "all on" until cache invalidate self-healed. This migration replaces the
--          function in-place (CREATE OR REPLACE) — preserves SECURITY DEFINER, search_path,
--          and the auth.uid() IDOR guard from the original (T-19-02 / T-27-01).
-- Author: Phase 27 closure
-- Date: 2026-05-07
--
-- Note (Rule 3 deviation): Postgres rejects CREATE OR REPLACE FUNCTION when
-- the RETURNS TABLE column set changes (SQLSTATE 42P13 — "cannot change return
-- type of existing function"). We DROP first, then re-create with the new
-- return shape. Safe: no views/triggers depend on this function — it's a
-- state-mutating UPDATE invoked only from the application via supabase.rpc().

DROP FUNCTION IF EXISTS regenerate_mcp_token(UUID);

CREATE FUNCTION regenerate_mcp_token(p_token_id UUID)
RETURNS TABLE (
  id                  UUID,
  user_id             UUID,
  org_id              UUID,
  workspace_id        UUID,
  name                TEXT,
  token               TEXT,
  scope               TEXT,
  last_used_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ,
  enabled_categories  JSONB
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
  UPDATE mcp_tokens
  SET token = encode(gen_random_bytes(32), 'hex')
  WHERE mcp_tokens.id = p_token_id
    AND mcp_tokens.user_id = auth.uid()
  RETURNING
    mcp_tokens.id,
    mcp_tokens.user_id,
    mcp_tokens.org_id,
    mcp_tokens.workspace_id,
    mcp_tokens.name,
    mcp_tokens.token,
    mcp_tokens.scope,
    mcp_tokens.last_used_at,
    mcp_tokens.created_at,
    mcp_tokens.enabled_categories;
$$;

COMMENT ON FUNCTION regenerate_mcp_token(UUID) IS
  'Phase 27 D-04: atomically replaces token hex; returns full row including enabled_categories. '
  'IDOR-protected via auth.uid() in WHERE clause (T-19-02). SECURITY DEFINER preserved.';
