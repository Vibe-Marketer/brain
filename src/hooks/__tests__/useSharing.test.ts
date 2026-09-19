import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as React from 'react'

const serviceMocks = vi.hoisted(() => ({
  createShareLink: vi.fn(),
  fetchSharedCall: vi.fn(),
  getShareAccessLog: vi.fn(),
  listShareLinks: vi.fn(),
  listSharedWithMe: vi.fn(),
  revokeShareLink: vi.fn(),
}))

vi.mock('@/services/sharing.service', () => serviceMocks)

import {
  useAccessLog,
  useSharedCall,
  useSharedWithMe,
  useSharing,
} from '../useSharing'

const RECORDING_UUID = '11111111-1111-4111-8111-111111111111'
const USER_UUID = '22222222-2222-4222-8222-222222222222'

const activeLink = {
  id: 'link-1',
  recording_id: RECORDING_UUID,
  call_recording_id: null,
  user_id: USER_UUID,
  created_by_user_id: USER_UUID,
  share_token: 'token-1',
  recipient_email: null,
  status: 'active' as const,
  created_at: '2026-09-19T00:00:00.000Z',
  revoked_at: null,
}

function createHarness() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  return { queryClient, wrapper }
}

describe('useSharing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    serviceMocks.listShareLinks.mockResolvedValue([])
    serviceMocks.createShareLink.mockResolvedValue(activeLink)
    serviceMocks.revokeShareLink.mockResolvedValue(undefined)
  })

  it('loads links by canonical UUID through the service', async () => {
    serviceMocks.listShareLinks.mockResolvedValue([activeLink])
    const { wrapper } = createHarness()

    const { result } = renderHook(
      () => useSharing({
        recordingId: RECORDING_UUID,
        userId: USER_UUID,
      }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.shareLinks).toEqual([activeLink]))
    expect(serviceMocks.listShareLinks).toHaveBeenCalledWith(RECORDING_UUID, USER_UUID)
    expect(result.current.sharingStatus).toMatchObject({
      hasShareLinks: true,
      shareLinkCount: 1,
    })
  })

  it('does not load links when disabled or missing UUID', async () => {
    const { wrapper } = createHarness()
    const { result } = renderHook(
      () => useSharing({
        recordingId: null,
        userId: USER_UUID,
        enabled: false,
      }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.isLoadingLinks).toBe(false))
    expect(serviceMocks.listShareLinks).not.toHaveBeenCalled()
  })

  it('creates with a UUID and invalidates sharing plus call-list caches on settle', async () => {
    const { queryClient, wrapper } = createHarness()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(
      () => useSharing({
        recordingId: RECORDING_UUID,
        userId: USER_UUID,
      }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.isLoadingLinks).toBe(false))

    await result.current.createShareLink({
      recording_id: RECORDING_UUID,
      recipient_email: 'viewer@example.com',
    })

    await waitFor(() => expect(serviceMocks.createShareLink).toHaveBeenCalled())
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['sharing', 'links', RECORDING_UUID],
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['calls'],
    })
  })

  it('revokes through the service and invalidates on settle', async () => {
    const { queryClient, wrapper } = createHarness()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(
      () => useSharing({
        recordingId: RECORDING_UUID,
        userId: USER_UUID,
      }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.isLoadingLinks).toBe(false))

    await result.current.revokeShareLink('link-1')

    await waitFor(() => expect(serviceMocks.revokeShareLink).toHaveBeenCalledWith('link-1'))
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['sharing', 'links', RECORDING_UUID],
    })
  })
})

describe('useSharedCall', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not fetch without a token', () => {
    const { wrapper } = createHarness()
    const { result } = renderHook(
      () => useSharedCall({ token: null }),
      { wrapper },
    )

    expect(result.current.data).toEqual({ status: 'not-found' })
    expect(serviceMocks.fetchSharedCall).not.toHaveBeenCalled()
  })

  it('preserves the service response union', async () => {
    serviceMocks.fetchSharedCall.mockResolvedValue({
      status: 'wrong-recipient',
      recipient_masked: 'v***@example.com',
    })
    const { wrapper } = createHarness()
    const { result } = renderHook(
      () => useSharedCall({ token: 'token-1', userId: USER_UUID }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.data.status).toBe('wrong-recipient'))
    expect(serviceMocks.fetchSharedCall).toHaveBeenCalledWith('token-1', true)
  })
})

describe('useAccessLog', () => {
  it('loads access logs through the sharing service', async () => {
    const logs = [{
      id: 'log-1',
      share_link_id: 'link-1',
      accessed_by_user_id: USER_UUID,
      accessed_at: '2026-09-19T00:00:00.000Z',
      user_email: 'viewer@example.com',
      user_name: 'Viewer',
    }]
    serviceMocks.getShareAccessLog.mockResolvedValue(logs)
    const { wrapper } = createHarness()
    const { result } = renderHook(
      () => useAccessLog({ linkId: 'link-1' }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.accessLog).toEqual(logs))
    expect(serviceMocks.getShareAccessLog).toHaveBeenCalledWith('link-1')
  })
})

describe('useSharedWithMe', () => {
  it('loads canonical rows through the v3-backed service', async () => {
    const rows = [{
      recording_id: RECORDING_UUID,
      call_name: 'UUID-only meeting',
      recording_start_time: '2026-09-19T00:00:00.000Z',
      duration: null,
      owner_user_id: USER_UUID,
      source_type: 'share_link',
      source_label: 'Direct Link',
    }]
    serviceMocks.listSharedWithMe.mockResolvedValue(rows)
    const { wrapper } = createHarness()
    const { result } = renderHook(
      () => useSharedWithMe(true),
      { wrapper },
    )

    await waitFor(() => expect(result.current.data).toEqual(rows))
    expect(serviceMocks.listSharedWithMe).toHaveBeenCalledWith(false)
  })

  it('does not load while disabled', () => {
    const { wrapper } = createHarness()
    renderHook(() => useSharedWithMe(false), { wrapper })

    expect(serviceMocks.listSharedWithMe).not.toHaveBeenCalled()
  })
})
