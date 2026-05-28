import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { forbiddenResponse, unauthorizedResponse } from './protocol.ts';
import type { McpToken, SupabaseClient } from './tools/_types.ts';

type AuthenticatedMcpRequest =
  | { ok: true; mcpToken: McpToken }
  | { ok: false; response: Response };

export async function authenticateMcpRequest(
  req: Request,
  id: string | number | null,
  corsHeaders: Record<string, string>,
  originHost: string,
  serviceRoleClient: SupabaseClient,
  supabaseUrl: string,
  serviceKey: string,
): Promise<AuthenticatedMcpRequest> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false, response: unauthorizedResponse(id, corsHeaders, originHost) };
  }

  const rawToken = authHeader.replace('Bearer ', '').trim();
  if (!rawToken) {
    return { ok: false, response: unauthorizedResponse(id, corsHeaders, originHost) };
  }

  const isLegacyHexToken = /^[0-9a-f]{64}$/.test(rawToken);
  const isPrefixedToken =
    rawToken.startsWith('cv_org_') || rawToken.startsWith('cv_ws_');
  const isManualToken = isLegacyHexToken || isPrefixedToken;

  if (isManualToken) {
    const { data: tokenRow, error: tokenError } = await serviceRoleClient
      .from('mcp_tokens')
      .select(
        'id, user_id, org_id, workspace_id, scope, name, enabled_categories, revoked_at',
      )
      .eq('token', rawToken)
      .maybeSingle();

    if (tokenError || !tokenRow) {
      return {
        ok: false,
        response: unauthorizedResponse(id, corsHeaders, originHost, 'Invalid MCP token'),
      };
    }

    if (tokenRow.revoked_at) {
      return {
        ok: false,
        response: forbiddenResponse(
          id,
          corsHeaders,
          'MCP token has been revoked',
        ),
      };
    }

    const mcpToken = tokenRow as McpToken;

    serviceRoleClient
      .from('mcp_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', mcpToken.id)
      .then(() => {/* no-op */});

    return { ok: true, mcpToken };
  }

  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? serviceKey;
  const authClient = createClient(supabaseUrl, anonKey);
  const { data: { user: jwtUser }, error: jwtError } = await authClient.auth.getUser(rawToken);

  if (jwtError || !jwtUser) {
    return {
      ok: false,
      response: unauthorizedResponse(id, corsHeaders, originHost, 'Invalid token'),
    };
  }

  const clientId = readClientIdFromJwt(rawToken);
  if (!clientId) {
    return {
      ok: false,
      response: unauthorizedResponse(
        id,
        corsHeaders,
        originHost,
        'Invalid token',
      ),
    };
  }

  const { data: grant } = await serviceRoleClient
    .from('mcp_oauth_client_grants')
    .select('id, org_id, workspace_id, scope, enabled_categories, revoked_at')
    .eq('user_id', jwtUser.id)
    .eq('client_id', clientId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!grant || grant.revoked_at) {
    return {
      ok: false,
      response: forbiddenResponse(
        id,
        corsHeaders,
        'OAuth grant is missing or revoked. Re-authorize in CallVault Settings.',
      ),
    };
  }

  serviceRoleClient
    .from('mcp_oauth_client_grants')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', grant.id)
    .then(() => {
      /* no-op */
    });

  return {
    ok: true,
    mcpToken: {
      id: `oauth-${grant.id}`,
      user_id: jwtUser.id,
      org_id: grant.org_id,
      workspace_id: grant.workspace_id,
      scope: grant.scope,
      name: 'OAuth',
      enabled_categories:
        (grant.enabled_categories as McpToken['enabled_categories']) ??
        ['read', 'write', 'ai'],
    },
  };
}

function readClientIdFromJwt(rawToken: string): string | null {
  const parts = rawToken.split('.');
  if (parts.length < 2) return null;
  const payload = base64UrlDecode(parts[1]);
  if (!payload) return null;
  try {
    const parsed = JSON.parse(payload) as { client_id?: unknown };
    return typeof parsed.client_id === 'string' && parsed.client_id.length > 0
      ? parsed.client_id
      : null;
  } catch {
    return null;
  }
}

function base64UrlDecode(value: string): string | null {
  try {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/');
    const withPadding = padded + '='.repeat((4 - (padded.length % 4)) % 4);
    return atob(withPadding);
  } catch {
    return null;
  }
}
