/**
 * ConnectorDetailPanel — generic, registry-driven detail surface for
 * connector-framework sources.
 *
 * Status: PARALLEL implementation. The seven existing sources (Fathom,
 * Fireflies, Zoom, Plaud, YouTube, file-upload, paste-transcript) keep
 * rendering through their dedicated detail panels in `ImportPage.tsx`. This
 * panel is the target shape for NEW sources added under the framework.
 *
 * Dispatch contract:
 *   source.adapter === 'native'    → renders <NativeAdapter />
 *   source.adapter === 'composio'  → renders <ComposioAdapter />  (@composio-unverified)
 *   source.adapter === 'internal'  → renders a "use the dedicated surface" notice;
 *                                    internal sources (file-upload, paste-transcript)
 *                                    don't have an adapter shape — their UI lives
 *                                    in dedicated components.
 */

import type { SourceConfig } from "@/config/source-registry";
import type { ImportSource } from "@/services/import-sources.service";
import {
  NativeAdapter,
  type NativeAdapterActions,
} from "./adapters/NativeAdapter";
import { ComposioAdapter } from "./adapters/ComposioAdapter";

export interface ConnectorDetailPanelProps {
  source: SourceConfig;
  sourceRow: ImportSource | null;
  /**
   * Native-source action handlers. Required when source.adapter === 'native'.
   * Ignored for other adapters.
   */
  nativeActions?: NativeAdapterActions;
  onDisconnect?: (source: ImportSource) => void;
  children?: React.ReactNode;
}

export function ConnectorDetailPanel({
  source,
  sourceRow,
  nativeActions,
  onDisconnect,
  children,
}: ConnectorDetailPanelProps) {
  if (source.adapter === "composio") {
    return (
      <ComposioAdapter
        source={source}
        sourceRow={sourceRow}
        onDisconnect={onDisconnect}
      />
    );
  }

  if (source.adapter === "native") {
    if (!nativeActions) {
      return (
        <UsageError
          sourceLabel={source.label}
          reason={`ConnectorDetailPanel was rendered for a native source (${source.id}) without nativeActions. Wire the connect/sync/disconnect handlers.`}
        />
      );
    }
    return (
      <NativeAdapter
        source={source}
        sourceRow={sourceRow}
        onConnect={nativeActions.onConnect}
        onSyncNow={nativeActions.onSyncNow}
        onDisconnect={nativeActions.onDisconnect ?? onDisconnect}
      >
        {children}
      </NativeAdapter>
    );
  }

  // adapter === 'internal' — file-upload, paste-transcript
  return (
    <UsageError
      sourceLabel={source.label}
      reason={`${source.label} is an internal source and does not flow through ConnectorDetailPanel. Render its dedicated component instead.`}
    />
  );
}

function UsageError({
  sourceLabel,
  reason,
}: {
  sourceLabel: string;
  reason: string;
}) {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-6 py-4 max-w-2xl">
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground">
            {sourceLabel} — wiring error
          </h3>
          <p className="text-xs text-muted-foreground">{reason}</p>
        </div>
      </div>
    </div>
  );
}

export default ConnectorDetailPanel;
