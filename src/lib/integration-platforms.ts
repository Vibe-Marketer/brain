import {
  getConnectorAdapter,
  listConnectorAdapters,
} from "@/components/connectors/registry/connectorRegistry";
import type { ConnectorSourceApp } from "@/components/connectors/registry/types";
import { getConnectorCapabilities } from "@/lib/connector-capabilities";
import { getConnectorSyncFunctionName } from "@/lib/connector-sync-functions";

export type IntegrationPlatform = ConnectorSourceApp;

export const INTEGRATION_PLATFORMS: readonly IntegrationPlatform[] =
  listConnectorAdapters()
    .filter((adapter) => {
      const capabilities = getConnectorCapabilities(adapter);
      return (
        adapter.setup.kind === "oauth" &&
        capabilities.canSearchAvailable &&
        capabilities.canImportSelected &&
        Boolean(getConnectorSyncFunctionName(adapter.metadata.sourceApp))
      );
    })
    .map((adapter) => adapter.metadata.sourceApp);

export function getIntegrationPlatformConfig(platform: IntegrationPlatform) {
  return getConnectorAdapter(platform).metadata;
}

export function usesLegacySourceLessSync(params: {
  platform: IntegrationPlatform;
  sourceId?: string | null;
}): boolean {
  return params.platform === "fathom" && !params.sourceId;
}
