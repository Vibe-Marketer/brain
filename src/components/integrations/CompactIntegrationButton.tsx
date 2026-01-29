import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { RiCheckLine, RiInformationLine } from "@remixicon/react";
import {
  FathomIcon,
  GoogleMeetIcon,
  ZoomIcon,
} from "@/components/transcript-library/SourcePlatformIcons";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import type { IntegrationPlatform } from "@/hooks/useIntegrationSync";

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

interface CompactIntegrationButtonProps {
  platform: IntegrationPlatform;
  connected: boolean;
  email?: string;
  lastSyncAt?: string | null;
  onClick: () => void;
}

export function CompactIntegrationButton({
  platform,
  connected,
  email,
  lastSyncAt,
  onClick,
}: CompactIntegrationButtonProps) {
  const Icon = platformIcons[platform];
  const name = platformNames[platform];

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            className={cn(
              // Size: 56px per CONTEXT.md decision (fits 6-8 per row)
              "w-14 h-14",
              // Shape: Square with rounded corners
              "relative rounded-xl",
              "flex items-center justify-center",
              "transition-all duration-200",
              // Ring for connection state
              "ring-2 ring-offset-2 ring-offset-background",
              connected ? "ring-success" : "ring-destructive/50",
              // Opacity per CONTEXT.md: 50-60% when disconnected
              !connected && "opacity-60",
              // Hover
              "hover:scale-105 hover:shadow-md",
              // Background
              "bg-card border border-border shadow-sm"
            )}
          >
            <Icon size={28} className={cn(!connected && "grayscale")} />

            {/* Connected: green checkmark badge bottom-right */}
            {connected && (
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-success flex items-center justify-center shadow-sm">
                <RiCheckLine className="h-2.5 w-2.5 text-white" />
              </div>
            )}

            {/* Connected: info icon top-right */}
            {connected && (
              <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white dark:bg-card border border-border flex items-center justify-center shadow-sm">
                <RiInformationLine className="h-2.5 w-2.5 text-ink-muted" />
              </div>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs max-w-[200px]">
          <div className="space-y-0.5">
            <p className="font-medium">
              {name} {connected ? "- Connected" : "- Not Connected"}
            </p>
            {connected && email && (
              <p className="text-ink-muted truncate">{email}</p>
            )}
            {connected && lastSyncAt && (
              <p className="text-ink-muted">
                Last synced:{" "}
                {formatDistanceToNow(new Date(lastSyncAt), { addSuffix: true })}
              </p>
            )}
            {!connected && <p className="text-ink-muted">Click to connect</p>}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
