import { IntegrationManager } from "@/components/shared/IntegrationManager";

export type IntegrationPlatform = "fathom" | "google_meet" | "zoom";

interface IntegrationSyncPaneProps {
  onIntegrationChange?: () => void;
}

/**
 * IntegrationSyncPane - Integration management for the Import screen
 *
 * Uses the shared IntegrationManager component with compact variant
 * to ensure consistent behavior across Import and Settings screens.
 */
export function IntegrationSyncPane({ onIntegrationChange }: IntegrationSyncPaneProps) {
  return (
    <IntegrationManager
      onIntegrationChange={onIntegrationChange}
      variant="compact"
      showCard={true}
      title="Integrations"
    />
  );
}
