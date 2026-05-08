/**
 * Tests for useSetMcpTokenCategories
 *
 * Phase 23 gap coverage:
 *   - Optimistic update patches the cache immediately
 *   - onError rollback restores prior cache state
 *   - Sonner toast.error fired on failure (not toast.success on success)
 *   - onSettled invalidates the token list query
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';

vi.mock('@/services/mcp-token-capabilities.service', () => ({
  setEnabledCategories: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import { setEnabledCategories } from '@/services/mcp-token-capabilities.service';
import { toast } from 'sonner';
import { useSetMcpTokenCategories } from '../useMcpTokenCapabilities';
import type { McpToken } from '@/services/mcp-tokens.service';

const tokenA: McpToken = {
  id: 'tok-a',
  user_id: 'u-1',
  org_id: 'org-1',
  workspace_id: null,
  name: 'A',
  token: 'aaa',
  scope: 'organization',
  last_used_at: null,
  created_at: '2026-01-01',
  enabled_categories: null,
};
const tokenB: McpToken = { ...tokenA, id: 'tok-b', name: 'B' };

function buildWrapper() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  qc.setQueryData<McpToken[]>(['mcp-tokens', 'list'], [tokenA, tokenB]);
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
  return { qc, wrapper };
}

describe('useSetMcpTokenCategories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('optimistically patches the cache before the server call resolves', async () => {
    const { qc, wrapper } = buildWrapper();

    // Block resolution so we can observe the optimistic state.
    let resolveServer: (value: McpToken) => void = () => {};
    const serverPromise = new Promise<McpToken>((res) => {
      resolveServer = res;
    });
    vi.mocked(setEnabledCategories).mockReturnValue(serverPromise);

    const { result } = renderHook(() => useSetMcpTokenCategories(), { wrapper });

    result.current.mutate({ tokenId: 'tok-a', value: ['read'] });

    // Wait for onMutate to apply.
    await waitFor(() => {
      const cache = qc.getQueryData<McpToken[]>(['mcp-tokens', 'list'])!;
      const a = cache.find((t) => t.id === 'tok-a')!;
      expect(a.enabled_categories).toEqual(['read']);
    });

    // tokenB should be untouched.
    const cacheNow = qc.getQueryData<McpToken[]>(['mcp-tokens', 'list'])!;
    const b = cacheNow.find((t) => t.id === 'tok-b')!;
    expect(b.enabled_categories).toBeNull();

    // Resolve the server call so the test doesn't hang.
    resolveServer({ ...tokenA, enabled_categories: ['read'] });
    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
  });

  it('rolls back the cache on server error', async () => {
    const { qc, wrapper } = buildWrapper();

    vi.mocked(setEnabledCategories).mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useSetMcpTokenCategories(), { wrapper });
    result.current.mutate({ tokenId: 'tok-a', value: ['read'] });

    // Wait until mutation has settled.
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // Cache value for tokenA should be restored to its pre-mutation state.
    const cache = qc.getQueryData<McpToken[]>(['mcp-tokens', 'list'])!;
    const a = cache.find((t) => t.id === 'tok-a')!;
    expect(a.enabled_categories).toBeNull();
  });

  it('fires Sonner toast.error on failure', async () => {
    const { wrapper } = buildWrapper();

    vi.mocked(setEnabledCategories).mockRejectedValue(new Error('write failed'));

    const { result } = renderHook(() => useSetMcpTokenCategories(), { wrapper });
    result.current.mutate({ tokenId: 'tok-a', value: ['read'] });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(vi.mocked(toast.error).mock.calls[0][0]).toMatch(/Failed to save permissions/);
    expect(vi.mocked(toast.error).mock.calls[0][0]).toMatch(/write failed/);
  });

  it('does NOT fire toast.success on a successful save (success is implicit)', async () => {
    const { wrapper } = buildWrapper();

    vi.mocked(setEnabledCategories).mockResolvedValue({
      ...tokenA,
      enabled_categories: ['read'],
    });

    const { result } = renderHook(() => useSetMcpTokenCategories(), { wrapper });
    result.current.mutate({ tokenId: 'tok-a', value: ['read'] });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(toast.success).not.toHaveBeenCalled();
  });

  it('invalidates the mcp-tokens query after settle', async () => {
    const { qc, wrapper } = buildWrapper();

    vi.mocked(setEnabledCategories).mockResolvedValue({
      ...tokenA,
      enabled_categories: ['read'],
    });

    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useSetMcpTokenCategories(), { wrapper });
    result.current.mutate({ tokenId: 'tok-a', value: ['read'] });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateSpy).toHaveBeenCalled();
    const calledKeys = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey);
    const sawMcpTokens = calledKeys.some(
      (k) => Array.isArray(k) && k[0] === 'mcp-tokens',
    );
    expect(sawMcpTokens).toBe(true);
  });

  it('also invalidates after error path (defense-in-depth resync)', async () => {
    const { qc, wrapper } = buildWrapper();

    vi.mocked(setEnabledCategories).mockRejectedValue(new Error('boom'));

    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useSetMcpTokenCategories(), { wrapper });
    result.current.mutate({ tokenId: 'tok-a', value: ['read'] });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(invalidateSpy).toHaveBeenCalled();
  });
});
