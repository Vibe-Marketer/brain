import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  RiAddLine,
  RiCheckboxCircleLine,
  RiTimeLine,
} from "@remixicon/react";
import { cn } from "@/lib/utils";
import { type IntegrationStatus } from "@/hooks/useIntegrationSync";
import { type IntegrationPlatform } from "./IntegrationSyncPane";
import { FathomIcon, GoogleMeetIcon, ZoomIcon } from "@/components/transcript-library/SourcePlatformIcons";

interface AddIntegrationButtonProps {
  integrations: IntegrationStatus[];
  onConnect: (platform: IntegrationPlatform) => void;
  variant?: "default" | "primary";
}

const availableIntegrations: Array<{
  platform: IntegrationPlatform;
  name: string;
  Icon: typeof FathomIcon;
  available: boolean;
}> = [
  {
    platform: "fathom",
    name: "Fathom",
    Icon: FathomIcon,
    available: true,
  },
  {
    platform: "google_meet",
    name: "Google Meet",
    Icon: GoogleMeetIcon,
    available: true,
  },
  {
    platform: "zoom",
    name: "Zoom",
    Icon: ZoomIcon,
    available: true,
  },
];

export function AddIntegrationButton({
  integrations,
  onConnect,
  variant = "default",
}: AddIntegrationButtonProps) {
  const connectedPlatforms = new Set(
    integrations.filter((i) => i.connected).map((i) => i.platform)
  );

  // Check if all available integrations are connected
  const allConnected = availableIntegrations
    .filter((i) => i.available)
    .every((i) => connectedPlatforms.has(i.platform));

  if (allConnected) {
    return null; // Hide button when all integrations are connected
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant === "primary" ? "default" : "hollow"}
          size="sm"
          className="h-8 gap-1"
        >
          <RiAddLine className="h-4 w-4" />
          Add Integration
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {availableIntegrations.map((integration) => {
          const Icon = integration.Icon;
          const isConnected = connectedPlatforms.has(integration.platform);
          const isDisabled = !integration.available;

          return (
            <DropdownMenuItem
              key={integration.platform}
              onClick={() => {
                if (!isDisabled && !isConnected) {
                  onConnect(integration.platform);
                }
              }}
              disabled={isDisabled}
              className={cn(
                "flex items-center gap-3 py-2",
                isConnected && "opacity-50 cursor-default"
              )}
            >
              <Icon className="h-6 w-6" />
              <span className="flex-1">{integration.name}</span>
              {isConnected && (
                <RiCheckboxCircleLine className="h-4 w-4 text-success" />
              )}
              {isDisabled && (
                <span className="flex items-center gap-1 text-xs text-ink-muted">
                  <RiTimeLine className="h-3 w-3" />
                  Soon
                </span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
