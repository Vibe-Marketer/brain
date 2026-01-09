import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useTeamHierarchy,
  useTeamMembers,
  useDirectReports,
  useManagerNotes,
  useTeamShares,
  useOrgChart,
} from '../useTeamHierarchy';
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

describe('useTeamHierarchy', () => {
  const testTeamId = 'team-123';
  const testUserId = 'user-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('team query', () => {
    it('should return null when teamId is not provided', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useTeamHierarchy({ teamId: undefined, userId: testUserId }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.team).toBeNull();
    });

    it('should fetch team details with owner info', async () => {
      const mockTeam = {
        id: testTeamId,
        name: 'Sales Team',
        owner_user_id: 'owner-123',
        admin_sees_all: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockTeam,
              error: null,
            }),
          }),
        }),
      });

      (mockSupabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: 'owner@test.com',
        error: null,
      });

      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useTeamHierarchy({ teamId: testTeamId, userId: testUserId }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.team).not.toBeNull();
      });

      expect(result.current.team?.name).toBe('Sales Team');
      expect(result.current.team?.owner_email).toBe('owner@test.com');
    });
  });

  describe('createTeam mutation', () => {
    it('should throw error when userId is not provided', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useTeamHierarchy({ teamId: undefined, userId: undefined }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(result.current.createTeam({ name: 'New Team' })).rejects.toThrow(
        'User ID is required to create team'
      );
    });

    it('should create team and admin membership', async () => {
      const createdTeam = {
        id: 'new-team-id',
        name: 'New Sales Team',
        owner_user_id: testUserId,
        admin_sees_all: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      (mockSupabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'teams') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: null,
                }),
              }),
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: createdTeam,
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'team_memberships') {
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
        () => useTeamHierarchy({ teamId: undefined, userId: testUserId }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const team = await result.current.createTeam({ name: 'New Sales Team' });

      expect(team.id).toBe('new-team-id');
      expect(team.name).toBe('New Sales Team');
    });
  });

  describe('updateTeam mutation', () => {
    it('should throw error when teamId is not provided', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useTeamHierarchy({ teamId: undefined, userId: testUserId }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(result.current.updateTeam({ name: 'Updated Name' })).rejects.toThrow(
        'Team ID is required to update team'
      );
    });
  });

  describe('deleteTeam mutation', () => {
    it('should throw error when teamId is not provided', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useTeamHierarchy({ teamId: undefined, userId: testUserId }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(result.current.deleteTeam()).rejects.toThrow(
        'Team ID is required to delete team'
      );
    });
  });
});

