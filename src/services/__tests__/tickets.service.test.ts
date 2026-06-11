import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  invoke: vi.fn(),
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mocks.from,
    functions: { invoke: mocks.invoke },
  },
}))

import { createTicket, getTickets, getTicketDetail, updateTicketStatus } from '../tickets.service'

type QueryResult = { data?: unknown; error: { message: string } | null; count?: number | null }

/**
 * Chainable, awaitable supabase query-builder mock.
 * Every chain method returns the same object; awaiting it resolves `result`.
 */
function createQueryMock(result: QueryResult) {
  const q: Record<string, ReturnType<typeof vi.fn>> & {
    then: (resolve: (v: QueryResult) => unknown, reject?: (e: unknown) => unknown) => Promise<unknown>
  } = {
    select: vi.fn(() => q),
    order: vi.fn(() => q),
    range: vi.fn(() => q),
    eq: vi.fn(() => q),
    in: vi.fn(() => q),
    update: vi.fn(() => q),
    single: vi.fn(() => Promise.resolve(result)),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  } as never
  return q
}

const ticketRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'a1b2c3d4-0000-0000-0000-000000000000',
  reporter_id: 'user-1',
  type: 'bug',
  severity: 'medium',
  status: 'new',
  source: 'manual',
  context: { url: 'https://app.example.com' },
  fingerprint: null,
  created_at: '2026-06-11T10:00:00.000Z',
  updated_at: '2026-06-11T10:00:00.000Z',
  ...overrides,
})

