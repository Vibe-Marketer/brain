import { IntegrationButtonGroup } from "@/components/integrations/IntegrationButtonGroup";
import { IntegrationConnectModal } from "@/components/integrations/IntegrationConnectModal";

export type IntegrationPlatform = "fathom" | "google_meet" | "zoom";

interface IntegrationSyncPaneProps {
  onIntegrationChange?: () => void;
}

/**
 * IntegrationSyncPane - Compact integration buttons for the Sync page
 *
 * Displays integrations as compact 56px buttons in a horizontal row.
 * Clicking any button opens the IntegrationConnectModal for connect/disconnect.
 *
 * @brand-version v4.2
 */
export function IntegrationSyncPane({ onIntegrationChange }: IntegrationSyncPaneProps) {
  return (
    <>
      <IntegrationButtonGroup onIntegrationChange={onIntegrationChange} />
      <IntegrationConnectModal onConnectionChange={onIntegrationChange} />
    </>
  );
}
