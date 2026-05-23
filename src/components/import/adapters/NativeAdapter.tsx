/**
 * NativeAdapter — connector-framework adapter for sources whose OAuth, API
 * calls, and webhook delivery are owned by CallVault.
 *
 * Status: PARALLEL implementation. The five existing native sources (Fathom,
 * Fireflies, Zoom, Plaud, YouTube) continue to render through their dedicated
 * detail panels in `ImportPage.tsx`. This adapter is the target shape for
 * NEW native sources added under the connector framework (Otter, Avoma,
 * Grain, Read.ai, Chorus per ADR-006).
 *
 * Contract: any consumer of this adapter must supply the source-specific
 * connect / disconnect / sync handlers via props. The adapter owns layout,
 * loading/error states, and badge rendering only.
 */

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import type { SourceConfig } from "@/config/source-registry";
import type { ImportSource } from "@/services/import-sources.service";

export interface NativeAdapterActions {
  /** Trigger the source's connect / OAuth flow. Required. */
  onConnect: () => Promise<void> | void;
  /** Trigger a manual sync against the connected account. Optional. */
  onSyncNow?: () => Promise<void> | void;
  /** Disconnect the source. Receives the active row so the caller can confirm. */
  onDisconnect?: (source: ImportSource) => void;
}

export interface NativeAdapterProps extends NativeAdapterActions {
  source: SourceConfig;
  /** The matching `import_sources` row, if the user has connected this source. */
  sourceRow: ImportSource | null;
  /**
   * Source-specific body (token-paste field, account picker, etc.). Rendered
   * BETWEEN the status block and the action buttons. Native sources with no
   * extra configuration omit this entirely.
   */
  children?: React.ReactNode;
}

export function NativeAdapter({
  source,
  sourceRow,
  onConnect,
  onSyncNow,
  onDisconnect,
  children,
}: NativeAdapterProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const isConnected = !!sourceRow?.is_active;

  async function handleConnect() {
    setIsConnecting(true);
    try {
      await onConnect();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : `Failed to connect ${source.label}`,
      );
    } finally {
      setIsConnecting(false);
    }
  }

  async function handleSync() {
    if (!onSyncNow) return;
    setIsSyncing(true);
    try {
      await onSyncNow();
      toast.success(`${source.label} sync started`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : `Failed to sync ${source.label}`,
      );
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <PageHeader
        title={source.label}
        subtitle={source.subtitle}
        icon={source.icon}
      />

      <div className="px-6 py-4 max-w-2xl space-y-4">
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground">
            {isConnected
              ? `${source.label} connected`
              : `Connect ${source.label}`}
          </h3>
          {sourceRow?.account_email && (
            <p className="text-xs text-muted-foreground">
              Connected as {sourceRow.account_email}
            </p>
          )}
          {sourceRow?.last_sync_at && (
            <p className="text-xs text-muted-foreground">
              Last sync: {new Date(sourceRow.last_sync_at).toLocaleString()}
            </p>
          )}
          {sourceRow?.error_message && (
            <p className="text-xs text-destructive">
              {sourceRow.error_message}
            </p>
          )}
        </div>

        {children}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="default"
            onClick={() => void handleConnect()}
            disabled={isConnecting}
          >
            {isConnecting
              ? "Connecting…"
              : isConnected
                ? `Reconnect ${source.label}`
                : `Connect ${source.label}`}
          </Button>
          {isConnected && onSyncNow && (
            <Button
              variant="hollow"
              onClick={() => void handleSync()}
              disabled={isSyncing}
            >
              {isSyncing ? "Syncing…" : "Sync Now"}
            </Button>
          )}
          {isConnected && sourceRow && onDisconnect && (
            <Button variant="hollow" onClick={() => onDisconnect(sourceRow)}>
              Disconnect
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default NativeAdapter;