describe('tickets.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getTickets', () => {
    it('fetches a bounded page ordered created_at desc with no filters applied', async () => {
      const ticketsQuery = createQueryMock({ data: [ticketRow()], error: null, count: 123 })
      const profilesQuery = createQueryMock({
        data: [{ user_id: 'user-1', display_name: 'Ada', email: 'ada@example.com' }],
        error: null,
      })
      mocks.from.mockImplementation((table: string) =>
        table === 'tickets' ? ticketsQuery : profilesQuery,
      )

      const { tickets, totalCount } = await getTickets()

      expect(mocks.from).toHaveBeenCalledWith('tickets')
      // 11-05: list query is paginated and no longer embeds ticket_messages
      expect(ticketsQuery.select).toHaveBeenCalledWith('*', { count: 'exact' })
      expect(ticketsQuery.range).toHaveBeenCalledWith(0, 49)
      expect(ticketsQuery.order).toHaveBeenCalledWith('created_at', { ascending: false })
      expect(ticketsQuery.eq).not.toHaveBeenCalled()
      expect(tickets).toHaveLength(1)
      expect(tickets[0].reporter).toBe('Ada')
      expect(totalCount).toBe(123)
    })

    it('applies custom limit/offset via .range', async () => {
      const ticketsQuery = createQueryMock({ data: [], error: null, count: 0 })
      mocks.from.mockImplementation(() => ticketsQuery)

      await getTickets({}, { limit: 20, offset: 40 })

      expect(ticketsQuery.range).toHaveBeenCalledWith(40, 59)
    })

    it("skips .eq for 'all' filters and applies .eq for concrete values", async () => {
      const ticketsQuery = createQueryMock({ data: [], error: null, count: 0 })
      mocks.from.mockImplementation(() => ticketsQuery)

      await getTickets({ status: 'new', severity: 'all', source: 'sentry' })

      expect(ticketsQuery.eq).toHaveBeenCalledWith('status', 'new')
      expect(ticketsQuery.eq).toHaveBeenCalledWith('source', 'sentry')
      expect(ticketsQuery.eq).not.toHaveBeenCalledWith('severity', expect.anything())
    })

    it('throws a labeled error when the query fails', async () => {
      mocks.from.mockImplementation(() =>
        createQueryMock({ data: null, error: { message: 'permission denied' } }),
      )

      await expect(getTickets()).rejects.toThrow('Failed to fetch tickets: permission denied')
    })

    it('falls back to a shortened reporter id when no profile is found', async () => {
      const ticketsQuery = createQueryMock({ data: [ticketRow()], error: null, count: 1 })
      const profilesQuery = createQueryMock({ data: [], error: null })
      mocks.from.mockImplementation((table: string) =>
        table === 'tickets' ? ticketsQuery : profilesQuery,
      )

      const { tickets } = await getTickets()

      expect(tickets[0].reporter).toBe('user-1')
    })
  })

  describe('getTicketDetail', () => {
    it('returns the ticket with messages asc and events desc', async () => {
      const ticket = ticketRow()
      const messages = [
        { id: 'm1', ticket_id: ticket.id, author_id: 'user-1', author_type: 'user', body: 'Hello', attachments: [], created_at: '2026-06-11T10:00:00.000Z' },
      ]
      const events = [
        { id: 'e2', ticket_id: ticket.id, actor_id: null, event_type: 'status_change', old_value: 'new', new_value: 'triaged', created_at: '2026-06-11T11:00:00.000Z' },
        { id: 'e1', ticket_id: ticket.id, actor_id: null, event_type: 'created', old_value: null, new_value: null, created_at: '2026-06-11T10:00:00.000Z' },
      ]

      const ticketQuery = createQueryMock({ data: ticket, error: null })
      const messagesQuery = createQueryMock({ data: messages, error: null })
      const eventsQuery = createQueryMock({ data: events, error: null })

      mocks.from.mockImplementation((table: string) => {
        if (table === 'tickets') return ticketQuery
        if (table === 'ticket_messages') return messagesQuery
        if (table === 'ticket_events') return eventsQuery
        throw new Error(`Unexpected table: ${table}`)
      })

      const detail = await getTicketDetail(ticket.id)

      expect(ticketQuery.eq).toHaveBeenCalledWith('id', ticket.id)
      expect(messagesQuery.eq).toHaveBeenCalledWith('ticket_id', ticket.id)
      expect(messagesQuery.order).toHaveBeenCalledWith('created_at', { ascending: true })
      expect(eventsQuery.eq).toHaveBeenCalledWith('ticket_id', ticket.id)
      expect(eventsQuery.order).toHaveBeenCalledWith('created_at', { ascending: false })
      expect(detail.ticket.id).toBe(ticket.id)
      expect(detail.messages).toEqual(messages)
      expect(detail.events).toEqual(events)
    })

    it('throws a labeled error when the ticket fetch fails', async () => {
      const failing = createQueryMock({ data: null, error: { message: 'not found' } })
      failing.single = vi.fn(() => Promise.resolve({ data: null, error: { message: 'not found' } }))
      mocks.from.mockImplementation(() => failing)

      await expect(getTicketDetail('missing-id')).rejects.toThrow(
        'Failed to fetch ticket detail: not found',
      )
    })
  })

  describe('createTicket', () => {
    it('invokes send-support-ticket with message, type, severity, and auto-captured context', async () => {
      mocks.invoke.mockResolvedValue({ data: { ok: true }, error: null })

      await createTicket({
        type: 'task',
        severity: 'high',
        message: 'Wire up the export pipeline',
        userId: 'user-1',
        organizationId: 'org-1',
        workspaceId: 'ws-1',
      })

      expect(mocks.invoke).toHaveBeenCalledTimes(1)
      const [fnName, options] = mocks.invoke.mock.calls[0]
      expect(fnName).toBe('send-support-ticket')
      const body = options.body
      expect(body.message).toBe('Wire up the export pipeline')
      expect(body.type).toBe('task')
      expect(body.severity).toBe('high')
      expect(body.url).toBe(window.location.href)
      expect(body.userAgent).toBe(window.navigator.userAgent)
      expect(body.userId).toBe('user-1')
      expect(body.organizationId).toBe('org-1')
      expect(body.workspaceId).toBe('ws-1')
    })

    it('omits optional identity fields when not provided', async () => {
      mocks.invoke.mockResolvedValue({ data: { ok: true }, error: null })

      await createTicket({ type: 'bug', severity: 'medium', message: 'It broke' })

      const body = mocks.invoke.mock.calls[0][1].body
      expect(body).not.toHaveProperty('userId')
      expect(body).not.toHaveProperty('organizationId')
      expect(body).not.toHaveProperty('workspaceId')
    })

    it('includes appVersion and commit when build env vars are set', async () => {
      vi.stubEnv('VITE_APP_VERSION', '2.4.0')
      vi.stubEnv('VITE_COMMIT_SHA', 'abc1234')
      mocks.invoke.mockResolvedValue({ data: { ok: true }, error: null })

      try {
        await createTicket({ type: 'bug', severity: 'low', message: 'Version check' })

        const body = mocks.invoke.mock.calls[0][1].body
        expect(body.appVersion).toBe('2.4.0')
        expect(body.commit).toBe('abc1234')
      } finally {
        vi.unstubAllEnvs()
      }
    })

    it('throws when the Edge Function returns an error', async () => {
      mocks.invoke.mockResolvedValue({ data: null, error: new Error('boom') })

      await expect(
        createTicket({ type: 'bug', severity: 'critical', message: 'Crash on load' }),
      ).rejects.toThrow()
    })
  })

  describe('updateTicketStatus', () => {
    it('updates the status by id', async () => {
      const updateQuery = createQueryMock({ error: null })
      mocks.from.mockImplementation(() => updateQuery)

      await updateTicketStatus('ticket-1', 'triaged')

      expect(mocks.from).toHaveBeenCalledWith('tickets')
      expect(updateQuery.update).toHaveBeenCalledWith({ status: 'triaged' })
      expect(updateQuery.eq).toHaveBeenCalledWith('id', 'ticket-1')
    })

    it('throws a labeled error when the update fails', async () => {
      const updateQuery = createQueryMock({ error: { message: 'RLS violation' } })
      mocks.from.mockImplementation(() => updateQuery)

      await expect(updateTicketStatus('ticket-1', 'resolved')).rejects.toThrow(
        'Failed to update ticket status: RLS violation',
      )
    })
  })
})
