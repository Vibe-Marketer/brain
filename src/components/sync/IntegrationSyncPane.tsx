import { useState } from "react";
import { IntegrationStatusRow } from "./IntegrationStatusRow";
import { AddIntegrationButton } from "./AddIntegrationButton";
import { InlineConnectionWizard } from "./InlineConnectionWizard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useIntegrationSync, type IntegrationStatus } from "@/hooks/useIntegrationSync";

export type IntegrationPlatform = "fathom" | "google_meet" | "zoom";

interface IntegrationSyncPaneProps {
  onIntegrationChange?: () => void;
}

export function IntegrationSyncPane({ onIntegrationChange }: IntegrationSyncPaneProps) {
  const [connectingIntegration, setConnectingIntegration] = useState<IntegrationPlatform | null>(null);

  const {
    integrations,
    isLoading,
    triggerManualSync,
  } = useIntegrationSync();

  const handleConnect = (platform: IntegrationPlatform) => {
    setConnectingIntegration(platform);
  };

  const handleConnectionComplete = () => {
    setConnectingIntegration(null);
    onIntegrationChange?.();
  };

  const handleConnectionCancel = () => {
    setConnectingIntegration(null);
  };

  const handleManualSync = async (platform: IntegrationPlatform) => {
    await triggerManualSync(platform);
  };

  const connectedPlatforms = integrations.filter((i: IntegrationStatus) => i.connected);
  const disconnectedPlatforms = integrations.filter((i: IntegrationStatus) => !i.connected);

  if (connectingIntegration) {
    return (
      <Card className="border-cb-border dark:border-cb-border-dark">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-montserrat font-extrabold uppercase tracking-wide">
            Connect Integration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <InlineConnectionWizard
            platform={connectingIntegration}
            onComplete={handleConnectionComplete}
            onCancel={handleConnectionCancel}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-cb-border dark:border-cb-border-dark">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-montserrat font-extrabold uppercase tracking-wide">
          Integrations
        </CardTitle>
        <AddIntegrationButton
          integrations={integrations}
          onConnect={handleConnect}
        />
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {isLoading ? (
          <div className="p-4 text-center text-ink-muted">
            Loading integrations...
          </div>
        ) : (
          <div>
            {/* Connected Integrations */}
            {connectedPlatforms.length > 0 && (
              <div>
                {connectedPlatforms.map((integration: IntegrationStatus) => (
                  <IntegrationStatusRow
                    key={integration.platform}
                    integration={integration}
                    onManualSync={() => handleManualSync(integration.platform)}
                    onReconnect={() => handleConnect(integration.platform)}
                  />
                ))}
              </div>
            )}

            {/* Separator between connected and disconnected */}
            {connectedPlatforms.length > 0 && disconnectedPlatforms.length > 0 && (
              <Separator className="my-0" />
            )}

            {/* Disconnected Integrations */}
            {disconnectedPlatforms.length > 0 && (
              <div className="opacity-60">
                {disconnectedPlatforms.map((integration: IntegrationStatus) => (
                  <IntegrationStatusRow
                    key={integration.platform}
                    integration={integration}
                    onConnect={() => handleConnect(integration.platform)}
                  />
                ))}
              </div>
            )}

            {/* Empty state */}
            {integrations.length === 0 && (
              <div className="p-6 text-center">
                <p className="text-ink-muted mb-4">
                  No integrations configured yet.
                </p>
                <AddIntegrationButton
                  integrations={integrations}
                  onConnect={handleConnect}
                  variant="primary"
                />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
