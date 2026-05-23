import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  RiRefreshLine,
  RiCheckboxCircleLine,
  RiLoader4Line,
  RiErrorWarningLine,
} from "@remixicon/react";
import { cn } from "@/lib/utils";
import { type IntegrationStatus } from "@/hooks/useIntegrationSync";
import { formatDistanceToNow } from "date-fns";
import {
  FathomIcon,
  ZoomIcon,
} from "@/components/transcript-library/SourcePlatformIcons";

interface IntegrationStatusRowProps {
  integration: IntegrationStatus;
  onManualSync?: () => void;
  onConnect?: () => void;
  onReconnect?: () => void;
  compact?: boolean;
}

const platformIcons = {
  fathom: FathomIcon,
  zoom: ZoomIcon,
};

const platformNames = {
  fathom: "Fathom",
  zoom: "Zoom",
};

export function IntegrationStatusRow({
  integration,
  onManualSync,
  onConnect,
  onReconnect,
  compact = false,
}: IntegrationStatusRowProps) {
  const Icon = platformIcons[integration.platform];
  const name = platformNames[integration.platform];

  const renderStatus = () => {
    if (!integration.connected) {
      return (
        <Badge variant="secondary" className="text-xs">
          Not Connected
        </Badge>
      );
    }

    switch (integration.syncStatus) {
      case "syncing":
        return (
          <Badge
            variant="default"
            className="bg-vibe-orange/10 text-vibe-orange border-vibe-orange/20 text-xs"
          >
            <RiLoader4Line className="mr-1 h-3 w-3 animate-spin" />
            Syncing...
          </Badge>
        );
      case "error":
        return (
          <Badge variant="destructive" className="text-xs">
            <RiErrorWarningLine className="mr-1 h-3 w-3" />
            Error
          </Badge>
        );
      case "idle":
      default:
        return (
          <Badge
            variant="default"
            className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-xs"
          >
            <RiCheckboxCircleLine className="mr-1 h-3 w-3" />
            Connected
          </Badge>
        );
    }
  };

  const renderLastSync = () => {
    if (!integration.connected || !integration.lastSyncAt) {
      return null;
    }

    const lastSync = new Date(integration.lastSyncAt);
    const timeAgo = formatDistanceToNow(lastSync, { addSuffix: true });

    return (
      <span className="text-xs text-muted-foreground">
        Last sync: {timeAgo}
      </span>
    );
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between transition-colors",
        compact
          ? "rounded-lg px-2 py-2 hover:bg-muted/50"
          : "rounded-xl border border-border/60 bg-card p-4",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2.5",
          !integration.connected && "opacity-50",
        )}
      >
        <div className="flex items-center justify-center">
          <Icon className={compact ? "h-7 w-7" : "h-8 w-8"} />
        </div>
        <div className="flex flex-col">
          <span className="font-medium text-sm">{name}</span>
          {compact && integration.email && (
            <span className="text-xs text-muted-foreground truncate max-w-[120px]">
              ({integration.email})
            </span>
          )}
          {!compact && integration.email && (
            <span className="text-[11px] text-muted-foreground truncate max-w-[180px]">
              {integration.email}
            </span>
          )}
          {!compact && renderLastSync()}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {!compact && renderStatus()}

        {integration.connected && onManualSync && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onManualSync}
            disabled={integration.syncStatus === "syncing"}
            className={compact ? "h-6 w-6 p-0" : "h-7 px-2"}
          >
            <RiRefreshLine
              className={cn(
                compact ? "h-3.5 w-3.5" : "h-4 w-4",
                integration.syncStatus === "syncing" && "animate-spin",
              )}
            />
          </Button>
        )}

        {!integration.connected && onConnect && (
          <Button
            variant="default"
            size="sm"
            onClick={onConnect}
            className={
              compact
                ? "h-6 text-xs px-2"
                : "bg-vibe-orange hover:opacity-90 text-white text-xs font-semibold uppercase tracking-wide rounded-lg px-3 py-1.5 h-auto border-0"
            }
          >
            Connect
          </Button>
        )}

        {integration.connected &&
          integration.syncStatus === "error" &&
          onReconnect && (
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
