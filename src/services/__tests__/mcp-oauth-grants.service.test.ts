import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

import { supabase } from '@/integrations/supabase/client'
import { getMcpOAuthGrants, persistMcpOAuthGrant } from '../mcp-oauth-grants.service'

const mockSupabase = supabase as unknown as {
  from: ReturnType<typeof vi.fn>
}

describe('mcp-oauth-grants.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('persists new OAuth grants with admin enabled by default', async () => {
    const upsert = vi.fn().mockResolvedValue({ data: null, error: null })
    mockSupabase.from.mockReturnValue({ upsert })

    await persistMcpOAuthGrant({
      userId: 'user-1',
      orgId: 'org-1',
      workspaceId: 'ws-1',
      scope: 'workspace',
      clientId: 'claude-desktop',
      clientName: 'Claude Desktop',
    })

    expect(mockSupabase.from).toHaveBeenCalledWith('mcp_oauth_client_grants')
    expect(upsert.mock.calls[0][0]).toMatchObject({
      enabled_categories: ['read', 'write', 'ai', 'admin'],
      workspace_id: 'ws-1',
      scope: 'workspace',
    })
  })

  it('normalizes missing categories to all four capabilities when listing grants', async () => {
    const grantsQuery = {
      select: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [{
          id: 'grant-1',
          client_id: 'claude-desktop',
          client_name: 'Claude Desktop',
          scope: 'organization',
          org_id: 'org-1',
          workspace_id: null,
          enabled_categories: null,
          created_at: '2026-06-05T00:00:00.000Z',
          updated_at: '2026-06-05T00:00:00.000Z',
          last_used_at: null,
          revoked_at: null,
        }],
        error: null,
      }),
    }
    mockSupabase.from
      .mockReturnValueOnce(grantsQuery)
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: [{ id: 'org-1', name: 'Acme Org' }], error: null }),
        }),
      })

    const grants = await getMcpOAuthGrants()

    expect(grants).toHaveLength(1)
    expect(grants[0].enabled_categories).toEqual(['read', 'write', 'ai', 'admin'])
    expect(grants[0].categories_summary).toBe('Read, Write, AI, Admin')
  })

  it('builds unique per-org / per-workspace subdomain endpoint URLs from slugs', async () => {
    const grantsQuery = {
      select: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'g-org', client_id: 'claude', client_name: 'Claude', scope: 'organization',
            org_id: 'org-1', workspace_id: null, enabled_categories: null,
            created_at: '2026-06-05T00:00:00.000Z', updated_at: '2026-06-05T00:00:00.000Z',
            last_used_at: null, revoked_at: null,
          },
          {
            id: 'g-ws', client_id: 'claude', client_name: 'Claude', scope: 'workspace',
            org_id: 'org-1', workspace_id: 'ws-1', enabled_categories: null,
            created_at: '2026-06-05T00:00:00.000Z', updated_at: '2026-06-05T00:00:00.000Z',
            last_used_at: null, revoked_at: null,
          },
        ],
        error: null,
      }),
    }
    mockSupabase.from
      .mockReturnValueOnce(grantsQuery)
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: [{ id: 'org-1', name: 'Freedom Experience', slug: 'freedomexperience' }],
            error: null,
          }),
        }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: [{ id: 'ws-1', name: 'Inbox', slug: 'inbox' }],
            error: null,
          }),
        }),
      })

    const grants = await getMcpOAuthGrants()
    const byId = Object.fromEntries(grants.map((grant) => [grant.id, grant]))

    expect(byId['g-org'].endpoint_url).toBe('https://freedomexperience.callvaultai.com/mcp')
    expect(byId['g-org'].resource_url).toBe('https://freedomexperience.callvaultai.com/mcp')
    expect(byId['g-ws'].endpoint_url).toBe('https://freedomexperience-inbox.callvaultai.com/mcp')
  })

  it('falls back to the legacy path URL when an org slug cannot be resolved', async () => {
    const grantsQuery = {
      select: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [{
          id: 'g-noslug', client_id: 'claude', client_name: 'Claude', scope: 'workspace',
          org_id: 'org-1', workspace_id: 'ws-1', enabled_categories: null,
          created_at: '2026-06-05T00:00:00.000Z', updated_at: '2026-06-05T00:00:00.000Z',
          last_used_at: null, revoked_at: null,
        }],
        error: null,
      }),
    }
    mockSupabase.from
      .mockReturnValueOnce(grantsQuery)
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: [{ id: 'org-1', name: 'Acme', slug: null }], error: null }),
        }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: [{ id: 'ws-1', name: 'Sales', slug: 'sales' }], error: null }),
        }),
      })

    const grants = await getMcpOAuthGrants()
    expect(grants[0].endpoint_url).toBe('https://mcp.callvaultai.com/w/ws-1')
  })

  it('deduplicates repeated org OAuth grants for the same client and scope', async () => {
    const grantsQuery = {
      select: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'g-new', client_id: 'claude-client-new', client_name: 'Claude', scope: 'organization',
            org_id: 'org-1', workspace_id: null, enabled_categories: null,
            created_at: '2026-07-03T00:00:00.000Z', updated_at: '2026-07-03T00:00:00.000Z',
            last_used_at: '2026-07-04T00:00:00.000Z', revoked_at: null,
          },
          {
            id: 'g-old', client_id: 'claude-client-old', client_name: 'Claude', scope: 'organization',
            org_id: 'org-1', workspace_id: null, enabled_categories: null,
            created_at: '2026-07-02T00:00:00.000Z', updated_at: '2026-07-02T00:00:00.000Z',
            last_used_at: null, revoked_at: null,
          },
        ],
        error: null,
      }),
    }
    mockSupabase.from
      .mockReturnValueOnce(grantsQuery)
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: [{ id: 'org-1', name: 'Lead Gen Jay', slug: 'leadgenjay' }],
            error: null,
          }),
        }),
      })

    const grants = await getMcpOAuthGrants()

    expect(grants).toHaveLength(1)
    expect(grants[0].id).toBe('g-new')
    expect(grants[0].endpoint_url).toBe('https://leadgenjay.callvaultai.com/mcp')
  })
})
