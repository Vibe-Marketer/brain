import { describe, it, expect, beforeEach, vi } from 'vitest';
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
    it('should return empty array when no share links exist', async () => {
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
        () => useSharing({ callId: testCallId, userId: testUserId }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoadingLinks).toBe(false);
      });

      expect(result.current.shareLinks).toEqual([]);
      expect(result.current.sharingStatus.hasShareLinks).toBe(false);
      expect(result.current.sharingStatus.shareLinkCount).toBe(0);
    });

    it('should fetch share links for a call', async () => {
      const mockShareLinks = [
        {
          id: 'link-1',
          call_recording_id: testCallId,
          user_id: testUserId,
          share_token: 'token-abc',
          status: 'active',
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'link-2',
          call_recording_id: testCallId,
          user_id: testUserId,
          share_token: 'token-xyz',
          status: 'active',
          created_at: '2024-01-02T00:00:00Z',
        },
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
        expect(result.current.shareLinks).toHaveLength(2);
      });

      expect(result.current.sharingStatus.hasShareLinks).toBe(true);
      expect(result.current.sharingStatus.shareLinkCount).toBe(2);
    });

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

    it('should not fetch when disabled', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useSharing({ callId: testCallId, userId: testUserId, enabled: false }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoadingLinks).toBe(false);
      });

      expect(mockSupabase.from).not.toHaveBeenCalled();
      expect(result.current.shareLinks).toEqual([]);
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
    it('should create a share link successfully', async () => {
      const createdLink = {
        id: 'new-link-id',
        call_recording_id: testCallId,
        user_id: testUserId,
        share_token: 'generated-token',
        status: 'active',
        created_at: '2024-01-01T00:00:00Z',
      };

      (mockSupabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'call_share_links') {
          return {
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
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: createdLink,
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      });

      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useSharing({ callId: testCallId, userId: testUserId }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoadingLinks).toBe(false);
      });

      const newLink = await result.current.createShareLink({
        call_recording_id: testCallId,
      });

      expect(newLink.id).toBe('new-link-id');
      expect(newLink.call_recording_id).toBe(testCallId);
    });

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

  describe('revokeShareLink mutation', () => {
    it('should revoke a share link successfully', async () => {
      (mockSupabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'call_share_links') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: [{ id: 'link-1', status: 'active' }],
                    error: null,
                  }),
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      });

      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useSharing({ callId: testCallId, userId: testUserId }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoadingLinks).toBe(false);
      });

      await expect(result.current.revokeShareLink('link-1')).resolves.toBeUndefined();
    });
  });
});

describe('useSharedCall', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetching shared call by token', () => {
    it('should return invalid when token is null', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useSharedCall({ token: null }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeNull();
    });

    it('should return valid shared call data', async () => {
      const mockShareLink = {
        id: 'link-1',
        call_recording_id: 12345,
        user_id: 'owner-123',
        share_token: 'valid-token',
        status: 'active',
      };

      const mockCall = {
        recording_id: 12345,
        call_name: 'Test Call',
        recorded_by_email: 'owner@test.com',
        recording_start_time: '2024-01-01T00:00:00Z',
        duration: '00:30:00',
        full_transcript: 'Test transcript content',
      };

      (mockSupabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'call_share_links') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockShareLink,
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'fathom_calls') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: mockCall,
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      });

      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useSharedCall({ token: 'valid-token' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data?.isValid).toBe(true);
      expect(result.current.data?.call?.call_name).toBe('Test Call');
      expect(result.current.data?.shareLink?.share_token).toBe('valid-token');
    });

    it('should return isRevoked when share link is revoked', async () => {
      const mockShareLink = {
        id: 'link-1',
        call_recording_id: 12345,
        share_token: 'revoked-token',
        status: 'revoked',
      };

      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockShareLink,
              error: null,
            }),
          }),
        }),
      });

      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useSharedCall({ token: 'revoked-token' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data?.isValid).toBe(false);
      expect(result.current.data?.isRevoked).toBe(true);
    });

    it('should return invalid when share link not found', async () => {
      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' },
            }),
          }),
        }),
      });

      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useSharedCall({ token: 'invalid-token' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data?.isValid).toBe(false);
      expect(result.current.data?.shareLink).toBeNull();
    });
  });

  describe('logAccess', () => {
    it('should log access successfully', async () => {
      const mockShareLink = {
        id: 'link-1',
        call_recording_id: 12345,
        user_id: 'owner-123',
        share_token: 'valid-token',
        status: 'active',
      };

      const mockCall = {
        recording_id: 12345,
        call_name: 'Test Call',
        recorded_by_email: 'owner@test.com',
        recording_start_time: '2024-01-01T00:00:00Z',
        duration: null,
        full_transcript: null,
      };

      (mockSupabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'call_share_links') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockShareLink,
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'fathom_calls') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: mockCall,
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'call_share_access_log') {
          return {
            insert: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          };
        }
        return {
          select: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      });

      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useSharedCall({ token: 'valid-token', userId: 'viewer-123' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.data?.isValid).toBe(true);
      });

      await expect(result.current.logAccess()).resolves.toBeUndefined();
    });
  });
});

describe('useAccessLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetching access log', () => {
    it('should return empty array when linkId is null', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useAccessLog({ linkId: null }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.accessLog).toEqual([]);
    });

    it('should fetch access log entries', async () => {
      const mockAccessLogs = [
        {
          id: 'log-1',
          share_link_id: 'link-1',
          accessed_by_user_id: 'user-1',
          accessed_at: '2024-01-01T10:00:00Z',
        },
        {
          id: 'log-2',
          share_link_id: 'link-1',
          accessed_by_user_id: 'user-2',
          accessed_at: '2024-01-01T11:00:00Z',
        },
      ];

      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockAccessLogs,
              error: null,
            }),
          }),
        }),
      });

      (mockSupabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: 'user@test.com',
        error: null,
      });

      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useAccessLog({ linkId: 'link-1' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.accessLog).toHaveLength(2);
    });

    it('should not fetch when disabled', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useAccessLog({ linkId: 'link-1', enabled: false }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockSupabase.from).not.toHaveBeenCalled();
      expect(result.current.accessLog).toEqual([]);
    });
  });
});
