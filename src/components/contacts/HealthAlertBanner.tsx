/**
 * HealthAlertBanner - Alert banner shown when contact is overdue
 *
 * Displays in ContactCard when track_health is enabled and
 * contact hasn't been seen past their threshold.
 *
 * @brand-version v4.2
 */

import * as React from "react";
import { RiAlertLine, RiMailSendLine } from "@remixicon/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useHealthAlerts } from "@/hooks/useHealthAlerts";
import type { ContactWithCallCount } from "@/types/contacts";

export interface HealthAlertBannerProps {
  contact: ContactWithCallCount;
  thresholdDays?: number;
  onSendCheckin?: () => void;
  className?: string;
}

export function HealthAlertBanner({
  contact,
  thresholdDays = 14,
  onSendCheckin,
  className,
}: HealthAlertBannerProps) {
  const { isContactOverdue, daysSinceContact } = useHealthAlerts();

  // Only show if tracking health and overdue
  if (!contact.track_health) return null;
  
  const threshold = contact.health_alert_threshold_days || thresholdDays;
  if (!isContactOverdue(contact.last_seen_at, threshold)) return null;

  const days = daysSinceContact(contact.last_seen_at);
  const contactName = contact.name || contact.email.split("@")[0];

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg",
        "bg-amber-50 dark:bg-amber-950/30",
        "border border-amber-200 dark:border-amber-800",
        className
      )}
    >
      <RiAlertLine className="h-5 w-5 text-amber-500 flex-shrink-0" />
      
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
          Time to check in with {contactName}
        </p>
        <p className="text-xs text-amber-600 dark:text-amber-400">
          {days !== null
            ? `It's been ${days} days since your last call`
            : "No recent calls on record"}
        </p>
      </div>

      {onSendCheckin && (
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "flex-shrink-0",
            "border-amber-300 dark:border-amber-700",
            "text-amber-700 dark:text-amber-300",
            "hover:bg-amber-100 dark:hover:bg-amber-900"
          )}
          onClick={onSendCheckin}
        >
          <RiMailSendLine className="h-4 w-4 mr-1.5" />
          Send check-in
        </Button>
      )}
    </div>
  );
}
