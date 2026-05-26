/**
 * CompactIntegrationButton — back-compat shim over ConnectorCardSquare.
 *
 * The legacy `platform/connected/email/lastSyncAt` API is preserved for callers
 * (currently IntegrationButtonGroup). All visual logic lives in the primitive.
 */
import { formatDistanceToNow } from "date-fns";
import { ConnectorCardSquare } from "@/components/connectors/primitives";
import type { IntegrationPlatform } from "@/hooks/useIntegrationSync";

interface CompactIntegrationButtonProps {
  platform: IntegrationPlatform;
  connected: boolean;
  email?: string;
  lastSyncAt?: string | null;
  onClick: () => void;
}

export function CompactIntegrationButton({
  platform,
  connected,
  email,
  lastSyncAt,
  onClick,
}: CompactIntegrationButtonProps) {
  const tooltipFooter = connected ? (
    <>
      {email && <p className="text-muted-foreground truncate">{email}</p>}
      {lastSyncAt && (
        <p className="text-muted-foreground">
          Last synced:{" "}
          {formatDistanceToNow(new Date(lastSyncAt), { addSuffix: true })}
        </p>
      )}
    </>
  ) : undefined;

  return (
    <ConnectorCardSquare
      sourceApp={platform}
      status={connected ? "connected" : "not-connected"}
      onClick={onClick}
      tooltipFooter={tooltipFooter}
    />
  );
}
