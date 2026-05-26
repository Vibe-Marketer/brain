import type * as React from "react";
import { RiAddLine, RiExternalLinkLine, RiLoader2Line } from "@remixicon/react";
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
  addAccountLabel?: string;
  disconnectLabel?: string;
  isActing?: boolean;
  onReconnect?: () => void;
  onAddAccount?: () => void;
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
  addAccountLabel = "Add account",
  disconnectLabel = "Disconnect",
  isActing = false,
  onReconnect,
  onAddAccount,
  onDisconnect,
  className,
}: ConnectorAccountHeaderProps) {
  const hasActions = Boolean(onAddAccount || onReconnect || (connected && onDisconnect));

  return (
    <div className={cn("space-y-5", className)}>
      <div className="flex min-w-0 items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-montserrat text-base font-extrabold uppercase tracking-wide text-foreground">
              {label}
            </h2>
            {badge === "beta" && <StatusBadge variant="beta" />}
            {errorMessage ? (
              <StatusBadge variant="error" label="Connection error" />
            ) : connected ? (
              <StatusBadge variant="connected" />
            ) : (
              <StatusBadge variant="setupNeeded" />
            )}
          </div>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>
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

      {hasActions ? (
        <div className="flex flex-wrap items-center gap-2">
          {onAddAccount && (
            <Button
              type="button"
              variant="hollow"
              onClick={onAddAccount}
              disabled={isActing}
              className="min-w-[150px]"
            >
              {isActing ? (
                <RiLoader2Line className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RiAddLine className="mr-2 h-4 w-4" />
              )}
              {addAccountLabel}
            </Button>
          )}
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
      ) : null}

      {errorMessage && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {errorMessage}
        </div>
      )}
    </div>
  );
}
