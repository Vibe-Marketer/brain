import { useIntegrationSync } from "@/hooks/useIntegrationSync";
import { useIntegrationModalStore } from "@/stores/integrationModalStore";
import { IntegrationSourceCard } from "./IntegrationSourceCard";
import { IntegrationConnectModal } from "@/components/integrations/IntegrationConnectModal";
import { RiLoader4Line } from "@remixicon/react";

interface IntegrationSourceGroupProps {
  onIntegrationChange?: () => void;
  enabledSources: string[];
  onSourceToggle: (platform: string, enabled: boolean) => Promise<boolean>;
}

/**
 * IntegrationSourceGroup - Grid of integration source cards for sync flow
 * 
 * Shows Fathom, Google Meet, Zoom as compact cards
 * Each connected source has an on/off toggle below it
 * 
 * @brand-version v4.2
 */
export function IntegrationSourceGroup({
  onIntegrationChange,
  enabledSources,
  onSourceToggle,
}: IntegrationSourceGroupProps) {
  const { integrations, isLoading } = useIntegrationSync();
  const { openModal } = useIntegrationModalStore();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <RiLoader4Line className="h-5 w-5 animate-spin text-ink-muted" />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-start gap-3">
        {integrations.map((integration) => {
          const isEnabled = enabledSources.includes(integration.platform);
          return (
            <IntegrationSourceCard
              key={integration.platform}
              platform={integration.platform}
              connected={integration.connected}
              enabled={isEnabled}
              onCardClick={() => openModal(integration.platform)}
              onToggle={(newEnabled) => onSourceToggle(integration.platform, newEnabled)}
            />
          );
        })}
      </div>
      <IntegrationConnectModal onConnectionChange={onIntegrationChange} />
    </>
  );
}
