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
import { FathomIcon, GoogleMeetIcon, ZoomIcon } from "@/components/transcript-library/SourcePlatformIcons";

interface IntegrationStatusRowProps {
  integration: IntegrationStatus;
  onManualSync?: () => void;
  onConnect?: () => void;
  onReconnect?: () => void;
  compact?: boolean;
}

const platformIcons = {
  fathom: FathomIcon,
  google_meet: GoogleMeetIcon,
  zoom: ZoomIcon,
};

const platformNames = {
  fathom: "Fathom",
  google_meet: "Google Meet",
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
          <Badge variant="default" className="bg-vibe-orange/10 text-vibe-orange border-vibe-orange/20 text-xs">
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
          <Badge variant="default" className="bg-success/10 text-success border-success/20 text-xs">
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
      <span className="text-xs text-ink-muted">
        Last sync: {timeAgo}
      </span>
    );
  };

  return (
    <div className={cn(
      "flex items-center justify-between rounded-lg transition-colors",
      compact
        ? "px-2 py-2 hover:bg-hover/50"
        : "px-4 py-3 border-b border-border dark:border-cb-border-dark last:border-b-0",
      !integration.connected && "opacity-50"
    )}>
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center">
          <Icon className={compact ? "h-7 w-7" : "h-8 w-8"} />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className={cn("font-medium", compact ? "text-sm" : "text-sm")}>{name}</span>
            {integration.email && (
              <span className="text-xs text-ink-muted truncate max-w-[120px]">
                ({integration.email})
              </span>
            )}
          </div>
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
            <RiRefreshLine className={cn(
              compact ? "h-3.5 w-3.5" : "h-4 w-4",
              integration.syncStatus === "syncing" && "animate-spin"
            )} />
          </Button>
        )}

        {!integration.connected && onConnect && (
          <Button
            variant="default"
            size="sm"
            onClick={onConnect}
            className={compact ? "h-6 text-xs px-2" : "h-7 text-xs"}
          >
            Connect
          </Button>
        )}

        {integration.connected && integration.syncStatus === "error" && onReconnect && (
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
