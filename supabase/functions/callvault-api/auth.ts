/**
 * auth.ts — API-token authentication for callvault-api.
 *
 * SECURITY REQUIREMENTS (T-06.2-04):
 * - Only tokens with token_source = 'api' are accepted. MCP/Obsidian tokens return 403.
 * - Missing, malformed, or unknown tokens return 401.
 * - Revoked tokens (revoked_at IS NOT NULL) return 401.
 * - last_used_at is updated fire-and-forget after successful auth.
 *
 * The return type is a union: either a Response (early exit) or an ApiTokenContext.
 * Callers must check: `if (result instanceof Response) return result;`
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { jsonError } from './responses.ts';

export interface ApiTokenContext {
  /** Token row ID */
  id: string;
  /** Owner user ID */
  user_id: string;
  /** Organization the token belongs to */
  org_id: string;
  /** Workspace the token is locked to — null for organization-scoped tokens */
  workspace_id: string | null;
  /** 'workspace' | 'organization' */
  scope: 'workspace' | 'organization';
  /** Token display name */
  name: string;
}

/**
 * Authenticate an incoming REST API request.
 *
 * Reads `Authorization: Bearer <token>`, looks up the token in mcp_tokens,
 * enforces token_source = 'api' and revoked_at IS NULL, then fires a
 * last_used_at update in the background.
 *
 * Returns:
 *   - 401 Response — missing/malformed/unknown token or revoked token
 *   - 403 Response — token exists but token_source is not 'api'
 *   - ApiTokenContext — successful auth
 */
export async function authenticateApiToken(
  req: Request,
  supabase: ReturnType<typeof createClient>,
): Promise<ApiTokenContext | Response> {
  // Case-insensitive bearer header parse
  const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization');

  if (!authHeader) {
    return jsonError(401, 'MISSING_TOKEN', 'Authorization header is required');
  }

  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return jsonError(401, 'INVALID_TOKEN_FORMAT', 'Authorization header must use Bearer scheme');
  }

  const rawToken = authHeader.replace(/^bearer\s+/i, '').trim();
  if (!rawToken) {
    return jsonError(401, 'MISSING_TOKEN', 'Bearer token value is empty');
  }

  // Look up token without source filter first so we can distinguish 401 (unknown) from 403 (wrong source)
  const { data: tokenRow, error: tokenError } = await supabase
    .from('mcp_tokens')
    .select('id, user_id, org_id, workspace_id, scope, name, token_source, revoked_at')
    .eq('token', rawToken)
    .maybeSingle();

  if (tokenError) {
    console.error('callvault-api: token lookup error', tokenError);
    return jsonError(500, 'INTERNAL_ERROR', 'Failed to authenticate token');
  }

  if (!tokenRow) {
    // Token doesn't exist at all → 401
    return jsonError(401, 'INVALID_TOKEN', 'Token not found or invalid');
  }

  type TokenRow = {
    id: string;
    user_id: string;
    org_id: string;
    workspace_id: string | null;
    scope: string;
    name: string;
    token_source: string;
    revoked_at: string | null;
  };

  const row = tokenRow as TokenRow;

  // Token exists but wrong source → 403
  if (row.token_source !== 'api') {
    return jsonError(403, 'WRONG_TOKEN_SOURCE', `This token cannot access the REST API. Expected source 'api', got '${row.token_source}'.`);
  }

  // Token is revoked → 401
  if (row.revoked_at !== null) {
    return jsonError(401, 'TOKEN_REVOKED', 'This token has been revoked');
  }

  // Update last_used_at fire-and-forget
  supabase
    .from('mcp_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', row.id)
    .then(() => {/* fire-and-forget */});

  return {
    id: row.id,
    user_id: row.user_id,
    org_id: row.org_id,
    workspace_id: row.workspace_id,
    scope: row.scope as 'workspace' | 'organization',
    name: row.name,
  };
}
