import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NotificationBell, isReporterTicketMetadata } from '@/components/notifications/NotificationBell';
import { useNotifications, type UserNotification } from '@/hooks/useNotifications';
import { useAdminDetailStore } from '@/stores/adminDetailStore';

vi.mock('@/hooks/useNotifications', () => ({
  useNotifications: vi.fn(),
}));

const mockUseNotifications = vi.mocked(useNotifications);
const markAsRead = vi.fn();
const markAllAsRead = vi.fn();

function makeNotification(overrides: Partial<UserNotification> = {}): UserNotification {
  return {
    id: 'notification-1',
    user_id: 'user-1',
    type: 'info',
    title: 'We received your report',
    body: 'We received your report and are tracking it.',
    metadata: {
      source: 'in_app_user',
      kind: 'received',
      ticket_id: 'ticket-1',
    },
    read_at: null,
    created_at: new Date(Date.now() - 60_000).toISOString(),
    ...overrides,
  };
}

function mockNotifications(notifications: UserNotification[]) {
  mockUseNotifications.mockReturnValue({
    notifications,
    unreadCount: notifications.filter((notification) => !notification.read_at).length,
    isLoading: false,
    markAsRead,
    markAllAsRead,
    deleteNotification: vi.fn(),
    isMarkingAsRead: false,
    isMarkingAllAsRead: false,
    isDeleting: false,
    refetch: vi.fn(),
  });
}

function renderBell() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <NotificationBell />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotifications([]);
    useAdminDetailStore.getState().close();
  });

  it('hides the unread badge when there are no unread updates', () => {
    mockNotifications([makeNotification({ read_at: new Date().toISOString() })]);

    renderBell();

    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
    expect(screen.queryByLabelText(/unread updates/i)).not.toBeInTheDocument();
  });

  it('caps the unread badge at 9+', () => {
    mockNotifications(
      Array.from({ length: 12 }, (_, index) =>
        makeNotification({ id: `notification-${index}`, title: `Update ${index}` }),
      ),
    );

    renderBell();

    expect(screen.getByText('9+')).toBeInTheDocument();
    expect(screen.getByLabelText('12 unread updates')).toBeInTheDocument();
  });

  it('marks a row read when clicked', () => {
    mockNotifications([makeNotification()]);
    renderBell();

    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    fireEvent.click(screen.getByRole('button', { name: /We received your report/i }));

    expect(markAsRead).toHaveBeenCalledWith('notification-1');
  });

  it('opens the linked ticket when a reporter notification is clicked', () => {
    mockNotifications([makeNotification()]);
    renderBell();

    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    fireEvent.click(screen.getByRole('button', { name: /We received your report/i }));

    expect(useAdminDetailStore.getState().detail).toEqual({ type: 'ticket', id: 'ticket-1' });
  });

  it('does not render View report for non in-app reporter metadata', () => {
    mockNotifications([
      makeNotification({
        metadata: {
          source: 'sentry',
          kind: 'received',
          ticket_id: 'ticket-1',
        },
      }),
    ]);
    renderBell();

    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));

    expect(screen.queryByText(/View ticket/)).not.toBeInTheDocument();
  });

  it('renders View ticket for valid in-app reporter metadata', () => {
    mockNotifications([makeNotification()]);
    renderBell();

    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));

    expect(screen.getByText(/View ticket/)).toBeInTheDocument();
  });
});

describe('isReporterTicketMetadata', () => {
  it.each([
    ['manual', { source: 'manual', kind: 'received', ticket_id: 'ticket-1' }],
    ['sentry', { source: 'sentry', kind: 'received', ticket_id: 'ticket-1' }],
    ['nightly_qa', { source: 'nightly_qa', kind: 'received', ticket_id: 'ticket-1' }],
    ['internal', { source: 'internal', kind: 'received', ticket_id: 'ticket-1' }],
    ['unknown', { source: 'unknown', kind: 'received', ticket_id: 'ticket-1' }],
    ['null source', { source: null, kind: 'received', ticket_id: 'ticket-1' }],
    ['null metadata', null],
  ])('rejects %s reporter metadata', (_label, metadata) => {
    expect(isReporterTicketMetadata(metadata)).toBe(false);
  });

  it('rejects invalid kind and non-string ticket id', () => {
    expect(isReporterTicketMetadata({ source: 'in_app_user', kind: 'other', ticket_id: 'ticket-1' })).toBe(false);
    expect(isReporterTicketMetadata({ source: 'in_app_user', kind: 'received', ticket_id: null })).toBe(false);
  });

  it('accepts valid in-app reporter metadata', () => {
    expect(isReporterTicketMetadata({ source: 'in_app_user', kind: 'resolved', ticket_id: 'ticket-1' })).toBe(true);
  });
});
