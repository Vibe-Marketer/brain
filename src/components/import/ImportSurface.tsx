/**
 * ImportSurface — the ONE shared, two-section dense import surface (TBL-01,
 * BROWSE-01). Lifted from the proven SyncTab shape (find-new section stacked
 * over browse-synced section, both on the dense `TranscriptTable`) into a
 * single component parameterized by `sourceApp`.
 *
 * Both the Import tab (per-source pane in `ImportPage`) and the Sync tab
 * (`TranscriptsNew` `TabsContent value="sync"`) render this same component —
 * one paging model, one selection store, one synced overlay.
 *
 * Wiring (no hand-rolling — RESEARCH "Don't Hand-Roll"):
 *   - Rendering: the dense `TranscriptTable` (reused unchanged), NOT a custom
 *     checkbox list (the wizard regression).
 *   - Selection: durable `useImportSelection` (Phase 25) — survives
 *     nav/OAuth/date-change; cleared ONLY on successful job creation. Never
 *     volatile `useState` selection sets (the cause of John's vanishing picks).
 *   - "Already imported?": the provider-agnostic `overlaySyncStatus` overlay
 *     (Task 1) — grouped by REAL source_app, org-threaded, merge-not-clobber
 *     (TBL-02 + the Phase 24 carry-forward triple CR-02/WR-01/WR-02). NEVER the
 *     per-adapter server-computed synced flag, never a literal "fathom".
 *
 * Capability gating (all 7 providers) via `getConnectorCapabilities`:
 *   - no `searchAvailable` (file-upload, youtube) → hide date picker + find
 *     section, show the "imports automatically" card.
 *   - no `importSelected` → hide workspace picker + import button.
 *
 * Selection keyspaces are kept DISTINCT (Pitfall 5): find-new rows key by
 * `source_app::externalId` (Phase 25 entry key); browse-synced rows key by the
 * recording UUID. They are never mixed.
 *
 * Phase 27 (job-status banner) and Phase 28 ("Sync all from provider") seams
 * are left clean and clearly commented — this plan does NOT build job-poll /
 * progress machinery (Phase 27) or the server sync-all behaviour (Phase 28).
 */

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { DateRange } from "react-day-picker";
import {
  RiAlertLine,
  RiArrowDownSLine,
  RiLoader4Line,
  RiRefreshLine,
  RiSearchLine,
  RiSettings3Line,
} from "@remixicon/react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { StatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { TranscriptTable } from "@/components/transcript-library/TranscriptTable";
import { ConnectorSetupCluster } from "@/components/connectors/setup";
import {
  invalidateConnectorQueries,
  useConnector,
} from "@/components/connectors/hooks/useConnector";
import { getConnectorAdapter } from "@/components/connectors/registry/connectorRegistry";
import { searchAllAvailableConnectorCalls } from "@/components/connectors/connectorSearch";
import { getConnectorCapabilities } from "@/lib/connector-capabilities";
import { useOrganizationWorkspaces } from "@/hooks/useWorkspaces";
import { useImportSelection } from "@/hooks/useImportSelection";
import { useExistingTranscripts } from "@/hooks/useExistingTranscripts";
import { useRetryFailedImport } from "@/hooks/useImportSources";
import { useSyncJobs } from "@/hooks/useSyncJobs";
import { overlaySyncStatus } from "./importSurfaceSyncStatus";
import { SyncJobBanner } from "./SyncJobBanner";
import { PerProviderSyncChip } from "./PerProviderSyncChip";
import type { AvailableCall } from "@/components/connectors/registry/types";
import type { ConnectorSourceApp } from "@/components/connectors/registry/types";
import type { Meeting } from "@/types/meetings";

export interface ImportSurfaceProps {
  /** The provider this surface imports from (drives every per-row source_app). */
  sourceApp: ConnectorSourceApp;
  /** The active import_sources row id used for provider search/import calls. */
  sourceId?: string | null;
  /** Pre-selected destination workspace (e.g. from routing default). */
  workspaceId?: string | null;
  /** Org scope threaded to the overlay + selection so synced status can't leak cross-org. */
  organizationId?: string | null;
  className?: string;
}

const BROWSE_PAGE_SIZE = 50;

