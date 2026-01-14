import { useState } from "react";
import { IntegrationStatusRow } from "@/components/sync/IntegrationStatusRow";
import { AddIntegrationButton } from "@/components/sync/AddIntegrationButton";
import { InlineConnectionWizard } from "@/components/sync/InlineConnectionWizard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useIntegrationSync, type IntegrationStatus, type IntegrationPlatform } from "@/hooks/useIntegrationSync";

interface IntegrationManagerProps {
  /** Callback when an integration's connection status changes */
  onIntegrationChange?: () => void;
  /** Display variant - compact for Import screen, full for Settings screen */
  variant?: "compact" | "full";
  /** Optional title override */
  title?: string;
  /** Whether to show in a card container */
  showCard?: boolean;
  /** Optional filter for specific platforms */
  platforms?: IntegrationPlatform[];
}

/**
 * IntegrationManager - Shared component for managing integrations
 *
 * Used in both Import (IntegrationSyncPane) and Settings (IntegrationsTab) screens
 * to ensure consistent behavior across the application.
 *
 * @brand-version v4.2
 */
export function IntegrationManager({
  onIntegrationChange,
  variant = "compact",
  title = "Integrations",
  showCard = false,
  platforms,
}: IntegrationManagerProps) {
  const [connectingIntegration, setConnectingIntegration] = useState<IntegrationPlatform | null>(null);

  const {
    integrations,
    isLoading,
    triggerManualSync,
  } = useIntegrationSync();

  // Filter integrations if platforms filter provided
  const filteredIntegrations = platforms
    ? integrations.filter((i) => platforms.includes(i.platform))
    : integrations;

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

  const connectedPlatforms = filteredIntegrations.filter((i: IntegrationStatus) => i.connected);
  const disconnectedPlatforms = filteredIntegrations.filter((i: IntegrationStatus) => !i.connected);

  // Get current email for the connecting platform (for reconnection notice)
  const connectingIntegrationEmail = connectingIntegration
    ? filteredIntegrations.find((i) => i.platform === connectingIntegration)?.email
    : undefined;

  const isCompact = variant === "compact";

  // Connection wizard view
  if (connectingIntegration) {
    const wizardContent = (
      <InlineConnectionWizard
        platform={connectingIntegration}
        onComplete={handleConnectionComplete}
        onCancel={handleConnectionCancel}
        currentEmail={connectingIntegrationEmail}
      />
    );

    if (showCard) {
      return (
        <Card className="border-border dark:border-cb-border-dark">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-montserrat font-extrabold uppercase tracking-wide">
              Connect Integration
            </CardTitle>
          </CardHeader>
          <CardContent>
            {wizardContent}
          </CardContent>
        </Card>
      );
    }

    return wizardContent;
  }

  // Integration list view
  const listContent = (
    <>
      {isLoading ? (
        <div className={isCompact ? "py-3 text-center text-ink-muted text-sm" : "py-6 text-center text-ink-muted"}>
          Loading integrations...
        </div>
      ) : (
        <div className={isCompact ? "space-y-1" : "space-y-2"}>
          {/* Connected Integrations */}
          {connectedPlatforms.map((integration: IntegrationStatus) => (
            <IntegrationStatusRow
              key={integration.platform}
              integration={integration}
              onManualSync={() => handleManualSync(integration.platform)}
              onReconnect={() => handleConnect(integration.platform)}
              compact={isCompact}
            />
          ))}

          {/* Disconnected Integrations */}
          {disconnectedPlatforms.map((integration: IntegrationStatus) => (
            <IntegrationStatusRow
              key={integration.platform}
              integration={integration}
              onConnect={() => handleConnect(integration.platform)}
              compact={isCompact}
            />
          ))}

          {/* Empty state */}
          {filteredIntegrations.length === 0 && (
            <div className="py-4 text-center">
              <p className="text-ink-muted text-sm mb-3">
                No integrations configured yet.
              </p>
              <AddIntegrationButton
                integrations={filteredIntegrations}
                onConnect={handleConnect}
                variant="primary"
              />
            </div>
          )}
        </div>
      )}
    </>
  );

  // Section header for compact variant
  if (isCompact) {
    return (
      <section>
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <h3 className="text-sm font-medium text-ink-soft uppercase tracking-wide">
            {title}
          </h3>
          <AddIntegrationButton
            integrations={filteredIntegrations}
            onConnect={handleConnect}
          />
        </div>
        <div className="pt-2">
          {listContent}
        </div>
      </section>
    );
  }

  // Full variant - optionally in a card
  if (showCard) {
    return (
      <Card className="border-border dark:border-cb-border-dark">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-montserrat font-extrabold uppercase tracking-wide flex items-center justify-between">
            <span>{title}</span>
            <AddIntegrationButton
              integrations={filteredIntegrations}
              onConnect={handleConnect}
            />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {listContent}
        </CardContent>
      </Card>
    );
  }

  // Full variant without card
  return (
    <div>
      <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
        <h3 className="font-semibold text-gray-900 dark:text-gray-50">
          {title}
        </h3>
        <AddIntegrationButton
          integrations={filteredIntegrations}
          onConnect={handleConnect}
        />
      </div>
      {listContent}
    </div>
  );
}

export type { IntegrationPlatform };
