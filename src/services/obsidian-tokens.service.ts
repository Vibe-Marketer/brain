/**
 * obsidian-tokens.service.ts
 *
 * Service for managing Obsidian personal API tokens.
 * These tokens are stored in mcp_tokens with token_source = 'obsidian'.
 * They are separate from MCP tokens (which go to AI clients).
 */

import { supabase } from '@/integrations/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ObsidianToken {
  id: string
  user_id: string
  org_id: string
  name: string
  /** Only present immediately after generation — never re-exposed */
  token?: string
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

export interface GeneratedObsidianToken extends ObsidianToken {
  /** Raw token value shown once at generation time */
  token: string
}

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Fetch all active (non-revoked) Obsidian tokens for the current user.
 * RLS on mcp_tokens restricts results to user_id = auth.uid().
 */
export async function getObsidianTokens(): Promise<ObsidianToken[]> {
  const { data, error } = await supabase
    .from('mcp_tokens')
    .select('id, user_id, org_id, name, created_at, last_used_at, revoked_at')
    .eq('token_source', 'obsidian')
    .is('revoked_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch Obsidian tokens: ${error.message}`)
  }

  return (data ?? []) as ObsidianToken[]
}

/**
 * Generate a new Obsidian token via the generate_obsidian_token RPC.
 * Returns the raw token value — surface to the user exactly once.
 */
export async function generateObsidianToken(params: {
  org_id: string
  name: string
}): Promise<GeneratedObsidianToken> {
  const { data, error } = await supabase.rpc('generate_obsidian_token', {
    p_org_id: params.org_id,
    p_name: params.name.trim(),
  })

  if (error) {
    throw new Error(`Failed to generate Obsidian token: ${error.message}`)
  }

  // RPC returns TABLE — take first row
  const row = Array.isArray(data) ? data[0] : data
  if (!row) {
    throw new Error('Token generation did not return a value')
  }

  return row as GeneratedObsidianToken
}

/**
 * Revoke an Obsidian token by setting revoked_at = now().
 * RLS ensures users can only revoke their own tokens.
 */
export async function revokeObsidianToken(id: string): Promise<void> {
  const { error } = await supabase
    .from('mcp_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('token_source', 'obsidian')

  if (error) {
    throw new Error(`Failed to revoke Obsidian token: ${error.message}`)
  }
}
