import * as React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ImportSource } from '@/services/import-sources.service';

const mockInvoke = vi.fn();
const mockMaybeSingle = vi.fn();
const mockFrom = vi.fn(() => ({
  select: vi.fn(() => ({
    eq: vi.fn(() => ({
      maybeSingle: mockMaybeSingle,
    })),
  })),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

vi.mock('@/lib/auth-utils', () => ({
  getSafeUser: vi.fn(async () => ({ user: { id: 'user-1' }, error: null })),
}));

vi.mock('@/hooks/useUserRole', () => ({
  useUserRole: () => ({ isPro: false, isTeam: false, isAdmin: false }),
}));

vi.mock('@/hooks/useFathomRefresh', () => ({
  useFathomRefresh: () => ({ isPending: false, mutate: vi.fn() }),
}));

vi.mock('@/components/ui/date-range-picker', () => ({
  DateRangePicker: ({ onDateRangeChange, disabled }: {
    onDateRangeChange: (range: { from: Date; to: Date }) => void;
    disabled?: boolean;
  }) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onDateRangeChange({
        from: new Date('2026-05-01T00:00:00Z'),
        to: new Date('2026-05-02T00:00:00Z'),
      })}
    >
      Set date range
    </button>
  ),
}));

vi.mock('@/components/workspace/WorkspaceSelector', () => ({
  WorkspaceSelector: () => <div data-testid="workspace-selector" />,
}));
vi.mock('@/components/dialogs/CreateWorkspaceDialog', () => ({
  CreateWorkspaceDialog: () => null,
}));

vi.mock('@/components/dialogs/RefreshFromFathomDialog', () => ({
  RefreshFromFathomDialog: () => null,
}));

type ObserverCallback = IntersectionObserverCallback;
let intersectionCallback: ObserverCallback | null = null;
const observeMock = vi.fn();
const disconnectMock = vi.fn();

class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin = '';
  readonly thresholds: ReadonlyArray<number> = [];

  constructor(callback: ObserverCallback) {
    intersectionCallback = callback;
  }

  observe = observeMock;
  unobserve = vi.fn();
  disconnect = disconnectMock;
  takeRecords = vi.fn(() => []);
}

const source: ImportSource = {
  id: 'source-1',
  user_id: 'user-1',
  source_app: 'fathom',
  is_active: true,
  account_email: 'fathom@example.com',
  last_sync_at: null,
  error_message: null,
  connection_metadata: null,
  webhook_path_token: null,
  created_at: '2026-05-01T00:00:00Z',
  updated_at: '2026-05-01T00:00:00Z',
};

function renderComponent() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <FathomImportDetail
        fathomSources={[source]}
        onConnect={vi.fn()}
        onDisconnect={vi.fn()}
      />
    </QueryClientProvider>
  );
}

import { FathomImportDetail } from '../FathomImportDetail';

describe('FathomImportDetail infinite scroll pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    intersectionCallback = null;
    mockMaybeSingle.mockResolvedValue({ data: { oauth_token_expires: '2026-06-01T00:00:00Z' }, error: null });
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads the next Fathom page when the bottom sentinel enters view', async () => {
    mockInvoke
      .mockResolvedValueOnce({
        data: {
          meetings: [
            {
              recording_id: 1,
              title: 'First page call',
              created_at: '2026-05-01T12:00:00Z',
              recording_start_time: '2026-05-01T12:00:00Z',
              recording_end_time: '2026-05-01T12:30:00Z',
              synced: false,
              calendar_invitees: [],
            },
          ],
          next_cursor: 'cursor-2',
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          meetings: [
            {
              recording_id: 2,
              title: 'Second page call',
              created_at: '2026-05-02T12:00:00Z',
              recording_start_time: '2026-05-02T12:00:00Z',
              recording_end_time: '2026-05-02T12:45:00Z',
              synced: false,
              calendar_invitees: [],
            },
          ],
          next_cursor: null,
        },
        error: null,
      });

    renderComponent();

    fireEvent.click(screen.getByRole('button', { name: /set date range/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /search fathom/i })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole('button', { name: /search fathom/i }));

    expect(await screen.findByText('First page call')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();

    await waitFor(() => {
      expect(observeMock).toHaveBeenCalled();
      expect(intersectionCallback).not.toBeNull();
    });

    act(() => {
      intersectionCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledTimes(2);
    });

    expect(mockInvoke).toHaveBeenNthCalledWith(
      2,
      'fetch-meetings',
      expect.objectContaining({
        body: expect.objectContaining({
          sourceId: 'source-1',
          cursor: 'cursor-2',
          pageMode: true,
        }),
      })
    );
    expect(await screen.findByText('Second page call')).toBeInTheDocument();
  });
});
