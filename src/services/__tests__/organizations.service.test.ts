import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getOrganizations,
  createOrganization,
  isPersonalOrg,
  getOrganizationMembers,
  updateOrganizationMemberRole,
  removeOrganizationMember,
} from '../organizations.service'
import { supabase } from '@/integrations/supabase/client'

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── Supabase mock ─────────────────────────────────────────────────────────
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}))

/** Build a chainable, awaitable Supabase query mock. */
function makeChain(result: { data?: unknown; error?: unknown }) {
  const resolved = { data: null, error: null, ...result }
  const chain: Record<string, unknown> = {}

  const methods = [
    'select', 'insert', 'update', 'delete',
    'eq', 'in', 'order', 'filter',
  ]

  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }

  chain.single = vi.fn().mockResolvedValue(resolved)
  chain.maybeSingle = vi.fn().mockResolvedValue(resolved)

  chain.then = (resolve: (v: typeof resolved) => unknown) => Promise.resolve(resolved).then(resolve)
  chain.catch = (reject: (e: unknown) => unknown) => Promise.resolve(resolved).catch(reject)

  return chain as unknown as ReturnType<typeof supabase.from>
}

// ─── getOrganizations ────────────────────────────────────────────────────────
describe('getOrganizations', () => {
  it('returns organizations with membership role attached', async () => {
    const membershipRows = [
      {
        id: 'mem-1',
        role: 'organization_owner',
        org: {
          id: 'org-1',
          name: 'Acme Corp',
          type: 'business',
          cross_org_default: false,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      },
      {
        id: 'mem-2',
        role: 'member',
        org: {
          id: 'org-2',
          name: 'Personal',
          type: 'personal',
          cross_org_default: false,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      },
    ]

    vi.mocked(supabase.from).mockReturnValue(makeChain({ data: membershipRows }))

    const result = await getOrganizations('user-1')

    expect(result).toHaveLength(2)
    expect(result[0].membershipRole).toBe('organization_owner')
    expect(result[0].membershipId).toBe('mem-1')
    expect(result[0].name).toBe('Acme Corp')
    expect(result[1].membershipRole).toBe('member')
  })

  it('filters out rows where org join returned null (stale FK)', async () => {
    const membershipRows = [
      { id: 'mem-1', role: 'member', org: null },
      {
        id: 'mem-2',
        role: 'organization_owner',
        org: { id: 'org-2', name: 'Valid Org', type: 'business' },
      },
    ]

    vi.mocked(supabase.from).mockReturnValue(makeChain({ data: membershipRows }))

    const result = await getOrganizations('user-1')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Valid Org')
  })

  it('returns empty array when user has no memberships', async () => {
    vi.mocked(supabase.from).mockReturnValue(makeChain({ data: [] }))
    const result = await getOrganizations('user-1')
    expect(result).toEqual([])
  })

  it('throws on supabase error', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ error: { message: 'fetch failed' } })
    )
    await expect(getOrganizations('user-1')).rejects.toThrow(
      'Failed to fetch organizations: fetch failed'
    )
  })

  it('queries organization_memberships, not organizations directly', async () => {
    vi.mocked(supabase.from).mockReturnValue(makeChain({ data: [] }))
    await getOrganizations('user-1')
    expect(supabase.from).toHaveBeenCalledWith('organization_memberships')
  })
})

// ─── createOrganization ──────────────────────────────────────────────────────
describe('createOrganization', () => {
  it('creates org then creates membership as organization_owner', async () => {
    const newOrg = {
      id: 'org-new',
      name: 'New Corp',
      type: 'business',
      cross_org_default: false,
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    }

    // First call: organizations insert
    const orgChain = makeChain({ data: newOrg })
    // Second call: organization_memberships insert
    const memberChain = makeChain({ error: null })

    vi.mocked(supabase.from)
      .mockReturnValueOnce(orgChain)
      .mockReturnValueOnce(memberChain)

    const result = await createOrganization('user-1', 'New Corp')
    expect(result).toEqual(newOrg)
    expect(supabase.from).toHaveBeenNthCalledWith(1, 'organizations')
    expect(supabase.from).toHaveBeenNthCalledWith(2, 'organization_memberships')
  })

  it('throws when org insert fails', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ error: { message: 'duplicate name' } })
    )
    await expect(createOrganization('user-1', 'Dupe')).rejects.toThrow(
      'Failed to create organization: duplicate name'
    )
  })

  it('throws when org is created but membership insert fails', async () => {
    const newOrg = { id: 'org-new', name: 'New Corp', type: 'business' }

    vi.mocked(supabase.from)
      .mockReturnValueOnce(makeChain({ data: newOrg }))
      .mockReturnValueOnce(makeChain({ error: { message: 'membership insert failed' } }))

    await expect(createOrganization('user-1', 'New Corp')).rejects.toThrow(
      'Organization created but failed to set membership: membership insert failed'
    )
  })

  it('throws with unknown error message when org is null', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ data: null, error: null })
    )
    await expect(createOrganization('user-1', 'Test')).rejects.toThrow(
      'Failed to create organization: Unknown error'
    )
  })
})

