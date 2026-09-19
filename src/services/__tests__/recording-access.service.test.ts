import { beforeEach, describe, expect, it, vi } from 'vitest'

import { supabase } from '@/integrations/supabase/client'
import { recordingAccessService } from '@/services/recording-access.service'

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
    functions: { invoke: vi.fn() },
  },
}))

const rpc = vi.mocked(supabase.rpc)
const from = vi.mocked(supabase.from)
const invoke = vi.mocked(supabase.functions.invoke)

describe('recordingAccessService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('maps discoverable copies to requester-safe fields only', async () => {
    rpc
      .mockResolvedValueOnce({
        data: [{ event_id: '11111111-1111-4111-a111-111111111111', has_other_copies: true }],
        error: null,
      } as never)
      .mockResolvedValueOnce({
        data: [{
          copy_ordinal: 2,
          recording_id: '22222222-2222-4222-a222-222222222222',
          request_status: null,
          cooldown_until: null,
          owner_email: 'must-not-leak@example.invalid',
        }],
        error: null,
      } as never)

    await expect(recordingAccessService.listDiscoverableRecordingCopies(
      '11111111-1111-4111-a111-111111111111',
    )).resolves.toEqual({
      eligible: true,
      copies: [{
        ordinal: 2,
        requestTarget: '22222222-2222-4222-a222-222222222222',
        requestState: 'available',
        cooldownUntil: null,
      }],
    })
  })

  it('keeps a saved request successful when email delivery remains pending', async () => {
    rpc.mockResolvedValueOnce({
      data: [{
        request_id: '33333333-3333-4333-a333-333333333333',
        status: 'pending',
        cooldown_until: null,
      }],
      error: null,
    } as never)
    invoke.mockResolvedValueOnce({
      data: { success: true, status: 'delivery_pending' },
      error: null,
    } as never)

    await expect(recordingAccessService.requestRecordingAccess(
      '22222222-2222-4222-a222-222222222222',
    )).resolves.toMatchObject({
      requestId: '33333333-3333-4333-a333-333333333333',
      status: 'pending',
      emailDelivery: 'pending',
    })
    expect(invoke).toHaveBeenCalledWith('recording-access', {
      body: { request_id: '33333333-3333-4333-a333-333333333333' },
    })
  })

  it('maps the request submission time separately from the meeting date', async () => {
    const requestId = '33333333-3333-4333-a333-333333333333'
    rpc.mockResolvedValueOnce({
      data: [{
        request_id: requestId,
        request_status: 'pending',
        requester_name: 'Taylor',
        requester_verified_email: 'taylor@example.invalid',
        meeting_title: 'Quarterly review',
        meeting_date: '2026-09-18T14:00:00Z',
        evidence: {},
        cooldown_until: null,
        grant_id: null,
        grantee_user_id: null,
        granted_at: null,
        revoked_at: null,
      }],
      error: null,
    } as never)
    const eq = vi.fn().mockResolvedValue({
      data: [{ id: requestId, created_at: '2026-09-19T12:05:00Z' }],
      error: null,
    })
    from.mockReturnValue({ select: vi.fn(() => ({ eq })) } as never)

    await expect(recordingAccessService.getRecordingAccessManagement(
      '22222222-2222-4222-a222-222222222222',
    )).resolves.toMatchObject({
      requests: [{
        id: requestId,
        requestedAt: '2026-09-19T12:05:00Z',
        meetingDate: '2026-09-18T14:00:00Z',
      }],
    })
    expect(from).toHaveBeenCalledWith('recording_access_requests')
  })

  it('does not roll back a saved request when the follow-up invocation fails', async () => {
    rpc.mockResolvedValueOnce({
      data: [{
        request_id: '33333333-3333-4333-a333-333333333333',
        status: 'pending',
        cooldown_until: null,
      }],
      error: null,
    } as never)
    invoke.mockResolvedValueOnce({ data: null, error: new Error('network unavailable') } as never)

    await expect(recordingAccessService.requestRecordingAccess(
      '22222222-2222-4222-a222-222222222222',
    )).resolves.toMatchObject({ emailDelivery: 'pending' })
  })

  it('rejects non-UUID lifecycle targets before calling Supabase', async () => {
    await expect(recordingAccessService.approveRequest('42')).rejects.toThrow('valid request ID')
    await expect(recordingAccessService.revokeGrant('42')).rejects.toThrow('valid grant ID')
    expect(rpc).not.toHaveBeenCalled()
  })
})
