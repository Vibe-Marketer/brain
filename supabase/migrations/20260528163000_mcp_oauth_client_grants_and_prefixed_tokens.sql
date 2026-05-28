-- Phase 03-01: OAuth client grants + prefixed MCP tokens
-- Replaces one-row-per-user OAuth binding as primary auth source.

CREATE TABLE IF NOT EXISTS mcp_oauth_client_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('organization', 'workspace')),
  enabled_categories JSONB NOT NULL DEFAULT '["read","write","ai"]'::jsonb,
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT mcp_oauth_client_grants_scope_ck CHECK (
    (scope = 'organization' AND org_id IS NOT NULL AND workspace_id IS NULL) OR
    (scope = 'workspace' AND org_id IS NOT NULL AND workspace_id IS NOT NULL)
  ),
  CONSTRAINT mcp_oauth_client_grants_enabled_categories_type_ck CHECK (
    jsonb_typeof(enabled_categories) = 'array'
  ),
  CONSTRAINT mcp_oauth_client_grants_unique_scope UNIQUE (user_id, client_id, org_id, workspace_id)
);

ALTER TABLE mcp_oauth_client_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own grants" ON mcp_oauth_client_grants;
CREATE POLICY "Users manage own grants" ON mcp_oauth_client_grants
  FOR ALL USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_mcp_oauth_client_grants_user_client
  ON mcp_oauth_client_grants(user_id, client_id);
CREATE INDEX IF NOT EXISTS idx_mcp_oauth_client_grants_scope
  ON mcp_oauth_client_grants(org_id, workspace_id, scope);
CREATE INDEX IF NOT EXISTS idx_mcp_oauth_client_grants_active
  ON mcp_oauth_client_grants(user_id, client_id)
  WHERE revoked_at IS NULL;

COMMENT ON TABLE mcp_oauth_client_grants IS
  'Per-client MCP OAuth grants keyed by user_id + client_id + org/workspace scope.';

ALTER TABLE mcp_tokens
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS mcp_tokens_active_lookup_idx
  ON mcp_tokens(token)
  WHERE revoked_at IS NULL;

CREATE OR REPLACE FUNCTION generate_prefixed_mcp_token(p_scope TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_scope = 'workspace' THEN
    RETURN 'cv_ws_' || encode(gen_random_bytes(32), 'hex');
  END IF;

  RETURN 'cv_org_' || encode(gen_random_bytes(32), 'hex');
END;
$$;

CREATE OR REPLACE FUNCTION set_mcp_token_value()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.token IS NULL OR NEW.token = '' OR NEW.token ~ '^[0-9a-f]{64}$' THEN
    NEW.token := generate_prefixed_mcp_token(NEW.scope);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_set_mcp_token_value ON mcp_tokens;
CREATE TRIGGER tr_set_mcp_token_value
BEFORE INSERT ON mcp_tokens
FOR EACH ROW
EXECUTE FUNCTION set_mcp_token_value();

DROP FUNCTION IF EXISTS regenerate_mcp_token(UUID);

CREATE FUNCTION regenerate_mcp_token(p_token_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  org_id UUID,
  workspace_id UUID,
  name TEXT,
  token TEXT,
  scope TEXT,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  enabled_categories JSONB,
  revoked_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
  UPDATE mcp_tokens
  SET token = generate_prefixed_mcp_token(mcp_tokens.scope)
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
    mcp_tokens.enabled_categories,
    mcp_tokens.revoked_at;
$$;

INSERT INTO mcp_oauth_client_grants (
  user_id,
  client_id,
  org_id,
  workspace_id,
  scope,
  enabled_categories,
  created_at,
  updated_at
)
SELECT
  b.user_id,
  'legacy_oauth_binding',
  b.org_id,
  NULL,
  'organization',
  '["read","write","ai"]'::jsonb,
  COALESCE(b.created_at, now()),
  COALESCE(b.updated_at, now())
FROM mcp_oauth_org_bindings b
ON CONFLICT (user_id, client_id, org_id, workspace_id) DO NOTHING;
