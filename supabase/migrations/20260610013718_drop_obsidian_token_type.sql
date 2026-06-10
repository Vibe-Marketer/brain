-- Migration: Drop generate_obsidian_token dead code
-- Purpose: generate_obsidian_token was created for an obsidian-sync path that was
--          superseded by generate_api_token. No frontend or Edge Function calls it.
--          Migrate any existing obsidian-type tokens to 'api', drop the function,
--          drop the lookup index, and tighten the CHECK constraint to ('mcp', 'api').
-- Date: 2026-06-10

-- Step 1: Migrate any existing obsidian-type tokens to api (preserves existing tokens)
UPDATE mcp_tokens
  SET token_source = 'api'
  WHERE token_source = 'obsidian';

-- Step 2: Drop the dead lookup index
DROP INDEX IF EXISTS mcp_tokens_obsidian_lookup_idx;

-- Step 3: Drop the dead function
DROP FUNCTION IF EXISTS generate_obsidian_token(UUID, TEXT);

-- Step 4: Update the CHECK constraint to remove 'obsidian'
ALTER TABLE mcp_tokens DROP CONSTRAINT IF EXISTS mcp_tokens_token_source_check;
ALTER TABLE mcp_tokens ADD CONSTRAINT mcp_tokens_token_source_check
  CHECK (token_source IN ('mcp', 'api'));

-- Step 5: Update the column comment
COMMENT ON COLUMN mcp_tokens.token_source IS
  'Token type discriminator: mcp (AI clients via MCP server), api (REST API integrations including Obsidian plugin).';
