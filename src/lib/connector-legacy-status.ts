/**
 * MIGRATION DEBT: this module hardcodes legacy `fathom_*` / `zoom_*`
 * user_settings columns because those columns were named before the
 * registry-driven model. Do not add new vendors here — new vendors
 * follow the registry pattern in src/config/source-registry.ts.
 */

import type { ConnectorSourceApp } from "@/components/connectors/registry/types";

export interface ConnectorLegacySettings {
  fathom_api_key: string | null;
  host_email?: string | null;
  oauth_token_expires: number | null;
  zoom_oauth_token_expires: number | null;
}

export function isLegacyConnectorConnected(params: {
  sourceApp: ConnectorSourceApp;
  settings: ConnectorLegacySettings | null;
  now?: number;
}): boolean {
  const { sourceApp, settings } = params;
  if (!settings) return false;

  const now = params.now ?? Date.now();

  if (sourceApp === "fathom") {
    return Boolean(
      settings.fathom_api_key ||
        (settings.oauth_token_expires && settings.oauth_token_expires > now),
    );
  }

  if (sourceApp === "zoom") {
    return Boolean(
      settings.zoom_oauth_token_expires &&
        settings.zoom_oauth_token_expires > now,
    );
  }

  return false;
}

export function getLegacyConnectorAccountEmail(params: {
  sourceApp: ConnectorSourceApp;
  settings: ConnectorLegacySettings | null;
}): string | null {
  if (params.sourceApp !== "fathom") return null;
  return params.settings?.host_email ?? null;
}
