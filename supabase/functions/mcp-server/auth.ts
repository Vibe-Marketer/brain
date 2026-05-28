import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { unauthorizedResponse } from './protocol.ts';
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

  const isHexToken = /^[0-9a-f]{64}$/.test(rawToken);

  if (isHexToken) {
    const { data: tokenRow, error: tokenError } = await serviceRoleClient
      .from('mcp_tokens')
      .select('id, user_id, org_id, workspace_id, scope, name, enabled_categories')
      .eq('token', rawToken)
      .maybeSingle();

    if (tokenError || !tokenRow) {
      return {
        ok: false,
        response: unauthorizedResponse(id, corsHeaders, originHost, 'Invalid MCP token'),
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

  const { data: binding } = await serviceRoleClient
    .from('mcp_oauth_org_bindings')
    .select('org_id')
    .eq('user_id', jwtUser.id)
    .maybeSingle();

  if (!binding) {
    return {
      ok: false,
      response: unauthorizedResponse(
        id,
        corsHeaders,
        originHost,
        'No organization selected. Please re-authorize at https://app.callvaultai.com/settings/mcp',
      ),
    };
  }

  return {
    ok: true,
    mcpToken: {
      id: `oauth-${jwtUser.id}`,
      user_id: jwtUser.id,
      org_id: binding.org_id,
      workspace_id: null,
      scope: 'organization',
      name: 'OAuth',
      enabled_categories: null,
    },
  };
}
