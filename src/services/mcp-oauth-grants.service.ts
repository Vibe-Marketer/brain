import { supabase } from '@/integrations/supabase/client'
import type { ToolCategory } from '@/lib/mcp-tool-categories'
import { buildSubdomainMcpUrl } from '@/services/mcp-tokens.service'

export type McpOAuthGrantScope = 'organization' | 'workspace'

export interface PersistMcpOAuthGrantParams {
  userId: string
  orgId: string
  workspaceId: string | null
  scope: McpOAuthGrantScope
  clientId?: string | null
  clientName?: string | null
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

const DEFAULT_OAUTH_CATEGORIES: ToolCategory[] = ['read', 'write', 'ai', 'admin']
const FALLBACK_CLIENT_ID = 'legacy_oauth_binding'
const PUBLIC_MCP_BASE_URL = 'https://mcp.callvaultai.com'

function getBaseMcpUrl(): string {
  return PUBLIC_MCP_BASE_URL
}

// Each connector needs a UNIQUE per-org / per-workspace subdomain URL — MCP
// clients (Claude, etc.) can't register multiple connectors on the same base
// host, and the legacy path form mcp.callvaultai.com/w/{uuid} is deprecated.
// Build the subdomain URL from slugs; fall back to the legacy path URL only when
// a slug can't be resolved, so we never render a broken endpoint.
function buildEndpointUrl(
  orgSlug: string | null,
  wsSlug: string | null,
  workspaceId: string | null,
): string {
  if (orgSlug) return buildSubdomainMcpUrl(orgSlug, wsSlug ?? undefined)
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

function formatClientName(clientId: string, storedName?: string | null): string {
  const trimmedName = storedName?.trim()
  if (trimmedName) return trimmedName
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId)) {
    return `AI client ${clientId.slice(0, 8)}`
  }
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
    client_name: params.clientName?.trim() || null,
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
    .select('id, client_id, client_name, scope, org_id, workspace_id, enabled_categories, created_at, updated_at, last_used_at, revoked_at')
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
      ? supabase.from('organizations').select('id, name, slug').in('id', orgIds)
      : Promise.resolve({ data: [], error: null }),
    workspaceIds.length > 0
      ? supabase.from('workspaces').select('id, name, slug').in('id', workspaceIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (orgResult.error) {
    throw new Error(`Failed to resolve OAuth grant organizations: ${orgResult.error.message}`)
  }

  if (workspaceResult.error) {
    throw new Error(`Failed to resolve OAuth grant workspaces: ${workspaceResult.error.message}`)
  }

  const orgNameById = new Map((orgResult.data ?? []).map((org) => [org.id, org.name]))
  const orgSlugById = new Map((orgResult.data ?? []).map((org) => [org.id, org.slug]))
  const workspaceNameById = new Map((workspaceResult.data ?? []).map((workspace) => [workspace.id, workspace.name]))
  const workspaceSlugById = new Map((workspaceResult.data ?? []).map((workspace) => [workspace.id, workspace.slug]))

  const connections = grants.map((grant) => {
    const categories = normalizeCategories(grant.enabled_categories)
    const orgSlug = grant.org_id ? (orgSlugById.get(grant.org_id) ?? null) : null
    const wsSlug =
      grant.scope === 'workspace' && grant.workspace_id
        ? (workspaceSlugById.get(grant.workspace_id) ?? null)
        : null
    const endpointUrl = buildEndpointUrl(orgSlug, wsSlug, grant.workspace_id)

    return {
      id: grant.id,
      client_id: grant.client_id,
      client_name: formatClientName(grant.client_id, grant.client_name),
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

  const seen = new Set<string>()
  return connections.filter((grant) => {
    const key = `${grant.client_name.toLowerCase()}:${grant.endpoint_url}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
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
