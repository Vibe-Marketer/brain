-- Migration: Add enabled_categories column to mcp_tokens
-- Purpose: Phase 23 — per-token capability toggles. NULL = backwards-compatible full-access
--          (matches existing token behavior). Non-null = JSONB array of category names from
--          {'read','write','admin','ai'}; only tools in those categories are accepted by mcp-server.
--          See .planning/phases/23-management-ui/23-CONTEXT.md (D-02, D-03, D-04, D-13).
-- Author: Phase 23 plan-phase
-- Date: 2026-05-07

-- ============================================================================
-- ALTER: mcp_tokens — add enabled_categories JSONB
-- ============================================================================
ALTER TABLE mcp_tokens
  ADD COLUMN IF NOT EXISTS enabled_categories JSONB;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON COLUMN mcp_tokens.enabled_categories IS
  'Phase 23 (D-02..D-04, D-13): per-token category whitelist. NULL = legacy full-access (default; backwards-compatible). Non-null = JSONB array containing any subset of [''read'',''write'',''admin'',''ai'']. Server-side enforcement in supabase/functions/mcp-server/index.ts gates tool dispatch by mapping the requested tool name through TOOL_CATEGORIES (supabase/functions/_shared/mcp-tool-categories.ts) and rejecting calls whose category is not in the array.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
