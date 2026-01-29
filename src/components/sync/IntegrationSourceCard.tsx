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
        // Size and shape
        "w-[140px] min-h-[100px] px-4 py-4",
        "rounded-xl",
        "flex flex-col items-center justify-center gap-2",
        "transition-all duration-200",
        // Border and background
        "bg-card border-2",
        selected && connected
          ? "border-vibe-orange shadow-md"
          : connected
          ? "border-border hover:border-success/50"
          : "border-border hover:border-ink-muted/50",
        // Hover
        "hover:shadow-md",
        // Opacity when disconnected
        !connected && "opacity-80"
      )}
    >
      {/* Platform icon */}
      <div
        className={cn(
          "w-12 h-12 rounded-lg flex items-center justify-center",
          connected ? "bg-success/10" : "bg-muted"
        )}
      >
        <Icon size={32} className={cn(!connected && "grayscale opacity-60")} />
      </div>

      {/* Platform name */}
      <span className="text-sm font-medium text-ink dark:text-white">
        {name}
      </span>

      {/* Connection status */}
      {connected ? (
        <span className="text-xs font-medium text-success flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-success" />
          Connected
        </span>
      ) : (
        <span className="text-xs font-medium text-vibe-orange">
          Connect →
        </span>
      )}
    </button>
  );
}
