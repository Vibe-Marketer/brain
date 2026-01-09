import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useCoachRelationships,
  useCoachShares,
  useCoachees,
  useSharedCalls,
  useCoachNotes,
} from '../useCoachRelationships';
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

describe('useCoachRelationships', () => {
  const testUserId = 'test-user-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('relationships query', () => {
    it('should return empty arrays when no relationships exist', async () => {
      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          or: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      });

      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useCoachRelationships({ userId: testUserId }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.relationships).toEqual([]);
      expect(result.current.asCoach).toEqual([]);
      expect(result.current.asCoachee).toEqual([]);
    });

    it('should fetch and categorize relationships by role', async () => {
      const mockRelationships = [
        {
          id: 'rel-1',
          coach_user_id: testUserId,
          coachee_user_id: 'other-user-1',
          status: 'active',
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'rel-2',
          coach_user_id: 'other-user-2',
          coachee_user_id: testUserId,
          status: 'active',
          created_at: '2024-01-02T00:00:00Z',
        },
      ];

      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          or: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockRelationships,
              error: null,
            }),
          }),
        }),
      });

      (mockSupabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: 'test@test.com',
        error: null,
      });

      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useCoachRelationships({ userId: testUserId }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.relationships).toHaveLength(2);
      });

      expect(result.current.asCoach).toHaveLength(1);
      expect(result.current.asCoach[0].id).toBe('rel-1');
      expect(result.current.asCoachee).toHaveLength(1);
      expect(result.current.asCoachee[0].id).toBe('rel-2');
    });

    it('should not fetch when userId is not provided', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useCoachRelationships({ userId: undefined }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.relationships).toEqual([]);
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('should not fetch when disabled', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useCoachRelationships({ userId: testUserId, enabled: false }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockSupabase.from).not.toHaveBeenCalled();
    });
  });

  describe('inviteCoach mutation', () => {
    it('should throw error when userId is not provided', async () => {
      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          or: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      });

      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useCoachRelationships({ userId: undefined }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(result.current.inviteCoach('coach@test.com')).rejects.toThrow(
        'User ID is required to invite coach'
      );
    });
  });

  describe('inviteCoachee mutation', () => {
    it('should generate invite link successfully', async () => {
      const mockRelationship = {
        id: 'new-rel-id',
        coach_user_id: testUserId,
        coachee_user_id: testUserId,
        status: 'pending',
        invited_by: 'coach',
        invite_token: 'generated-token',
      };

      (mockSupabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'coach_relationships') {
          return {
            select: vi.fn().mockReturnValue({
              or: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockRelationship,
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      });

      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useCoachRelationships({ userId: testUserId }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const inviteResult = await result.current.inviteCoachee();

      expect(inviteResult.invite_token).toBeDefined();
      expect(inviteResult.invite_url).toContain('/coach-invite/');
    });
  });

  describe('acceptInvite mutation', () => {
    it('should throw error for invalid token', async () => {
      (mockSupabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'coach_relationships') {
          return {
            select: vi.fn().mockReturnValue({
              or: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'Not found' },
                  }),
                }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      });

      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useCoachRelationships({ userId: testUserId }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(result.current.acceptInvite('invalid-token')).rejects.toThrow(
        'Invalid or expired invite'
      );
    });

    it('should throw error for expired invite', async () => {
      const expiredRelationship = {
        id: 'rel-1',
        coach_user_id: 'coach-id',
        coachee_user_id: 'placeholder',
        status: 'pending',
        invited_by: 'coach',
        invite_expires_at: '2020-01-01T00:00:00Z', // Expired date
      };

      (mockSupabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'coach_relationships') {
          return {
            select: vi.fn().mockReturnValue({
              or: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: expiredRelationship,
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      });

      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useCoachRelationships({ userId: testUserId }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(result.current.acceptInvite('expired-token')).rejects.toThrow(
        'This invite has expired'
      );
    });
  });

  describe('endRelationship mutation', () => {
    it('should end relationship successfully', async () => {
      (mockSupabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'coach_relationships') {
          return {
            select: vi.fn().mockReturnValue({
              or: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [],
                  error: null,
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
          select: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      });

      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useCoachRelationships({ userId: testUserId }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(result.current.endRelationship('rel-1')).resolves.toBeUndefined();
    });
  });
});

describe('useCoachShares', () => {
  const testRelationshipId = 'rel-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('shares query', () => {
    it('should return empty array when relationshipId is null', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useCoachShares({ relationshipId: null }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.shares).toEqual([]);
    });

    it('should fetch shares for a relationship', async () => {
      const mockShares = [
        {
          id: 'share-1',
          relationship_id: testRelationshipId,
          share_type: 'folder',
          folder_id: 'folder-1',
          folders: { name: 'Sales Calls' },
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'share-2',
          relationship_id: testRelationshipId,
          share_type: 'all',
          created_at: '2024-01-02T00:00:00Z',
        },
      ];

      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockShares,
              error: null,
            }),
          }),
        }),
      });

      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useCoachShares({ relationshipId: testRelationshipId }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.shares).toHaveLength(2);
      });

      expect(result.current.shares[0].folder_name).toBe('Sales Calls');
    });
  });

  describe('addShare mutation', () => {
    it('should throw error when relationshipId is null', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useCoachShares({ relationshipId: null }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(
        result.current.addShare({ share_type: 'all' })
      ).rejects.toThrow('Relationship ID is required');
    });

    it('should add share successfully', async () => {
      const newShare = {
        id: 'new-share-id',
        relationship_id: testRelationshipId,
        share_type: 'folder',
        folder_id: 'folder-1',
        created_at: '2024-01-01T00:00:00Z',
      };

      (mockSupabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'coach_shares') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: newShare,
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      });

      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useCoachShares({ relationshipId: testRelationshipId }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const share = await result.current.addShare({
        share_type: 'folder',
        folder_id: 'folder-1',
      });

      expect(share.id).toBe('new-share-id');
    });
  });

  describe('removeShare mutation', () => {
    it('should remove share successfully', async () => {
      (mockSupabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'coach_shares') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      });

      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useCoachShares({ relationshipId: testRelationshipId }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(result.current.removeShare('share-1')).resolves.toBeUndefined();
    });
  });
});

