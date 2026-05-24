/**
 * ConnectorImportWizard — the unified import flow for ANY connector.
 *
 * Issue #295 / Phase 8 of #283. Andrew's product requirement:
 *
 *   "All the new connectors are not following the right flow of what's
 *    supposed to happen. They're supposed to go through the same process
 *    that 'fathom' does. You should be able to:
 *      1. Connect the platform
 *      2. See that it's connected
 *      3. Have confirmation that it's still connected
 *      4. Have the option to search available calls — by date, etc.
 *      5. When you search, all the calls available for that date should
 *         show up below
 *      6. Option to select those calls/transcripts you want to bring into
 *         the library
 *      7. Option to select which workspace those calls go to
 *      8. Selectively choose and import calls into your workspaces"
 *
 * Renders inside the per-source pane (Phase 5 will swap the bespoke
 * FathomImportDetail / FirefliesImportDetail / ZoomImportDetail panes
 * for `<ConnectorImportWizard sourceApp="..." />`).
 *
 * Sections (in order):
 *   1. Status header — uses <ConnectorPanel layout="detail" />
 *   2. Date range picker — drives the search query
 *   3. Search results list — checkboxes per available call
 *   4. Workspace picker — destination for the selected calls
 *   5. Import button — fires adapter.importSelected() with the selection
 *
 * Per-adapter capability gating:
 *   - If adapter has no `searchAvailable`: hide date picker + search list,
 *     show an explanatory message instead (file-upload, youtube)
 *   - If adapter has no `importSelected`: hide workspace picker + import
 *     button, show "this connector imports automatically" message (plaud
 *     in its current bulk-sync mode — Phase 8e replaces it with selective)
 *
 * Status: SCAFFOLD ONLY in this PR. The 6 adapters don't yet implement
 * searchAvailable / importSelected — that's Phase 8b-8e per the issue.
 * No consumer migration in this PR — the existing per-source detail
 * panes continue to handle Fathom / Fireflies / Zoom imports.
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { RiLoader4Line, RiSearchLine } from "@remixicon/react";
import { toast } from "sonner";
import { ConnectorPanel } from "./ConnectorPanel";
import { useConnector } from "./hooks/useConnector";
import { getConnectorAdapter } from "./registry/connectorRegistry";
import type { AvailableCall, ConnectorSourceApp } from "./registry/types";

interface ConnectorImportWizardProps {
  sourceApp: ConnectorSourceApp;
  /** Optional initial workspace pre-selection (e.g. from URL or context). */
  initialWorkspaceId?: string;
  /** Optional callback when import completes successfully. */
  onImportComplete?: (jobId: string) => void;
  className?: string;
}

