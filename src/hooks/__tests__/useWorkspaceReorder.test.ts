/**
 * Phase 25 Nyquist coverage — drag isolation in useWorkspaceReorder.
 *
 * Verifies:
 *   - handleWorkspaceReorderDragEnd no-ops when active.id is NOT a known workspace UUID
 *     (so recording-row drags fall through to the page-level handler)
 *   - handleWorkspaceReorderDragEnd reorders when active.id IS a known workspace
 *   - normalizes over.id from "workspace-{uuid}" form (when dropping on the WorkspaceDropZone)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';
import type { DragEndEvent } from '@dnd-kit/core';

const updateOrderMutate = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: { id: 'user-A' } })),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('@/hooks/useOrganizationContext', () => ({
  useOrganizationContext: () => ({ activeOrgId: 'org-1' }),
}));

vi.mock('@/hooks/useWorkspaces', () => ({
  useWorkspaces: () => ({
    workspaces: [
      { id: 'ws-1', name: 'Alpha' },
      { id: 'ws-2', name: 'Bravo' },
      { id: 'ws-3', name: 'Charlie' },
    ],
    isLoading: false,
    error: null,
  }),
}));

vi.mock('@/hooks/useWorkspaceMutations', () => ({
  useUpdateWorkspaceOrder: () => ({
    mutate: updateOrderMutate,
    mutateAsync: updateOrderMutate,
    isPending: false,
  }),
}));

import { useWorkspaceReorder } from '../useWorkspaceReorder';

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

function makeDragEndEvent(activeId: string, overId: string | null): DragEndEvent {
  return {
    active: { id: activeId, data: { current: undefined }, rect: { current: { initial: null, translated: null } } },
    over: overId
      ? { id: overId, data: { current: undefined }, rect: {} as DOMRect, disabled: false }
      : null,
    delta: { x: 0, y: 0 },
    activatorEvent: new Event('drag'),
    collisions: null,
  } as unknown as DragEndEvent;
}

describe('useWorkspaceReorder drag isolation', () => {
  beforeEach(() => {
    updateOrderMutate.mockReset();
  });

  it('does NOT trigger a reorder when active.id is a recording (not a workspace UUID)', () => {
    const { result } = renderHook(() => useWorkspaceReorder(), { wrapper: createWrapper() });

    // A recording drag — id is "recording-12345", not in the workspaces array
    act(() => {
      result.current.handleWorkspaceReorderDragEnd(
        makeDragEndEvent('recording-12345', 'workspace-ws-2'),
      );
    });

    expect(updateOrderMutate).not.toHaveBeenCalled();
  });

  it('does NOT trigger a reorder when over is null (drop outside any zone)', () => {
    const { result } = renderHook(() => useWorkspaceReorder(), { wrapper: createWrapper() });

    act(() => {
      result.current.handleWorkspaceReorderDragEnd(makeDragEndEvent('ws-1', null));
    });

    expect(updateOrderMutate).not.toHaveBeenCalled();
  });

  it('triggers a reorder mutation when active and over are both workspace UUIDs', () => {
    const { result } = renderHook(() => useWorkspaceReorder(), { wrapper: createWrapper() });

    // Drag ws-3 onto ws-1 (move Charlie above Alpha)
    act(() => {
      result.current.handleWorkspaceReorderDragEnd(makeDragEndEvent('ws-3', 'ws-1'));
    });

    expect(updateOrderMutate).toHaveBeenCalledTimes(1);
    const arg = updateOrderMutate.mock.calls[0][0];
    expect(arg.orgId).toBe('org-1');
    // Resulting order: [Charlie, Alpha, Bravo]
    expect(arg.pairs).toEqual([
      { workspaceId: 'ws-3', sortOrder: 0 },
      { workspaceId: 'ws-1', sortOrder: 1 },
      { workspaceId: 'ws-2', sortOrder: 2 },
    ]);
  });

  it('normalizes over.id when it has the "workspace-" prefix from WorkspaceDropZone', () => {
    const { result } = renderHook(() => useWorkspaceReorder(), { wrapper: createWrapper() });

    // active is plain UUID ws-2; over comes from a WorkspaceDropZone wrapper id "workspace-ws-1"
    act(() => {
      result.current.handleWorkspaceReorderDragEnd(makeDragEndEvent('ws-2', 'workspace-ws-1'));
    });

    expect(updateOrderMutate).toHaveBeenCalledTimes(1);
    const arg = updateOrderMutate.mock.calls[0][0];
    expect(arg.pairs.map((p: { workspaceId: string }) => p.workspaceId)).toEqual([
      'ws-2',
      'ws-1',
      'ws-3',
    ]);
  });

  it('does NOT trigger a reorder when active.id equals over.id (drop on self)', () => {
    const { result } = renderHook(() => useWorkspaceReorder(), { wrapper: createWrapper() });

    act(() => {
      result.current.handleWorkspaceReorderDragEnd(makeDragEndEvent('ws-2', 'ws-2'));
    });

    expect(updateOrderMutate).not.toHaveBeenCalled();
  });
});
