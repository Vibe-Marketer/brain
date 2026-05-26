/**
 * ConnectorCardRow — horizontal vendor row with status + action group.
 *
 * Replaces IntegrationStatusRow. Resolves icon/label via useConnectorMeta.
 */
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  RiCheckboxCircleLine,
  RiErrorWarningLine,
  RiLoader4Line,
  RiRefreshLine,
} from "@remixicon/react";
import { cn } from "@/lib/utils";
import { useConnectorMeta, type ConnectorCardStatus } from "./ConnectorCard";

export interface ConnectorCardRowProps {
  sourceApp: string;
  status: ConnectorCardStatus;
  label?: string;
  description?: string;
  iconOverride?: React.ReactNode;
  metadata?: React.ReactNode;
  compact?: boolean;
  actionLabel?: string;
  onConnect?: () => void;
  onReconnect?: () => void;
  onManualSync?: () => void;
}

function StatusPill({
  status,
}: {
  status: ConnectorCardStatus;
}) {
  if (status === "syncing")
    return (
      <Badge className="bg-vibe-orange/10 text-vibe-orange border-vibe-orange/20 text-xs">
        <RiLoader4Line className="mr-1 h-3 w-3 animate-spin" />
        Syncing...
      </Badge>
    );
  if (status === "error")
    return (
      <Badge variant="destructive" className="text-xs">
        <RiErrorWarningLine className="mr-1 h-3 w-3" />
        Error
      </Badge>
    );
  if (status === "connected")
    return (
      <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-xs">
        <RiCheckboxCircleLine className="mr-1 h-3 w-3" />
        Connected
      </Badge>
    );
  return (
    <Badge variant="secondary" className="text-xs">
      Not Connected
    </Badge>
  );
}

export function ConnectorCardRow({
  sourceApp,
  status,
  label,
  description,
  iconOverride,
  metadata,
  compact = false,
  actionLabel = "Connect",
  onConnect,
  onReconnect,
  onManualSync,
}: ConnectorCardRowProps) {
  const { label: resolvedLabel, Icon } = useConnectorMeta(sourceApp, label);
  const isConnected = status === "connected" || status === "syncing";
  const isSyncing = status === "syncing";
  const iconNode =
    iconOverride ?? (Icon ? <Icon className={compact ? "h-7 w-7" : "h-8 w-8"} /> : null);

  return (
    <div
      className={cn(
        "flex items-center justify-between transition-colors",
        compact
          ? "rounded-lg px-2 py-2 hover:bg-muted/50"
          : "rounded-xl border border-border/60 bg-card p-4",
      )}
    >
      <div className={cn("flex items-center gap-2.5", !isConnected && "opacity-50")}>
        <div className="flex items-center justify-center">{iconNode}</div>
        <div className="flex flex-col">
          <span className="font-medium text-sm">{resolvedLabel}</span>
          {description && (
            <span className="text-xs text-muted-foreground leading-snug">{description}</span>
          )}
          {metadata}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        {!compact && <StatusPill status={status} />}
        {isConnected && onManualSync && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onManualSync}
            disabled={isSyncing}
            className={compact ? "h-6 w-6 p-0" : "h-7 px-2"}
          >
            <RiRefreshLine
              className={cn(compact ? "h-3.5 w-3.5" : "h-4 w-4", isSyncing && "animate-spin")}
            />
          </Button>
        )}
        {!isConnected && status !== "error" && onConnect && (
          <Button
            size="sm"
            onClick={onConnect}
            className={
              compact
                ? "h-6 text-xs px-2"
                : "bg-vibe-orange hover:opacity-90 text-white text-xs font-semibold uppercase tracking-wide rounded-lg px-3 py-1.5 h-auto border-0"
            }
          >
            {actionLabel}
          </Button>
        )}
        {status === "error" && onReconnect && (
          <Button
            variant="hollow"
            size="sm"
            onClick={onReconnect}
            className={compact ? "h-6 text-xs px-2" : "h-7 text-xs"}
          >
            Reconnect
          </Button>
        )}
      </div>
    </div>
  );
}
