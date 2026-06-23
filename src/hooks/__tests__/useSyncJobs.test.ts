import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks — a fake supabase client with a chainable `from('sync_jobs').select()`
// query and a `channel().on().subscribe()` chain that captures the status
// callback so we can drive the Realtime lifecycle from the test.
// Shared mutable state + spies live in vi.hoisted so the hoisted vi.mock
// factory can reference them without a TDZ error.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => {
  return {
    // Seeded rows the poll/initial-fetch query resolves to.
    seededRows: [] as Array<Record<string, unknown>>,
    // Captured Realtime callbacks.
    capturedStatusCb: null as ((status: string) => void) | null,
    capturedChangeHandler: null as ((payload: unknown) => void) | null,
    removeChannelSpy: vi.fn(),
    subscribeSpy: vi.fn(),
    onSpy: vi.fn(),
    channelSpy: vi.fn(),
    fromSpy: vi.fn(),
  };
});

vi.mock('@/integrations/supabase/client', () => {
  // Build a thenable query chain resolving to { data, error }.
  const makeQueryChain = () => {
    const resolved = () =>
      Promise.resolve({ data: h.seededRows, error: null });
    const chain: Record<string, unknown> = {};
    const passthrough = () => chain;
    for (const m of ['select', 'eq', 'in', 'gte', 'lte', 'order', 'limit']) {
      chain[m] = vi.fn(passthrough);
    }
    (chain as { then: unknown }).then = (
      onFulfilled: (v: { data: unknown; error: unknown }) => unknown,
    ) => resolved().then(onFulfilled);
    return chain;
  };

  const mockSupabase = {
    from: (...args: unknown[]) => {
      h.fromSpy(...args);
      return makeQueryChain();
    },
    channel: (...args: unknown[]) => {
      h.channelSpy(...args);
      const channelObj = {
        on: (...onArgs: unknown[]) => {
          h.onSpy(...onArgs);
          h.capturedChangeHandler = onArgs[2] as (payload: unknown) => void;
          return channelObj;
        },
        subscribe: (cb: (status: string) => void) => {
          h.subscribeSpy(cb);
          h.capturedStatusCb = cb;
          return channelObj;
        },
      };
      return channelObj;
    },
    removeChannel: h.removeChannelSpy,
  };
  return { supabase: mockSupabase };
});

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const TEST_USER_ID = 'user-uuid-1';
vi.mock('@/lib/auth-utils', () => ({
  getSafeUser: vi.fn(async () => ({ user: { id: TEST_USER_ID }, error: null })),
}));

const TEST_ORG_ID = 'org-uuid-1';
vi.mock('@/hooks/useOrganizationContext', () => ({
  useOrganizationContext: () => ({ activeOrgId: TEST_ORG_ID }),
}));

// Import AFTER mocks are registered.
import { useSyncJobs, type SyncJob } from '@/hooks/useSyncJobs';

function row(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'job-1',
    user_id: TEST_USER_ID,
    status: 'processing',
    type: 'sync',
    created_at: '2026-06-23T00:00:00Z',
    updated_at: '2026-06-23T00:00:00Z',
    started_at: null,
    completed_at: null,
    error: null,
    recording_ids: ['143800259', 'zoom-uuid-abc'],
    synced_ids: null,
    failed_ids: null,
    progress_current: 0,
    progress_total: 2,
    skipped_count: 0,
    source_app: 'fathom',
    organization_id: TEST_ORG_ID,
    workspace_id: null,
    source_id: null,
    mode: null,
    date_start: null,
    date_end: null,
    provider_cursor: null,
    last_heartbeat_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.seededRows = [];
  h.capturedStatusCb = null;
  h.capturedChangeHandler = null;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useSyncJobs', () => {
  it('only surfaces rows whose source_app matches the hook arg', async () => {
    h.seededRows = [
      row({ id: 'fathom-job', source_app: 'fathom' }),
      row({ id: 'zoom-job', source_app: 'zoom' }),
    ];

    const { result } = renderHook(() =>
      useSyncJobs({ sourceApp: 'fathom', organizationId: TEST_ORG_ID }),
    );

    await waitFor(() => {
      expect(result.current.activeJobs.length).toBe(1);
    });
    expect(result.current.activeJobs[0].id).toBe('fathom-job');
    expect(
      result.current.activeJobs.some((j) => j.source_app === 'zoom'),
    ).toBe(false);
  });

  it('passes string ids through untouched (no numeric coercion)', async () => {
    h.seededRows = [
      row({
        id: 'job-strings',
        status: 'completed',
        synced_ids: ['143800259', 'zoom-uuid-abc'],
        failed_ids: ['fireflies-uuid-xyz'],
        recording_ids: ['143800259', 'zoom-uuid-abc', 'fireflies-uuid-xyz'],
      }),
    ];

    const { result } = renderHook(() =>
      useSyncJobs({ sourceApp: 'fathom', organizationId: TEST_ORG_ID }),
    );

    await waitFor(() => {
      expect(result.current.terminalJobs.length).toBe(1);
    });
    const job: SyncJob = result.current.terminalJobs[0];
    expect(job.synced_ids).toEqual(['143800259', 'zoom-uuid-abc']);
    expect(job.failed_ids).toEqual(['fireflies-uuid-xyz']);
    // Strings stay strings — not parsed to numbers.
    expect(job.synced_ids?.every((id) => typeof id === 'string')).toBe(true);
    expect(job.recording_ids?.includes('zoom-uuid-abc')).toBe(true);
  });

  it('keeps failed / completed_with_errors jobs in terminalJobs and never auto-dismisses them after 8s', async () => {
    vi.useFakeTimers();
    h.seededRows = [
      row({ id: 'failed-job', status: 'failed', error: 'boom' }),
      row({ id: 'partial-job', status: 'completed_with_errors' }),
    ];

    const { result } = renderHook(() =>
      useSyncJobs({ sourceApp: 'fathom', organizationId: TEST_ORG_ID }),
    );

    // Flush the initial async fetch under fake timers.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.terminalJobs.map((j) => j.id).sort()).toEqual([
      'failed-job',
      'partial-job',
    ]);

    // Advance well past any legacy 8s auto-dismiss timer.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(9000);
    });

    expect(result.current.terminalJobs.map((j) => j.id).sort()).toEqual([
      'failed-job',
      'partial-job',
    ]);
  });

  it('subscribes a channel and queries sync_jobs on mount, then removes channel on unmount', async () => {
    h.seededRows = [row()];

    const { unmount } = renderHook(() =>
      useSyncJobs({ sourceApp: 'fathom', organizationId: TEST_ORG_ID }),
    );

    await waitFor(() => {
      expect(h.channelSpy).toHaveBeenCalled();
    });
    expect(h.fromSpy.mock.calls.some((c) => c[0] === 'sync_jobs')).toBe(true);
    expect(h.subscribeSpy).toHaveBeenCalled();

    unmount();

    expect(h.removeChannelSpy).toHaveBeenCalled();
  });

  it('establishes the 2000ms poll fallback when the channel reports CHANNEL_ERROR', async () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    h.seededRows = [row()];

    renderHook(() =>
      useSyncJobs({ sourceApp: 'fathom', organizationId: TEST_ORG_ID }),
    );

    await waitFor(() => {
      expect(h.capturedStatusCb).not.toBeNull();
    });

    act(() => {
      h.capturedStatusCb?.('CHANNEL_ERROR');
    });

    expect(setIntervalSpy.mock.calls.some((c) => c[1] === 2000)).toBe(true);

    setIntervalSpy.mockRestore();
  });
});
