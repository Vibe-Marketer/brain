import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => {
  const mockSupabase = {
    auth: { getSession: vi.fn() },
    functions: { invoke: vi.fn() },
  };
  return { supabase: mockSupabase };
});

// Mock useSubscription
vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => ({
    tier: 'pro' as const,
    aiActionsLimit: 1000,
    isLoading: false,
  }),
}));

// Mock useOrgContext
const mockActiveOrgId = vi.fn(() => 'org-abc-123');
vi.mock('@/hooks/useOrgContext', () => ({
  useOrgContext: () => ({
    activeOrgId: mockActiveOrgId(),
    activeOrg: null,
    organizations: [],
    activeWorkspaceId: null,
    activeFolderId: null,
    isPersonalOrg: false,
    isReady: true,
    switchOrg: vi.fn(),
    switchWorkspace: vi.fn(),
    switchFolder: vi.fn(),
  }),
}));

// Import after mocking
import { supabase } from '@/integrations/supabase/client';
import { useAiGate } from '../useAiGate';

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

describe('useAiGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActiveOrgId.mockReturnValue('org-abc-123');
  });

  function mockSession(token = 'test-token') {
    (supabase.auth.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { session: { access_token: token } },
    });
  }

  function mockInvokeSuccess(data = { success: true, usage: 1, limit: 1000, remaining: 999 }) {
    (supabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValue({
      data,
      error: null,
    });
  }

  it('should auto-inject activeOrgId when no orgId provided', async () => {
    mockSession();
    mockInvokeSuccess();

    const { result } = renderHook(() => useAiGate(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.trackAction('summarize_call', { recordingId: 'rec-1' });
    });

    expect(supabase.functions.invoke).toHaveBeenCalledWith('track-ai-usage', {
      headers: { Authorization: 'Bearer test-token' },
      body: {
        actionType: 'summarize_call',
        recordingId: 'rec-1',
        orgId: 'org-abc-123',
      },
    });
  });

  it('should prefer explicit orgId over activeOrgId', async () => {
    mockSession();
    mockInvokeSuccess();

    const { result } = renderHook(() => useAiGate(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.trackAction('auto_tag', { orgId: 'explicit-org' });
    });

    expect(supabase.functions.invoke).toHaveBeenCalledWith('track-ai-usage', expect.objectContaining({
      body: expect.objectContaining({ orgId: 'explicit-org' }),
    }));
  });

  it('should send undefined orgId when activeOrgId is undefined and no explicit orgId', async () => {
    mockActiveOrgId.mockReturnValue(undefined);
    mockSession();
    mockInvokeSuccess();

    const { result } = renderHook(() => useAiGate(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.trackAction('chat_message');
    });

    expect(supabase.functions.invoke).toHaveBeenCalledWith('track-ai-usage', expect.objectContaining({
      body: expect.objectContaining({ orgId: undefined }),
    }));
  });

  it('should return allowed: true on success', async () => {
    mockSession();
    mockInvokeSuccess({ success: true, usage: 5, limit: 1000, remaining: 995 });

    const { result } = renderHook(() => useAiGate(), { wrapper: createWrapper() });

    let trackResult: Awaited<ReturnType<typeof result.current.trackAction>>;
    await act(async () => {
      trackResult = await result.current.trackAction('summarize_call');
    });

    expect(trackResult!.allowed).toBe(true);
    expect(trackResult!.usage).toBe(5);
    expect(trackResult!.remaining).toBe(995);
  });

  it('should fail open when no session exists', async () => {
    (supabase.auth.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { session: null },
    });

    const { result } = renderHook(() => useAiGate(), { wrapper: createWrapper() });

    let trackResult: Awaited<ReturnType<typeof result.current.trackAction>>;
    await act(async () => {
      trackResult = await result.current.trackAction('summarize_call');
    });

    expect(trackResult!.allowed).toBe(true);
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });

  it('should return allowed: false on 429 limit-reached', async () => {
    mockSession();

    const mockContext = {
      status: 429,
      json: vi.fn().mockResolvedValue({
        error: 'Monthly AI action limit reached',
        usage: 1000,
        limit: 1000,
        tier: 'pro',
      }),
    };

    (supabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: null,
      error: { context: mockContext },
    });

    const { result } = renderHook(() => useAiGate(), { wrapper: createWrapper() });

    let trackResult: Awaited<ReturnType<typeof result.current.trackAction>>;
    await act(async () => {
      trackResult = await result.current.trackAction('summarize_call');
    });

    expect(trackResult!.allowed).toBe(false);
    expect(trackResult!.usage).toBe(1000);
    expect(trackResult!.remaining).toBe(0);
  });

  it('should fail open on non-429 errors', async () => {
    mockSession();

    (supabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: null,
      error: { message: 'Internal server error' },
    });

    const { result } = renderHook(() => useAiGate(), { wrapper: createWrapper() });

    let trackResult: Awaited<ReturnType<typeof result.current.trackAction>>;
    await act(async () => {
      trackResult = await result.current.trackAction('summarize_call');
    });

    expect(trackResult!.allowed).toBe(true);
  });
});
