/**
 * Tracking Toggle Component
 * iPhone-style toggle for "Track all contacts" setting
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RiUserFollowLine, RiUserUnfollowLine } from "@remixicon/react";

interface TrackingToggleProps {
  /** Whether track all contacts is enabled */
  isEnabled: boolean;
  /** Callback when toggle changes */
  onToggle: (enabled: boolean) => void;
  /** Whether the toggle is in a loading state */
  isLoading?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function TrackingToggle({
  isEnabled,
  onToggle,
  isLoading = false,
  className,
}: TrackingToggleProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-4 p-4 rounded-lg border border-border bg-card",
        className
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors duration-200",
          isEnabled
            ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
            : "bg-muted text-muted-foreground"
        )}
      >
        {isEnabled ? (
          <RiUserFollowLine className="h-5 w-5" />
        ) : (
          <RiUserUnfollowLine className="h-5 w-5" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <Label
          htmlFor="track-all-contacts"
          className="text-sm font-medium cursor-pointer"
        >
          Track all contacts
        </Label>
        <p className="text-xs text-muted-foreground mt-1">
          {isEnabled ? (
            <>
              <span className="text-green-600 dark:text-green-400 font-medium">
                Enabled
              </span>
              {" "}— Automatically import attendees from all your calls as contacts.
            </>
          ) : (
            <>
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                Manual
              </span>
              {" "}— Use "Import All" to manually add call attendees as contacts.
            </>
          )}
        </p>
      </div>

      {/* Toggle */}
      <Switch
        id="track-all-contacts"
        checked={isEnabled}
        onCheckedChange={onToggle}
        disabled={isLoading}
        className="flex-shrink-0"
      />
    </div>
  );
}

export default TrackingToggle;
