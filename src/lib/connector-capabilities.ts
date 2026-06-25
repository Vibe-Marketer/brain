import type {
  ConnectorAdapter,
  ConnectorSetupKind,
} from "@/components/connectors/registry/types";

const ONBOARDING_SETUP_KINDS = new Set<ConnectorSetupKind>([
  "oauth",
  "api_key",
  "api_key_webhook",
]);

export interface ConnectorCapabilities {
  canSearchAvailable: boolean;
  canImportSelected: boolean;
  /** Phase 28 (SYNC-02): provider exposes a server-side "Sync all" backfill. */
  canSyncAll: boolean;
  canOnboardInSetupWizard: boolean;
  importsAutomatically: boolean;
}

export function getConnectorCapabilities(
  adapter: ConnectorAdapter,
): ConnectorCapabilities {
  const canSearchAvailable = Boolean(adapter.searchAvailable);
  const canImportSelected = Boolean(adapter.importSelected);
  const canSyncAll = Boolean(adapter.syncAll);

  return {
    canSearchAvailable,
    canImportSelected,
    canSyncAll,
    canOnboardInSetupWizard: ONBOARDING_SETUP_KINDS.has(adapter.setup.kind),
    importsAutomatically: !canSearchAvailable || !canImportSelected,
  };
}

export function canConnectorOnboardInSetupWizard(
  adapter: ConnectorAdapter,
): boolean {
  return getConnectorCapabilities(adapter).canOnboardInSetupWizard;
}
