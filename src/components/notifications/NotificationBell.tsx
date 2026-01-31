/**
 * NotificationBell - Bell icon with unread count badge
 *
 * Displays in the header, shows unread notification count,
 * and opens NotificationPanel on click.
 *
 * @brand-version v4.2
 */

import * as React from "react";
import { RiNotification3Line } from "@remixicon/react";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/hooks/useNotifications";
import { NotificationPanel } from "./NotificationPanel";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

export interface NotificationBellProps {
  className?: string;
}

export function NotificationBell({ className }: NotificationBellProps) {
  const { unreadCount, isLoading } = useNotifications();
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "relative h-9 w-9 rounded-full",
            "hover:bg-muted transition-colors",
            className
          )}
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        >
          <RiNotification3Line className="h-5 w-5 text-cb-ink-muted" />
          
          {/* Unread badge */}
          {unreadCount > 0 && (
            <span
              className={cn(
                "absolute -top-0.5 -right-0.5",
                "flex items-center justify-center",
                "min-w-[18px] h-[18px] px-1",
                "text-[10px] font-semibold text-white",
                "bg-red-500 rounded-full",
                "ring-2 ring-background"
              )}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent
        align="end"
        sideOffset={8}
        className={cn(
          "w-[380px] p-0",
          "bg-card border border-border rounded-lg shadow-lg"
        )}
      >
        <NotificationPanel onClose={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
