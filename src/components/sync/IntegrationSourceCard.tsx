import { useState } from "react";
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
  onToggle: (enabled: boolean) => Promise<boolean>;
}

/**
 * IntegrationSourceCard - Card with toggle for sync flow
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
  
  // Local state to prevent flicker during async toggle
  const [isToggling, setIsToggling] = useState(false);
  const [localEnabled, setLocalEnabled] = useState(enabled);
  
  // Sync local state when prop changes (from parent)
  if (!isToggling && localEnabled !== enabled) {
    setLocalEnabled(enabled);
  }

  const handleToggle = async (newEnabled: boolean) => {
    setIsToggling(true);
    setLocalEnabled(newEnabled); // Optimistic update
    
    const success = await onToggle(newEnabled);
    
    if (!success) {
      // Revert if failed
      setLocalEnabled(!newEnabled);
    }
    
    setIsToggling(false);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Card button */}
      <button
        onClick={onCardClick}
        className={cn(
          // Size and shape
          "w-[100px] px-3 py-3",
          "rounded-xl",
          "flex flex-col items-center justify-center gap-1.5",
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
            "w-10 h-10 rounded-lg flex items-center justify-center",
            connected ? "bg-success/10" : "bg-muted"
          )}
        >
          <Icon size={24} className={cn(!connected && "grayscale opacity-60")} />
        </div>

        {/* Platform name */}
        <span className="text-xs font-medium text-ink dark:text-white leading-tight">
          {name}
        </span>

        {/* Connection status */}
        {connected ? (
          <span className="text-[10px] font-medium text-success flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-success" />
            Connected
          </span>
        ) : (
          <span className="text-[10px] font-medium text-vibe-orange">
            Connect →
          </span>
        )}
      </button>

      {/* Toggle switch - only show when connected */}
      {connected && (
        <div className="flex items-center gap-1.5">
          <span className={cn(
            "text-[10px] font-medium uppercase transition-colors",
            !localEnabled ? "text-ink-muted" : "text-ink-muted/40"
          )}>
            off
          </span>
          <Switch
            checked={localEnabled}
            onCheckedChange={handleToggle}
            disabled={isToggling}
            className="data-[state=checked]:bg-success"
          />
          <span className={cn(
            "text-[10px] font-medium uppercase transition-colors",
            localEnabled ? "text-success" : "text-ink-muted/40"
          )}>
            on
          </span>
        </div>
      )}
    </div>
  );
}
