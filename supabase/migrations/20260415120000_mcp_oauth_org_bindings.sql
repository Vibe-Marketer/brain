-- Migration: MCP OAuth Org Bindings
-- Purpose: Sidecar table mapping OAuth-authenticated users to their selected
--          organization during the MCP OAuth 2.1 consent flow. Since Supabase
--          OAuth JWTs don't support custom claims, this table bridges the gap.
-- Author: Claude
-- Date: 2026-04-15

-- ============================================================================
-- TABLE: mcp_oauth_org_bindings
-- ============================================================================
-- When a user approves an MCP OAuth authorization request, the consent page
-- upserts a row here with their chosen org_id. The MCP server looks this up
-- when it receives a JWT (instead of a hex token) to determine org scope.
--
-- UNIQUE(user_id): one active binding per user. Re-authorizing overwrites.
-- Users needing per-org tokens should use the manual hex token flow (MCPTab).

CREATE TABLE IF NOT EXISTS mcp_oauth_org_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE mcp_oauth_org_bindings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own bindings" ON mcp_oauth_org_bindings
  FOR ALL USING (user_id = auth.uid());

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX idx_mcp_oauth_org_bindings_user ON mcp_oauth_org_bindings(user_id);

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE mcp_oauth_org_bindings IS
  'Maps OAuth-authenticated MCP users to their selected organization. Upserted during OAuth consent.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
