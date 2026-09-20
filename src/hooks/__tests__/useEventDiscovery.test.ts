import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const serviceMocks = vi.hoisted(() => ({
  countEvents: vi.fn(),
  listEvents: vi.fn(),
  syncDiscoveredEventNotifications: vi.fn(),
  getParticipationInvitationStatus: vi.fn(),
  getParticipationInvitationStatuses: vi.fn(),
  inspectParticipationClaim: vi.fn(),
  consumeParticipationClaim: vi.fn(),
  sendParticipationInvitation: vi.fn(),
  resendParticipationInvitation: vi.fn(),
  cancelParticipationReminder: vi.fn(),
  disconnectVerifiedEmail: vi.fn(),
}))
const invalidateCallListCaches = vi.hoisted(() => vi.fn())

vi.mock('@/services/event-discovery.service', () => ({
  eventDiscoveryService: serviceMocks,
}))
vi.mock('@/lib/query-config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/query-config')>()
  return { ...actual, invalidateCallListCaches }
})

const RECORDING_ID = '11111111-1111-4111-a111-111111111111'
const PARTICIPANT_ID = '22222222-2222-4222-a222-222222222222'
const ALIAS_ID = '33333333-3333-4333-a333-333333333333'
const TOKEN = `${crypto.randomUUID().replace(/-/g, '')}${crypto.randomUUID().replace(/-/g, '')}`
const HOOK_MODULE = '/src/hooks/useEventDiscovery.ts'

interface EventDiscoveryHooks {
  useInspectParticipationClaim: () => {
    mutateAsync: (token: string) => Promise<unknown>
  }
  useConsumeParticipationClaim: () => {
    mutateAsync: (input: { token: string; confirmEmailAttachment: boolean }) => Promise<unknown>
  }
  useSendParticipationInvitation: (recordingId: string, participantId: string) => {
    mutateAsync: (input: { sendReminder: boolean }) => Promise<unknown>
  }
  useResendParticipationInvitation: (recordingId: string, participantId: string) => {
    mutateAsync: (input: { sendReminder: boolean }) => Promise<unknown>
  }
  useDisconnectVerifiedEmail: () => {
    mutateAsync: (aliasId: string) => Promise<unknown>
  }
  useCancelParticipationReminder: (recordingId: string, participantId: string) => {
    mutateAsync: () => Promise<unknown>
  }
  useEventDiscoveryCount: () => {
    data: number | undefined
    isSuccess: boolean
    refetch: () => Promise<unknown>
  }
  useDiscoveredEvents: (limit?: number) => {
    data: { pages: Array<{ items: unknown[]; nextCursor: string | null }> } | undefined
    isSuccess: boolean
    refetch: () => Promise<unknown>
  }
}

async function loadHooks(): Promise<EventDiscoveryHooks> {
  return import(/* @vite-ignore */ HOOK_MODULE) as Promise<EventDiscoveryHooks>
}

function createHarness() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  return { queryClient, wrapper }
}

function serializedCache(queryClient: QueryClient): string {
  return JSON.stringify({
    queries: queryClient.getQueryCache().getAll().map((query) => query.queryKey),
    mutations: queryClient.getMutationCache().getAll().map((mutation) => mutation.options.mutationKey),
  })
}