describe('useTeamMembers', () => {
  const testTeamId = 'team-123';
  const testUserId = 'user-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('members query', () => {
    it('should return empty array when teamId is not provided', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useTeamMembers({ teamId: undefined, userId: testUserId }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.members).toEqual([]);
    });

    it('should fetch team members with user info', async () => {
      const mockMembers = [
        {
          id: 'membership-1',
          team_id: testTeamId,
          user_id: testUserId,
          role: 'admin',
          status: 'active',
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'membership-2',
          team_id: testTeamId,
          user_id: 'other-user',
          role: 'member',
          manager_membership_id: 'membership-1',
          status: 'active',
          created_at: '2024-01-02T00:00:00Z',
        },
      ];

      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            neq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockMembers,
                error: null,
              }),
            }),
          }),
        }),
      });

      (mockSupabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: 'member@test.com',
        error: null,
      });

      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useTeamMembers({ teamId: testTeamId, userId: testUserId }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.members).toHaveLength(2);
      });
    });

    it('should identify current user membership and role', async () => {
      const mockMembers = [
        {
          id: 'membership-1',
          team_id: testTeamId,
          user_id: testUserId,
          role: 'admin',
          status: 'active',
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            neq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockMembers,
                error: null,
              }),
            }),
          }),
        }),
      });

      (mockSupabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: 'admin@test.com',
        error: null,
      });

      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useTeamMembers({ teamId: testTeamId, userId: testUserId }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.currentUserMembership).not.toBeNull();
      });

      expect(result.current.isAdmin).toBe(true);
      expect(result.current.isManager).toBe(true);
    });

    it('should correctly identify manager role', async () => {
      const mockMembers = [
        {
          id: 'membership-1',
          team_id: testTeamId,
          user_id: testUserId,
          role: 'manager',
          status: 'active',
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            neq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockMembers,
                error: null,
              }),
            }),
          }),
        }),
      });

      (mockSupabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: 'manager@test.com',
        error: null,
      });

      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useTeamMembers({ teamId: testTeamId, userId: testUserId }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.currentUserMembership).not.toBeNull();
      });

      expect(result.current.isAdmin).toBe(false);
      expect(result.current.isManager).toBe(true);
    });
  });

  describe('inviteMember mutation', () => {
    it('should throw error when teamId is not provided', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useTeamMembers({ teamId: undefined, userId: testUserId }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(result.current.inviteMember({ email: 'new@test.com' })).rejects.toThrow(
        'Team ID and User ID are required to invite member'
      );
    });
  });

  describe('acceptInvite mutation', () => {
    it('should throw error for invalid token', async () => {
      (mockSupabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'team_memberships') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                neq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: [],
                    error: null,
                  }),
                }),
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
        () => useTeamMembers({ teamId: testTeamId, userId: testUserId }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(result.current.acceptInvite('invalid-token')).rejects.toThrow(
        'Invalid or expired invite'
      );
    });
  });

  describe('removeMember mutation', () => {
    it('should prevent removing last admin', async () => {
      const mockMembership = {
        role: 'admin',
        team_id: testTeamId,
      };

      (mockSupabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'team_memberships') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                neq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: [],
                    error: null,
                  }),
                }),
                single: vi.fn().mockResolvedValue({
                  data: mockMembership,
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
        };
      });

      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useTeamMembers({ teamId: testTeamId, userId: testUserId }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(result.current.removeMember('membership-1')).rejects.toThrow(
        'Cannot remove the last admin'
      );
    });
  });
});

describe('useDirectReports', () => {
  const testUserId = 'manager-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('directReports query', () => {
    it('should return empty arrays when userId is not provided', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useDirectReports({ userId: undefined }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.directReports).toEqual([]);
      expect(result.current.directReportCalls).toEqual([]);
    });

    it('should return empty arrays when user has no memberships', async () => {
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
        () => useDirectReports({ userId: testUserId }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.directReports).toEqual([]);
      expect(result.current.directReportCalls).toEqual([]);
    });
  });
});

describe('useManagerNotes', () => {
  const testUserId = 'manager-123';
  const testCallId = 12345;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('note query', () => {
    it('should return null when callId is null', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useManagerNotes({ callId: null, userId: testUserId }),
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
        manager_user_id: testUserId,
        call_recording_id: testCallId,
        user_id: 'report-user',
        note: 'Great improvement this quarter!',
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
        () => useManagerNotes({ callId: testCallId, userId: testUserId }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.note).not.toBeNull();
      });

      expect(result.current.note?.note).toBe('Great improvement this quarter!');
    });
  });

  describe('saveNote mutation', () => {
    it('should throw error when callId is null', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useManagerNotes({ callId: null, userId: testUserId }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(result.current.saveNote('Test note')).rejects.toThrow(
        'Call ID and User ID are required'
      );
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
        () => useManagerNotes({ callId: testCallId, userId: testUserId }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(result.current.deleteNote()).rejects.toThrow('No note to delete');
    });
  });
});

