/**
 * SyncImportSurface — the Sync tab's provider-scoped wrapper around the shared
 * <ImportSurface> (26-03 TBL-01 cutover).
 *
 * The historical SyncTab was MULTI-PROVIDER: it rendered unsynced meetings
 * across every connected provider in one view (via connectedPlatforms +
 * useSyncSourceFilter). <ImportSurface> is single-`sourceApp`. The locked
 * 26-03 resolution preserves John's cross-provider access WITHOUT making the
 * surface internally multi-provider:
 *
 *   - A PROVIDER PICKER (reusing the existing connectedPlatforms /
 *     useSyncSourceFilter machinery) lets the user switch providers.
 *   - <ImportSurface> renders for the SELECTED provider, defaulting to the
 *     user's first/active connected provider.
 *
 * This is the Sync-tab seam only. The Import tab (ImportPage) renders the
 * surface for the provider being connected/imported. SyncTab.tsx and the
 * useSyncTab* hooks stay on disk until Plan 04 deletes them.
 */

import * as React from "react";

import { Button } from "@/components/ui/button";
import { ImportSurface } from "@/components/import/ImportSurface";
import { useIntegrationSync } from "@/hooks/useIntegrationSync";
import { useSyncSourceFilter } from "@/hooks/useSyncSourceFilter";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { getConnectorAdapter } from "@/components/connectors/registry/connectorRegistry";
import type { IntegrationPlatform } from "@/lib/integration-platforms";

export function SyncImportSurface() {
  const { activeOrgId } = useOrganizationContext();

  // Reuse the existing multi-provider machinery to drive the picker.
  const { integrations } = useIntegrationSync();
  const connectedIntegrations = React.useMemo(
    () => integrations.filter((i) => i.connected),
    [integrations],
  );
  // Stable identity so useSyncSourceFilter doesn't reset every render
  // (mirrors the SyncTab memo pattern).
  const connectedPlatformsKey = JSON.stringify(
    connectedIntegrations.map((i) => i.platform).sort(),
  );
  const connectedPlatforms = React.useMemo(
    () => connectedIntegrations.map((i) => i.platform),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [connectedPlatformsKey],
  );
  const { enabledSources } = useSyncSourceFilter({ connectedPlatforms });

  // Default to the user's first ENABLED connected provider, falling back to
  // the first connected provider (preserves the SyncTab default behaviour).
  const defaultProvider = React.useMemo<IntegrationPlatform | null>(() => {
    const firstEnabledConnected = enabledSources.find((source) =>
      connectedPlatforms.includes(source as IntegrationPlatform),
    ) as IntegrationPlatform | undefined;
    return firstEnabledConnected ?? connectedPlatforms[0] ?? null;
  }, [connectedPlatforms, enabledSources]);

  const [selectedProvider, setSelectedProvider] =
    React.useState<IntegrationPlatform | null>(null);

  // Adopt the default once it resolves, and self-heal if the active provider
  // is disconnected out from under the picker.
  React.useEffect(() => {
    if (
      selectedProvider &&
      connectedPlatforms.includes(selectedProvider)
    ) {
      return;
    }
    setSelectedProvider(defaultProvider);
  }, [selectedProvider, connectedPlatforms, defaultProvider]);

  const activeProvider = selectedProvider ?? defaultProvider;
  const sourceIdForProvider =
    connectedIntegrations.find((i) => i.platform === activeProvider)?.sourceId ??
    null;

  if (connectedPlatforms.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        Connect a source to import calls. Add a connection from the Import page.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Provider picker — preserves cross-provider access (locked 26-03). */}
      {connectedPlatforms.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground/60">
            Provider
          </span>
          {connectedPlatforms.map((platform) => {
            const isActive = platform === activeProvider;
            return (
              <Button
                key={platform}
                type="button"
                variant={isActive ? "default" : "hollow"}
                size="sm"
                onClick={() => setSelectedProvider(platform)}
                aria-pressed={isActive}
              >
                {getConnectorAdapter(platform).metadata.label}
              </Button>
            );
          })}
        </div>
      ) : null}

      {activeProvider ? (
        <ImportSurface
          key={activeProvider}
          sourceApp={activeProvider}
          sourceId={sourceIdForProvider}
          organizationId={activeOrgId}
        />
      ) : null}
    </div>
  );
}
