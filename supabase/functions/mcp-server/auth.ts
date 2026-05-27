import { type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { type McpToken } from './tools/types.ts';
import { unauthorizedResponse, mcpError } from './tools/utils.ts';
import { RoutingContext } from './routing.ts';

export async function authenticateMcpRequest(
  req: Request,
  routingContext: RoutingContext,
  supabase: SupabaseClient,
  corsHeaders: Record<string, string>,
  id: string | number | null
): Promise<Response | { mcpToken: McpToken }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return unauthorizedResponse(id, corsHeaders, routingContext.originHost);
  }

  const rawToken = authHeader.replace('Bearer ', '').trim();
  if (!rawToken) {
    return unauthorizedResponse(id, corsHeaders, routingContext.originHost);
  }

  // Token validation for new prefixes (cv_ws_<hex>, cv_org_<hex>) and legacy (64 hex)
  const isWorkspaceToken = rawToken.startsWith('cv_ws_') && /^[0-9a-f]{64}$/.test(rawToken.replace('cv_ws_', ''));
  const isOrgToken = rawToken.startsWith('cv_org_') && /^[0-9a-f]{64}$/.test(rawToken.replace('cv_org_', ''));
  const isLegacyHexToken = /^[0-9a-f]{64}$/.test(rawToken);
  const isHexToken = isWorkspaceToken || isOrgToken || isLegacyHexToken;

  let mcpToken: McpToken;

  if (isHexToken) {
    const { data: tokenRow, error: tokenError } = await supabase
      .from('mcp_tokens')
      .select('id, user_id, org_id, workspace_id, scope, name, enabled_categories')
      .eq('token', rawToken)
      .maybeSingle();

    if (tokenError || !tokenRow) {
      return unauthorizedResponse(id, corsHeaders, routingContext.originHost, 'Invalid MCP token');
    }

    mcpToken = tokenRow as McpToken;

    // Audience binding: if the request path specifies a workspace, token must authorize access to it.
    if (routingContext.workspaceId && mcpToken.workspace_id !== routingContext.workspaceId) {
      // Return 403 Forbidden for valid token but wrong audience
      return new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id,
          error: { code: -32001, message: 'Forbidden: Token does not grant access to this workspace' }
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update last_used_at
    supabase
      .from('mcp_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', mcpToken.id)
      .then(() => {});
  } else {
    // OAuth JWT auth
    const authClient = supabase; // In real code, we use anonKey auth client. We will pass anon auth client.
    const { data: { user: jwtUser }, error: jwtError } = await authClient.auth.getUser(rawToken);

    if (jwtError || !jwtUser) {
      return unauthorizedResponse(id, corsHeaders, routingContext.originHost, 'Invalid token');
    }

    const { data: binding } = await supabase
      .from('mcp_oauth_org_bindings')
      .select('org_id')
      .eq('user_id', jwtUser.id)
      .maybeSingle();

    if (!binding) {
      return unauthorizedResponse(
        id,
        corsHeaders,
        routingContext.originHost,
        'No organization selected. Please re-authorize at https://app.callvaultai.com/settings/mcp'
      );
    }

    mcpToken = {
      id: `oauth-${jwtUser.id}`,
      user_id: jwtUser.id,
      org_id: binding.org_id,
      workspace_id: null,
      scope: 'organization',
      name: 'OAuth',
      enabled_categories: null,
    };

    // Audience binding for OAuth: we must also check workspace_id if specified.
    // For OAuth tokens, since workspace_id is null, if routingContext.workspaceId is provided, 
    // it implies it's an org token. In the future we might need to check if org has this workspace.
    // Assuming org-level tokens can access all workspaces in the org.
    if (routingContext.workspaceId) {
       const { data: ws } = await supabase
        .from('workspaces')
        .select('org_id')
        .eq('id', routingContext.workspaceId)
        .maybeSingle();
       
       if (!ws || ws.org_id !== mcpToken.org_id) {
          return new Response(
            JSON.stringify({
              jsonrpc: '2.0',
              id,
              error: { code: -32001, message: 'Forbidden: OAuth token does not grant access to this workspace' }
            }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
       }
       mcpToken.workspace_id = routingContext.workspaceId;
    }
  }

  return { mcpToken };
}
