/**
 * IntegrationStatusRow — back-compat shim over ConnectorCardRow.
 *
 * Preserves the legacy `(integration, onManualSync, onConnect, onReconnect, compact)`
 * API used by IntegrationManager. The IntegrationStatus shape is unpacked into
 * the primitive's `sourceApp/status/description/metadata` slots.
 */
import { formatDistanceToNow } from "date-fns";
import { ConnectorCardRow } from "@/components/connectors/primitives";
import { type IntegrationStatus } from "@/hooks/useIntegrationSync";
import type { ConnectorCardStatus } from "@/components/connectors/primitives";

interface IntegrationStatusRowProps {
  integration: IntegrationStatus;
  onManualSync?: () => void;
  onConnect?: () => void;
  onReconnect?: () => void;
  compact?: boolean;
}

function deriveStatus(integration: IntegrationStatus): ConnectorCardStatus {
  if (!integration.connected) return "not-connected";
  if (integration.syncStatus === "syncing") return "syncing";
  if (integration.syncStatus === "error") return "error";
  return "connected";
}

export function IntegrationStatusRow({
  integration,
  onManualSync,
  onConnect,
  onReconnect,
  compact = false,
}: IntegrationStatusRowProps) {
  const status = deriveStatus(integration);
  const description =
    !compact && integration.email ? integration.email : undefined;

  const metadata =
    compact && integration.email ? (
      <span className="text-xs text-muted-foreground truncate max-w-[120px]">
        ({integration.email})
      </span>
    ) : !compact && integration.connected && integration.lastSyncAt ? (
      <span className="text-xs text-muted-foreground">
        Last sync:{" "}
        {formatDistanceToNow(new Date(integration.lastSyncAt), {
          addSuffix: true,
        })}
      </span>
    ) : undefined;

  return (
    <ConnectorCardRow
      sourceApp={integration.platform}
      status={status}
      description={description}
      metadata={metadata}
      compact={compact}
      onManualSync={onManualSync}
      onConnect={onConnect}
      onReconnect={onReconnect}
    />
  );
}
