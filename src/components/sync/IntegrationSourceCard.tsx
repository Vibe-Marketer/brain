import {
  FathomIcon,
  GoogleMeetIcon,
  ZoomIcon,
} from "@/components/transcript-library/SourcePlatformIcons";
import { cn } from "@/lib/utils";
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

interface IntegrationSourceCardProps {
  platform: IntegrationPlatform;
  connected: boolean;
  onClick: () => void;
  selected?: boolean;
}

/**
 * IntegrationSourceCard - Card-style integration button for sync flow
 * 
 * Shows platform icon, name, and "Connected" or "Connect ->" status below
 * Selected state shows orange border
 * 
 * @brand-version v4.2
 */
export function IntegrationSourceCard({
  platform,
  connected,
  onClick,
  selected = false,
}: IntegrationSourceCardProps) {
  const Icon = platformIcons[platform];
  const name = platformNames[platform];

  return (
    <button
      onClick={onClick}
      className={cn(
        // Size and shape - compact
        "w-[100px] px-3 py-2.5",
        "rounded-lg",
        "flex flex-col items-center justify-center gap-1.5",
        "transition-all duration-200",
        // Border and background
        "bg-card border",
        selected && connected
          ? "border-vibe-orange shadow-sm"
          : connected
          ? "border-border hover:border-success/50"
          : "border-border hover:border-ink-muted/50",
        // Hover
        "hover:shadow-sm",
        // Opacity when disconnected
        !connected && "opacity-70"
      )}
    >
      {/* Platform icon */}
      <div
        className={cn(
          "w-9 h-9 rounded-md flex items-center justify-center",
          connected ? "bg-success/10" : "bg-muted"
        )}
      >
        <Icon size={24} className={cn(!connected && "grayscale opacity-60")} />
      </div>

      {/* Platform name */}
      <span className="text-xs font-medium text-ink dark:text-white">
        {name}
      </span>

      {/* Connection status */}
      {connected ? (
        <span className="text-[10px] font-medium text-success flex items-center gap-1">
          <span className="w-1 h-1 rounded-full bg-success" />
          Connected
        </span>
      ) : (
        <span className="text-[10px] font-medium text-vibe-orange">
          Connect →
        </span>
      )}
    </button>
  );
}
