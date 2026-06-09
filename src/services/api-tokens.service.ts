/**
 * api-tokens.service.ts
 *
 * Service for managing CallVault REST API tokens.
 * These tokens are stored in mcp_tokens with token_source = 'api'.
 * They authenticate requests to the CallVault REST API (api.callvaultai.com/v1/*).
 *
 * Distinct from MCP tokens (AI clients) and Obsidian tokens.
 * Token values are generated server-side by the generate_api_token RPC.
 */

import { supabase } from '@/integrations/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ApiTokenScope = 'organization' | 'workspace'

export interface ApiToken {
  id: string
  user_id: string
  org_id: string
  workspace_id: string | null
  name: string
  scope: ApiTokenScope
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

export interface GeneratedApiToken extends ApiToken {
  /** Raw token value shown once at generation time — never re-exposed after this */
  token: string
}

export interface GenerateApiTokenParams {
  org_id: string
  name: string
  scope?: ApiTokenScope
  workspace_id?: string
}

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Fetch all active (non-revoked) API tokens for the current user.
 * RLS on mcp_tokens restricts results to user_id = auth.uid().
 * Filters to token_source = 'api' so MCP and Obsidian tokens are never included.
 */
export async function getApiTokens(): Promise<ApiToken[]> {
  const { data, error } = await supabase
    .from('mcp_tokens')
    .select('id, user_id, org_id, workspace_id, name, scope, created_at, last_used_at, revoked_at')
    .eq('token_source', 'api')
    .is('revoked_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch API tokens: ${error.message}`)
  }

  return (data ?? []) as ApiToken[]
}

/**
 * Generate a new CallVault API token via the generate_api_token RPC.
 * Returns the raw token value — surface to the user exactly once.
 *
 * The RPC hard-codes token_source = 'api' and uses cv_api_ prefix.
 * Never calls generate_obsidian_token or any Obsidian-specific RPC.
 */
export async function generateApiToken(params: GenerateApiTokenParams): Promise<GeneratedApiToken> {
  const { data, error } = await supabase.rpc('generate_api_token', {
    p_org_id: params.org_id,
    p_name: params.name.trim(),
    p_scope: params.scope ?? 'organization',
    p_workspace_id: params.workspace_id ?? null,
  })

  if (error) {
    throw new Error(`Failed to generate API token: ${error.message}`)
  }

  // RPC returns TABLE — take first row
  const row = Array.isArray(data) ? data[0] : data
  if (!row) {
    throw new Error('Token generation did not return a value')
  }

  return row as GeneratedApiToken
}

/**
 * Revoke an API token by setting revoked_at = now().
 * RLS ensures users can only revoke their own tokens.
 * Filters by token_source = 'api' as an extra safety boundary.
 */
export async function revokeApiToken(id: string): Promise<void> {
  const { error } = await supabase
    .from('mcp_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('token_source', 'api')

  if (error) {
    throw new Error(`Failed to revoke API token: ${error.message}`)
  }
}
