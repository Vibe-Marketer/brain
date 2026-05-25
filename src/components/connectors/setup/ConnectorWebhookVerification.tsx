import { RiRefreshLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { StatusBadge, type StatusBadgeProps } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

export type ConnectorWebhookVerificationStatus =
  | "not_configured"
  | "waiting"
  | "verified"
  | "error";

const statusBadgeByState = {
  not_configured: { variant: "setupNeeded", label: "Save needed" },
  waiting: { variant: "warning", label: "Waiting" },
  verified: { variant: "success", label: "Verified" },
  error: { variant: "error", label: "Error" },
} satisfies Record<
  ConnectorWebhookVerificationStatus,
  Pick<StatusBadgeProps, "variant" | "label">
>;

export interface ConnectorWebhookVerificationProps {
  status: ConnectorWebhookVerificationStatus;
  title?: string;
  description?: string;
  lastReceivedAt?: string | Date | null;
  errorMessage?: string;
  refreshLabel?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  disabled?: boolean;
  className?: string;
}

export function ConnectorWebhookVerification({
  status,
  title = "Webhook verification",
  description,
  lastReceivedAt,
  errorMessage,
  refreshLabel = "Refresh",
  onRefresh,
  refreshing = false,
  disabled = false,
  className,
}: ConnectorWebhookVerificationProps) {
  const badge = statusBadgeByState[status];
  const resolvedDescription =
    description ??
    (status === "verified"
      ? "CallVault received a provider webhook event."
      : status === "waiting"
        ? "Send a test event from the provider, then return to CallVault."
        : status === "error"
          ? "CallVault could not verify the latest provider webhook event."
          : "Save credentials before sending a provider test event.");

  return (
    <div className={cn("rounded-lg border border-border bg-muted/20 p-3", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-medium text-foreground">{title}</p>
            <StatusBadge variant={badge.variant} label={badge.label} />
          </div>
          <p className="text-xs text-muted-foreground">{resolvedDescription}</p>
          {lastReceivedAt ? (
            <p className="text-[11px] text-muted-foreground">
              Last received: {formatVerificationTime(lastReceivedAt)}
            </p>
          ) : null}
          {errorMessage ? (
            <p className="text-[11px] text-rose-600 dark:text-rose-300">
              {errorMessage}
            </p>
          ) : null}
        </div>
        {onRefresh ? (
          <Button
            type="button"
            variant="hollow"
            size="sm"
            onClick={onRefresh}
            disabled={disabled || refreshing}
            className="shrink-0"
          >
            <RiRefreshLine
              className={cn("h-3.5 w-3.5", refreshing && "animate-spin")}
            />
            {refreshing ? "Refreshing" : refreshLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function formatVerificationTime(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
