/**
 * MCP Token Capabilities Service
 *
 * Phase 23 (D-09, D-10): writes the per-token category whitelist.
 * Server-side enforcement lives in `supabase/functions/mcp-server/index.ts`
 * (see Plan 23-01) and reads `mcp_tokens.enabled_categories`.
 *
 * RLS on `mcp_tokens` (`Users manage own tokens` USING `user_id = auth.uid()`)
 * ensures users can only update their own tokens — column inherits the policy.
 */

import { supabase } from '@/integrations/supabase/client'
import type { ToolCategory } from '@/lib/mcp-tool-categories'
import type { McpToken } from '@/services/mcp-tokens.service'

/**
 * Persistence value contract (D-09):
 *   - null → "all categories enabled" (legacy / default state)
 *   - ToolCategory[] → only listed categories are enabled
 *   - [] → no categories enabled (all tools rejected)
 */
export type EnabledCategoriesValue = ToolCategory[] | null

/**
 * Update the `enabled_categories` column for a single token.
 * Returns the updated token row (full select).
 *
 * Server validation: the four allowed category strings are validated by the
 * mcp-server enforcement (Plan 23-01) on every tool call — a malicious write
 * with an unknown string would simply fail closed (no tool would match).
 * Frontend defense-in-depth: the caller (the hook layer) only ever passes
 * values derived from the four-toggle UI, so unknown strings cannot reach
 * this service in normal use.
 */
export async function setEnabledCategories(
  tokenId: string,
  value: EnabledCategoriesValue,
): Promise<McpToken> {
  const { data, error } = await supabase
    .from('mcp_tokens')
    .update({ enabled_categories: value })
    .eq('id', tokenId)
    .select('id, user_id, org_id, workspace_id, name, token, scope, last_used_at, created_at, enabled_categories')
    .single()

  if (error) {
    throw new Error(`Failed to update token capabilities: ${error.message}`)
  }

  return data as McpToken
}
