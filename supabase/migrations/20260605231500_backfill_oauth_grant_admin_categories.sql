-- Fix MCP OAuth grants so OAuth clients can reach admin-category tools.
-- The launch-era default omitted "admin", which made create_workspace and
-- create_organization unreachable for every OAuth-backed connection even when
-- the user expected full MCP access.

ALTER TABLE mcp_oauth_client_grants
ALTER COLUMN enabled_categories
SET DEFAULT '["read","write","ai","admin"]'::jsonb;

UPDATE mcp_oauth_client_grants
SET enabled_categories = enabled_categories || '["admin"]'::jsonb,
    updated_at = now()
WHERE revoked_at IS NULL
  AND NOT (enabled_categories ? 'admin');
