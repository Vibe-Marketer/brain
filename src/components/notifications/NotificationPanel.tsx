/**
 * NotificationPanel - Popover panel showing notifications
 *
 * Lists notifications with title, body, time, and actions.
 * Health alerts include "Send to chat" action for re-engagement emails.
 *
 * @brand-version v4.2
 */

import * as React from "react";
import {
  RiCheckLine,
  RiDeleteBinLine,
  RiMailLine,
  RiTimeLine,
  RiUserHeartLine,
  RiInformationLine,
  RiAlertLine,
} from "@remixicon/react";
import { cn } from "@/lib/utils";
import { useNotifications, UserNotification, HealthAlertMetadata } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

export interface NotificationPanelProps {
  onClose?: () => void;
  onSendToChat?: (notification: UserNotification) => void;
}

/**
 * Format relative time (e.g., "2 hours ago", "3 days ago")
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/**
 * Get icon for notification type
 */
function getNotificationIcon(type: string) {
  switch (type) {
    case "health_alert":
      return <RiUserHeartLine className="h-4 w-4 text-amber-500" />;
    case "system":
      return <RiAlertLine className="h-4 w-4 text-blue-500" />;
    default:
      return <RiInformationLine className="h-4 w-4 text-cb-ink-muted" />;
  }
}

/**
 * Single notification item
 */
function NotificationItem({
  notification,
  onMarkAsRead,
  onDelete,
  onSendToChat,
}: {
  notification: UserNotification;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
  onSendToChat?: (notification: UserNotification) => void;
}) {
  const isUnread = !notification.read_at;
  const isHealthAlert = notification.type === "health_alert";
  const metadata = notification.metadata as HealthAlertMetadata | null;

  const handleClick = () => {
    if (isUnread) {
      onMarkAsRead(notification.id);
    }
  };

  return (
    <div
      className={cn(
        "p-3 border-b border-border last:border-b-0",
        "hover:bg-muted/50 transition-colors cursor-pointer",
        isUnread && "bg-muted/30"
      )}
      onClick={handleClick}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="mt-0.5 flex-shrink-0">
          {getNotificationIcon(notification.type)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4
              className={cn(
                "text-sm truncate",
                isUnread ? "font-semibold" : "font-medium"
              )}
            >
              {notification.title}
            </h4>
            {isUnread && (
              <span className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full" />
            )}
          </div>

          {notification.body && (
            <p className="text-sm text-cb-ink-muted mt-0.5 line-clamp-2">
              {notification.body}
            </p>
          )}

          {/* Time and actions */}
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-cb-ink-muted flex items-center gap-1">
              <RiTimeLine className="h-3 w-3" />
              {formatRelativeTime(notification.created_at)}
            </span>

            <div className="flex items-center gap-1">
              {/* Health alert: Send to chat button */}
              {isHealthAlert && onSendToChat && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSendToChat(notification);
                  }}
                >
                  <RiMailLine className="h-3.5 w-3.5 mr-1" />
                  Send check-in
                </Button>
              )}

              {/* Delete button */}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-cb-ink-muted hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(notification.id);
                }}
              >
                <RiDeleteBinLine className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Loading skeleton for notifications
 */
function NotificationSkeleton() {
  return (
    <div className="p-3 space-y-2">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

/**
 * Empty state when no notifications
 */
function EmptyState() {
  return (
    <div className="p-8 text-center">
      <RiInformationLine className="h-10 w-10 text-cb-ink-muted mx-auto mb-3" />
      <p className="text-sm text-cb-ink-muted">No notifications yet</p>
      <p className="text-xs text-cb-ink-muted mt-1">
        You'll be notified when contacts need attention
      </p>
    </div>
  );
}

export function NotificationPanel({ onClose, onSendToChat }: NotificationPanelProps) {
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    isMarkingAllAsRead,
  } = useNotifications();

  const handleSendToChat = React.useCallback(
    (notification: UserNotification) => {
      if (onSendToChat) {
        onSendToChat(notification);
        onClose?.();
      }
    },
    [onSendToChat, onClose]
  );

  return (
    <div className="flex flex-col max-h-[480px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="font-semibold text-sm">Notifications</h3>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => markAllAsRead()}
            disabled={isMarkingAllAsRead}
          >
            <RiCheckLine className="h-3.5 w-3.5 mr-1" />
            Mark all read
          </Button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="divide-y divide-border">
          <NotificationSkeleton />
          <NotificationSkeleton />
          <NotificationSkeleton />
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState />
      ) : (
        <ScrollArea className="flex-1">
          <div className="divide-y divide-border">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkAsRead={markAsRead}
                onDelete={deleteNotification}
                onSendToChat={handleSendToChat}
              />
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="px-4 py-2 border-t border-border bg-muted/30">
          <p className="text-xs text-cb-ink-muted text-center">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up!"}
          </p>
        </div>
      )}
    </div>
  );
}
