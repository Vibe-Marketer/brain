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
 * Renders inside the per-source pane for connector-backed imports
 * (Fathom, Fireflies, Zoom, Plaud).
 *
 * Sections (in order):
 *   1. Setup/status cluster — shared connect, reconnect, disconnect, webhook state
 *   2. Date range picker — drives the search query
 *   3. Search results list — checkboxes per available call
 *   4. Workspace picker — destination for the selected calls
 *   5. Import button — fires adapter.importSelected() with the selection
 *
 * Per-adapter capability gating:
 *   - If adapter has no `searchAvailable`: hide date picker + search list,
 *     show an explanatory message instead (file-upload, youtube)
 *   - If adapter has no `importSelected`: hide workspace picker + import
 *     button, show "this connector imports automatically" message.
 */

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Label } from "@/components/ui/label";
import {
  RiLoader4Line,
  RiSearchLine,
} from "@remixicon/react";
import { toast } from "sonner";
import { ConnectorSetupCluster } from "@/components/connectors/setup";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { useRoutingDefault } from "@/hooks/useRoutingRules";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { getConnectorCapabilities } from "@/lib/connector-capabilities";
import { appendUniqueAvailableCalls } from "./connectorSearch";
import { invalidateConnectorQueries, useConnector } from "./hooks/useConnector";
import { getConnectorAdapter } from "./registry/connectorRegistry";
import type {
  AvailableCall,
  ConnectorSourceApp,
} from "./registry/types";

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
  const queryClient = useQueryClient();
  const adapter = getConnectorAdapter(sourceApp);
  const { status, refresh } = useConnector(sourceApp);
  const { activeOrgId } = useOrganizationContext();
  const {
    workspaces,
    isLoading: workspacesLoading,
    error: workspacesError,
  } = useWorkspaces(activeOrgId || null);
  const { data: connectorRoutingDefault } = useRoutingDefault(sourceApp);
  const capabilities = getConnectorCapabilities(adapter);

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
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [hasSearched, setHasSearched] = React.useState(false);
  const [searching, setSearching] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [selectedSourceId, setSelectedSourceId] = React.useState<
    string | undefined
  >(undefined);

  // Capability flags from adapter
  const canSearch = capabilities.canSearchAvailable;
  const canImportSelected = capabilities.canImportSelected;

  const selectedWorkspaceExists = workspaces.some((ws) => ws.id === workspaceId);
  const activeSourceRows = React.useMemo(
    () => (status?.allRows ?? []).filter((row) => row.is_active),
    [status?.allRows],
  );
  const sourceIdForActions = selectedSourceId ?? status?.sourceId ?? undefined;

  const resetSearchResults = React.useCallback(() => {
    setResults([]);
    setSelected(new Set());
    setNextCursor(null);
    setHasSearched(false);
  }, []);

  const handleConnectorStateChanged = React.useCallback(async () => {
    await refresh();
    await invalidateConnectorQueries(queryClient, sourceApp);
  }, [queryClient, refresh, sourceApp]);

  React.useEffect(() => {
    if (!workspaceId || workspacesLoading || workspaces.length === 0) return;
    if (!selectedWorkspaceExists) setWorkspaceId(undefined);
  }, [selectedWorkspaceExists, workspaceId, workspaces.length, workspacesLoading]);

  React.useEffect(() => {
    if (workspaceId || !connectorRoutingDefault?.target_workspace_id) return;
    setWorkspaceId(connectorRoutingDefault.target_workspace_id);
  }, [connectorRoutingDefault?.target_workspace_id, workspaceId]);

  React.useEffect(() => {
    if (!status?.sourceId) {
      setSelectedSourceId(undefined);
      return;
    }
    setSelectedSourceId((current) => {
      if (current && activeSourceRows.some((row) => row.id === current)) {
        return current;
      }
      return status.sourceId ?? undefined;
    });
  }, [activeSourceRows, status?.sourceId]);

  React.useEffect(() => {
    resetSearchResults();
  }, [resetSearchResults, sourceIdForActions]);

  const handleDateRangeChange = React.useCallback(
    (range: { from?: Date; to?: Date }) => {
      setDateRange(range);
      resetSearchResults();
    },
    [resetSearchResults],
  );

  const runSearch = async (cursor?: string) => {
    if (!adapter.searchAvailable || !sourceIdForActions) return;
    if (!dateRange.from || !dateRange.to) {
      toast.error("Pick a date range first");
      return;
    }
    const isNextPage = Boolean(cursor);
    if (isNextPage) setLoadingMore(true);
    else {
      setSearching(true);
      setHasSearched(true);
      setResults([]);
      setNextCursor(null);
      setSelected(new Set());
    }
    try {
      const { items, nextCursor: newNextCursor } = await adapter.searchAvailable({
        sourceId: sourceIdForActions,
        dateStart: dateRange.from,
        dateEnd: dateRange.to,
        cursor,
      });
      setResults((prev) => {
        if (!isNextPage) return items;
        return appendUniqueAvailableCalls(prev, items);
      });
      setNextCursor(newNextCursor ?? null);
      if (!isNextPage && items.length === 0) {
        toast.info("No calls found for that date range");
      }
    } catch (err) {
      toast.error(
        `${isNextPage ? "Loading more calls" : "Search"} failed: ${
          err instanceof Error ? err.message : "unknown error"
        }`,
      );
    } finally {
      if (isNextPage) setLoadingMore(false);
      else setSearching(false);
    }
  };

  const handleSearch = () => runSearch();
  const handleLoadMore = () => {
    if (!nextCursor || loadingMore || searching) return;
    return runSearch(nextCursor);
  };

  const handleImport = async () => {
    if (!adapter.importSelected || !sourceIdForActions) return;
    if (selected.size === 0) {
      toast.error("Select at least one call to import");
      return;
    }
    if (!workspaceId) {
      toast.error("Pick a destination workspace");
      return;
    }
    if (!selectedWorkspaceExists) {
      toast.error("Pick an available destination workspace");
      return;
    }
    setImporting(true);
    try {
      const job = await adapter.importSelected({
        sourceId: sourceIdForActions,
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

  const toggleSelected = (call: AvailableCall) => {
    if (call.alreadyImported) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(call.externalId)) next.delete(call.externalId);
      else next.add(call.externalId);
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
      {/* 1. Shared connector setup/status cluster */}
      {status ? (
        <div className="mt-6">
          <ConnectorSetupCluster
            sourceApp={sourceApp}
            mode="import"
            onConnected={handleConnectorStateChanged}
            onSaved={handleConnectorStateChanged}
            onDisconnected={handleConnectorStateChanged}
          />
        </div>
      ) : null}

      {canSearch &&
        status?.connected &&
        !sourceIdForActions && (
          <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            This connection needs to be reconnected before the unified import
            flow can search available calls.
          </div>
        )}

      {canSearch && activeSourceRows.length > 1 && (
        <div className="mt-8 max-w-sm space-y-1">
          <Label htmlFor={`${sourceApp}-source-account`}>
            Connected account
          </Label>
          <select
            id={`${sourceApp}-source-account`}
            value={sourceIdForActions ?? ""}
            onChange={(event) =>
              setSelectedSourceId(event.target.value || undefined)
            }
            className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
          >
            {activeSourceRows.map((row) => (
              <option key={row.id} value={row.id}>
                {row.account_email ?? `${adapter.metadata.label} account`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* If connector doesn't support search at all, render the "this connector
          imports automatically / via webhook" message and stop here. */}
      {capabilities.importsAutomatically && !canSearch && (
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
      {canSearch && status?.connected && sourceIdForActions && (
        <div className="mt-8 space-y-3">
          <h3 className="font-montserrat font-extrabold uppercase tracking-wide text-sm text-foreground">
            Search available calls
          </h3>
          <div className="flex flex-wrap items-end gap-3">
            <DateRangePicker
              dateRange={dateRange}
              onDateRangeChange={handleDateRangeChange}
              className="min-w-[260px]"
              disabled={searching || loadingMore}
            />
            <Button
              onClick={() => void handleSearch()}
              disabled={searching || loadingMore || !dateRange.from || !dateRange.to}
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

      {canSearch && !status?.connected && (
        <div className="mt-8 rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          Connect {adapter.metadata.label} to search and import available calls.
        </div>
      )}

      {canSearch &&
        status?.connected &&
        sourceIdForActions &&
        hasSearched &&
        !searching &&
        results.length === 0 && (
        <div className="mt-6 rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          No calls found for that date range.
        </div>
      )}

      {/* 3. Results list */}
      {canSearch && results.length > 0 && (
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">
              {results.length} call{results.length === 1 ? "" : "s"} found
            </h3>
            <Button
              variant="hollow"
              size="sm"
              onClick={toggleSelectAll}
              disabled={allSelectableIds.length === 0 || importing}
            >
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
                    onCheckedChange={() => toggleSelected(call)}
                    className="mt-1"
                    aria-label={`Select ${call.title}`}
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

      {canSearch && status?.connected && sourceIdForActions && nextCursor && (
        <div className="mt-6 flex justify-center">
          <Button
            variant="hollow"
            size="sm"
            onClick={() => void handleLoadMore()}
            disabled={loadingMore || searching}
          >
            {loadingMore ? (
              <>
                <RiLoader4Line className="mr-2 h-4 w-4 animate-spin" />
                Loading…
              </>
            ) : (
              "Load more"
            )}
          </Button>
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
              disabled={workspacesLoading || importing}
              aria-label="Destination workspace"
            >
              <option value="">
                {workspacesLoading ? "Loading workspaces…" : "Select workspace…"}
              </option>
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
            {workspacesError && (
              <p className="mt-1 text-xs text-destructive">
                Workspaces could not be loaded.
              </p>
            )}
            {!workspacesLoading && !workspacesError && workspaces.length === 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                No workspaces are available in this organization.
              </p>
            )}
          </div>
          <Button
            onClick={() => void handleImport()}
            disabled={
              importing ||
              selected.size === 0 ||
              !workspaceId ||
              !selectedWorkspaceExists ||
              workspacesLoading
            }
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
