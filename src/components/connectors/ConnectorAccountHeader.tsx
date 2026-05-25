import type * as React from "react";
import { RiExternalLinkLine, RiLoader2Line } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

interface ConnectorAccountHeaderProps {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  connected: boolean;
  accountEmail?: string | null;
  errorMessage?: string | null;
  badge?: "beta";
  lastSyncAt?: string | null;
  reconnectLabel?: string;
  disconnectLabel?: string;
  isActing?: boolean;
  onReconnect?: () => void;
  onDisconnect?: () => void;
  className?: string;
}

export function ConnectorAccountHeader({
  label,
  description,
  icon: Icon,
  connected,
  accountEmail,
  errorMessage,
  badge,
  lastSyncAt,
  reconnectLabel = connected ? "Reconnect" : "Connect",
  disconnectLabel = "Disconnect",
  isActing = false,
  onReconnect,
  onDisconnect,
  className,
}: ConnectorAccountHeaderProps) {
  return (
    <div className={cn("space-y-8", className)}>
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl border border-border bg-muted">
            <Icon className="h-7 w-7 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 font-montserrat text-base font-extrabold uppercase tracking-wide text-foreground">
              {label}
              {badge === "beta" && <StatusBadge variant="beta" />}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {description}
            </p>
            <div className="mt-5">
              {errorMessage ? (
                <StatusBadge variant="error" label="Connection error" />
              ) : connected ? (
                <StatusBadge variant="connected" />
              ) : (
                <StatusBadge variant="setupNeeded" />
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-end">
          {onReconnect && (
            <Button
              type="button"
              variant="hollow"
              onClick={onReconnect}
              disabled={isActing}
              className="min-w-[150px]"
            >
              {isActing ? (
                <RiLoader2Line className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RiExternalLinkLine className="mr-2 h-4 w-4" />
              )}
              {reconnectLabel}
            </Button>
          )}
          {connected && onDisconnect && (
            <Button
              type="button"
              variant="hollow"
              onClick={onDisconnect}
              disabled={isActing}
              className="min-w-[132px]"
            >
              {disconnectLabel}
            </Button>
          )}
        </div>
      </div>

      {connected && (
        <p className="text-sm text-muted-foreground">
          Connected as{" "}
          <span className="font-semibold text-foreground">
            {accountEmail ?? "Unknown account"}
          </span>
          {lastSyncAt && (
            <>
              {" "}
              · Last sync <time>{new Date(lastSyncAt).toLocaleString()}</time>
            </>
          )}
        </p>
      )}

      {errorMessage && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {errorMessage}
        </div>
      )}
    </div>
  );
}
