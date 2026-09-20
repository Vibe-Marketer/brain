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
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
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

describe('useTeamMembers', () => {
  const testTeamId = 'team-123';
  const testUserId = 'user-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('members query', () => {

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

      const mockProfiles = [
        { user_id: testUserId, email: 'admin@test.com', display_name: null },
      ];

      (mockSupabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'team_memberships') {
          return {
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
          };
        }
        if (table === 'user_profiles') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: mockProfiles,
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

      const mockProfiles = [
        { user_id: testUserId, email: 'manager@test.com', display_name: null },
      ];

      (mockSupabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'team_memberships') {
          return {
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
          };
        }
        if (table === 'user_profiles') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: mockProfiles,
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

  describe('acceptInvite mutation', () => {
    it('should throw error for invalid token', async () => {
      (mockSupabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'teams') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Not found' },
                }),
              }),
            }),
          };
        }
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

      // Track how many times from('team_memberships') has been called
      let teamMembershipsCallCount = 0;
      (mockSupabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'team_memberships') {
          teamMembershipsCallCount++;
          if (teamMembershipsCallCount === 1) {
            // Initial hook mount: members list query (.eq().neq().order())
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  neq: vi.fn().mockReturnValue({
                    order: vi.fn().mockResolvedValue({ data: [], error: null }),
                  }),
                }),
              }),
            };
          }
          if (teamMembershipsCallCount === 2) {
            // Mutation: .select("role, team_id").eq("id", membershipId).single()
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: mockMembership,
                    error: null,
                  }),
                }),
              }),
            };
          }
          // Count admins: .select("*", {count}).eq().eq().eq().neq() → count: 0
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    neq: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
                  }),
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

describe('useOrgChart', () => {
  const testTeamId = 'team-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('orgChart query', () => {

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
        if (table === 'user_profiles') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
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
        if (table === 'user_profiles') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
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
