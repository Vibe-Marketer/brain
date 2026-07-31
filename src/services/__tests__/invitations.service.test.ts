import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createInvitation } from '@/services/invitations.service'
import { supabase } from '@/integrations/supabase/client'

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

type QueryResult<T> = {
  data: T | null
  error: { code?: string; message: string } | null
}

type QueryBuilder<T> = {
  select: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  maybeSingle: ReturnType<typeof vi.fn>
  insertedRows: unknown[]
  updatedRows: unknown[]
  filters: Array<[string, unknown]>
}

function createQueryBuilder<T>({
  singleResult,
  maybeSingleResult,
}: {
  singleResult?: QueryResult<T>
  maybeSingleResult?: QueryResult<T>
}): QueryBuilder<T> {
  const builder = {
    insertedRows: [] as unknown[],
    updatedRows: [] as unknown[],
    filters: [] as Array<[string, unknown]>,
    select: vi.fn(() => builder),
    insert: vi.fn((row: unknown) => {
      builder.insertedRows.push(row)
      return builder
    }),
    update: vi.fn((row: unknown) => {
      builder.updatedRows.push(row)
      return builder
    }),
    eq: vi.fn((column: string, value: unknown) => {
      builder.filters.push([column, value])
      return builder
    }),
    single: vi.fn(() => Promise.resolve(singleResult ?? { data: null, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve(maybeSingleResult ?? { data: null, error: null })),
  }

  return builder
}

function queueFromBuilders(builders: Array<QueryBuilder<unknown>>) {
  const fromMock = supabase.from as unknown as ReturnType<typeof vi.fn>
  fromMock.mockImplementation(() => {
    const builder = builders.shift()
    if (!builder) throw new Error('Unexpected supabase.from call')
    return builder
  })
}

const invite = {
  id: 'invite-1',
  workspace_id: 'workspace-1',
  invited_by: 'user-1',
  email: 'teammate@example.com',
  role: 'member',
  token: 'token-1',
  status: 'pending',
  expires_at: '2026-07-10T00:00:00.000Z',
  created_at: '2026-07-03T00:00:00.000Z',
  accepted_at: null,
} as const

describe('createInvitation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a new normalized workspace invitation when no pending invite exists', async () => {
    // createInvitation now checks isEmailAlreadyMember() first (user_profiles
    // lookup — no matching profile short-circuits before the membership
    // query), then getPendingInvitation, then the insert.
    const memberCheckBuilder = createQueryBuilder({ maybeSingleResult: { data: null, error: null } })
    const checkBuilder = createQueryBuilder({ maybeSingleResult: { data: null, error: null } })
    const insertBuilder = createQueryBuilder({ singleResult: { data: invite, error: null } })
    queueFromBuilders([memberCheckBuilder, checkBuilder, insertBuilder])

    const result = await createInvitation(
      'workspace-1',
      'user-1',
      ' Teammate@Example.com ',
      'member'
    )

    expect(result).toEqual(invite)
    expect(insertBuilder.insertedRows).toEqual([
      {
        workspace_id: 'workspace-1',
        invited_by: 'user-1',
        email: 'teammate@example.com',
        role: 'member',
      },
    ])
  })

  it('refreshes an existing pending invitation instead of inserting a duplicate', async () => {
    const refreshedInvite = { ...invite, role: 'workspace_admin', token: 'refreshed-token' }
    const memberCheckBuilder = createQueryBuilder({ maybeSingleResult: { data: null, error: null } })
    const checkBuilder = createQueryBuilder({ maybeSingleResult: { data: invite, error: null } })
    const updateBuilder = createQueryBuilder({ singleResult: { data: refreshedInvite, error: null } })
    queueFromBuilders([memberCheckBuilder, checkBuilder, updateBuilder])

    const result = await createInvitation(
      'workspace-1',
      'user-2',
      'teammate@example.com',
      'workspace_admin'
    )

    expect(result).toEqual(refreshedInvite)
    expect(updateBuilder.updatedRows).toHaveLength(1)
    expect(updateBuilder.updatedRows[0]).toEqual(
      expect.objectContaining({
        invited_by: 'user-2',
        role: 'workspace_admin',
        accepted_at: null,
        status: 'pending',
      })
    )
    expect(updateBuilder.filters).toContainEqual(['id', 'invite-1'])
  })

  it('recovers from a duplicate insert race by refreshing the winning pending invite', async () => {
    const memberCheckBuilder = createQueryBuilder({ maybeSingleResult: { data: null, error: null } })
    const checkBuilder = createQueryBuilder({ maybeSingleResult: { data: null, error: null } })
    const insertBuilder = createQueryBuilder({
      singleResult: {
        data: null,
        error: {
          code: '23505',
          message: 'duplicate key value violates unique constraint "workspace_invitations_workspace_id_email_status_key"',
        },
      },
    })
    const recheckBuilder = createQueryBuilder({ maybeSingleResult: { data: invite, error: null } })
    const updateBuilder = createQueryBuilder({ singleResult: { data: invite, error: null } })
    queueFromBuilders([memberCheckBuilder, checkBuilder, insertBuilder, recheckBuilder, updateBuilder])

    const result = await createInvitation(
      'workspace-1',
      'user-1',
      'teammate@example.com',
      'member'
    )

    expect(result).toEqual(invite)
    expect(recheckBuilder.filters).toEqual([
      ['workspace_id', 'workspace-1'],
      ['email', 'teammate@example.com'],
      ['status', 'pending'],
    ])
    expect(updateBuilder.filters).toContainEqual(['id', 'invite-1'])
  })
})