// ─── isPersonalOrg ───────────────────────────────────────────────────────────
describe('isPersonalOrg', () => {
  it('returns true for personal org', () => {
    expect(isPersonalOrg({ type: 'personal' } as any)).toBe(true)
  })

  it('returns false for business org', () => {
    expect(isPersonalOrg({ type: 'business' } as any)).toBe(false)
  })

  it('returns false for org with no type', () => {
    expect(isPersonalOrg({ type: undefined } as any)).toBe(false)
  })
})

// ─── getOrganizationMembers ──────────────────────────────────────────────────
describe('getOrganizationMembers', () => {
  const memberships = [
    { id: 'mem-1', user_id: 'user-1', role: 'organization_owner', created_at: '2024-01-01' },
    { id: 'mem-2', user_id: 'user-2', role: 'member', created_at: '2024-01-02' },
  ]

  const profiles = [
    { user_id: 'user-1', email: 'alice@co.com', display_name: 'Alice', avatar_url: null },
    { user_id: 'user-2', email: 'bob@co.com', display_name: 'Bob', avatar_url: 'https://img' },
  ]

  it('fetches memberships then batch-fetches profiles and merges them', async () => {
    vi.mocked(supabase.from)
      .mockReturnValueOnce(makeChain({ data: memberships }))
      .mockReturnValueOnce(makeChain({ data: profiles }))

    const result = await getOrganizationMembers('org-1')

    expect(result).toHaveLength(2)
    expect(result[0].email).toBe('alice@co.com')
    expect(result[0].display_name).toBe('Alice')
    expect(result[0].role).toBe('organization_owner')
    expect(result[1].email).toBe('bob@co.com')
    expect(result[1].avatar_url).toBe('https://img')
  })

  it('uses empty strings for missing profile fields', async () => {
    vi.mocked(supabase.from)
      .mockReturnValueOnce(makeChain({ data: memberships }))
      .mockReturnValueOnce(makeChain({ data: [] })) // No profiles found

    const result = await getOrganizationMembers('org-1')
    expect(result[0].email).toBe('')
    expect(result[0].display_name).toBe('')
    expect(result[0].avatar_url).toBeNull()
  })

  it('returns empty array when org has no members', async () => {
    vi.mocked(supabase.from).mockReturnValue(makeChain({ data: [] }))
    const result = await getOrganizationMembers('org-empty')
    expect(result).toEqual([])
  })

  it('throws when membership query fails', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ error: { message: 'membership query fail' } })
    )
    await expect(getOrganizationMembers('org-1')).rejects.toThrow(
      'Failed to fetch organization members: membership query fail'
    )
  })
})

// ─── updateOrganizationMemberRole ────────────────────────────────────────────
describe('updateOrganizationMemberRole', () => {
  it('resolves without throwing on success', async () => {
    vi.mocked(supabase.from).mockReturnValue(makeChain({ error: null }))
    await expect(
      updateOrganizationMemberRole('mem-1', 'organization_admin')
    ).resolves.toBeUndefined()
  })

  it('throws on update error', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ error: { message: 'role update failed' } })
    )
    await expect(
      updateOrganizationMemberRole('mem-1', 'member')
    ).rejects.toThrow('Failed to update member role: role update failed')
  })
})

// ─── removeOrganizationMember ────────────────────────────────────────────────
describe('removeOrganizationMember', () => {
  it('resolves without throwing on success', async () => {
    vi.mocked(supabase.from).mockReturnValue(makeChain({ error: null }))
    await expect(removeOrganizationMember('mem-1')).resolves.toBeUndefined()
    expect(supabase.from).toHaveBeenCalledWith('organization_memberships')
  })

  it('throws on delete error', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChain({ error: { message: 'delete denied' } })
    )
    await expect(removeOrganizationMember('mem-1')).rejects.toThrow(
      'Failed to remove organization member: delete denied'
    )
  })
})
