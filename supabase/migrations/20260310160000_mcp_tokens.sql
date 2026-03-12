-- MCP Tokens
-- Each token scopes an AI assistant (Claude Desktop, Cursor, etc.) to a specific
-- workspace or entire organization. Tokens are long-lived API keys — NOT Supabase JWTs.
-- PRO+ feature: enforced at the edge function level, not in SQL.

CREATE TABLE mcp_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'My MCP Token',
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  scope TEXT NOT NULL CHECK (scope IN ('workspace', 'organization')),
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT workspace_or_org CHECK (
    (scope = 'workspace' AND workspace_id IS NOT NULL AND org_id IS NOT NULL) OR
    (scope = 'organization' AND org_id IS NOT NULL AND workspace_id IS NULL)
  )
);

-- RLS: users can only see/manage their own tokens
ALTER TABLE mcp_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own tokens" ON mcp_tokens;
CREATE POLICY "Users manage own tokens" ON mcp_tokens FOR ALL USING (user_id = auth.uid());

-- Index for fast token lookup (called on every MCP request)
CREATE INDEX mcp_tokens_token_idx ON mcp_tokens(token);
CREATE INDEX mcp_tokens_user_idx ON mcp_tokens(user_id);
