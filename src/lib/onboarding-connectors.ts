import {
  isKnownSourceApp,
  listConnectorAdapters,
} from "@/components/connectors/registry/connectorRegistry";
import type {
  ConnectorAdapter,
  ConnectorSourceApp,
} from "@/components/connectors/registry/types";
import { canConnectorOnboardInSetupWizard } from "@/lib/connector-capabilities";

export const ONBOARDING_CONNECTORS = listConnectorAdapters().filter(
  canConnectorOnboardInSetupWizard,
);

export function getOnboardingConnector(
  sourceApp: string | null | undefined,
): ConnectorAdapter | null {
  if (!sourceApp || !isKnownSourceApp(sourceApp)) return null;
  return (
    ONBOARDING_CONNECTORS.find(
      (adapter) => adapter.metadata.sourceApp === sourceApp,
    ) ?? null
  );
}

export function isOnboardingConnector(
  sourceApp: string | null | undefined,
): sourceApp is ConnectorSourceApp {
  return Boolean(getOnboardingConnector(sourceApp));
}
