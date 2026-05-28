import { supabase } from '@/integrations/supabase/client'
import type { ToolCategory } from '@/lib/mcp-tool-categories'

export type McpOAuthGrantScope = 'organization' | 'workspace'

export interface PersistMcpOAuthGrantParams {
  userId: string
  orgId: string
  workspaceId: string | null
  scope: McpOAuthGrantScope
  clientId?: string | null
}

const DEFAULT_OAUTH_CATEGORIES: ToolCategory[] = ['read', 'write', 'ai']
const FALLBACK_CLIENT_ID = 'legacy_oauth_binding'

export async function persistMcpOAuthGrant(params: PersistMcpOAuthGrantParams): Promise<void> {
  const clientId = params.clientId?.trim() || FALLBACK_CLIENT_ID

  const grantRow = {
    user_id: params.userId,
    client_id: clientId,
    org_id: params.orgId,
    workspace_id: params.scope === 'workspace' ? params.workspaceId : null,
    scope: params.scope,
    enabled_categories: DEFAULT_OAUTH_CATEGORIES,
    revoked_at: null,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('mcp_oauth_client_grants')
    .upsert(grantRow, { onConflict: 'user_id,client_id,org_id,workspace_id' })

  if (error) {
    throw new Error(`Failed to persist MCP OAuth grant: ${error.message}`)
  }
}
