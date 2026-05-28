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

export interface McpOAuthGrantConnection {
  id: string
  client_id: string
  client_name: string
  connection_type: 'OAuth'
  scope: McpOAuthGrantScope
  org_id: string | null
  org_name: string
  workspace_id: string | null
  workspace_name: string
  endpoint_url: string
  resource_url: string
  enabled_categories: ToolCategory[]
  categories_summary: string
  created_at: string
  updated_at: string
  last_used_at: string | null
  revoked_at: string | null
}

const DEFAULT_OAUTH_CATEGORIES: ToolCategory[] = ['read', 'write', 'ai']
const FALLBACK_CLIENT_ID = 'legacy_oauth_binding'
const PUBLIC_MCP_BASE_URL = 'https://api.callvaultai.com/mcp'

function getBaseMcpUrl(): string {
  return PUBLIC_MCP_BASE_URL
}

function buildEndpointUrl(workspaceId: string | null): string {
  return workspaceId ? `${getBaseMcpUrl()}/w/${workspaceId}` : getBaseMcpUrl()
}

function normalizeCategories(value: unknown): ToolCategory[] {
  if (!Array.isArray(value)) return DEFAULT_OAUTH_CATEGORIES
  const categories = value.filter((item): item is ToolCategory => {
    return item === 'read' || item === 'write' || item === 'ai' || item === 'admin'
  })
  return categories.length > 0 ? categories : DEFAULT_OAUTH_CATEGORIES
}

function summarizeCategories(categories: ToolCategory[]): string {
  return categories
    .map((category) => (category === 'ai' ? 'AI' : category.charAt(0).toUpperCase() + category.slice(1)))
    .join(', ')
}

function formatClientName(clientId: string): string {
  return clientId
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

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

export async function getMcpOAuthGrants(): Promise<McpOAuthGrantConnection[]> {
  const { data, error } = await supabase
    .from('mcp_oauth_client_grants')
    .select('id, client_id, scope, org_id, workspace_id, enabled_categories, created_at, updated_at, last_used_at, revoked_at')
    .is('revoked_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch OAuth grants: ${error.message}`)
  }

  const grants = data ?? []
  if (grants.length === 0) return []

  const orgIds = Array.from(new Set(grants.map((grant) => grant.org_id).filter((id): id is string => Boolean(id))))
  const workspaceIds = Array.from(new Set(grants.map((grant) => grant.workspace_id).filter((id): id is string => Boolean(id))))

  const [orgResult, workspaceResult] = await Promise.all([
    orgIds.length > 0
      ? supabase.from('organizations').select('id, name').in('id', orgIds)
      : Promise.resolve({ data: [], error: null }),
    workspaceIds.length > 0
      ? supabase.from('workspaces').select('id, name').in('id', workspaceIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (orgResult.error) {
    throw new Error(`Failed to resolve OAuth grant organizations: ${orgResult.error.message}`)
  }

  if (workspaceResult.error) {
    throw new Error(`Failed to resolve OAuth grant workspaces: ${workspaceResult.error.message}`)
  }

  const orgNameById = new Map((orgResult.data ?? []).map((org) => [org.id, org.name]))
  const workspaceNameById = new Map((workspaceResult.data ?? []).map((workspace) => [workspace.id, workspace.name]))

  return grants.map((grant) => {
    const categories = normalizeCategories(grant.enabled_categories)
    const endpointUrl = buildEndpointUrl(grant.workspace_id)

    return {
      id: grant.id,
      client_id: grant.client_id,
      client_name: formatClientName(grant.client_id),
      connection_type: 'OAuth',
      scope: grant.scope === 'workspace' ? 'workspace' : 'organization',
      org_id: grant.org_id,
      org_name: grant.org_id ? (orgNameById.get(grant.org_id) ?? 'Organization') : 'Organization',
      workspace_id: grant.workspace_id,
      workspace_name: grant.workspace_id ? (workspaceNameById.get(grant.workspace_id) ?? 'Workspace') : 'All workspaces',
      endpoint_url: endpointUrl,
      resource_url: endpointUrl,
      enabled_categories: categories,
      categories_summary: summarizeCategories(categories),
      created_at: grant.created_at,
      updated_at: grant.updated_at,
      last_used_at: grant.last_used_at,
      revoked_at: grant.revoked_at,
    }
  })
}

export async function revokeMcpOAuthGrant(id: string): Promise<void> {
  const { error } = await supabase
    .from('mcp_oauth_client_grants')
    .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    throw new Error(`Failed to revoke OAuth grant: ${error.message}`)
  }
}
