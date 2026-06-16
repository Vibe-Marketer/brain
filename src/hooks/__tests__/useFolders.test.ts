import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';

// Mock dependencies before imports
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'test-user-id' },
    session: { user: { id: 'test-user-id' } },
  })),
}));

vi.mock('@/stores/orgContextStore', () => ({
  useOrgContextStore: vi.fn((selector: (s: any) => any) =>
    selector({ activeWorkspaceId: 'ws-1' })
  ),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

// Import after mocking
import { supabase } from '@/integrations/supabase/client';
import { useFolderAssignments, useFolders } from '../useFolders';

const mockSupabase = supabase as unknown as {
  from: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
};

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

describe('useFolders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return folders for a valid workspaceId', async () => {
    const mockFolders = [
      { id: 'f-1', name: 'Work', user_id: 'u1', organization_id: 'org-1', workspace_id: 'ws-1', parent_id: null, description: null, color: '#000', icon: null, visibility: null, position: 0, is_archived: false, archived_at: null, created_at: '2024-01-01', updated_at: '2024-01-01' },
      { id: 'f-2', name: 'Personal', user_id: 'u1', organization_id: 'org-1', workspace_id: 'ws-1', parent_id: null, description: null, color: '#111', icon: null, visibility: null, position: 1, is_archived: false, archived_at: null, created_at: '2024-01-01', updated_at: '2024-01-01' },
    ];

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockFolders, error: null }),
          }),
        }),
      }),
    });

    const { result } = renderHook(() => useFolders('ws-1'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0].name).toBe('Work');
    expect(result.current.data![1].name).toBe('Personal');
  });

  it('should not fetch when workspaceId is null', async () => {
    const { result } = renderHook(() => useFolders(null), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Query should be disabled
    expect(result.current.data).toBeUndefined();
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });
});

describe('useFolderAssignments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return folder->recording mappings for a workspace', async () => {
    // Mock folders query
    const folderIdsData = [{ id: 'f-1' }, { id: 'f-2' }];
    const assignmentsData = [
      { call_recording_id: 101, folder_id: 'f-1' },
      { call_recording_id: 102, folder_id: 'f-1' },
      { call_recording_id: 103, folder_id: 'f-2' },
    ];

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'folders') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: folderIdsData, error: null }),
          }),
        };
      }
      if (table === 'folder_assignments') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: assignmentsData, error: null }),
          }),
        };
      }
      return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
    });

    const { result } = renderHook(
      () => useFolderAssignments('ws-1'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const data = result.current.data!;
    expect(data['101']).toEqual(['f-1']);
    expect(data['102']).toEqual(['f-1']);
    expect(data['103']).toEqual(['f-2']);
  });

  it('should return correct folder counts from assignments', async () => {
    const folderIdsData = [{ id: 'f-1' }, { id: 'f-2' }];
    const assignmentsData = [
      { call_recording_id: 101, folder_id: 'f-1' },
      { call_recording_id: 102, folder_id: 'f-1' },
      { call_recording_id: 103, folder_id: 'f-1' },
      { call_recording_id: 104, folder_id: 'f-2' },
    ];

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'folders') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: folderIdsData, error: null }),
          }),
        };
      }
      if (table === 'folder_assignments') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: assignmentsData, error: null }),
          }),
        };
      }
      return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
    });

    const { result } = renderHook(
      () => useFolderAssignments('ws-1'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const data = result.current.data!;
    // Count how many recordings are in f-1
    const f1Recordings = Object.entries(data).filter(([, folders]) =>
      folders.includes('f-1')
    );
    expect(f1Recordings).toHaveLength(3);

    // Count how many recordings are in f-2
    const f2Recordings = Object.entries(data).filter(([, folders]) =>
      folders.includes('f-2')
    );
    expect(f2Recordings).toHaveLength(1);
  });

  it('should return empty object when workspaceId is null', async () => {
    const { result } = renderHook(
      () => useFolderAssignments(null),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBeUndefined();
  });

  it('should support organizationId-based scoping', async () => {
    const folderIdsData = [{ id: 'f-org-1' }];
    const assignmentsData = [
      { call_recording_id: 201, folder_id: 'f-org-1' },
    ];

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'folders') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: folderIdsData, error: null }),
          }),
        };
      }
      if (table === 'folder_assignments') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: assignmentsData, error: null }),
          }),
        };
      }
      return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
    });

    const { result } = renderHook(
      () => useFolderAssignments(null, 'org-1'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const data = result.current.data!;
    expect(data['201']).toEqual(['f-org-1']);
  });

  it('should share one query when workspaceId matches and organizationId differs', async () => {
    const folderIdsData = [{ id: 'f-1' }];
    const assignmentsData = [
      { call_recording_id: 101, folder_id: 'f-1' },
    ];

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'folders') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: folderIdsData, error: null }),
          }),
        };
      }
      if (table === 'folder_assignments') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: assignmentsData, error: null }),
          }),
        };
      }
      return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
    });

    const wrapper = createWrapper();
    const { result } = renderHook(
      () => ({
        workspaceOnly: useFolderAssignments('ws-1'),
        workspaceWithOrg: useFolderAssignments('ws-1', 'org-1'),
      }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.workspaceOnly.isLoading).toBe(false);
      expect(result.current.workspaceWithOrg.isLoading).toBe(false);
    });

    expect(result.current.workspaceOnly.data).toEqual({ '101': ['f-1'] });
    expect(result.current.workspaceWithOrg.data).toEqual({ '101': ['f-1'] });
    expect(mockSupabase.from).toHaveBeenCalledTimes(2);
    expect(mockSupabase.from).toHaveBeenCalledWith('folders');
    expect(mockSupabase.from).toHaveBeenCalledWith('folder_assignments');
  });
});
