/**
 * IntegrationSourceCard — back-compat shim over ConnectorCardTile.
 *
 * Preserves the legacy `(platform, connected, enabled, onCardClick, onToggle)`
 * API and the async-toggle anti-flicker state machine (optimistic update +
 * revert on failure). All visual logic lives in the primitive.
 *
 * @brand-version v4.2
 */
import { useState } from "react";
import { ConnectorCardTile } from "@/components/connectors/primitives";
import type { IntegrationPlatform } from "@/hooks/useIntegrationSync";

interface IntegrationSourceCardProps {
  platform: IntegrationPlatform;
  connected: boolean;
  enabled: boolean;
  onCardClick: () => void;
  onToggle: (enabled: boolean) => Promise<boolean>;
}

export function IntegrationSourceCard({
  platform,
  connected,
  enabled,
  onCardClick,
  onToggle,
}: IntegrationSourceCardProps) {
  const [isToggling, setIsToggling] = useState(false);
  const [localEnabled, setLocalEnabled] = useState(enabled);

  if (!isToggling && localEnabled !== enabled) {
    setLocalEnabled(enabled);
  }

  const handleToggle = async (newEnabled: boolean) => {
    setIsToggling(true);
    setLocalEnabled(newEnabled);
    const success = await onToggle(newEnabled);
    if (!success) setLocalEnabled(!newEnabled);
    setIsToggling(false);
  };

  return (
    <ConnectorCardTile
      sourceApp={platform}
      status={connected ? "connected" : "not-connected"}
      enabled={localEnabled}
      switchDisabled={isToggling}
      onSwitchChange={handleToggle}
      onCardClick={onCardClick}
    />
  );
}
