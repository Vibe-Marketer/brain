import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mocks.from,
  },
}))

import { getRecentRecordings, getRecordingCounts } from '../recordings.service'

type QueryResult = { data?: unknown; error: { message: string } | null; count?: number | null }

/**
 * Chainable, awaitable supabase query-builder mock — same pattern as
 * tickets.service.test.ts. Every chain method returns the same object;
 * awaiting it resolves `result`.
 */
function createQueryMock(result: QueryResult) {
  const q: Record<string, ReturnType<typeof vi.fn>> & {
    then: (resolve: (v: QueryResult) => unknown, reject?: (e: unknown) => unknown) => Promise<unknown>
  } = {
    select: vi.fn(() => q),
    order: vi.fn(() => q),
    limit: vi.fn(() => q),
    eq: vi.fn(() => q),
    gte: vi.fn(() => q),
    lt: vi.fn(() => q),
    not: vi.fn(() => q),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  } as never
  return q
}

describe('getRecentRecordings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('excludes rows with no recording_start_time (partial-sync/test artifacts)', async () => {
    const q = createQueryMock({
      data: [{ id: 'rec-1', title: 'Real call', recording_start_time: '2026-07-20T00:00:00Z' }],
      error: null,
    })
    mocks.from.mockReturnValue(q)

    await getRecentRecordings('org-1', 8)

    expect(q.not).toHaveBeenCalledWith('recording_start_time', 'is', null)
  })

  it('throws with a clear message on a query error', async () => {
    mocks.from.mockReturnValue(createQueryMock({ data: null, error: { message: 'boom' } }))
    await expect(getRecentRecordings('org-1')).rejects.toThrow(/Failed to fetch recent recordings/)
  })
})

describe('getRecordingCounts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns totalCalls, callsThisWeek, and callsPriorWeek from three independent counts', async () => {
    let call = 0
    mocks.from.mockImplementation(() => {
      call += 1
      // 1st call: total, 2nd: this week, 3rd: prior week
      const counts = [12, 3, 5]
      return createQueryMock({ data: null, error: null, count: counts[call - 1] })
    })

    const result = await getRecordingCounts('org-1')

    expect(result).toEqual({ totalCalls: 12, callsThisWeek: 3, callsPriorWeek: 5 })
  })

  it('scopes the prior-week count to the 7 days before the current window (gte + lt)', async () => {
    const q = createQueryMock({ data: null, error: null, count: 0 })
    mocks.from.mockReturnValue(q)

    await getRecordingCounts('org-1')

    // The prior-week query is the only one that both gte's and lt's the timestamp.
    expect(q.gte).toHaveBeenCalled()
    expect(q.lt).toHaveBeenCalled()
  })

  it('throws with a clear message when the prior-week count query errors', async () => {
    let call = 0
    mocks.from.mockImplementation(() => {
      call += 1
      if (call === 3) return createQueryMock({ data: null, error: { message: 'prior week boom' } })
      return createQueryMock({ data: null, error: null, count: 1 })
    })

    await expect(getRecordingCounts('org-1')).rejects.toThrow(/Failed to fetch prior-week call count/)
  })
})
