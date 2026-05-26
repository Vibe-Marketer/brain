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
} from "@remixicon/react";
import { cn } from "@/lib/utils";
import { type IntegrationStatus } from "@/hooks/useIntegrationSync";
import { type IntegrationPlatform } from "./IntegrationSyncPane";
import {
  getIntegrationPlatformConfig,
  INTEGRATION_PLATFORMS,
} from "@/lib/integration-platforms";

interface AddIntegrationButtonProps {
  integrations: IntegrationStatus[];
  onConnect: (platform: IntegrationPlatform) => void;
  variant?: "default" | "primary";
}

const availableIntegrations: readonly IntegrationPlatform[] = INTEGRATION_PLATFORMS;

export function AddIntegrationButton({
  integrations,
  onConnect,
  variant = "default",
}: AddIntegrationButtonProps) {
  const connectedPlatforms = new Set(
    integrations.filter((i) => i.connected).map((i) => i.platform)
  );

  // Check if all available integrations are connected
  const allConnected = availableIntegrations.every((platform) =>
    connectedPlatforms.has(platform)
  );

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
        {availableIntegrations.map((platform) => {
          const metadata = getIntegrationPlatformConfig(platform);
          const Icon = metadata.icon;
          const isConnected = connectedPlatforms.has(platform);

          return (
            <DropdownMenuItem
              key={platform}
              onClick={() => {
                if (!isConnected) {
                  onConnect(platform);
                }
              }}
              className={cn(
                "flex items-center gap-3 py-2",
                isConnected && "opacity-50 cursor-default"
              )}
            >
              <Icon className="h-6 w-6" />
              <span className="flex-1">{metadata.label}</span>
              {isConnected && (
                <RiCheckboxCircleLine className="h-4 w-4 text-success" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
