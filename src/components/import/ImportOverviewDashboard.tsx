/**
 * ImportOverviewDashboard — Pane 3 default view for the Import page.
 *
 * Issue #283 — Phase 4 migration. Source cards now render via
 * <ConnectorPanel />. The previous hand-rolled
 * deriveSourceStatus / SOURCE_DEFS constants are deleted because the
 * connector registry is the single source of truth, and useConnector
 * (inside ConnectorPanel) handles status the same way Settings does.
 *
 * Result: Settings and Import cannot structurally diverge on connection
 * status. Adding a new source (Otter, Gong, Granola) automatically shows
 * up here too — no edits to this file required.
 *
 * @pattern pane3-overview
 */

import * as React from "react";
import {
  RiAlertLine,
  RiCloseLine,
  RiDownloadCloud2Line,
} from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ConnectorPanel } from "@/components/connectors/ConnectorPanel";
import { listConnectorAdapters } from "@/components/connectors/registry/connectorRegistry";
import type { FailedImport } from "@/services/import-sources.service";

export interface ImportOverviewDashboardProps {
  counts: Record<string, number>;
  failedImports: FailedImport[];
  onSelectSource: (source: string) => void;
}

export function ImportOverviewDashboard({
  counts,
  failedImports,
  onSelectSource,
}: ImportOverviewDashboardProps) {
  const [alertDismissed, setAlertDismissed] = React.useState(false);
  const adapters = listConnectorAdapters();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Import Overview"
        subtitle="Manage your import sources and track sync activity"
        icon={RiDownloadCloud2Line}
      />
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
        {/* Failed imports alert */}
        {failedImports.length > 0 && !alertDismissed && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
            <RiAlertLine
              size={16}
              className="text-amber-500 flex-shrink-0 mt-0.5"
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                {failedImports.length} failed import
                {failedImports.length !== 1 ? "s" : ""} need attention
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 px-0 h-auto font-medium mt-0.5"
                onClick={() => onSelectSource("import-history")}
              >
                Review &amp; retry failed imports →
              </Button>
            </div>
            <button
              type="button"
              onClick={() => setAlertDismissed(true)}
              className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-amber-500/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Dismiss failed imports alert"
            >
              <RiCloseLine size={16} aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Sources grid (unified via ConnectorPanel) */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Sources
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {adapters.map((adapter) => (
              <ConnectorPanel
                key={adapter.metadata.sourceApp}
                sourceApp={adapter.metadata.sourceApp}
                count={counts[adapter.metadata.sourceApp] ?? 0}
                onClick={() => onSelectSource(adapter.metadata.sourceApp)}
              />
            ))}
          </div>
        </div>

        {/* Visual hint */}
        <p className="text-sm text-muted-foreground">
          Select a source from the sidebar to manage imports.
        </p>
      </div>
    </div>
  );
}

export default ImportOverviewDashboard;
