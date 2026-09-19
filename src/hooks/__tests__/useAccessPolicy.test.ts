import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const serviceMocks = vi.hoisted(() => ({
  getAccountAccessDefault: vi.fn(),
  setAccountAccessDefault: vi.fn(),
  getRecordingAccessPolicy: vi.fn(),
  setRecordingAccessLevel: vi.fn(),
  resetRecordingAccessLevel: vi.fn(),
}))
const toastMocks = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
const invalidateCallListCaches = vi.hoisted(() => vi.fn())

vi.mock('@/services/access-policy.service', () => ({
  accessPolicyService: serviceMocks,
}))
vi.mock('sonner', () => ({ toast: toastMocks }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }))
vi.mock('@/lib/query-config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/query-config')>()
  return { ...actual, invalidateCallListCaches }
})

import {
  useAccountAccessDefault,
  useResetRecordingAccessLevel,
  useSetAccountAccessDefault,
  useSetRecordingAccessLevel,
} from '@/hooks/useAccessPolicy'
import { queryKeys } from '@/lib/query-config'

const RECORDING_ID = '11111111-1111-4111-a111-111111111111'

function createHarness() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  return { queryClient, wrapper }
}

describe('access policy hooks', () => {
  beforeEach(() => vi.clearAllMocks())

  it('queries the account default through the service boundary', async () => {
    serviceMocks.getAccountAccessDefault.mockResolvedValue({ accessLevel: 'private' })
    const { wrapper } = createHarness()
    const { result } = renderHook(() => useAccountAccessDefault(), { wrapper })

    await waitFor(() => expect(result.current.data).toEqual({ accessLevel: 'private' }))
    expect(serviceMocks.getAccountAccessDefault).toHaveBeenCalledTimes(1)
  })

  it('optimistically updates the default and uses exact success copy', async () => {
    serviceMocks.setAccountAccessDefault.mockResolvedValue({ accessLevel: 'attendees' })
    const { queryClient, wrapper } = createHarness()
    queryClient.setQueryData(queryKeys.accessPolicy.accountDefault(), { accessLevel: 'private' })
    const { result } = renderHook(() => useSetAccountAccessDefault(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync('attendees')
    })

    expect(queryClient.getQueryData(queryKeys.accessPolicy.accountDefault())).toEqual({
      accessLevel: 'attendees',
    })
    expect(toastMocks.success).toHaveBeenCalledWith('Default access set to Attendees.')
  })

  it('restores access level and origin when a recording update fails', async () => {
    serviceMocks.setRecordingAccessLevel.mockRejectedValue(new Error('nope'))
    const { queryClient, wrapper } = createHarness()
    const previous = { accessLevel: 'private', origin: 'default', accountDefault: 'attendees' }
    queryClient.setQueryData(queryKeys.accessPolicy.recording(RECORDING_ID), previous)
    const { result } = renderHook(() => useSetRecordingAccessLevel(RECORDING_ID), { wrapper })

    await act(async () => {
      await expect(result.current.mutateAsync('link')).rejects.toThrow('nope')
    })

    expect(queryClient.getQueryData(queryKeys.accessPolicy.recording(RECORDING_ID))).toEqual(previous)
    expect(toastMocks.error).toHaveBeenCalledWith(
      "Couldn't update recording access. Nothing changed. Try again.",
    )
    expect(invalidateCallListCaches).toHaveBeenCalledWith(queryClient)
  })

  it('resets optimistically to the current default and invalidates call lists', async () => {
    serviceMocks.resetRecordingAccessLevel.mockResolvedValue({
      accessLevel: 'organization',
      origin: 'default',
    })
    const { queryClient, wrapper } = createHarness()
    queryClient.setQueryData(queryKeys.accessPolicy.recording(RECORDING_ID), {
      accessLevel: 'public',
      origin: 'custom',
      accountDefault: 'organization',
    })
    const { result } = renderHook(() => useResetRecordingAccessLevel(RECORDING_ID), { wrapper })

    await act(async () => {
      await result.current.mutateAsync()
    })

    expect(queryClient.getQueryData(queryKeys.accessPolicy.recording(RECORDING_ID))).toEqual({
      accessLevel: 'organization',
      origin: 'default',
      accountDefault: 'organization',
    })
    expect(toastMocks.success).toHaveBeenCalledWith('Recording access reset to Organization.')
    expect(invalidateCallListCaches).toHaveBeenCalledWith(queryClient)
  })
})
