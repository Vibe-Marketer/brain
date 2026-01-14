import { useState } from "react";
import { IntegrationStatusRow } from "./IntegrationStatusRow";
import { AddIntegrationButton } from "./AddIntegrationButton";
import { InlineConnectionWizard } from "./InlineConnectionWizard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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

  // Get current email for the connecting platform (for reconnection notice)
  const connectingIntegrationEmail = connectingIntegration
    ? integrations.find((i) => i.platform === connectingIntegration)?.email
    : undefined;

  if (connectingIntegration) {
    return (
      <Card className="border-border dark:border-cb-border-dark">
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
            currentEmail={connectingIntegrationEmail}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <section>
      {/* Section header - cleaner, no card border */}
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <h3 className="text-sm font-medium text-ink-soft uppercase tracking-wide">
          Integrations
        </h3>
        <AddIntegrationButton
          integrations={integrations}
          onConnect={handleConnect}
        />
      </div>

      {/* Compact integration list */}
      <div className="pt-2">
        {isLoading ? (
          <div className="py-3 text-center text-ink-muted text-sm">
            Loading integrations...
          </div>
        ) : (
          <div className="space-y-1">
            {/* Connected Integrations */}
            {connectedPlatforms.map((integration: IntegrationStatus) => (
              <IntegrationStatusRow
                key={integration.platform}
                integration={integration}
                onManualSync={() => handleManualSync(integration.platform)}
                onReconnect={() => handleConnect(integration.platform)}
                compact
              />
            ))}

            {/* Disconnected Integrations */}
            {disconnectedPlatforms.map((integration: IntegrationStatus) => (
              <IntegrationStatusRow
                key={integration.platform}
                integration={integration}
                onConnect={() => handleConnect(integration.platform)}
                compact
              />
            ))}

            {/* Empty state */}
            {integrations.length === 0 && (
              <div className="py-4 text-center">
                <p className="text-ink-muted text-sm mb-3">
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
      </div>
    </section>
  );
}
