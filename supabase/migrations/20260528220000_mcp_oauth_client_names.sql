-- Store the human-readable OAuth client name shown during consent so the
-- Settings page can show "Claude", "Perplexity", etc. instead of UUIDs.

ALTER TABLE mcp_oauth_client_grants
  ADD COLUMN IF NOT EXISTS client_name TEXT;

COMMENT ON COLUMN mcp_oauth_client_grants.client_name IS
  'Display name reported by the OAuth client during consent, e.g. Claude Desktop or Perplexity.';
