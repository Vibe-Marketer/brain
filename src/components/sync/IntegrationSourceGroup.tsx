import { useIntegrationSync } from "@/hooks/useIntegrationSync";
import { useIntegrationModalStore } from "@/stores/integrationModalStore";
import { IntegrationSourceCard } from "./IntegrationSourceCard";
import { IntegrationConnectModal } from "@/components/integrations/IntegrationConnectModal";
import { RiLoader4Line } from "@remixicon/react";

interface IntegrationSourceGroupProps {
  onIntegrationChange?: () => void;
}

/**
 * IntegrationSourceGroup - Grid of integration source cards for sync flow
 * 
 * Shows Fathom, Google Meet, Zoom as card-style buttons
 * Each shows platform icon, name, and "Connected" or "Connect ->" status
 * 
 * @brand-version v4.2
 */
export function IntegrationSourceGroup({
  onIntegrationChange,
}: IntegrationSourceGroupProps) {
  const { integrations, isLoading } = useIntegrationSync();
  const { openModal } = useIntegrationModalStore();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RiLoader4Line className="h-6 w-6 animate-spin text-ink-muted" />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-stretch gap-4">
        {integrations.map((integration) => (
          <IntegrationSourceCard
            key={integration.platform}
            platform={integration.platform}
            connected={integration.connected}
            onClick={() => openModal(integration.platform)}
          />
        ))}
      </div>
      <IntegrationConnectModal onConnectionChange={onIntegrationChange} />
    </>
  );
}
