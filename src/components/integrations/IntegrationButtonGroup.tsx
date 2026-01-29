import { useIntegrationSync } from "@/hooks/useIntegrationSync";
import { useIntegrationModalStore } from "@/stores/integrationModalStore";
import { CompactIntegrationButton } from "./CompactIntegrationButton";
import { RiLoader4Line } from "@remixicon/react";

interface IntegrationButtonGroupProps {
  onIntegrationChange?: () => void;
}

export function IntegrationButtonGroup({
  onIntegrationChange: _onIntegrationChange,
}: IntegrationButtonGroupProps) {
  const { integrations, isLoading } = useIntegrationSync();
  const { openModal } = useIntegrationModalStore();

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-ink-soft uppercase tracking-wide">
        Integrations
      </span>
      <div className="flex items-center gap-2">
        {isLoading ? (
          <RiLoader4Line className="h-5 w-5 animate-spin text-ink-muted" />
        ) : (
          integrations.map((integration) => (
            <CompactIntegrationButton
              key={integration.platform}
              platform={integration.platform}
              connected={integration.connected}
              email={integration.email}
              lastSyncAt={integration.lastSyncAt}
              onClick={() => openModal(integration.platform)}
            />
          ))
        )}
      </div>
    </div>
  );
}
