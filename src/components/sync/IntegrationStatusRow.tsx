import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  RiRefreshLine,
  RiCheckboxCircleLine,
  RiLoader4Line,
  RiErrorWarningLine,
  RiVideoLine,
  RiGoogleLine,
  RiVideoChatLine,
} from "@remixicon/react";
import { cn } from "@/lib/utils";
import { type IntegrationStatus } from "@/hooks/useIntegrationSync";
import { formatDistanceToNow } from "date-fns";

interface IntegrationStatusRowProps {
  integration: IntegrationStatus;
  onManualSync?: () => void;
  onConnect?: () => void;
  onReconnect?: () => void;
}

const platformIcons = {
  fathom: RiVideoLine,
  google_meet: RiGoogleLine,
  zoom: RiVideoChatLine,
};

const platformNames = {
  fathom: "Fathom",
  google_meet: "Google Meet",
  zoom: "Zoom",
};

const platformColors = {
  fathom: "text-purple-600 dark:text-purple-400",
  google_meet: "text-blue-600 dark:text-blue-400",
  zoom: "text-sky-600 dark:text-sky-400",
};

export function IntegrationStatusRow({
  integration,
  onManualSync,
  onConnect,
  onReconnect,
}: IntegrationStatusRowProps) {
  const Icon = platformIcons[integration.platform];
  const name = platformNames[integration.platform];
  const colorClass = platformColors[integration.platform];

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
      <span className="text-xs text-cb-ink-muted">
        Last sync: {timeAgo}
      </span>
    );
  };

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-cb-border dark:border-cb-border-dark last:border-b-0">
      <div className="flex items-center gap-3">
        <div className={cn("h-8 w-8 rounded-lg bg-muted flex items-center justify-center", colorClass)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{name}</span>
            {integration.email && (
              <span className="text-xs text-cb-ink-muted">
                ({integration.email})
              </span>
            )}
          </div>
          {renderLastSync()}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {renderStatus()}

        {integration.connected && onManualSync && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onManualSync}
            disabled={integration.syncStatus === "syncing"}
            className="h-7 px-2"
          >
            <RiRefreshLine className={cn(
              "h-4 w-4",
              integration.syncStatus === "syncing" && "animate-spin"
            )} />
          </Button>
        )}

        {!integration.connected && onConnect && (
          <Button
            variant="default"
            size="sm"
            onClick={onConnect}
            className="h-7 text-xs"
          >
            Connect
          </Button>
        )}

        {integration.connected && integration.syncStatus === "error" && onReconnect && (
          <Button
            variant="hollow"
            size="sm"
            onClick={onReconnect}
            className="h-7 text-xs"
          >
            Reconnect
          </Button>
        )}
      </div>
    </div>
  );
}
