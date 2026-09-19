import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const serviceMocks = vi.hoisted(() => ({
  getEventRecordingExistence: vi.fn(),
  listDiscoverableRecordingCopies: vi.fn(),
  requestRecordingAccess: vi.fn(),
  getRecordingAccessManagement: vi.fn(),
  approveRequest: vi.fn(),
  denyRequest: vi.fn(),
  revokeGrant: vi.fn(),
}))
const toastMocks = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
const invalidateCallListCaches = vi.hoisted(() => vi.fn())

vi.mock('@/services/recording-access.service', () => ({
  RecordingAccessError: class RecordingAccessError extends Error {
    constructor(message: string, public readonly code: string) {
      super(message)
    }
  },
  recordingAccessService: serviceMocks,
}))
vi.mock('sonner', () => ({ toast: toastMocks }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }))
vi.mock('@/lib/query-config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/query-config')>()
  return { ...actual, invalidateCallListCaches }
})

import {
  useApproveRecordingAccessRequest,
  useDenyRecordingAccessRequest,
  useRequestRecordingAccess,
  useRevokeRecordingAccessGrant,
} from '@/hooks/useRecordingAccess'
import { queryKeys } from '@/lib/query-config'
import { RecordingAccessError } from '@/services/recording-access.service'
import type { RecordingAccessManagement } from '@/types/recording-access'

const EVENT_ID = '11111111-1111-4111-a111-111111111111'
const RECORDING_ID = '22222222-2222-4222-a222-222222222222'
const REQUEST_ID = '33333333-3333-4333-a333-333333333333'
const GRANT_ID = '44444444-4444-4444-a444-444444444444'

const management: RecordingAccessManagement = {
  requests: [{
    id: REQUEST_ID,
    status: 'pending',
    name: 'Taylor',
    verifiedEmail: 'taylor@example.invalid',
    meetingTitle: 'Quarterly review',
    meetingDate: '2026-09-19T12:00:00Z',
    evidence: {
      participantRole: 'attendee',
      participantType: 'speaker',
      hasConfirmedSpeech: true,
      sources: ['transcript'],
    },
    cooldownUntil: null,
    grantId: null,
  }],
  grants: [{
    id: GRANT_ID,
    requestId: REQUEST_ID,
    granteeUserId: '55555555-5555-4555-a555-555555555555',
    name: 'Jordan',
    verifiedEmail: 'jordan@example.invalid',
    grantedAt: '2026-09-19T12:30:00Z',
    revokedAt: null,
  }],
}

function createHarness() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  return { queryClient, wrapper }
}

describe('recording access hooks', () => {
  beforeEach(() => vi.clearAllMocks())

  it('keeps email-pending saved requests in the success path', async () => {
    serviceMocks.requestRecordingAccess.mockResolvedValue({
      requestId: REQUEST_ID,
      status: 'pending',
      cooldownUntil: null,
      emailDelivery: 'pending',
    })
    const { queryClient, wrapper } = createHarness()
    queryClient.setQueryData(queryKeys.accessPolicy.eventCopies(EVENT_ID), {
      eligible: true,
      copies: [{
        ordinal: 1,
        requestTarget: RECORDING_ID,
        requestState: 'available',
        cooldownUntil: null,
      }],
    })
    const { result } = renderHook(() => useRequestRecordingAccess(EVENT_ID), { wrapper })

    await act(async () => {
      await result.current.mutateAsync(RECORDING_ID)
    })

    expect(toastMocks.success).toHaveBeenCalledWith(
      'Access request sent. The recording owner has been notified.',
    )
    expect(toastMocks.error).not.toHaveBeenCalled()
  })

  it('moves only the approved request and invalidates calls plus lifecycle caches', async () => {
    serviceMocks.approveRequest.mockResolvedValue({
      requestId: REQUEST_ID,
      grantId: GRANT_ID,
      status: 'approved',
    })
    const { queryClient, wrapper } = createHarness()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    queryClient.setQueryData(queryKeys.accessPolicy.management(RECORDING_ID), management)
    const { result } = renderHook(
      () => useApproveRecordingAccessRequest(RECORDING_ID, EVENT_ID),
      { wrapper },
    )

    await act(async () => {
      await result.current.mutateAsync(REQUEST_ID)
    })

    expect(toastMocks.success).toHaveBeenCalledWith('Access approved for Taylor.')
    expect(invalidateCallListCaches).toHaveBeenCalledWith(queryClient)
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.accessPolicy.management(RECORDING_ID),
    })
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.accessPolicy.eventCopies(EVENT_ID),
    })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.notifications.list() })
  })

  it('rolls back a denied-row update and refetches on conflict', async () => {
    serviceMocks.denyRequest.mockRejectedValue(
      new RecordingAccessError('already changed', 'REQUEST_ALREADY_RESOLVED'),
    )
    const { queryClient, wrapper } = createHarness()
    queryClient.setQueryData(queryKeys.accessPolicy.management(RECORDING_ID), management)
    const { result } = renderHook(
      () => useDenyRecordingAccessRequest(RECORDING_ID, EVENT_ID),
      { wrapper },
    )

    await act(async () => {
      await expect(result.current.mutateAsync(REQUEST_ID)).rejects.toThrow('already changed')
    })

    expect(queryClient.getQueryData(queryKeys.accessPolicy.management(RECORDING_ID)))
      .toEqual(management)
    expect(toastMocks.error).toHaveBeenCalledWith(
      'This request changed. The latest status is shown.',
    )
  })

  it('restores a grant after failed revocation and still invalidates call lists', async () => {
    serviceMocks.revokeGrant.mockRejectedValue(new Error('offline'))
    const { queryClient, wrapper } = createHarness()
    queryClient.setQueryData(queryKeys.accessPolicy.management(RECORDING_ID), management)
    const { result } = renderHook(
      () => useRevokeRecordingAccessGrant(RECORDING_ID, EVENT_ID),
      { wrapper },
    )

    await act(async () => {
      await expect(result.current.mutateAsync(GRANT_ID)).rejects.toThrow('offline')
    })

    expect(queryClient.getQueryData(queryKeys.accessPolicy.management(RECORDING_ID)))
      .toEqual(management)
    expect(toastMocks.error).toHaveBeenCalledWith(
      "Couldn't revoke access. Nothing changed. Try again.",
    )
    expect(invalidateCallListCaches).toHaveBeenCalledWith(queryClient)
  })
})
