import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

import {
  buildScopedMcpUrl,
  buildSubdomainMcpUrl,
  getMcpManualTokenConnections,
  getMcpUrl,
  toManualTokenConnection,
  type McpToken,
} from '@/services/mcp-tokens.service'
import { supabase } from '@/integrations/supabase/client'

const mockSupabase = supabase as unknown as {
  from: ReturnType<typeof vi.fn>
}

const workspaceToken: McpToken = {
  id: 'tok-ws-1',
  user_id: 'user-1',
  org_id: 'org-1',
  workspace_id: 'ws-1',
  name: 'Workspace Token',
  token: 'cv_workspace_token_1234',
  scope: 'workspace',
  last_used_at: null,
  created_at: '2026-06-01T00:00:00.000Z',
  enabled_categories: ['read', 'write', 'ai', 'admin'],
}

const orgToken: McpToken = {
  id: 'tok-org-1',
  user_id: 'user-1',
  org_id: 'org-1',
  workspace_id: null,
  name: 'Org Token',
  token: 'cv_org_token_1234',
  scope: 'organization',
  last_used_at: null,
  created_at: '2026-06-01T00:00:00.000Z',
  enabled_categories: ['read', 'write', 'ai', 'admin'],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('buildSubdomainMcpUrl', () => {
  it('builds an organization-scoped subdomain URL', () => {
    expect(buildSubdomainMcpUrl('acmecorp')).toBe('https://acmecorp.callvaultai.com/mcp')
  })

  it('builds a workspace-scoped subdomain URL', () => {
    expect(buildSubdomainMcpUrl('acmecorp', 'sales')).toBe('https://acmecorp-sales.callvaultai.com/mcp')
  })

  it('supports numeric org slugs', () => {
    expect(buildSubdomainMcpUrl('abc123')).toBe('https://abc123.callvaultai.com/mcp')
  })

  it('supports numeric workspace slugs', () => {
    expect(buildSubdomainMcpUrl('org1', 'ws2')).toBe('https://org1-ws2.callvaultai.com/mcp')
  })

  it('treats empty workspace slug as absent', () => {
    expect(buildSubdomainMcpUrl('org1', '')).toBe('https://org1.callvaultai.com/mcp')
  })

  it('treats undefined workspace slug as absent', () => {
    expect(buildSubdomainMcpUrl('org1', undefined)).toBe('https://org1.callvaultai.com/mcp')
  })

  it('keeps the legacy scoped URL builder unchanged', () => {
    expect(buildScopedMcpUrl('organization', null)).toBe(getMcpUrl())
    expect(buildScopedMcpUrl('workspace', 'ws-1')).toBe('https://mcp.callvaultai.com/w/ws-1')
  })
})

describe('toManualTokenConnection', () => {
  it('builds a workspace-scoped subdomain URL when org and workspace slugs are available', () => {
    const connection = toManualTokenConnection(workspaceToken, { orgSlug: 'acme', wsSlug: 'sales' })

    expect(connection.endpoint_url).toBe('https://acme-sales.callvaultai.com/mcp')
    expect(connection.resource_url).toBe('https://acme-sales.callvaultai.com/mcp')
  })

  it('builds an organization-scoped subdomain URL when only orgSlug is available', () => {
    const connection = toManualTokenConnection(orgToken, { orgSlug: 'acme' })

    expect(connection.endpoint_url).toBe('https://acme.callvaultai.com/mcp')
    expect(connection.resource_url).toBe('https://acme.callvaultai.com/mcp')
  })

  it('falls back to the legacy scoped URL when no slugs are provided', () => {
    const connection = toManualTokenConnection(workspaceToken)

    expect(connection.endpoint_url).toBe('https://mcp.callvaultai.com/w/ws-1')
    expect(connection.resource_url).toBe('https://mcp.callvaultai.com/w/ws-1')
  })
})

describe('getMcpManualTokenConnections', () => {
  it('returns an empty array without org or workspace lookups when there are no tokens', async () => {
    const tokensQuery = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    }
    mockSupabase.from.mockReturnValue(tokensQuery)

    const connections = await getMcpManualTokenConnections()

    expect(connections).toEqual([])
    expect(mockSupabase.from).toHaveBeenCalledTimes(1)
    expect(mockSupabase.from).toHaveBeenCalledWith('mcp_tokens')
  })

  it('resolves org and workspace slugs into subdomain endpoints', async () => {
    const tokensQuery = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [workspaceToken, orgToken], error: null }),
    }
    const orgIn = vi.fn().mockResolvedValue({
      data: [{ id: 'org-1', slug: 'acme' }],
      error: null,
    })
    const workspaceIn = vi.fn().mockResolvedValue({
      data: [{ id: 'ws-1', slug: 'sales' }],
      error: null,
    })

    mockSupabase.from
      .mockReturnValueOnce(tokensQuery)
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          in: orgIn,
        }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          in: workspaceIn,
        }),
      })

    const connections = await getMcpManualTokenConnections()
    const byId = Object.fromEntries(connections.map((connection) => [connection.id, connection]))

    expect(orgIn).toHaveBeenCalledWith('id', ['org-1'])
    expect(workspaceIn).toHaveBeenCalledWith('id', ['ws-1'])
    expect(byId['tok-ws-1'].endpoint_url).toBe('https://acme-sales.callvaultai.com/mcp')
    expect(byId['tok-org-1'].endpoint_url).toBe('https://acme.callvaultai.com/mcp')
  })

  it('throws a descriptive error when organization slug lookup fails', async () => {
    const tokensQuery = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [workspaceToken], error: null }),
    }

    mockSupabase.from
      .mockReturnValueOnce(tokensQuery)
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'org lookup failed' },
          }),
        }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: [{ id: 'ws-1', slug: 'sales' }],
            error: null,
          }),
        }),
      })

    await expect(getMcpManualTokenConnections()).rejects.toThrow(
      'Failed to resolve manual token organizations: org lookup failed',
    )
  })

  it('throws a descriptive error when workspace slug lookup fails', async () => {
    const tokensQuery = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [workspaceToken], error: null }),
    }

    mockSupabase.from
      .mockReturnValueOnce(tokensQuery)
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: [{ id: 'org-1', slug: 'acme' }],
            error: null,
          }),
        }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'workspace lookup failed' },
          }),
        }),
      })

    await expect(getMcpManualTokenConnections()).rejects.toThrow(
      'Failed to resolve manual token workspaces: workspace lookup failed',
    )
  })
})