/**
 * Find-new row selection key (Pitfall 5): `source_app::externalId`, matching the
 * Phase 25 / syncSelection `::` + encodeURIComponent convention. Kept DISTINCT
 * from browse-synced rows (which key by recording UUID). Ids stay opaque strings.
 */
function findRowKey(sourceApp: string, externalId: string): string {
  return `${encodeURIComponent(sourceApp)}::${encodeURIComponent(externalId)}`;
}

export function ImportSurface({
  sourceApp,
  sourceId,
  workspaceId: initialWorkspaceId,
  organizationId,
  className,
}: ImportSurfaceProps) {
  const queryClient = useQueryClient();
  const adapter = getConnectorAdapter(sourceApp);
  const capabilities = getConnectorCapabilities(adapter);
  const { status, refresh } = useConnector(sourceApp);

  const {
    workspaces,
    isLoading: workspacesLoading,
    error: workspacesError,
  } = useOrganizationWorkspaces(organizationId ?? null);

  // The surface owns its own date-range state + picker (Open Question 1).
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(
    undefined,
  );
  const dateStart = dateRange?.from ? dateRange.from.toISOString() : null;
  const dateEnd = dateRange?.to ? dateRange.to.toISOString() : null;

  // Durable selection (Phase 25) — selection NEVER lives in volatile component
  // state; it is owned by the durable store via the hook below.
  const {
    toggle,
    selectAllMatching,
    isSelected,
    count,
    reconcile,
    clearSelection,
  } = useImportSelection({
    sourceApp,
    dateStart,
    dateEnd,
    organizationId,
  });

  const [workspaceId, setWorkspaceId] = React.useState<string | undefined>(
    initialWorkspaceId ?? undefined,
  );
  const [results, setResults] = React.useState<AvailableCall[]>([]);
  // Overlay result (NOT selection): which find-row externalIds are already
  // imported. Typed as a ReadonlySet — distinct from the durable selection store.
  const [importedIds, setImportedIds] = React.useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  const [searching, setSearching] = React.useState(false);
  const [hasSearched, setHasSearched] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [showConnectionSettings, setShowConnectionSettings] =
    React.useState(false);

  const sourceIdForActions = sourceId ?? status?.sourceId ?? undefined;
  const canSearch = capabilities.canSearchAvailable;
  const canImportSelected = capabilities.canImportSelected;
  // Phase 28 (SYNC-02): server-side "Sync all from this provider" capability.
  const canSyncAll = capabilities.canSyncAll;
  const [syncingAll, setSyncingAll] = React.useState(false);

  const selectedWorkspaceExists = workspaces.some((ws) => ws.id === workspaceId);

  const handleConnectorStateChanged = React.useCallback(async () => {
    await refresh();
    await invalidateConnectorQueries(queryClient, sourceApp);
  }, [queryClient, refresh, sourceApp]);

  const handleDateRangeChange = React.useCallback(
    (range: { from?: Date; to?: Date }) => {
      setDateRange(range.from || range.to ? (range as DateRange) : undefined);
      setHasSearched(false);
      setResults([]);
    },
    [],
  );

  // --- Section A: find-new (live provider search + overlay) --------------
  const handleSearch = React.useCallback(async () => {
    if (!adapter.searchAvailable || !sourceIdForActions) {
      toast.error("Connect this source before searching");
      return;
    }
    if (!dateRange?.from || !dateRange?.to) {
      toast.error("Pick a date range first");
      return;
    }
    setSearching(true);
    setHasSearched(true);
    try {
      // Auto-page the provider results (kills the "Load 10 at a time" loop).
      const items = await searchAllAvailableConnectorCalls({
        searchAvailable: adapter.searchAvailable,
        sourceId: sourceIdForActions,
        dateStart: dateRange.from,
        dateEnd: dateRange.to,
      });
      setResults(items);

      // TBL-02 overlay: compute already-imported via the canonical reader,
      // grouped by each row's REAL source_app (here all rows share this
      // surface's sourceApp) and org-threaded. Merge-not-clobber.
      const imported = await overlaySyncStatus(
        items.map((i) => ({ externalId: i.externalId, sourceApp })),
        { organizationId },
      );
      setImportedIds(imported);

      // Reconcile durable selection against server truth (drop now-synced ids).
      await reconcile(items.map((i) => i.externalId));

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
  }, [
    adapter,
    sourceIdForActions,
    dateRange?.from,
    dateRange?.to,
    sourceApp,
    organizationId,
    reconcile,
  ]);

  // --- Import selected ----------------------------------------------------
  const handleImport = React.useCallback(async () => {
    if (!adapter.importSelected || !sourceIdForActions) return;
    const externalIds = results
      .filter((r) => isSelected(r.externalId) && !importedIds.has(r.externalId))
      .map((r) => r.externalId);
    if (externalIds.length === 0) {
      toast.error("No calls selected to import");
      return;
    }
    if (!workspaceId || !selectedWorkspaceExists) {
      toast.error("Pick a destination workspace");
      return;
    }
    setImporting(true);
    try {
      const job = await adapter.importSelected({
        sourceId: sourceIdForActions,
        externalIds,
        workspaceId,
      });
      toast.success(
        job.message ??
          `Importing ${job.total} call${job.total === 1 ? "" : "s"} into workspace`,
      );
      // clearSelection() is the ONLY full-clear path — call it on job creation.
      clearSelection();
    } catch (err) {
      toast.error(
        `Import failed: ${err instanceof Error ? err.message : "unknown error"}`,
      );
    } finally {
      setImporting(false);
    }
  }, [
    adapter,
    sourceIdForActions,
    results,
    isSelected,
    importedIds,
    workspaceId,
    selectedWorkspaceExists,
    clearSelection,
  ]);

  // --- Sync all (Phase 28, SYNC-02) ---------------------------------------
  // Kicks off the resumable, SERVER-paged backfill. The client passes NO
  // enumerated ids — the server enumerates every page. Progress shows through
  // the already-mounted Phase-27 SyncJobBanner / PerProviderSyncChip (no new
  // query). The optional date window narrows the backfill; an empty range = all.
  const handleSyncAll = React.useCallback(async () => {
    if (!adapter.syncAll || !sourceIdForActions) {
      toast.error("Connect this source before syncing");
      return;
    }
    setSyncingAll(true);
    try {
      const job = await adapter.syncAll({
        sourceId: sourceIdForActions,
        workspaceId: workspaceId ?? undefined,
        dateStart,
        dateEnd,
      });
      toast.success(
        job.message ??
          `Syncing all ${adapter.metadata.label} calls in the background…`,
      );
    } catch (err) {
      toast.error(
        `Sync all failed: ${err instanceof Error ? err.message : "unknown error"}`,
      );
    } finally {
      setSyncingAll(false);
    }
  }, [adapter, sourceIdForActions, workspaceId, dateStart, dateEnd]);

  // Map AvailableCall -> dense TranscriptTable rows (the find-new section's
  // mapping template). Find-new rows key by source_app::externalId (Pitfall 5);
  // already-imported rows are de-emphasized inline via `synced`.
  const findRows = React.useMemo<Meeting[]>(
    () =>
      results.map((call) => ({
        recording_id: findRowKey(sourceApp, call.externalId),
        title: call.title,
        created_at: call.startTime ?? "",
        recording_start_time: call.startTime ?? null,
        recording_end_time: null,
        full_transcript: null,
        summary: null,
        url: call.externalUrl ?? null,
        share_url: null,
        synced: importedIds.has(call.externalId),
        synced_at: undefined,
        source_platform: sourceApp,
        source_metadata: {
          externalRecordingId: call.externalId,
          sync_state: call.syncState,
        },
        sync_state: call.syncState,
        local_title: call.localTitle ?? null,
        remote_title: call.remoteTitle ?? null,
      })),
    [results, sourceApp, importedIds],
  );

  const selectedFindKeys = React.useMemo(
    () =>
      results
        .filter((r) => isSelected(r.externalId))
        .map((r) => findRowKey(sourceApp, r.externalId)),
    [results, isSelected, sourceApp],
  );

  // Resolve a find-row table id (source_app::externalId) back to its raw
  // externalId for the durable selection store.
  const externalIdByKey = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const r of results) {
      map.set(findRowKey(sourceApp, r.externalId), r.externalId);
    }
    return map;
  }, [results, sourceApp]);

  const selectedCount = count === "all" ? results.length : count;

  // --- Section B: browse-synced (cheap DB read, per-source scoped) --------
  const [browsePage, setBrowsePage] = React.useState(1);
  const [browsePageSize, setBrowsePageSize] = React.useState(BROWSE_PAGE_SIZE);
  const browseQuery = useExistingTranscripts({
    dateRange,
    page: browsePage,
    pageSize: browsePageSize,
    organizationId,
    workspaceId: workspaceId ?? null,
  });

  // Per-provider browse (locked decision): scope the synced archive to this
  // surface's sourceApp so the Import-tab pane never shows other providers' rows.
  const browseRows = React.useMemo<Meeting[]>(
    () =>
      (browseQuery.data?.rows ?? []).filter(
        (row) => row.source_platform === sourceApp,
      ),
    [browseQuery.data?.rows, sourceApp],
  );

  // --- Phase 27: observable job state (JOB-03 / JOB-05) -------------------
  // One shared, durable, DB-backed job source for this provider/org. Realtime
  // primary + poll fallback live in the hook — the components below are purely
  // presentational off activeJobs/terminalJobs.
  const { activeJobs, terminalJobs } = useSyncJobs({
    sourceApp,
    organizationId,
  });

  // Local "I've seen it" dismissal — never a DB delete, never a timer. Only
  // terminal jobs can be dismissed; active/processing jobs always stay visible.
  const [dismissedJobIds, setDismissedJobIds] = React.useState<Set<string>>(
    () => new Set<string>(),
  );
  const dismissJob = React.useCallback((jobId: string) => {
    setDismissedJobIds((prev) => {
      const next = new Set(prev);
      next.add(jobId);
      return next;
    });
  }, []);

  const visibleTerminalJobs = React.useMemo(
    () => terminalJobs.filter((job) => !dismissedJobIds.has(job.id)),
    [terminalJobs, dismissedJobIds],
  );

  // De-clutter (banner-stacking fix): successful `completed` syncs are transient
  // info — the "Last synced" chip already shows the newest one at a glance, so we
  // DON'T render a persistent green banner per historical success. Only failures
  // and partial-failures (completed_with_errors) are actionable, so those persist
  // — collapsed behind a single "N need attention" disclosure instead of a stack.
  const failedTerminalJobs = React.useMemo(
    () =>
      visibleTerminalJobs.filter(
        (job) =>
          job.status === "failed" || job.status === "completed_with_errors",
      ),
    [visibleTerminalJobs],
  );
  const [failuresOpen, setFailuresOpen] = React.useState(false);

  // --- Phase 29 (FAIL-02): retry ONLY the failed set from the banner ------
  // Reuses the EXISTING single-call retry path — no new import path, edge fn,
  // or sync_jobs row. Each failed id is re-attempted through
  // useRetryFailedImport -> retryFailedImport -> getConnectorSyncFunctionName +
  // { singleCallId }, which authenticates the caller + gates workspace/org
  // server-side (no IDOR). Retrying an already-imported call is a no-op by the
  // Phase 24 org-scoped unique index (idempotent — never a duplicate row).
  // Successful retries drop from the failed set as counts refresh through the
  // existing useSyncJobs Realtime/poll + the mutation's onSuccess invalidations.
  const retryFailedMutation = useRetryFailedImport();
  const handleRetryFailed = React.useCallback(
    (retrySourceApp: string, failedIds: string[]) => {
      // failed_ids are opaque TEXT — passed verbatim, no coercion (dual-ID rule).
      for (const failedExternalId of failedIds) {
        retryFailedMutation.mutate({
          sourceApp: retrySourceApp,
          failedExternalId,
        });
      }
    },
    [retryFailedMutation],
  );

  // Most recent terminal job for this surface drives the chip's "Last synced"
  // + "M failed" segments. terminalJobs is ordered created_at DESC by the hook.
  const lastCompletedJob = terminalJobs[0];

  // "N new available" = find-section rows not yet imported. LOCKED — derived
  // from data already in scope (results + importedIds); the chip runs no query.
  const newAvailableCount = Math.max(0, results.length - importedIds.size);

  return (
    <div className={className}>
      {/* ===== Toolbar (connect -> search -> select -> import) ===== */}
      <div className="space-y-4">
        {/* 1. Connection status / connect */}
        {status && !status.connected ? (
          <ConnectorSetupCluster
            sourceApp={sourceApp}
            mode="import"
            onConnected={handleConnectorStateChanged}
            onSaved={handleConnectorStateChanged}
            onDisconnected={handleConnectorStateChanged}
          />
        ) : null}

        {status?.connected ? (
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {adapter.metadata.label} connected
                  </p>
                  <StatusBadge variant="connected" />
                  {/* Phase 27 (JOB-05): persistent per-provider status chip. */}
                  <PerProviderSyncChip
                    sourceApp={sourceApp}
                    lastSyncedAt={lastCompletedJob?.completed_at}
                    newCount={newAvailableCount}
                    failedCount={lastCompletedJob?.failed_ids?.length ?? 0}
                  />
                </div>
                {status.accountEmail ? (
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {status.accountEmail}
                  </p>
                ) : null}
              </div>
              <Button
                type="button"
                variant="hollow"
                size="sm"
                onClick={() => setShowConnectionSettings((open) => !open)}
                aria-expanded={showConnectionSettings}
              >
                <RiSettings3Line className="mr-2 h-4 w-4" />
                {showConnectionSettings ? "Hide settings" : "Manage connection"}
              </Button>
            </div>
          </div>
        ) : null}

        {status?.connected && showConnectionSettings ? (
          <ConnectorSetupCluster
            sourceApp={sourceApp}
            mode="import"
            statusOverride={status}
            onConnected={handleConnectorStateChanged}
            onSaved={handleConnectorStateChanged}
            onDisconnected={handleConnectorStateChanged}
          />
        ) : null}

        {/* 2-6. Search / select / import controls (search-capable providers). */}
        {canSearch ? (
          <div className="flex flex-wrap items-end gap-3">
            <DateRangePicker
              dateRange={dateRange ?? {}}
              onDateRangeChange={handleDateRangeChange}
              className="min-w-[260px]"
              disabled={searching}
            />
            <Button
              onClick={() => void handleSearch()}
              disabled={searching || !dateRange?.from || !dateRange?.to}
            >
              {searching ? (
                <RiLoader4Line className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RiSearchLine className="mr-2 h-4 w-4" />
              )}
              Search {adapter.metadata.label}
            </Button>

            {canImportSelected ? (
              <>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Destination workspace
                  </label>
                  <select
                    value={workspaceId ?? ""}
                    onChange={(e) =>
                      setWorkspaceId(e.target.value || undefined)
                    }
                    className="rounded-md border border-border bg-card px-3 py-2 text-sm"
                    disabled={workspacesLoading || importing}
                    aria-label="Destination workspace"
                  >
                    <option value="">
                      {workspacesLoading
                        ? "Loading workspaces…"
                        : "Select workspace…"}
                    </option>
                    {workspaces.map((workspace) => (
                      <option key={workspace.id} value={workspace.id}>
                        {workspace.name}
                      </option>
                    ))}
                  </select>
                  {workspacesError ? (
                    <p className="mt-1 text-xs text-destructive">
                      Workspaces could not be loaded.
                    </p>
                  ) : null}
                </div>
                <Button
                  onClick={() => void handleImport()}
                  disabled={
                    importing ||
                    selectedCount === 0 ||
                    !workspaceId ||
                    !selectedWorkspaceExists ||
                    workspacesLoading
                  }
                >
                  {importing ? (
                    "Importing…"
                  ) : (
                    <>
                      Import selected (
                      <span className="tabular-nums">
                        {count === "all" ? "all" : selectedCount}
                      </span>
                      )
                    </>
                  )}
                </Button>
                {/*
                  Phase 28 (SYNC-02): "Sync all from this provider" button.
                  Renders when the active adapter advertises syncAll (the 6
                  list-API providers; youtube/file-upload leave it undefined).
                  The SERVER enumerates every page — this passes NO ids, only the
                  current date window. Progress shows via the Phase-27 banner/chip
                  already mounted below (no new query).
                */}
                {canSyncAll ? (
                  <Button
                    type="button"
                    variant="hollow"
                    onClick={() => void handleSyncAll()}
                    disabled={syncingAll || !status?.connected}
                    title="Backfill every call from this provider in the background"
                  >
                    {syncingAll ? (
                      <RiLoader4Line className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RiRefreshLine className="mr-2 h-4 w-4" />
                    )}
                    Sync all from {adapter.metadata.label}
                  </Button>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}

        {/*
          Active (processing) jobs always render — live progress feedback.
          Successful completed jobs no longer stack as green banners (the
          "Last synced" chip conveys the latest); only failures persist,
          collapsed behind a single disclosure so they never wall-of-text.
        */}
        {activeJobs.map((job) => (
          <SyncJobBanner
            key={job.id}
            job={job}
            onDismiss={dismissJob}
            onRetry={handleRetryFailed}
          />
        ))}

        {failedTerminalJobs.length > 0 && (
          <Collapsible open={failuresOpen} onOpenChange={setFailuresOpen}>
            <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-lg border border-vibe-orange/30 bg-vibe-orange/10 px-3 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-vibe-orange/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange">
              <RiAlertLine className="h-4 w-4 shrink-0 text-vibe-orange" aria-hidden="true" />
              <span className="tabular-nums">
                {failedTerminalJobs.length} sync
                {failedTerminalJobs.length === 1 ? "" : "s"} need attention
              </span>
              <RiArrowDownSLine
                className={cn(
                  "ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                  failuresOpen && "rotate-180",
                )}
                aria-hidden="true"
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2">
              {failedTerminalJobs.map((job) => (
                <SyncJobBanner
                  key={job.id}
                  job={job}
                  onDismiss={dismissJob}
                  onRetry={handleRetryFailed}
                />
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>

      {/* ===== Section A — Find new (live provider API, slow, on top) ===== */}
      {canSearch ? (
        <section className="mt-8 space-y-4">
          <div>
            <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-foreground">
              New to import
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="tabular-nums">{results.length}</span> call
              {results.length === 1 ? "" : "s"} found
              {selectedCount > 0 ? (
                <span className="ml-1">
                  •{" "}
                  <span className="font-medium text-primary tabular-nums">
                    {count === "all" ? "all" : selectedCount} selected
                  </span>
                </span>
              ) : null}
            </p>
          </div>

          {searching ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : null}

          {!status?.connected && !searching ? (
            <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              Connect {adapter.metadata.label} to search and import available
              calls.
            </div>
          ) : null}

          {hasSearched && !searching && results.length === 0 ? (
            <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              No calls found for that date range.
            </div>
          ) : null}

          <TranscriptTable
            calls={findRows}
            selectedCalls={selectedFindKeys}
            tags={[]}
            tagAssignments={{}}
            totalCount={findRows.length}
            page={1}
            pageSize={findRows.length || BROWSE_PAGE_SIZE}
            isUnsyncedView
            onSelectCall={(id) => {
              const externalId = externalIdByKey.get(String(id));
              if (externalId) toggle(externalId);
            }}
            onSelectAll={() => selectAllMatching({ dateStart, dateEnd })}
            onCallClick={() => {
              // Detail-pane preview is out of scope this plan (Phase 27+ seam).
            }}
            onPageChange={() => {}}
            onPageSizeChange={() => {}}
          />
        </section>
      ) : (
        /* Capability-gated: provider imports automatically (file-upload, youtube, plaud). */
        <section className="mt-8">
          <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">
              {adapter.metadata.label} imports automatically
            </p>
            <p className="mt-1">
              This connector doesn&apos;t support selective import — calls arrive
              via webhook or polling.
            </p>
          </div>
        </section>
      )}

      {/* ===== Section B — Already in your vault (cheap DB read, below) ===== */}
      <section className="mt-10 space-y-4">
        <div>
          <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-foreground">
            Already in your vault
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="tabular-nums">{browseRows.length}</span> synced{" "}
            {adapter.metadata.label} transcript
            {browseRows.length === 1 ? "" : "s"}
            {dateRange?.from || dateRange?.to
              ? " for this date range"
              : ""}
          </p>
        </div>

        <TranscriptTable
          calls={browseRows}
          selectedCalls={[]}
          tags={[]}
          tagAssignments={browseQuery.data?.tagAssignments ?? {}}
          totalCount={browseRows.length}
          page={browsePage}
          pageSize={browsePageSize}
          onSelectCall={() => {}}
          onSelectAll={() => {}}
          onCallClick={() => {}}
          onPageChange={setBrowsePage}
          onPageSizeChange={setBrowsePageSize}
        />
      </section>
    </div>
  );
}
