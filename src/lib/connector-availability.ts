import { tryGetSourceConfig } from "@/config/source-registry";
import type { ConnectorSourceApp } from "@/components/connectors/registry/types";

export function isConnectorAlwaysAvailable(sourceApp: ConnectorSourceApp): boolean {
  const authMode = tryGetSourceConfig(sourceApp)?.authMode;
  return authMode === "none" || authMode === "public-url";
}

export function isOAuthConnectorSource(sourceApp: string): boolean {
  return tryGetSourceConfig(sourceApp)?.authMode === "oauth2";
}