describe('event discovery hooks and invalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    serviceMocks.inspectParticipationClaim.mockResolvedValue({
      status: 'valid',
      maskedInvitedEmail: 'a***@example.com',
      confirmationRequired: false,
    })
    serviceMocks.consumeParticipationClaim.mockResolvedValue({ status: 'claimed' })
    serviceMocks.sendParticipationInvitation.mockResolvedValue({ status: 'sent' })
    serviceMocks.resendParticipationInvitation.mockResolvedValue({ status: 'sent' })
    serviceMocks.cancelParticipationReminder.mockResolvedValue({ status: 'canceled' })
    serviceMocks.disconnectVerifiedEmail.mockResolvedValue({ status: 'disconnected' })
    serviceMocks.cancelParticipationReminder.mockResolvedValue({ status: 'reminder_canceled' })
    serviceMocks.syncDiscoveredEventNotifications.mockResolvedValue({ createdCount: 0 })
    serviceMocks.countEvents.mockResolvedValue(7)
    serviceMocks.listEvents.mockResolvedValue({ items: [], nextCursor: null })
  })

  it('inspects through a mutation without persisting the raw token in cache keys', async () => {
    const { useInspectParticipationClaim } = await loadHooks()
    const { queryClient, wrapper } = createHarness()
    const { result } = renderHook(() => useInspectParticipationClaim(), { wrapper })

    await act(async () => { await result.current.mutateAsync(TOKEN) })

    expect(serviceMocks.inspectParticipationClaim).toHaveBeenCalledWith(TOKEN)
    expect(serializedCache(queryClient)).not.toContain(TOKEN)
    expect(serviceMocks.consumeParticipationClaim).not.toHaveBeenCalled()
  })

  it('serializes inspect and consume and preserves explicit confirmation', async () => {
    let releaseInspect: (() => void) | undefined
    serviceMocks.inspectParticipationClaim.mockImplementationOnce(() => new Promise((resolve) => {
      releaseInspect = () => resolve({
        status: 'valid',
        maskedInvitedEmail: 'a***@example.com',
        confirmationRequired: true,
      })
    }))
    const { useInspectParticipationClaim, useConsumeParticipationClaim } = await loadHooks()
    const { wrapper } = createHarness()
    const { result } = renderHook(() => ({
      inspect: useInspectParticipationClaim(),
      consume: useConsumeParticipationClaim(),
    }), { wrapper })

    let inspectPromise: Promise<unknown>
    let consumePromise: Promise<unknown>
    act(() => {
      inspectPromise = result.current.inspect.mutateAsync(TOKEN)
      consumePromise = result.current.consume.mutateAsync({
        token: TOKEN,
        confirmEmailAttachment: true,
      })
    })
    await waitFor(() => expect(serviceMocks.inspectParticipationClaim).toHaveBeenCalledTimes(1))
    expect(serviceMocks.consumeParticipationClaim).not.toHaveBeenCalled()
    releaseInspect?.()
    await act(async () => {
      await inspectPromise
      await consumePromise
    })
    expect(serviceMocks.consumeParticipationClaim).toHaveBeenCalledWith({
      token: TOKEN,
      confirmEmailAttachment: true,
    })
  })

  it.each([
    ['success', 'resolve'],
    ['error', 'reject'],
  ] as const)('claim settlement invalidates every authorization cache on %s', async (_label, outcome) => {
    if (outcome === 'reject') serviceMocks.consumeParticipationClaim.mockRejectedValueOnce(new Error('offline'))
    const { useConsumeParticipationClaim } = await loadHooks()
    const { queryClient, wrapper } = createHarness()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useConsumeParticipationClaim(), { wrapper })

    await act(async () => {
      const promise = result.current.mutateAsync({ token: TOKEN, confirmEmailAttachment: false })
      if (outcome === 'reject') await expect(promise).rejects.toThrow('offline')
      else await promise
    })

    const serializedCalls = JSON.stringify(invalidate.mock.calls)
    expect(serializedCalls).toContain('eventDiscovery')
    expect(serializedCalls).toContain('identity-aliases')
    expect(serializedCalls).toContain('notifications')
    expect(serializedCalls).toContain('access-policy')
    expect(invalidateCallListCaches).toHaveBeenCalledWith(queryClient)
    expect(serializedCache(queryClient)).not.toContain(TOKEN)
  })

  it.each(['resolve', 'reject'] as const)(
    'invite settlement refreshes exact participant status and call caches on %s',
    async (outcome) => {
    if (outcome === 'reject') {
      serviceMocks.sendParticipationInvitation.mockRejectedValueOnce(new Error('offline'))
    }
    const { useSendParticipationInvitation } = await loadHooks()
    const { queryClient, wrapper } = createHarness()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(
      () => useSendParticipationInvitation(RECORDING_ID, PARTICIPANT_ID),
      { wrapper },
    )

    await act(async () => {
      const promise = result.current.mutateAsync({ sendReminder: false })
      if (outcome === 'reject') await expect(promise).rejects.toThrow('offline')
      else await promise
    })

    expect(serviceMocks.sendParticipationInvitation).toHaveBeenCalledWith({
      recordingId: RECORDING_ID,
      participantId: PARTICIPANT_ID,
      sendReminder: false,
    })
    expect(JSON.stringify(invalidate.mock.calls)).toContain(PARTICIPANT_ID)
    expect(invalidateCallListCaches).toHaveBeenCalledWith(queryClient)
  })

  it.each(['resolve', 'reject'] as const)(
    'resend settlement refreshes exact participant status and call caches on %s',
    async (outcome) => {
      if (outcome === 'reject') {
        serviceMocks.resendParticipationInvitation.mockRejectedValueOnce(new Error('offline'))
      }
      const { useResendParticipationInvitation } = await loadHooks()
      const { queryClient, wrapper } = createHarness()
      const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
      const { result } = renderHook(
        () => useResendParticipationInvitation(RECORDING_ID, PARTICIPANT_ID),
        { wrapper },
      )
      await act(async () => {
        const promise = result.current.mutateAsync({ sendReminder: false })
        if (outcome === 'reject') await expect(promise).rejects.toThrow('offline')
        else await promise
      })
      expect(JSON.stringify(invalidate.mock.calls)).toContain(PARTICIPANT_ID)
      expect(invalidateCallListCaches).toHaveBeenCalledWith(queryClient)
    },
  )

  it.each(['resolve', 'reject'] as const)(
    'disconnect settlement refetches authorization caches on %s',
    async (outcome) => {
    if (outcome === 'reject') {
      serviceMocks.disconnectVerifiedEmail.mockRejectedValueOnce(new Error('offline'))
    }
    const { useDisconnectVerifiedEmail } = await loadHooks()
    const { queryClient, wrapper } = createHarness()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useDisconnectVerifiedEmail(), { wrapper })

    await act(async () => {
      const promise = result.current.mutateAsync(ALIAS_ID)
      if (outcome === 'reject') await expect(promise).rejects.toThrow('offline')
      else await promise
    })

    const serializedCalls = JSON.stringify(invalidate.mock.calls)
    for (const family of ['eventDiscovery', 'identity-aliases', 'notifications', 'access-policy']) {
      expect(serializedCalls).toContain(family)
    }
    expect(invalidateCallListCaches).toHaveBeenCalledWith(queryClient)
  })

  it.each(['resolve', 'reject'] as const)(
    'reminder cancellation settlement invalidates exact invitation and calls on %s',
    async (outcome) => {
      if (outcome === 'reject') {
        serviceMocks.cancelParticipationReminder.mockRejectedValueOnce(new Error('offline'))
      }
      const { useCancelParticipationReminder } = await loadHooks()
      const { queryClient, wrapper } = createHarness()
      const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
      const { result } = renderHook(
        () => useCancelParticipationReminder(RECORDING_ID, PARTICIPANT_ID),
        { wrapper },
      )
      await act(async () => {
        const promise = result.current.mutateAsync()
        if (outcome === 'reject') await expect(promise).rejects.toThrow('offline')
        else await promise
      })
      expect(JSON.stringify(invalidate.mock.calls)).toContain(PARTICIPANT_ID)
      expect(invalidateCallListCaches).toHaveBeenCalledWith(queryClient)
    },
  )

  it('syncs notifications before count and paged discovery reads', async () => {
    const order: string[] = []
    serviceMocks.syncDiscoveredEventNotifications.mockImplementation(async () => {
      order.push('sync')
      return { createdCount: 0 }
    })
    serviceMocks.countEvents.mockImplementation(async () => {
      order.push('count')
      return 7
    })
    serviceMocks.listEvents.mockImplementation(async () => {
      order.push('list')
      return { items: [], nextCursor: null }
    })
    const { useEventDiscoveryCount, useDiscoveredEvents } = await loadHooks()
    const first = createHarness()
    const count = renderHook(() => useEventDiscoveryCount(), { wrapper: first.wrapper })
    await act(async () => { await count.result.current.refetch() })
    expect(order.slice(0, 2)).toEqual(['sync', 'count'])

    order.length = 0
    const second = createHarness()
    const list = renderHook(() => useDiscoveredEvents(25), { wrapper: second.wrapper })
    await act(async () => { await list.result.current.refetch() })
    expect(order.slice(0, 2)).toEqual(['sync', 'list'])
  })
})