describe('useCoachees', () => {
  const testUserId = 'coach-user-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('coachees query', () => {
    it('should return empty array when userId is not provided', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useCoachees({ userId: undefined }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.coachees).toEqual([]);
    });

    it('should fetch coachees with call counts', async () => {
      const mockRelationships = [
        {
          id: 'rel-1',
          coach_user_id: testUserId,
          coachee_user_id: 'coachee-1',
          status: 'active',
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      (mockSupabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'coach_relationships') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: mockRelationships,
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'fathom_calls') {
          return {
            select: vi.fn().mockResolvedValue({
              count: 5,
              error: null,
            }),
          };
        }
        return {
          select: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      });

      (mockSupabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: 'coachee@test.com',
        error: null,
      });

      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useCoachees({ userId: testUserId }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.coachees).toHaveLength(1);
      });

      expect(result.current.coachees[0].relationship.coachee_email).toBe('coachee@test.com');
    });
  });
});

describe('useSharedCalls', () => {
  const testUserId = 'coach-user-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sharedCalls query', () => {
    it('should return empty array when userId is not provided', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useSharedCalls({ userId: undefined }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.sharedCalls).toEqual([]);
    });

    it('should return empty array when no active relationships', async () => {
      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      });

      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useSharedCalls({ userId: testUserId }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.sharedCalls).toEqual([]);
    });
  });
});

describe('useCoachNotes', () => {
  const testUserId = 'coach-user-123';
  const testCallId = 12345;
  const testRelationshipId = 'rel-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('note query', () => {
    it('should return null when callId is null', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useCoachNotes({
          callId: null,
          relationshipId: testRelationshipId,
          userId: testUserId,
        }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.note).toBeNull();
    });

    it('should fetch existing note', async () => {
      const mockNote = {
        id: 'note-1',
        relationship_id: testRelationshipId,
        call_recording_id: testCallId,
        user_id: 'coachee-user',
        note: 'Great progress on objection handling!',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: mockNote,
                error: null,
              }),
            }),
          }),
        }),
      });

      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useCoachNotes({
          callId: testCallId,
          relationshipId: testRelationshipId,
          userId: testUserId,
        }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.note).not.toBeNull();
      });

      expect(result.current.note?.note).toBe('Great progress on objection handling!');
    });
  });

  describe('saveNote mutation', () => {
    it('should throw error when required params are missing', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useCoachNotes({
          callId: null,
          relationshipId: testRelationshipId,
          userId: testUserId,
        }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(result.current.saveNote('Test note')).rejects.toThrow(
        'Call ID, Relationship ID, and User ID are required'
      );
    });

    it('should create new note when none exists', async () => {
      const mockRelationship = {
        coachee_user_id: 'coachee-123',
      };

      const newNote = {
        id: 'new-note-id',
        relationship_id: testRelationshipId,
        call_recording_id: testCallId,
        user_id: 'coachee-123',
        note: 'New coaching note',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      (mockSupabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'coach_notes') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: null,
                    error: null,
                  }),
                }),
              }),
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: newNote,
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'coach_relationships') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockRelationship,
                  error: null,
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
        () => useCoachNotes({
          callId: testCallId,
          relationshipId: testRelationshipId,
          userId: testUserId,
        }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const note = await result.current.saveNote('New coaching note');

      expect(note.id).toBe('new-note-id');
      expect(note.note).toBe('New coaching note');
    });
  });

  describe('deleteNote mutation', () => {
    it('should throw error when no note exists', async () => {
      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          }),
        }),
      });

      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useCoachNotes({
          callId: testCallId,
          relationshipId: testRelationshipId,
          userId: testUserId,
        }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(result.current.deleteNote()).rejects.toThrow('No note to delete');
    });
  });
});
