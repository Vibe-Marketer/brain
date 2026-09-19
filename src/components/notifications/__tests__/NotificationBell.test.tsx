import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NotificationBell, isRecordingAccessNotificationMetadata, isReporterTicketMetadata } from '@/components/notifications/NotificationBell';
import { useNotifications, type UserNotification } from '@/hooks/useNotifications';
import { useAdminDetailStore } from '@/stores/adminDetailStore';

vi.mock('@/hooks/useNotifications', () => ({
  useNotifications: vi.fn(),
}));

const mockUseNotifications = vi.mocked(useNotifications);
const markAsRead = vi.fn();
const markAllAsRead = vi.fn();
const deleteNotification = vi.fn();

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
    deleteNotification,
    isMarkingAsRead: false,
    isMarkingAllAsRead: false,
    isDeleting: false,
    refetch: vi.fn(),
  });
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderBell() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <NotificationBell />
        <LocationProbe />
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

  it('renders typed access-request metadata and deep-links to the focused owner review', () => {
    mockNotifications([
      makeNotification({
        type: 'info',
        title: 'Access requested',
        body: 'Taylor requested access to “Quarterly review”.',
        metadata: {
          source: 'recording_access',
          kind: 'requested',
          recording_id: '11111111-1111-4111-a111-111111111111',
          request_id: '22222222-2222-4222-a222-222222222222',
        },
      }),
    ]);
    renderBell();
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(screen.getByText('Review request →')).toBeInTheDocument();

    const row = screen.getByRole('button', { name: /Access requested/i });
    const dismiss = screen.getByRole('button', { name: 'Dismiss notification' });
    expect(row).not.toContainElement(dismiss);
    fireEvent.click(row);
    expect(markAsRead).toHaveBeenCalledWith('notification-1');
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/call/11111111-1111-4111-a111-111111111111?accessRequest=22222222-2222-4222-a222-222222222222',
    );
  });

  it.each([
    ['approved', 'Recording access approved', 'Open recording →', {
      source: 'recording_access', kind: 'approved',
      recording_id: '11111111-1111-4111-a111-111111111111',
      request_id: '22222222-2222-4222-a222-222222222222',
    }],
    ['denied', 'Access request denied', 'View request status →', {
      source: 'recording_access', kind: 'denied',
      recording_id: '11111111-1111-4111-a111-111111111111',
      request_id: '22222222-2222-4222-a222-222222222222',
      cooldown_until: '2026-10-19T12:00:00Z',
    }],
  ])('renders and navigates a typed %s result without private reason copy', (_kind, title, action, metadata) => {
    mockNotifications([makeNotification({ title, body: _kind === 'denied' ? 'You can request again after October 19, 2026.' : 'You can now open this recording.', metadata })])
    renderBell()
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }))
    expect(screen.getByText(action)).toBeInTheDocument()
    expect(screen.queryByText(/reason:/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: new RegExp(title, 'i') }))
    expect(screen.getByTestId('location')).toHaveTextContent('/call/11111111-1111-4111-a111-111111111111')
  })

  it('keeps malformed or partial access metadata inert', () => {
    mockNotifications([makeNotification({
      title: 'Access requested',
      metadata: { source: 'recording_access', kind: 'requested', recording_id: 'not-a-uuid' },
    })])
    renderBell()
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }))
    expect(screen.queryByText(/Review request|Open recording|View request status/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Access requested/i }))
    expect(screen.getByTestId('location')).toHaveTextContent('/')
  })

  it('safely recognizes already-stored legacy access notification metadata', () => {
    mockNotifications([makeNotification({
      type: 'info',
      title: 'Recording access requested',
      metadata: {
        request_id: '22222222-2222-4222-a222-222222222222',
        recording_id: '11111111-1111-4111-a111-111111111111',
      },
    })])
    renderBell()
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }))
    expect(screen.getByText('Review request →')).toBeInTheDocument()
  })

  it('keeps dismiss separate from mark-read and navigation', () => {
    mockNotifications([
      makeNotification({
        type: 'info',
        title: 'Access request denied',
        body: 'Your request for “Quarterly review” wasn\'t approved. You can request again after October 19, 2026.',
        metadata: {
          source: 'recording_access',
          kind: 'denied',
          recording_id: '11111111-1111-4111-a111-111111111111',
          available_at: '2026-10-19T12:00:00Z',
        },
      }),
    ]);
    renderBell();
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(deleteNotification).toHaveBeenCalledWith('notification-1');
    expect(markAsRead).not.toHaveBeenCalled();
    expect(screen.getByTestId('location')).toHaveTextContent('/');
    expect(screen.queryByText(/reason:/i)).not.toBeInTheDocument();
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

describe('isRecordingAccessNotificationMetadata', () => {
  it('requires stable source/kind and UUID-shaped identifiers', () => {
    expect(isRecordingAccessNotificationMetadata({
      source: 'recording_access', kind: 'requested',
      recording_id: '11111111-1111-4111-a111-111111111111',
      request_id: '22222222-2222-4222-a222-222222222222',
    })).toBe(true)
    expect(isRecordingAccessNotificationMetadata({
      source: 'recording_access', kind: 'requested', recording_id: 'not-a-uuid', request_id: null,
    })).toBe(false)
  })
})
