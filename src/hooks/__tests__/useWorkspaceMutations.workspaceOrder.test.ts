/**
 * Phase 25 Nyquist coverage — WS-03 workspace reorder mutation behavior.
 *
 * Verifies useUpdateWorkspaceOrder:
 *   - persists by writing sort_order on workspace_memberships scoped to the caller's user_id
 *   - looks up membership.id by (user_id, workspace_id) before issuing UPDATE
 *   - applies optimistic reorder to the cached workspaces list immediately
 *   - rolls cached list back to its previous value when the mutation throws
 *
 * The behavioral edges that matter for the gap:
 *   - sort_order writes are scoped per-user (cross-user contamination is structurally impossible)
 *   - optimistic update is observable in the React Query cache, not just promised
 *   - failure rolls back rather than leaving a half-applied order in the cache
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'user-A' },
    session: { user: { id: 'user-A' } },
  })),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// Import after mocks
import { supabase } from '@/integrations/supabase/client';
import { useUpdateWorkspaceOrder } from '../useWorkspaceMutations';
import { queryKeys } from '@/lib/query-config';
import type { WorkspaceWithMeta } from '@/types/workspace';

const mockSupabase = supabase as unknown as {
  from: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
};

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

function makeWorkspace(id: string, name: string): WorkspaceWithMeta {
  return {
    id,
    organization_id: 'org-1',
    name,
    workspace_type: 'team',
    default_sharelink_ttl_days: 7,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    member_count: 1,
    user_role: 'workspace_owner',
  } as WorkspaceWithMeta;
}

describe('useUpdateWorkspaceOrder (WS-03)', () => {
  let queryClient: QueryClient;
  const orgId = 'org-1';

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  it('writes sort_order via workspace_memberships scoped to the caller user_id', async () => {
    // Arrange: stub two-stage flow.
    //   1) SELECT memberships id, workspace_id where user_id = ? .in(workspace_id, [...])
    //   2) UPDATE workspace_memberships SET sort_order = ? WHERE id = ?  (parallel, one per pair)
    const selectChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [
          { id: 'mem-1', workspace_id: 'ws-1' },
          { id: 'mem-2', workspace_id: 'ws-2' },
          { id: 'mem-3', workspace_id: 'ws-3' },
        ],
        error: null,
      }),
    };

    const updateChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    let callCount = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      expect(table).toBe('workspace_memberships');
      callCount += 1;
      if (callCount === 1) return selectChain as any;
      // Subsequent calls are the parallel UPDATEs — return a fresh chain each time
      return {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      } as any;
    });

    const { result } = renderHook(() => useUpdateWorkspaceOrder(), {
      wrapper: createWrapper(queryClient),
    });

    // Act
    await act(async () => {
      await result.current.mutateAsync({
        orgId,
        pairs: [
          { workspaceId: 'ws-2', sortOrder: 0 },
          { workspaceId: 'ws-1', sortOrder: 1 },
          { workspaceId: 'ws-3', sortOrder: 2 },
        ],
      });
    });

    // Assert — SELECT was scoped to user_id = 'user-A'
    expect(selectChain.select).toHaveBeenCalledWith('id, workspace_id');
    expect(selectChain.eq).toHaveBeenCalledWith('user_id', 'user-A');
    expect(selectChain.in).toHaveBeenCalledWith(
      'workspace_id',
      expect.arrayContaining(['ws-1', 'ws-2', 'ws-3']),
    );

    // Assert — at minimum 1 SELECT + 3 UPDATE roundtrips on workspace_memberships
    expect(mockSupabase.from).toHaveBeenCalledWith('workspace_memberships');
    expect(mockSupabase.from.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it('optimistically reorders the cached workspaces list before the request resolves', async () => {
    // Arrange: seed the cache with [ws-1, ws-2, ws-3]
    const listKey = queryKeys.workspaces.list(orgId);
    queryClient.setQueryData<WorkspaceWithMeta[]>(listKey, [
      makeWorkspace('ws-1', 'Alpha'),
      makeWorkspace('ws-2', 'Bravo'),
      makeWorkspace('ws-3', 'Charlie'),
    ]);

    // Stub a never-resolving SELECT so we can observe the optimistic state
    let resolveSelect: (value: any) => void = () => {};
    const pendingSelect = new Promise<any>((res) => {
      resolveSelect = res;
    });
    mockSupabase.from.mockImplementation(
      () =>
        ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnValue(pendingSelect),
          update: vi.fn().mockReturnThis(),
        }) as any,
    );

    const { result } = renderHook(() => useUpdateWorkspaceOrder(), {
      wrapper: createWrapper(queryClient),
    });

    // Act: kick off mutation. Pairs invert order to [ws-3, ws-2, ws-1].
    act(() => {
      result.current.mutate({
        orgId,
        pairs: [
          { workspaceId: 'ws-3', sortOrder: 0 },
          { workspaceId: 'ws-2', sortOrder: 1 },
          { workspaceId: 'ws-1', sortOrder: 2 },
        ],
      });
    });

    // Assert: cache was reordered optimistically
    await waitFor(() => {
      const cached = queryClient.getQueryData<WorkspaceWithMeta[]>(listKey)!;
      expect(cached.map((w) => w.id)).toEqual(['ws-3', 'ws-2', 'ws-1']);
    });

    // Cleanup the pending promise
    resolveSelect({ data: [], error: null });
  });

  it('rolls back the cache to the previous order when the mutation fails', async () => {
    const listKey = queryKeys.workspaces.list(orgId);
    const previous = [
      makeWorkspace('ws-1', 'Alpha'),
      makeWorkspace('ws-2', 'Bravo'),
      makeWorkspace('ws-3', 'Charlie'),
    ];
    queryClient.setQueryData<WorkspaceWithMeta[]>(listKey, previous);

    // SELECT throws → mutationFn rejects → onError rollback runs
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Network down' },
      }),
    } as any);

    const { result } = renderHook(() => useUpdateWorkspaceOrder(), {
      wrapper: createWrapper(queryClient),
    });

    // Act: trigger and let it fail. Stop QueryClient from auto-refetching during invalidation.
    queryClient.setQueryDefaults(listKey, { staleTime: Infinity, queryFn: () => previous });

    await act(async () => {
      await result.current
        .mutateAsync({
          orgId,
          pairs: [
            { workspaceId: 'ws-3', sortOrder: 0 },
            { workspaceId: 'ws-2', sortOrder: 1 },
            { workspaceId: 'ws-1', sortOrder: 2 },
          ],
        })
        .catch(() => {
          /* expected */
        });
    });

    // Assert: cache restored to original order
    const cached = queryClient.getQueryData<WorkspaceWithMeta[]>(listKey)!;
    expect(cached.map((w) => w.id)).toEqual(['ws-1', 'ws-2', 'ws-3']);
  });
});