export function ConnectorImportWizard({
  sourceApp,
  initialWorkspaceId,
  onImportComplete,
  className,
}: ConnectorImportWizardProps) {
  const adapter = getConnectorAdapter(sourceApp);
  const { status } = useConnector(sourceApp);

  // Wizard state
  const [dateRange, setDateRange] = React.useState<{
    from?: Date;
    to?: Date;
  }>({});
  const [results, setResults] = React.useState<AvailableCall[]>([]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [workspaceId, setWorkspaceId] = React.useState<string | undefined>(
    initialWorkspaceId,
  );
  const [searching, setSearching] = React.useState(false);
  const [importing, setImporting] = React.useState(false);

  // Capability flags from adapter
  const canSearch = Boolean(adapter.searchAvailable);
  const canImportSelected = Boolean(adapter.importSelected);

  const handleSearch = async () => {
    if (!adapter.searchAvailable || !status?.sourceId) return;
    if (!dateRange.from || !dateRange.to) {
      toast.error("Pick a date range first");
      return;
    }
    setSearching(true);
    setSelected(new Set());
    try {
      const { items } = await adapter.searchAvailable({
        sourceId: status.sourceId,
        dateStart: dateRange.from,
        dateEnd: dateRange.to,
      });
      setResults(items);
      if (items.length === 0) {
        toast.info("No calls found for that date range");
      }
    } catch (err) {
      toast.error(
        `Search failed: ${err instanceof Error ? err.message : "unknown error"}`,
      );
    } finally {
      setSearching(false);
    }
  };

  const handleImport = async () => {
    if (!adapter.importSelected || !status?.sourceId) return;
    if (selected.size === 0) {
      toast.error("Select at least one call to import");
      return;
    }
    if (!workspaceId) {
      toast.error("Pick a destination workspace");
      return;
    }
    setImporting(true);
    try {
      const job = await adapter.importSelected({
        sourceId: status.sourceId,
        externalIds: Array.from(selected),
        workspaceId,
      });
      toast.success(
        job.message ??
          `Importing ${job.total} call${job.total === 1 ? "" : "s"} into workspace`,
      );
      setSelected(new Set());
      onImportComplete?.(job.jobId);
    } catch (err) {
      toast.error(
        `Import failed: ${err instanceof Error ? err.message : "unknown error"}`,
      );
    } finally {
      setImporting(false);
    }
  };

  const toggleSelected = (externalId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(externalId)) next.delete(externalId);
      else next.add(externalId);
      return next;
    });
  };

  const allSelectableIds = results
    .filter((r) => !r.alreadyImported)
    .map((r) => r.externalId);
  const allSelected =
    allSelectableIds.length > 0 &&
    allSelectableIds.every((id) => selected.has(id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allSelectableIds));
    }
  };

  return (
    <div className={className}>
      {/* 1. Status header */}
      <ConnectorPanel sourceApp={sourceApp} layout="detail" />

      {/* If connector doesn't support search at all, render the "this connector
          imports automatically / via webhook" message and stop here. */}
      {!canSearch && (
        <div className="mt-8 rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">
            {adapter.metadata.label} imports automatically
          </p>
          <p className="mt-1">
            This connector doesn&apos;t support selective import yet — calls
            arrive via webhook or polling.
          </p>
        </div>
      )}

      {/* 2. Date range picker + Search */}
      {canSearch && status?.connected && (
        <div className="mt-8 space-y-3">
          <h3 className="font-montserrat font-extrabold uppercase tracking-wide text-sm text-foreground">
            Search available calls
          </h3>
          <div className="flex flex-wrap items-end gap-3">
            <DateRangePicker
              value={dateRange}
              onChange={setDateRange}
              className="min-w-[260px]"
            />
            <Button
              onClick={() => void handleSearch()}
              disabled={searching || !dateRange.from || !dateRange.to}
            >
              {searching ? (
                <RiLoader4Line className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RiSearchLine className="mr-2 h-4 w-4" />
              )}
              Search {adapter.metadata.label}
            </Button>
          </div>
        </div>
      )}

      {/* 3. Results list */}
      {canSearch && results.length > 0 && (
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">
              {results.length} call{results.length === 1 ? "" : "s"} found
            </h3>
            <Button variant="hollow" size="sm" onClick={toggleSelectAll}>
              {allSelected ? "Deselect all" : "Select all"}
            </Button>
          </div>
          <div className="rounded-lg border border-border divide-y divide-border">
            {results.map((call) => {
              const isSelected = selected.has(call.externalId);
              return (
                <label
                  key={call.externalId}
                  className={`flex items-start gap-3 p-3 cursor-pointer transition-colors ${
                    call.alreadyImported
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-muted/40"
                  }`}
                >
                  <Checkbox
                    checked={isSelected}
                    disabled={call.alreadyImported}
                    onCheckedChange={() => toggleSelected(call.externalId)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {call.title}
                      {call.alreadyImported && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          (already imported)
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {call.startTime
                        ? new Date(call.startTime).toLocaleString()
                        : "—"}
                      {call.durationSeconds
                        ? ` · ${Math.round(call.durationSeconds / 60)}m`
                        : ""}
                      {call.participants && call.participants.length > 0
                        ? ` · ${call.participants.length} participant${call.participants.length === 1 ? "" : "s"}`
                        : ""}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* 4 + 5. Workspace picker + Import button */}
      {canSearch && canImportSelected && results.length > 0 && (
        <div className="mt-6 flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Destination workspace
            </label>
            <select
              value={workspaceId ?? ""}
              onChange={(e) => setWorkspaceId(e.target.value || undefined)}
              className="rounded-md border border-border bg-card px-3 py-2 text-sm"
            >
              <option value="">Select workspace…</option>
              {/* TODO Phase 8a-ii: wire to useWorkspaces() so the dropdown
                  shows real workspaces. Scaffold leaves it empty for now. */}
            </select>
          </div>
          <Button
            onClick={() => void handleImport()}
            disabled={importing || selected.size === 0 || !workspaceId}
          >
            {importing
              ? "Importing…"
              : `Import ${selected.size} call${selected.size === 1 ? "" : "s"}`}
          </Button>
        </div>
      )}
    </div>
  );
}
