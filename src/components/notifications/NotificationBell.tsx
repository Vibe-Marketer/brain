import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { RiCloseLine, RiNotification3Line } from '@remixicon/react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications, type UserNotification } from '@/hooks/useNotifications';
import { useAdminDetailStore } from '@/stores/adminDetailStore';
import { cn } from '@/lib/utils';

const REPORTER_NOTIFICATION_KINDS = new Set([
  'received',
  'in_progress',
  'resolved',
  'escalated',
]);

interface ReporterTicketMetadata {
  source: 'in_app_user';
  kind: 'received' | 'in_progress' | 'resolved' | 'escalated';
  ticket_id: string;
}

interface NotificationBellProps {
  isCollapsed?: boolean;
}

export function isReporterTicketMetadata(metadata: unknown): metadata is ReporterTicketMetadata {
  if (!metadata || typeof metadata !== 'object') return false;

  const candidate = metadata as Record<string, unknown>;
  return (
    candidate.source === 'in_app_user' &&
    typeof candidate.kind === 'string' &&
    REPORTER_NOTIFICATION_KINDS.has(candidate.kind) &&
    typeof candidate.ticket_id === 'string'
  );
}

function formatRelativeTime(value: string): string {
  const createdAt = new Date(value).getTime();
  if (Number.isNaN(createdAt)) return '';

  const diffSeconds = Math.round((createdAt - Date.now()) / 1000);
  const absoluteSeconds = Math.abs(diffSeconds);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

  if (absoluteSeconds < 60) return formatter.format(diffSeconds, 'second');
  if (absoluteSeconds < 3600) return formatter.format(Math.round(diffSeconds / 60), 'minute');
  if (absoluteSeconds < 86400) return formatter.format(Math.round(diffSeconds / 3600), 'hour');
  return formatter.format(Math.round(diffSeconds / 86400), 'day');
}

function NotificationRow({
  notification,
  onMarkRead,
  onDismiss,
  onOpenTicket,
}: {
  notification: UserNotification;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onOpenTicket: (ticketId: string) => void;
}) {
  const isUnread = !notification.read_at;
  const ticketMetadata = isReporterTicketMetadata(notification.metadata)
    ? notification.metadata
    : null;
  const relativeTime = formatRelativeTime(notification.created_at);

  return (
    <div className="group relative">
      <button
        type="button"
        className={cn(
          'w-full rounded-md border border-transparent px-3.5 py-3 pr-11 text-left transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange',
          isUnread ? 'bg-muted/40 hover:bg-muted/60' : 'bg-card hover:bg-muted/40',
        )}
        onClick={() => {
          onMarkRead(notification.id);
          if (ticketMetadata) onOpenTicket(ticketMetadata.ticket_id);
        }}
      >
        <div className="flex gap-2.5">
          <span
            className={cn(
              'mt-1 h-2 w-2 flex-shrink-0 rounded-full',
              isUnread ? 'bg-vibe-orange' : 'bg-muted-foreground/30',
            )}
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold leading-snug text-foreground">
              {notification.title}
            </span>
            {notification.body ? (
              <span className="mt-1 line-clamp-3 block text-sm leading-6 text-muted-foreground">
                {notification.body}
              </span>
            ) : null}
            <span className="mt-2 flex items-center justify-between gap-3">
              <span className="text-xs tabular-nums text-muted-foreground">
                {relativeTime}
              </span>
              {ticketMetadata ? (
                <span className="text-xs font-semibold text-vibe-orange">
                  View ticket &rarr;
                </span>
              ) : null}
            </span>
          </span>
        </div>
      </button>
      <button
        type="button"
        aria-label="Dismiss notification"
        className={cn(
          'absolute right-2 top-2 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity',
          'hover:bg-muted hover:text-foreground',
          'focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange',
          'group-hover:opacity-100',
        )}
        onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
          event.preventDefault();
          event.stopPropagation();
          onDismiss(notification.id);
        }}
      >
        <RiCloseLine className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export function NotificationBell({ isCollapsed }: NotificationBellProps) {
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    isMarkingAllAsRead,
  } = useNotifications();
  const navigate = useNavigate();
  const openTicket = useAdminDetailStore((s) => s.openTicket);

  const badgeLabel = unreadCount > 9 ? '9+' : String(unreadCount);
  const unreadText = unreadCount === 1 ? '1 unread update' : `${unreadCount} unread updates`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'relative flex items-center rounded-lg',
            'text-muted-foreground hover:bg-muted/70 transition-colors duration-150',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange focus-visible:ring-offset-2',
            !isCollapsed && 'w-full px-3 py-2.5 gap-3',
            isCollapsed && 'w-14 h-14 justify-center items-center mx-auto',
          )}
          aria-label="Notifications"
        >
          <span className="relative h-8 w-8 flex-shrink-0 rounded-md border border-border bg-card flex items-center justify-center">
            <RiNotification3Line className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <span className="absolute -right-1 -top-1 flex h-4 w-5 items-center justify-center">
              {unreadCount > 0 ? (
                <span
                  className="flex h-4 min-w-4 items-center justify-center rounded-full bg-vibe-orange px-1 text-[10px] font-semibold leading-none text-white tabular-nums"
                  aria-label={unreadText}
                >
                  {badgeLabel}
                </span>
              ) : null}
            </span>
          </span>
          <span
            className={cn(
              'text-xs font-medium transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap',
              isCollapsed ? 'w-0 opacity-0' : 'opacity-100',
            )}
          >
            Notifications
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="right"
        className="w-[calc(100vw-16px)] max-w-[400px] p-0"
      >
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold leading-tight text-foreground">Updates</h2>
            {unreadCount > 0 ? (
              <Button
                type="button"
                variant="link"
                className="text-xs font-semibold text-vibe-orange"
                disabled={isMarkingAllAsRead}
                onClick={() => {
                  void markAllAsRead();
                }}
              >
                Mark all read
              </Button>
            ) : null}
          </div>
        </div>

        <ScrollArea className="max-h-[70vh]">
          <div className="p-2">
            {isLoading ? (
              <div className="px-3 py-8 text-center">
                <p className="text-sm text-muted-foreground">Loading updates...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm font-semibold text-foreground">No updates yet</p>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">
                  Ticket updates will appear here when there is something new to share.
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {notifications.map((notification) => (
                  <NotificationRow
                    key={notification.id}
                    notification={notification}
                    onMarkRead={(id) => {
                      void markAsRead(id);
                    }}
                    onDismiss={(id) => {
                      void deleteNotification(id);
                    }}
                    onOpenTicket={(ticketId) => {
                      openTicket(ticketId);
                      navigate('/admin/tickets');
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
