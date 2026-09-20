import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const serviceMocks = vi.hoisted(() => ({
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
  useDisconnectVerifiedEmail: () => {
    mutateAsync: (aliasId: string) => Promise<unknown>
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

describe('event discovery hooks and invalidation (Wave 0 RED)', () => {
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
  })

  it.fails('RED: inspects through a mutation without persisting the raw token in cache keys', async () => {
    const { useInspectParticipationClaim } = await loadHooks()
    const { queryClient, wrapper } = createHarness()
    const { result } = renderHook(() => useInspectParticipationClaim(), { wrapper })

    await act(async () => { await result.current.mutateAsync(TOKEN) })

    expect(serviceMocks.inspectParticipationClaim).toHaveBeenCalledWith(TOKEN)
    expect(serializedCache(queryClient)).not.toContain(TOKEN)
    expect(serviceMocks.consumeParticipationClaim).not.toHaveBeenCalled()
  })

  it.fails.each([
    ['success', 'resolve'],
    ['error', 'reject'],
  ] as const)('RED: claim settlement invalidates every authorization cache on %s', async (_label, outcome) => {
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
    expect(serializedCalls).toContain('identityAliases')
    expect(serializedCalls).toContain('notifications')
    expect(serializedCalls).toContain('accessPolicy')
    expect(invalidateCallListCaches).toHaveBeenCalledWith(queryClient)
    expect(serializedCache(queryClient)).not.toContain(TOKEN)
  })

  it.fails('RED: invite settlement refreshes the exact participant status and call caches', async () => {
    const { useSendParticipationInvitation } = await loadHooks()
    const { queryClient, wrapper } = createHarness()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(
      () => useSendParticipationInvitation(RECORDING_ID, PARTICIPANT_ID),
      { wrapper },
    )

    await act(async () => {
      await result.current.mutateAsync({ sendReminder: false })
    })

    expect(serviceMocks.sendParticipationInvitation).toHaveBeenCalledWith({
      recordingId: RECORDING_ID,
      participantId: PARTICIPANT_ID,
      sendReminder: false,
    })
    expect(JSON.stringify(invalidate.mock.calls)).toContain(PARTICIPANT_ID)
    expect(invalidateCallListCaches).toHaveBeenCalledWith(queryClient)
  })

  it.fails('RED: disconnect settlement refetches discovery, aliases, notifications, access, and calls', async () => {
    serviceMocks.disconnectVerifiedEmail.mockRejectedValueOnce(new Error('offline'))
    const { useDisconnectVerifiedEmail } = await loadHooks()
    const { queryClient, wrapper } = createHarness()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useDisconnectVerifiedEmail(), { wrapper })

    await act(async () => {
      await expect(result.current.mutateAsync(ALIAS_ID)).rejects.toThrow('offline')
    })

    const serializedCalls = JSON.stringify(invalidate.mock.calls)
    for (const family of ['eventDiscovery', 'identityAliases', 'notifications', 'accessPolicy']) {
      expect(serializedCalls).toContain(family)
    }
    expect(invalidateCallListCaches).toHaveBeenCalledWith(queryClient)
  })
})
