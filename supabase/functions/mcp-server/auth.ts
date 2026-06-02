import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { forbiddenResponse, unauthorizedResponse } from './protocol.ts';
import { applyRequestedWorkspaceScope, selectOAuthGrant } from './grant-selection.ts';
import type { McpToken, SupabaseClient } from './tools/_types.ts';

type AuthenticatedMcpRequest =
  | { ok: true; mcpToken: McpToken }
  | { ok: false; response: Response };

export async function authenticateMcpRequest(
  req: Request,
  id: string | number | null,
  corsHeaders: Record<string, string>,
  originHost: string,
  publicMcpPath: string,
  requestedWorkspaceId: string | null,
  serviceRoleClient: SupabaseClient,
  supabaseUrl: string,
  serviceKey: string,
): Promise<AuthenticatedMcpRequest> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      ok: false,
      response: unauthorizedResponse(id, corsHeaders, originHost, publicMcpPath),
    };
  }

  const rawToken = authHeader.replace('Bearer ', '').trim();
  if (!rawToken) {
    return {
      ok: false,
      response: unauthorizedResponse(id, corsHeaders, originHost, publicMcpPath),
    };
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
        response: unauthorizedResponse(id, corsHeaders, originHost, publicMcpPath, 'Invalid MCP token'),
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

    const scopeError = await enforceWorkspaceAudience(
      serviceRoleClient,
      mcpToken,
      requestedWorkspaceId,
      id,
      corsHeaders,
    );
    if (scopeError) return { ok: false, response: scopeError };

    serviceRoleClient
      .from('mcp_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', mcpToken.id)
      .then(() => {/* no-op */});

    return {
      ok: true,
      mcpToken: applyRequestedWorkspaceScope(mcpToken, requestedWorkspaceId),
    };
  }

  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? serviceKey;
  const authClient = createClient(supabaseUrl, anonKey);
  const { data: { user: jwtUser }, error: jwtError } = await authClient.auth.getUser(rawToken);

  if (jwtError || !jwtUser) {
    return {
      ok: false,
      response: unauthorizedResponse(id, corsHeaders, originHost, publicMcpPath, 'Invalid token'),
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
        publicMcpPath,
        'Invalid token',
      ),
    };
  }

  const { data: grantRows, error: grantError } = await serviceRoleClient
    .from('mcp_oauth_client_grants')
    .select('id, org_id, workspace_id, scope, enabled_categories, revoked_at')
    .eq('user_id', jwtUser.id)
    .eq('client_id', clientId)
    .is('revoked_at', null)
    .order('updated_at', { ascending: false });

  if (grantError) {
    return {
      ok: false,
      response: forbiddenResponse(
        id,
        corsHeaders,
        'Failed to resolve OAuth grant. Re-authorize in CallVault Settings.',
      ),
    };
  }

  let requestedWorkspace: { id: string; organization_id: string } | null = null;
  if (requestedWorkspaceId) {
    const { data: workspaceRow, error: workspaceError } = await serviceRoleClient
      .from('workspaces')
      .select('id, organization_id')
      .eq('id', requestedWorkspaceId)
      .maybeSingle();

    if (workspaceError || !workspaceRow) {
      return {
        ok: false,
        response: forbiddenResponse(
          id,
          corsHeaders,
          `Workspace audience mismatch: requested workspace ${requestedWorkspaceId} is not available to this token.`,
        ),
      };
    }
    requestedWorkspace = workspaceRow;
  }

  const grant = selectOAuthGrant(
    ((grantRows ?? []) as Array<{
      id: string;
      org_id: string | null;
      workspace_id: string | null;
      scope: 'workspace' | 'organization';
      enabled_categories: unknown;
      revoked_at: string | null;
    }>),
    requestedWorkspaceId,
    requestedWorkspace,
  );

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

  const scopeError = await enforceWorkspaceAudience(
    serviceRoleClient,
    {
      id: `oauth-${grant.id}`,
      user_id: jwtUser.id,
      org_id: grant.org_id,
      workspace_id: grant.workspace_id,
      scope: grant.scope,
      name: 'OAuth',
      enabled_categories: (grant.enabled_categories as McpToken['enabled_categories']) ?? null,
    },
    requestedWorkspaceId,
    id,
    corsHeaders,
  );
  if (scopeError) return { ok: false, response: scopeError };

  serviceRoleClient
    .from('mcp_oauth_client_grants')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', grant.id)
    .then(() => {
      /* no-op */
    });

  return {
    ok: true,
    mcpToken: applyRequestedWorkspaceScope(
      {
        id: `oauth-${grant.id}`,
        user_id: jwtUser.id,
        org_id: grant.org_id,
        workspace_id: grant.workspace_id,
        scope: grant.scope,
        name: 'OAuth',
        enabled_categories:
          (grant.enabled_categories as McpToken['enabled_categories']) ??
          null,
      },
      requestedWorkspaceId,
    ),
  };
}

async function enforceWorkspaceAudience(
  serviceRoleClient: SupabaseClient,
  mcpToken: McpToken,
  requestedWorkspaceId: string | null,
  id: string | number | null,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  if (!requestedWorkspaceId) return null;

  if (mcpToken.workspace_id) {
    if (mcpToken.workspace_id !== requestedWorkspaceId) {
      return forbiddenResponse(
        id,
        corsHeaders,
        `Workspace audience mismatch: token is scoped to ${mcpToken.workspace_id} but request targeted ${requestedWorkspaceId}.`,
      );
    }
    return null;
  }

  const { data: workspaceRow, error } = await serviceRoleClient
    .from('workspaces')
    .select('id')
    .eq('id', requestedWorkspaceId)
    .eq('organization_id', mcpToken.org_id)
    .maybeSingle();

  if (error || !workspaceRow) {
    return forbiddenResponse(
      id,
      corsHeaders,
      `Workspace audience mismatch: requested workspace ${requestedWorkspaceId} is not available to this token.`,
    );
  }

  return null;
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
