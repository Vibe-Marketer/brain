/**
 * SourcesFilterPopover - Filter dropdown for toggling integration sources on Sync page
 *
 * Allows users to toggle which connected integrations' meetings are shown.
 * Uses Switch toggles with platform icons. Prevents disabling all sources.
 *
 * @pattern filter-popover
 * @brand-version v4.2
 */

import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { FilterButton } from "@/components/transcript-library/FilterButton";
import { Switch } from "@/components/ui/switch";
import {
  FathomIcon,
  GoogleMeetIcon,
  ZoomIcon,
} from "@/components/transcript-library/SourcePlatformIcons";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { RiFilter3Line } from "@remixicon/react";
import type { IntegrationStatus } from "@/hooks/useIntegrationSync";

interface SourcesFilterPopoverProps {
  /** Connected integrations from useIntegrationSync */
  connectedIntegrations: IntegrationStatus[];
  /** Currently enabled source platform strings from useSyncSourceFilter */
  enabledSources: string[];
  /** Toggle a single source. Returns false if prevented (would disable all). */
  onSourceToggle: (platform: string, enabled: boolean) => Promise<boolean>;
}

/** Platform display names */
const platformNames: Record<string, string> = {
  fathom: "Fathom",
  zoom: "Zoom",
  google_meet: "Google Meet",
};

/** Platform icon components */
const platformIcons: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  fathom: FathomIcon,
  zoom: ZoomIcon,
  google_meet: GoogleMeetIcon,
};

/** Order for displaying platforms */
const platformOrder = ["fathom", "zoom", "google_meet"];

export function SourcesFilterPopover({
  connectedIntegrations,
  enabledSources,
  onSourceToggle,
}: SourcesFilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const [togglingPlatform, setTogglingPlatform] = useState<string | null>(null);

  // Only show connected integrations
  const connectedPlatforms = connectedIntegrations
    .filter((i) => i.connected)
    .map((i) => i.platform);

  // Sort by defined order
  const orderedPlatforms = [...connectedPlatforms].sort(
    (a, b) => platformOrder.indexOf(a) - platformOrder.indexOf(b)
  );

  // Check if filter is active (some sources disabled)
  const isFilterActive = enabledSources.length < connectedPlatforms.length;

  // Get enabled platforms in order for icon display
  const enabledPlatformsOrdered = orderedPlatforms.filter((p) =>
    enabledSources.includes(p)
  );

  // Handle toggle with loading state
  const handleToggle = async (platform: string, enabled: boolean) => {
    setTogglingPlatform(platform);
    try {
      const success = await onSourceToggle(platform, enabled);
      if (!success) {
        // Toast is shown by the hook, no need to duplicate
      }
    } finally {
      setTogglingPlatform(null);
    }
  };

  // Don't render if no connected integrations
  if (connectedPlatforms.length === 0) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <FilterButton
          icon={
            enabledPlatformsOrdered.length > 0 ? (
              <div className="flex items-center -space-x-1">
                {enabledPlatformsOrdered.slice(0, 3).map((platform) => {
                  const Icon = platformIcons[platform];
                  return Icon ? (
                    <div key={platform} className="rounded-full shadow-sm">
                      <Icon size={14} />
                    </div>
                  ) : null;
                })}
              </div>
            ) : (
              <RiFilter3Line className="h-3.5 w-3.5" />
            )
          }
          label="Sources"
          count={enabledSources.length}
          active={isFilterActive}
        />
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0 bg-white dark:bg-card" align="start">
        <div className="space-y-0">
          <div className="p-4 pb-3">
            <div className="text-sm font-medium">Filter by source</div>
          </div>
          <div className="px-2 pb-3">
            <div className="space-y-1">
              {orderedPlatforms.map((platform) => {
                const Icon = platformIcons[platform];
                const isEnabled = enabledSources.includes(platform);
                const isToggling = togglingPlatform === platform;
                const isLastEnabled = isEnabled && enabledSources.length === 1;

                return (
                  <div
                    key={platform}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md transition-opacity",
                      !isEnabled && "opacity-50"
                    )}
                  >
                    {Icon && <Icon size={20} />}
                    <span className="flex-1 text-sm font-medium">
                      {platformNames[platform] || platform}
                    </span>
                    <Switch
                      checked={isEnabled}
                      disabled={isToggling || (isLastEnabled && isEnabled)}
                      onCheckedChange={(checked) => {
                        if (!checked && isLastEnabled) {
                          toast.error("At least one source must be enabled");
                          return;
                        }
                        handleToggle(platform, checked);
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
