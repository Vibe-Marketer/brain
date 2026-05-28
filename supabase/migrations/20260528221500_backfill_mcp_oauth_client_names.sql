-- Backfill existing MCP OAuth grants with the display name Supabase Auth
-- stored when the client registered or authorized.

UPDATE mcp_oauth_client_grants AS grant_row
SET
  client_name = auth_client.client_name,
  updated_at = now()
FROM auth.oauth_clients AS auth_client
WHERE grant_row.client_name IS NULL
  AND auth_client.id::text = grant_row.client_id
  AND auth_client.client_name IS NOT NULL
  AND btrim(auth_client.client_name) <> '';
