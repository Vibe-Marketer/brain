import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockFrom = vi.fn()
const mockRpc = vi.fn()
const mockGetSession = vi.fn()

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getSession: mockGetSession },
    from: mockFrom,
    rpc: mockRpc,
  },
}))

import {
  createShareLink,
  fetchSharedCall,
  getShareAccessLog,
  listShareLinks,
  listSharedWithMe,
  revokeShareLink,
} from '@/services/sharing.service'

const RECORDING_UUID = '11111111-1111-4111-8111-111111111111'
const USER_UUID = '22222222-2222-4222-8222-222222222222'

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response
}

describe('sharing service', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'anon-key')
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'access-token' } },
      error: null,
    })
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.unstubAllEnvs()
  })

  it('lists owner share links by canonical recording UUID', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [{
        id: 'link-1',
        recording_id: RECORDING_UUID,
        call_recording_id: null,
        user_id: USER_UUID,
        created_by_user_id: USER_UUID,
        share_token: 'token-1',
        recipient_email: null,
        status: 'active',
        created_at: '2026-09-19T00:00:00.000Z',
        revoked_at: null,
      }],
      error: null,
    })
    const ownerEq = vi.fn().mockReturnValue({ order })
    const recordingEq = vi.fn().mockReturnValue({ eq: ownerEq })
    const select = vi.fn().mockReturnValue({ eq: recordingEq })
    mockFrom.mockReturnValue({ select })

    const links = await listShareLinks(RECORDING_UUID, USER_UUID)

    expect(mockFrom).toHaveBeenCalledWith('call_share_links')
    expect(recordingEq).toHaveBeenCalledWith('recording_id', RECORDING_UUID)
    expect(ownerEq).toHaveBeenCalledWith('user_id', USER_UUID)
    expect(links[0]).toMatchObject({
      recording_id: RECORDING_UUID,
      call_recording_id: null,
    })
  })

  it('creates a UUID-native share through the authenticated Edge API', async () => {
    const link = {
      id: 'link-2',
      recording_id: RECORDING_UUID,
      call_recording_id: null,
      user_id: USER_UUID,
      created_by_user_id: USER_UUID,
      share_token: 'token-2',
      recipient_email: 'viewer@example.com',
      status: 'active',
      created_at: '2026-09-19T00:00:00.000Z',
      revoked_at: null,
    }
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(200, { share_link: link }))
    global.fetch = fetchSpy as unknown as typeof global.fetch

    await expect(createShareLink({
      recording_id: RECORDING_UUID,
      recipient_email: 'viewer@example.com',
    })).resolves.toEqual(link)

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://test.supabase.co/functions/v1/share-call',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          recording_id: RECORDING_UUID,
          recipient_email: 'viewer@example.com',
        }),
      }),
    )
  })

  it('revokes and loads access logs by share-link ID through the Edge API', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { success: true }))
      .mockResolvedValueOnce(jsonResponse(200, {
        access_logs: [{
          id: 'log-1',
          share_link_id: 'link-2',
          accessed_by_user_id: USER_UUID,
          accessed_at: '2026-09-19T00:00:00.000Z',
          user_email: 'viewer@example.com',
          user_name: 'Viewer',
        }],
      }))
    global.fetch = fetchSpy as unknown as typeof global.fetch

    await expect(revokeShareLink('link-2')).resolves.toBeUndefined()
    await expect(getShareAccessLog('link-2')).resolves.toHaveLength(1)

    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      'https://test.supabase.co/functions/v1/share-call?id=link-2',
      expect.objectContaining({ method: 'DELETE' }),
    )
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      'https://test.supabase.co/functions/v1/share-call/access-log?id=link-2',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('preserves the public shared-call response union', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(403, {
      code: 'WRONG_RECIPIENT',
      recipient_masked: 'v***@example.com',
    })) as unknown as typeof global.fetch

    await expect(fetchSharedCall('token-3', false)).resolves.toEqual({
      status: 'wrong-recipient',
      recipient_masked: 'v***@example.com',
    })
  })

  it('loads Shared With Me rows from the UUID-native v3 RPC', async () => {
    const row = {
      recording_id: RECORDING_UUID,
      call_name: 'UUID-only meeting',
      recording_start_time: '2026-09-19T00:00:00.000Z',
      duration: null,
      owner_user_id: USER_UUID,
      source_type: 'share_link',
      source_label: 'Direct Link',
    }
    mockRpc.mockResolvedValue({ data: [row], error: null })

    await expect(listSharedWithMe()).resolves.toEqual([row])
    expect(mockRpc).toHaveBeenCalledWith('get_calls_shared_with_me_v3', {
      p_include_expired: false,
    })
  })
})
