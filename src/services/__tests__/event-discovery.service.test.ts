import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.hoisted(() => vi.fn())
const invoke = vi.hoisted(() => vi.fn())

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc,
    functions: { invoke },
  },
}))

const SAFE_EVENT_ID = '11111111-1111-4111-a111-111111111111'
const SAFE_RECORDING_ID = '22222222-2222-4222-a222-222222222222'
const SERVICE_MODULE = '/src/services/event-discovery.service.ts'

function runtimeClaimToken(): string {
  return `${crypto.randomUUID().replaceAll('-', '')}${crypto.randomUUID().replaceAll('-', '')}`
}

async function loadService() {
  return import(/* @vite-ignore */ SERVICE_MODULE) as Promise<{
    eventDiscoveryService: {
      listEvents: (input: { limit: number; cursor: string | null }) => Promise<{
        items: Array<{ eventId: string }>
      }>
      inspectParticipationClaim: (token: string) => Promise<unknown>
    }
  }>
}

const safePage = {
  items: [{
    event_id: SAFE_EVENT_ID,
    group: 'needs_action',
    starts_at: '2026-09-20T12:00:00.000Z',
    heading: 'Event on September 20, 2026',
    connection: { verified_email: 'a***@example.com', verified_email_count: 1 },
    readable_recordings: [],
    restricted_recordings: [{
      ordinal: 1,
      request_target: SAFE_RECORDING_ID,
      request_state: 'available',
      available_at: null,
    }],
  }],
  next_cursor: null,
}

describe('event discovery service privacy boundary (Wave 0 RED)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.mockResolvedValue({ data: safePage, error: null })
    invoke.mockResolvedValue({ data: { status: 'unavailable' }, error: null })
  })

  it.fails('RED: maps a safe server page without changing its authoritative order', async () => {
    const { eventDiscoveryService } = await loadService()
    const result = await eventDiscoveryService.listEvents({ limit: 25, cursor: null })

    expect(result.items.map((item) => item.eventId)).toEqual([SAFE_EVENT_ID])
    expect(rpc).toHaveBeenCalledWith('list_my_discovered_events', {
      p_limit: 25,
      p_cursor: null,
    })
  })

  it.fails('RED: rejects malformed rows and unexpected restricted metadata', async () => {
    const { eventDiscoveryService } = await loadService()
    rpc.mockResolvedValueOnce({
      data: {
        ...safePage,
        items: [{
          ...safePage.items[0],
          restricted_recordings: [{
            ...safePage.items[0].restricted_recordings[0],
            owner_email: 'private-owner@example.com',
            title: 'Private roadmap call',
          }],
        }],
      },
      error: null,
    })

    await expect(eventDiscoveryService.listEvents({ limit: 25, cursor: null }))
      .rejects.toThrow(/invalid|unexpected|response/i)
  })

  it.fails('RED: bounds page size and validates opaque cursor input before RPC I/O', async () => {
    const { eventDiscoveryService } = await loadService()

    await expect(eventDiscoveryService.listEvents({ limit: 51, cursor: null }))
      .rejects.toThrow(/limit/i)
    await expect(eventDiscoveryService.listEvents({ limit: 25, cursor: 'not-an-opaque-cursor' }))
      .rejects.toThrow(/cursor/i)
    expect(rpc).not.toHaveBeenCalled()
  })

  it.fails('RED: exposes one generic unavailable claim result without private metadata', async () => {
    const { eventDiscoveryService } = await loadService()
    const token = runtimeClaimToken()
    invoke.mockResolvedValueOnce({
      data: {
        status: 'expired',
        event_title: 'Private board meeting',
        owner_email: 'owner@example.com',
      },
      error: null,
    })

    await expect(eventDiscoveryService.inspectParticipationClaim(token))
      .rejects.toMatchObject({ code: 'CLAIM_UNAVAILABLE' })
    await expect(eventDiscoveryService.inspectParticipationClaim(token))
      .rejects.not.toThrow(token)
  })
})
