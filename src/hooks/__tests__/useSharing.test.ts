import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSharing, useSharedCall, useAccessLog } from '../useSharing';
import * as React from 'react';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => {
  const mockSupabase = {
    from: vi.fn(),
    rpc: vi.fn(),
  };
  return { supabase: mockSupabase };
});

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import after mocking
import { supabase as mockSupabase } from '@/integrations/supabase/client';

// Helper to create wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useSharing', () => {
  const testUserId = 'test-user-123';
  const testCallId = 12345;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('shareLinks query', () => {

    it('should not count revoked links in status', async () => {
      const mockShareLinks = [
        { id: 'link-1', status: 'active', call_recording_id: testCallId },
        { id: 'link-2', status: 'revoked', call_recording_id: testCallId },
        { id: 'link-3', status: 'active', call_recording_id: testCallId },
      ];

      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockShareLinks,
                error: null,
              }),
            }),
          }),
        }),
      });

      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useSharing({ callId: testCallId, userId: testUserId }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.shareLinks).toHaveLength(3);
      });

      expect(result.current.sharingStatus.shareLinkCount).toBe(2);
    });

    it('should not fetch when callId is null', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useSharing({ callId: null, userId: testUserId }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoadingLinks).toBe(false);
      });

      expect(result.current.shareLinks).toEqual([]);
    });
  });

  describe('createShareLink mutation', () => {

    it('should throw error when userId is not provided', async () => {
      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        }),
      });

      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useSharing({ callId: testCallId, userId: undefined }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoadingLinks).toBe(false);
      });

      await expect(
        result.current.createShareLink({ call_recording_id: testCallId })
      ).rejects.toThrow('User ID is required to create share link');
    });
  });

});

// TODO: useSharedCall now calls a Supabase edge function via fetch() instead of
// the supabase.from() chain these tests mock. Skipping until the suite is rewritten
// to mock global fetch (or run against a local supabase functions serve).

// ---------------------------------------------------------------------------
// Phase 32: useSharedCall discriminated union
// ---------------------------------------------------------------------------
//
// Validates that the refactored useSharedCall hook maps share-call Edge Function
// response codes to the correct discriminated-union variant. Each test mocks
// global.fetch to return a specific status + code, then asserts the resolved
// data.status value.

