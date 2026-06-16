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
  // ISC-1–7: Internal secret gate — FIRST action before any auth logic.
  // Cloudflare Worker bypasses are blocked here: direct POSTs to the Supabase
  // project URL without the shared secret return 403 immediately.
  const internalSecret = Deno.env.get('CALLVAULT_INTERNAL_SECRET');
  const incomingSecret = req.headers.get('x-callvault-internal-secret');
  if (!internalSecret || !incomingSecret || incomingSecret !== internalSecret) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    };
  }

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

    const subdomainAudience = await enforceSubdomainSlugAudience(
      req,
      serviceRoleClient,
      mcpToken,
    );
    if (!subdomainAudience.ok) return subdomainAudience;

    return {
      ok: true,
      mcpToken: applyRequestedWorkspaceScope(
        subdomainAudience.mcpToken,
        requestedWorkspaceId,
      ),
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

  // ISC-9: client_id read from verified app_metadata (field confirmed: 'client_id'); replaces raw base64 JWT decode which had no signature verification
  const clientId = (jwtUser.app_metadata as Record<string, unknown>)?.client_id as string | null ?? null;
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

  // Resolve the org from an org subdomain ({orgslug}.callvaultai.com) so grant
  // selection can disambiguate by org. Without this, a user with Claude grants in
  // multiple orgs always hits multi_org_ambiguity on an org URL even though the
  // subdomain already names the org. (The slug audience is re-validated below.)
  let requestedOrgId: string | null = null;
  const orgSlugHeader = req.headers.get('x-callvault-org-slug')?.trim();
  if (orgSlugHeader) {
    const { data: orgRow } = await serviceRoleClient
      .from('organizations')
      .select('id')
      .eq('slug', orgSlugHeader)
      .maybeSingle();
    requestedOrgId = (orgRow as { id: string } | null)?.id ?? null;
  }

  const grantResult = selectOAuthGrant(
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
    requestedOrgId,
  );

  // ISC-48–50: Multi-org ambiguity — return 403 with disambiguation message.
  if (grantResult.error?.code === 'multi_org_ambiguity') {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({
          error: 'multi_org_ambiguity',
          message:
            'Multiple org grants found. Connect via your org-scoped URL: {orgslug}.callvaultai.com/mcp',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      ),
    };
  }

  const grant = grantResult.grant;

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

  const subdomainAudience = await enforceSubdomainSlugAudience(
    req,
    serviceRoleClient,
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
  );
  if (!subdomainAudience.ok) return subdomainAudience;

  return {
    ok: true,
    mcpToken: applyRequestedWorkspaceScope(
      subdomainAudience.mcpToken,
      requestedWorkspaceId,
    ),
  };
}

async function enforceSubdomainSlugAudience(
  req: Request,
  serviceRoleClient: SupabaseClient,
  mcpToken: McpToken,
): Promise<AuthenticatedMcpRequest> {
  const orgSlugHeader = req.headers.get('x-callvault-org-slug')?.trim();
  if (!orgSlugHeader) return { ok: true, mcpToken };

  const { data: orgRow, error: orgError } = await serviceRoleClient
    .from('organizations')
    .select('id')
    .eq('slug', orgSlugHeader)
    .maybeSingle();

  if (orgError || !orgRow) {
    return {
      ok: false,
      response: jsonAudienceError('org_not_found', 404),
    };
  }

  const orgId = (orgRow as { id: string }).id;
  if (mcpToken.org_id !== orgId) {
    return {
      ok: false,
      response: jsonAudienceError('token_org_mismatch', 403),
    };
  }

  const workspaceSlugHeader = req.headers.get('x-callvault-workspace-slug')?.trim();
  if (!workspaceSlugHeader) return { ok: true, mcpToken };

  const { data: workspaceRow, error: workspaceError } = await serviceRoleClient
    .from('workspaces')
    .select('id')
    .eq('slug', workspaceSlugHeader)
    .eq('organization_id', orgId)
    .maybeSingle();

  if (workspaceError || !workspaceRow) {
    return {
      ok: false,
      response: jsonAudienceError('token_workspace_mismatch', 403),
    };
  }

  const workspaceId = (workspaceRow as { id: string }).id;
  if (mcpToken.workspace_id && mcpToken.workspace_id !== workspaceId) {
    return {
      ok: false,
      response: jsonAudienceError('token_workspace_mismatch', 403),
    };
  }

  return {
    ok: true,
    mcpToken: {
      ...mcpToken,
      scope: 'workspace',
      workspace_id: workspaceId,
    },
  };
}

function jsonAudienceError(error: string, status: number): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
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
