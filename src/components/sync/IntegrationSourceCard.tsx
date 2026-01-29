import {
  FathomIcon,
  GoogleMeetIcon,
  ZoomIcon,
} from "@/components/transcript-library/SourcePlatformIcons";
import { Switch } from "@/components/ui/switch";
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
  enabled: boolean;
  onCardClick: () => void;
  onToggle: (enabled: boolean) => void;
}

/**
 * IntegrationSourceCard - Compact card with toggle for sync flow
 * 
 * Shows platform icon, name, connection status, and on/off toggle
 * Toggle controls whether this source is included in searches
 * 
 * @brand-version v4.2
 */
export function IntegrationSourceCard({
  platform,
  connected,
  enabled,
  onCardClick,
  onToggle,
}: IntegrationSourceCardProps) {
  const Icon = platformIcons[platform];
  const name = platformNames[platform];

  return (
    <div className="flex flex-col items-center gap-1.5">
      {/* Card button */}
      <button
        onClick={onCardClick}
        className={cn(
          // Size and shape - very compact
          "w-[72px] px-2 py-2",
          "rounded-lg",
          "flex flex-col items-center justify-center gap-1",
          "transition-all duration-200",
          // Border and background
          "bg-card border",
          connected
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
            "w-8 h-8 rounded flex items-center justify-center",
            connected ? "bg-success/10" : "bg-muted"
          )}
        >
          <Icon size={20} className={cn(!connected && "grayscale opacity-60")} />
        </div>

        {/* Platform name */}
        <span className="text-[10px] font-medium text-ink dark:text-white leading-tight">
          {name}
        </span>

        {/* Connection status */}
        {connected ? (
          <span className="text-[9px] font-medium text-success flex items-center gap-0.5">
            <span className="w-1 h-1 rounded-full bg-success" />
            Connected
          </span>
        ) : (
          <span className="text-[9px] font-medium text-vibe-orange">
            Connect →
          </span>
        )}
      </button>

      {/* Toggle switch - only show when connected */}
      {connected && (
        <div className="flex items-center gap-1">
          <span className={cn(
            "text-[9px] font-medium transition-colors",
            !enabled ? "text-ink-muted" : "text-ink-muted/50"
          )}>
            off
          </span>
          <Switch
            checked={enabled}
            onCheckedChange={onToggle}
            className="h-4 w-7 data-[state=checked]:bg-success"
          />
          <span className={cn(
            "text-[9px] font-medium transition-colors",
            enabled ? "text-success" : "text-ink-muted/50"
          )}>
            on
          </span>
        </div>
      )}
    </div>
  );
}
