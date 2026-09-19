import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
const maybeSingle = vi.fn()
const eq = vi.fn(() => ({ maybeSingle }))
const select = vi.fn(() => ({ eq }))
const from = vi.fn(() => ({ select }))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from, rpc },
}))

import {
  accessPolicyService,
  getAccountAccessDefault,
  getRecordingAccessPolicy,
  resetRecordingAccessLevel,
  setAccountAccessDefault,
  setRecordingAccessLevel,
} from '@/services/access-policy.service'

const RECORDING_ID = '11111111-1111-4111-a111-111111111111'

describe('accessPolicyService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    eq.mockReturnValue({ maybeSingle })
    select.mockReturnValue({ eq })
    from.mockReturnValue({ select })
  })

  it('reads the owner-scoped account default and falls back to private when no row exists', async () => {
    maybeSingle.mockResolvedValueOnce({
      data: { default_recording_access_level: 'attendees' },
      error: null,
    })
    await expect(getAccountAccessDefault()).resolves.toEqual({ accessLevel: 'attendees' })
    expect(from).toHaveBeenCalledWith('user_settings')

    maybeSingle.mockResolvedValueOnce({ data: null, error: null })
    await expect(getAccountAccessDefault()).resolves.toEqual({ accessLevel: 'private' })
  })

  it('uses only owner-derived RPC arguments for default and recording mutations', async () => {
    rpc
      .mockResolvedValueOnce({
        data: [{ default_recording_access_level: 'organization' }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ access_level: 'link', access_policy_origin: 'custom' }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ access_level: 'organization', access_policy_origin: 'default' }],
        error: null,
      })

    await expect(setAccountAccessDefault('organization')).resolves.toEqual({
      accessLevel: 'organization',
    })
    await expect(setRecordingAccessLevel(RECORDING_ID, 'link')).resolves.toEqual({
      accessLevel: 'link',
      origin: 'custom',
    })
    await expect(resetRecordingAccessLevel(RECORDING_ID)).resolves.toEqual({
      accessLevel: 'organization',
      origin: 'default',
    })

    expect(rpc).toHaveBeenNthCalledWith(1, 'set_default_recording_access_level', {
      p_access_level: 'organization',
    })
    expect(rpc).toHaveBeenNthCalledWith(2, 'set_recording_access_level', {
      p_recording_id: RECORDING_ID,
      p_access_level: 'link',
    })
    expect(rpc).toHaveBeenNthCalledWith(3, 'reset_recording_access_level', {
      p_recording_id: RECORDING_ID,
    })
    expect(JSON.stringify(rpc.mock.calls)).not.toContain('owner')
  })

  it('validates policy rows and maps stable RPC errors to typed service errors', async () => {
    rpc
      .mockResolvedValueOnce({
        data: [{ access_level: 'attendees', access_policy_origin: 'default' }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: { code: '42501', message: 'RECORDING_NOT_AVAILABLE' },
      })

    await expect(getRecordingAccessPolicy(RECORDING_ID)).resolves.toEqual({
      accessLevel: 'attendees',
      origin: 'default',
    })
    await expect(setRecordingAccessLevel(RECORDING_ID, 'public')).rejects.toMatchObject({
      name: 'AccessPolicyServiceError',
      code: 'RECORDING_NOT_AVAILABLE',
    })
  })

  it('throws contextual errors for malformed rows and unexpected database failures', async () => {
    rpc
      .mockResolvedValueOnce({ data: [{ access_level: 'bogus', access_policy_origin: 'default' }], error: null })
      .mockResolvedValueOnce({ data: null, error: { code: 'XX000', message: 'database exploded' } })

    await expect(getRecordingAccessPolicy(RECORDING_ID)).rejects.toThrow(
      'Failed to get recording access policy: invalid response',
    )
    await expect(setAccountAccessDefault('private')).rejects.toThrow(
      'Failed to set account access default: database exploded',
    )
  })

  it('exposes the named functions through the service object', () => {
    expect(accessPolicyService).toEqual({
      getAccountAccessDefault,
      setAccountAccessDefault,
      getRecordingAccessPolicy,
      setRecordingAccessLevel,
      resetRecordingAccessLevel,
    })
  })
})
