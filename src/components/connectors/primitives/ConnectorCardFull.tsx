/**
 * ConnectorCardFull — full vendor card with multi-action footer.
 *
 * Replaces SourceCard. The disconnect alert dialog lives in
 * DisconnectConfirmDialog so this file stays focused on layout.
 */
import * as React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useConnectorMeta, type ConnectorCardStatus } from "./ConnectorCard";
import { DisconnectConfirmDialog } from "./DisconnectConfirmDialog";

export interface ConnectorCardFullProps {
  sourceApp: string;
  status: ConnectorCardStatus;
  label?: string;
  iconOverride?: React.ReactNode;
  accountEmail?: string;
  lastSyncAt?: string | null;
  callCount?: number;
  isActive?: boolean;
  onToggle?: (active: boolean) => void;
  onSync?: () => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  syncProgress?: { current: number; total: number };
  errorMessage?: string | null;
  disabled?: boolean;
  alwaysAvailable?: boolean;
}

const STATUS_LABEL: Record<ConnectorCardStatus, string> = {
  connected: "Active",
  syncing: "Syncing",
  paused: "Paused",
  error: "Error",
  expired: "Expired",
  "not-connected": "Not connected",
};

const STATUS_CLASS: Record<ConnectorCardStatus, string> = {
  connected: "bg-emerald-500/10 text-emerald-500",
  syncing: "bg-vibe-orange/10 text-vibe-orange",
  paused: "bg-amber-500/10 text-amber-500",
  error: "bg-red-500/10 text-red-500",
  expired: "bg-amber-500/10 text-amber-500",
  "not-connected": "bg-muted text-muted-foreground",
};

function formatRelativeTime(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function ConnectorCardFull({
  sourceApp,
  status,
  label,
  iconOverride,
  accountEmail,
  lastSyncAt,
  callCount = 0,
  isActive = true,
  onToggle,
  onSync,
  onConnect,
  onDisconnect,
  syncProgress,
  errorMessage,
  disabled = false,
  alwaysAvailable = false,
}: ConnectorCardFullProps) {
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const { label: resolvedLabel, Icon, config } = useConnectorMeta(sourceApp, label);
  const isConnected = status !== "not-connected";
  const isOAuthSource = config?.authMode === "oauth2";
  const iconNode = iconOverride ?? (Icon ? <Icon className="h-5 w-5 text-foreground" /> : null);

  return (
    <>
      <div
        className={cn(
          "relative flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4",
          "transition-shadow hover:shadow-sm",
          disabled && "opacity-60 pointer-events-none",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-foreground">
              {iconNode}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground leading-tight">
                {resolvedLabel}
              </p>
              {accountEmail && (
                <p className="text-[11px] text-muted-foreground truncate max-w-[120px]">
                  {accountEmail}
                </p>
              )}
            </div>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
              STATUS_CLASS[status],
            )}
          >
            {STATUS_LABEL[status]}
          </span>
        </div>

        {status === "error" && errorMessage && (
          <p className="text-[11px] text-red-500 leading-relaxed rounded-md bg-red-500/10 px-2.5 py-1.5">
            {errorMessage}
          </p>
        )}

        {syncProgress && syncProgress.total > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>Syncing…</span>
              <span>
                {syncProgress.current}/{syncProgress.total}
              </span>
            </div>
            <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-vibe-orange rounded-full transition-all"
                style={{
                  width: `${Math.min(100, (syncProgress.current / syncProgress.total) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        {isConnected && (
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span>{callCount} recordings</span>
            {lastSyncAt && (
              <>
                <span className="text-border">·</span>
                <span>Last sync {formatRelativeTime(lastSyncAt)}</span>
              </>
            )}
          </div>
        )}

        {isConnected && !alwaysAvailable && onToggle && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {isActive ? "Background sync on" : "Background sync off"}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={isActive}
              aria-label={`Toggle ${resolvedLabel} auto-sync`}
              onClick={() => onToggle(!isActive)}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full",
                "border-2 border-transparent transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange",
                isActive ? "bg-vibe-orange" : "bg-muted",
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm",
                  "transform transition-transform",
                  isActive ? "translate-x-4" : "translate-x-0",
                )}
              />
            </button>
          </div>
        )}

        {alwaysAvailable && (
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
            <span className="text-xs text-muted-foreground">Always available</span>
          </div>
        )}

        <div className="flex items-center gap-2 pt-0.5">
          {!isConnected && onConnect && (
            <Button type="button" onClick={onConnect} size="sm" className="flex-1">
              Connect
            </Button>
          )}
          {isConnected && status === "error" && onConnect && (
            <Button type="button" onClick={onConnect} size="sm" className="flex-1">
              Reconnect
            </Button>
          )}
          {isConnected && status === "connected" && onSync && (
            <Button type="button" onClick={onSync} size="sm" className="flex-1">
              {isOAuthSource ? "Sync Now" : "Import"}
            </Button>
          )}
          {isConnected && onDisconnect && (
            <Button
              type="button"
              onClick={() => setDisconnectOpen(true)}
              variant="ghost"
              size="sm"
              className="ml-auto min-w-0 px-2 text-muted-foreground"
            >
              Disconnect
            </Button>
          )}
        </div>
      </div>

      {onDisconnect && (
        <DisconnectConfirmDialog
          open={disconnectOpen}
          onOpenChange={setDisconnectOpen}
          vendorLabel={resolvedLabel}
          onConfirm={onDisconnect}
        />
      )}
    </>
  );
}
