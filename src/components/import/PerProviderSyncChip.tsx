import { formatDistanceToNow } from "date-fns";
import {
  RiCheckLine,
  RiTimeLine,
  RiDownloadCloud2Line,
  RiAlertLine,
} from "@remixicon/react";

import { cn } from "@/lib/utils";
import { getConnectorAdapter } from "@/components/connectors/registry/connectorRegistry";
import type { ConnectorSourceApp } from "@/components/connectors/registry/types";

/**
 * PerProviderSyncChip — persistent, per-provider "at a glance" sync status
 * (JOB-05): "Last synced X · N new available · M failed".
 *
 * Purely presentational. All three values are supplied by <ImportSurface>:
 *   - lastSyncedAt: the most recent terminal job's completed_at for THIS source
 *   - newCount:     results.length - importedIds.size  (LOCKED — no new query)
 *   - failedCount:  lastCompletedJob.failed_ids.length (string[] .length)
 *
 * The provider label is derived from the adapter registry via `sourceApp` —
 * never a hardcoded provider name. The chip issues no query of its own; it only
 * renders what the surface already scoped through useSyncJobs (T-27-03-I).
 */

export interface PerProviderSyncChipProps {
  sourceApp: ConnectorSourceApp;
  lastSyncedAt?: string | null;
  newCount: number;
  failedCount: number;
}

export function PerProviderSyncChip({
  sourceApp,
  lastSyncedAt,
  newCount,
  failedCount,
}: PerProviderSyncChipProps) {
  // Provider label from the registry — never a literal provider name.
  let providerLabel: string = sourceApp;
  try {
    providerLabel = getConnectorAdapter(sourceApp).metadata.label;
  } catch {
    // Unknown/unregistered source — fall back to the raw sourceApp slug.
    providerLabel = sourceApp;
  }

  const hasNew = newCount > 0;
  const hasFailed = failedCount > 0;

  const lastSyncedLabel = lastSyncedAt
    ? `Last synced ${formatDistanceToNow(new Date(lastSyncedAt), {
        addSuffix: true,
      })}`
    : "Not synced yet";

  return (
    <div
      role="status"
      aria-label={`${providerLabel} sync status`}
      className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs"
    >
      <RiTimeLine className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-muted-foreground">{lastSyncedLabel}</span>

      <span className="text-muted-foreground/40">·</span>

      {hasNew ? (
        <span className="inline-flex items-center gap-1 font-medium text-primary">
          <RiDownloadCloud2Line className="h-3.5 w-3.5" />
          <span className="tabular-nums">{newCount}</span> new
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <RiCheckLine className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
          <span className="tabular-nums">0</span> new
        </span>
      )}

      {hasFailed ? (
        <>
          <span className="text-muted-foreground/40">·</span>
          <span
            className={cn(
              "inline-flex items-center gap-1 font-medium",
              "text-red-600 dark:text-red-400",
            )}
          >
            <RiAlertLine className="h-3.5 w-3.5" />
            <span className="tabular-nums">{failedCount}</span> failed
          </span>
        </>
      ) : null}
    </div>
  );
}