describe('useSharedCall — Phase 32 discriminated union', () => {
  const originalFetch = global.fetch;
  let getSessionSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no session attached (anonymous fetch path).
    getSessionSpy = vi.fn().mockResolvedValue({ data: { session: null } });
    (mockSupabase as unknown as { auth: { getSession: typeof getSessionSpy } }).auth = {
      getSession: getSessionSpy,
    };
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function mockFetchOnce(response: { status: number; body: unknown }) {
    global.fetch = vi.fn().mockResolvedValue({
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      json: async () => response.body,
    }) as unknown as typeof global.fetch;
  }

  it('maps 200 with is_public_view to status="public-view"', async () => {
    mockFetchOnce({
      status: 200,
      body: {
        is_public_view: true,
        inviter_name: 'Andrew N.',
        call_title: 'Q3 Sync',
        recipient_email: 'r@e.com',
        recipient_masked: 'r***@e.com',
      },
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useSharedCall({ token: 'tok-1' }), { wrapper });

    await waitFor(() => {
      expect(result.current.data.status).toBe('public-view');
    });
    if (result.current.data.status === 'public-view') {
      expect(result.current.data.inviter_name).toBe('Andrew N.');
      expect(result.current.data.call_title).toBe('Q3 Sync');
      expect(result.current.data.recipient_masked).toBe('r***@e.com');
    }
  });

  it('maps 200 with is_valid to status="ok"', async () => {
    mockFetchOnce({
      status: 200,
      body: {
        is_valid: true,
        share_link: { id: 'l1', share_token: 'tok-2', status: 'active', created_at: '2026-01-01' },
        call: {
          recording_id: 12345,
          call_name: 'Test',
          recorded_by_email: 'a@b.com',
          recording_start_time: '2026-01-01T00:00:00Z',
          duration: null,
          full_transcript: 'hello',
        },
      },
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useSharedCall({ token: 'tok-2' }), { wrapper });

    await waitFor(() => {
      expect(result.current.data.status).toBe('ok');
    });
  });

  it('maps 403 WRONG_RECIPIENT to status="wrong-recipient"', async () => {
    mockFetchOnce({
      status: 403,
      body: { code: 'WRONG_RECIPIENT', recipient_masked: 'na***@gmail.com' },
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useSharedCall({ token: 'tok-3' }), { wrapper });

    await waitFor(() => {
      expect(result.current.data.status).toBe('wrong-recipient');
    });
    if (result.current.data.status === 'wrong-recipient') {
      expect(result.current.data.recipient_masked).toBe('na***@gmail.com');
    }
  });

  it('maps 403 LINK_REVOKED to status="revoked"', async () => {
    mockFetchOnce({
      status: 403,
      body: {
        code: 'LINK_REVOKED',
        share_link: { id: 'r1', status: 'revoked', revoked_at: '2026-01-01' },
      },
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useSharedCall({ token: 'tok-4' }), { wrapper });

    await waitFor(() => {
      expect(result.current.data.status).toBe('revoked');
    });
  });

  it('maps 404 LINK_NOT_FOUND to status="not-found"', async () => {
    mockFetchOnce({ status: 404, body: { code: 'LINK_NOT_FOUND' } });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useSharedCall({ token: 'tok-5' }), { wrapper });

    await waitFor(() => {
      expect(result.current.data.status).toBe('not-found');
    });
  });

  it('maps 404 CALL_NOT_FOUND to status="not-found"', async () => {
    mockFetchOnce({ status: 404, body: { code: 'CALL_NOT_FOUND' } });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useSharedCall({ token: 'tok-6' }), { wrapper });

    await waitFor(() => {
      expect(result.current.data.status).toBe('not-found');
    });
  });

  it('maps 500 to status="error"', async () => {
    mockFetchOnce({ status: 500, body: { error: 'Internal' } });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useSharedCall({ token: 'tok-7' }), { wrapper });

    await waitFor(() => {
      expect(result.current.data.status).toBe('error');
    });
    if (result.current.data.status === 'error') {
      expect(result.current.data.message).toBe('Internal');
    }
  });

  it('maps network failure to status="error"', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network down')) as unknown as typeof global.fetch;

    const wrapper = createWrapper();
    const { result } = renderHook(() => useSharedCall({ token: 'tok-8' }), { wrapper });

    await waitFor(() => {
      expect(result.current.data.status).toBe('error');
    });
  });

  it('attaches Authorization header when session is present', async () => {
    getSessionSpy.mockResolvedValue({ data: { session: { access_token: 'abc123' } } });
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ is_public_view: true, inviter_name: 'X', call_title: 'Y' }),
    });
    global.fetch = fetchSpy as unknown as typeof global.fetch;

    const wrapper = createWrapper();
    renderHook(() => useSharedCall({ token: 'tok-auth', userId: 'u1' }), { wrapper });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });
    const callArgs = fetchSpy.mock.calls[0];
    const headers = (callArgs[1] as { headers: Record<string, string> }).headers;
    expect(headers.Authorization).toBe('Bearer abc123');
  });

  it('does NOT attach Authorization header when session is null', async () => {
    getSessionSpy.mockResolvedValue({ data: { session: null } });
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ is_public_view: true, inviter_name: 'X', call_title: 'Y' }),
    });
    global.fetch = fetchSpy as unknown as typeof global.fetch;

    const wrapper = createWrapper();
    renderHook(() => useSharedCall({ token: 'tok-anon' }), { wrapper });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });
    const callArgs = fetchSpy.mock.calls[0];
    const headers = (callArgs[1] as { headers: Record<string, string> }).headers;
    expect(headers.Authorization).toBeUndefined();
  });
});
