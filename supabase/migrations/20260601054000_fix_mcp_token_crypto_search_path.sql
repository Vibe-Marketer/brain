-- Fix MCP token crypto lookup under SECURITY DEFINER functions that run with
-- search_path=public. pgcrypto is installed in extensions on Supabase, so
-- unqualified gen_random_bytes() is not visible from that path.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.generate_prefixed_mcp_token(p_scope TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
BEGIN
  IF p_scope = 'workspace' THEN
    RETURN 'cv_ws_' || encode(extensions.gen_random_bytes(32), 'hex');
  END IF;

  RETURN 'cv_org_' || encode(extensions.gen_random_bytes(32), 'hex');
END;
$$;

CREATE OR REPLACE FUNCTION public.set_mcp_token_value()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
BEGIN
  IF NEW.token IS NULL OR NEW.token = '' OR NEW.token ~ '^[0-9a-f]{64}$' THEN
    NEW.token := public.generate_prefixed_mcp_token(NEW.scope);
  END IF;

  RETURN NEW;
END;
$$;

ALTER TABLE public.mcp_tokens
  ALTER COLUMN token SET DEFAULT encode(extensions.gen_random_bytes(32), 'hex');

CREATE OR REPLACE FUNCTION public.regenerate_mcp_token(p_token_id UUID)
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
  UPDATE public.mcp_tokens
  SET token = public.generate_prefixed_mcp_token(mcp_tokens.scope)
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

COMMENT ON FUNCTION public.generate_prefixed_mcp_token(TEXT) IS
  'Generates prefixed MCP tokens with pgcrypto resolved from extensions regardless of caller search_path.';

COMMENT ON FUNCTION public.set_mcp_token_value() IS
  'Normalizes inserted MCP token values to cv_org_/cv_ws_ prefixes before NOT NULL checks.';
