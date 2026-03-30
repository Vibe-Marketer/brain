import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

// Import after mocking
import { supabase } from '@/integrations/supabase/client';
import { useBulkApplyRules } from '../useBulkApplyRules';
import { toast } from 'sonner';

const mockInvoke = supabase.functions.invoke as ReturnType<typeof vi.fn>;

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

describe('useBulkApplyRules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call supabase.functions.invoke with correct params', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        processed: 10,
        matched: 3,
        assigned: 3,
        skipped: 0,
        dryRun: false,
        details: [],
      },
      error: null,
    });

    const { result } = renderHook(() => useBulkApplyRules(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        organizationId: 'org-123',
        dryRun: false,
      });
    });

    expect(mockInvoke).toHaveBeenCalledWith('apply-routing-rules', {
      body: {
        organization_id: 'org-123',
        dry_run: false,
      },
    });
  });

  it('should pass dry_run=true when dryRun option is set', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        processed: 5,
        matched: 2,
        assigned: 0,
        skipped: 0,
        dryRun: true,
        details: [
          {
            recordingId: 'rec-1',
            title: 'Sales Call',
            matchedRuleId: 'rule-1',
            matchedRuleName: 'Sales Rule',
            workspaceId: 'ws-1',
            folderId: null,
            action: 'assigned',
          },
        ],
      },
      error: null,
    });

    const { result } = renderHook(() => useBulkApplyRules(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        organizationId: 'org-123',
        dryRun: true,
      });
    });

    expect(mockInvoke).toHaveBeenCalledWith('apply-routing-rules', {
      body: {
        organization_id: 'org-123',
        dry_run: true,
      },
    });
  });

  it('should handle success response correctly', async () => {
    const successData = {
      processed: 10,
      matched: 3,
      assigned: 3,
      skipped: 0,
      dryRun: false,
      details: [],
    };

    mockInvoke.mockResolvedValue({ data: successData, error: null });

    const { result } = renderHook(() => useBulkApplyRules(), {
      wrapper: createWrapper(),
    });

    let response: any;
    await act(async () => {
      response = await result.current.mutateAsync({
        organizationId: 'org-123',
      });
    });

    expect(response.assigned).toBe(3);
    expect(response.processed).toBe(10);
  });

  it('should throw on non-2xx error (network/function error)', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: new Error('non-2xx'),
    });

    const { result } = renderHook(() => useBulkApplyRules(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({ organizationId: 'org-123' });
      } catch (e: any) {
        expect(e.message).toBe(
          'Routing rules apply failed — check function logs'
        );
      }
    });
  });

  it('should throw on data.error response', async () => {
    mockInvoke.mockResolvedValue({
      data: { error: 'Organization not found' },
      error: null,
    });

    const { result } = renderHook(() => useBulkApplyRules(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({ organizationId: 'bad-org' });
      } catch (e: any) {
        expect(e.message).toBe('Organization not found');
      }
    });
  });

  it('should default dry_run to false when not specified', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        processed: 0,
        matched: 0,
        assigned: 0,
        skipped: 0,
        dryRun: false,
        details: [],
      },
      error: null,
    });

    const { result } = renderHook(() => useBulkApplyRules(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({ organizationId: 'org-123' });
    });

    expect(mockInvoke).toHaveBeenCalledWith('apply-routing-rules', {
      body: {
        organization_id: 'org-123',
        dry_run: false,
      },
    });
  });

  it('should show success toast for dry run with matches', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        processed: 10,
        matched: 3,
        assigned: 0,
        skipped: 0,
        dryRun: true,
        details: [
          { matchedRuleName: 'Rule A', recordingId: 'r1', title: 'T', matchedRuleId: 'x', workspaceId: 'w', folderId: null, action: 'assigned' },
          { matchedRuleName: 'Rule A', recordingId: 'r2', title: 'T', matchedRuleId: 'x', workspaceId: 'w', folderId: null, action: 'assigned' },
          { matchedRuleName: 'Rule B', recordingId: 'r3', title: 'T', matchedRuleId: 'y', workspaceId: 'w', folderId: null, action: 'assigned' },
        ],
      },
      error: null,
    });

    const { result } = renderHook(() => useBulkApplyRules(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({ organizationId: 'org-123', dryRun: true });
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining('3 calls would be routed')
      );
    });
  });

  it('should show error toast on failure', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: new Error('Server error'),
    });

    const { result } = renderHook(() => useBulkApplyRules(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({ organizationId: 'org-123' });
      } catch {
        // expected
      }
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Bulk apply failed')
      );
    });
  });
});