describe('useTeamShares', () => {
  const testTeamId = 'team-123';
  const testUserId = 'user-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('shares query', () => {
    it('should return empty arrays when teamId is not provided', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useTeamShares({ teamId: undefined, userId: testUserId }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.shares).toEqual([]);
      expect(result.current.sharesWithMe).toEqual([]);
    });

    it('should fetch shares created by user and shared with user', async () => {
      const myShares = [
        {
          id: 'share-1',
          team_id: testTeamId,
          owner_user_id: testUserId,
          recipient_user_id: 'other-user',
          share_type: 'folder',
          folder_id: 'folder-1',
          folders: { name: 'Sales Calls' },
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      const sharesWithMe = [
        {
          id: 'share-2',
          team_id: testTeamId,
          owner_user_id: 'other-user',
          recipient_user_id: testUserId,
          share_type: 'all',
          created_at: '2024-01-02T00:00:00Z',
        },
      ];

      let queryCount = 0;
      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockImplementation(() => {
                queryCount++;
                return Promise.resolve({
                  data: queryCount === 1 ? myShares : sharesWithMe,
                  error: null,
                });
              }),
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
        () => useTeamShares({ teamId: testTeamId, userId: testUserId }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.shares.length + result.current.sharesWithMe.length).toBeGreaterThan(0);
      });
    });
  });

  describe('addShare mutation', () => {
    it('should throw error when teamId is not provided', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useTeamShares({ teamId: undefined, userId: testUserId }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(
        result.current.addShare({
          recipient_user_id: 'other-user',
          share_type: 'all',
        })
      ).rejects.toThrow('Team ID and User ID are required');
    });
  });
});

describe('useOrgChart', () => {
  const testTeamId = 'team-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('orgChart query', () => {
    it('should return null when teamId is not provided', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useOrgChart({ teamId: undefined }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.orgChart).toBeNull();
    });

    it('should build org chart from team members', async () => {
      const mockTeam = {
        id: testTeamId,
        name: 'Engineering Team',
        owner_user_id: 'owner-123',
        admin_sees_all: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      const mockMembers = [
        {
          id: 'membership-1',
          team_id: testTeamId,
          user_id: 'manager-1',
          role: 'manager',
          manager_membership_id: null,
          status: 'active',
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'membership-2',
          team_id: testTeamId,
          user_id: 'member-1',
          role: 'member',
          manager_membership_id: 'membership-1',
          status: 'active',
          created_at: '2024-01-02T00:00:00Z',
        },
        {
          id: 'membership-3',
          team_id: testTeamId,
          user_id: 'member-2',
          role: 'member',
          manager_membership_id: 'membership-1',
          status: 'active',
          created_at: '2024-01-03T00:00:00Z',
        },
      ];

      (mockSupabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'teams') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockTeam,
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'team_memberships') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: mockMembers,
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

      (mockSupabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: 'member@test.com',
        error: null,
      });

      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useOrgChart({ teamId: testTeamId }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.orgChart).not.toBeNull();
      });

      expect(result.current.orgChart?.team.name).toBe('Engineering Team');
      expect(result.current.orgChart?.total_members).toBe(3);
      expect(result.current.orgChart?.root_nodes).toHaveLength(1); // Only the manager is at root
    });

    it('should handle members without managers as root nodes', async () => {
      const mockTeam = {
        id: testTeamId,
        name: 'Flat Team',
        owner_user_id: 'owner-123',
        admin_sees_all: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      const mockMembers = [
        {
          id: 'membership-1',
          team_id: testTeamId,
          user_id: 'member-1',
          role: 'member',
          manager_membership_id: null,
          status: 'active',
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'membership-2',
          team_id: testTeamId,
          user_id: 'member-2',
          role: 'member',
          manager_membership_id: null,
          status: 'active',
          created_at: '2024-01-02T00:00:00Z',
        },
      ];

      (mockSupabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'teams') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockTeam,
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'team_memberships') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: mockMembers,
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

      (mockSupabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: 'member@test.com',
        error: null,
      });

      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useOrgChart({ teamId: testTeamId }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.orgChart).not.toBeNull();
      });

      expect(result.current.orgChart?.root_nodes).toHaveLength(2); // Both members are at root
    });
  });
});
