import { useState, useCallback, useRef, useMemo } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { SyncTabDialogs } from "./SyncTabDialogs";
import { UnsyncedMeetingsSection } from "./UnsyncedMeetingsSection";
import { SyncedTranscriptsSection } from "./SyncedTranscriptsSection";
import { ActiveSyncJobsCard } from "./ActiveSyncJobsCard";
import { SyncStatusIndicator } from "./SyncStatusIndicator";
import {
  DatePresetBar,
  SyncEmptyState,
  StepLabel,
  IntegrationSourceGroup,
} from "@/components/sync";
import { useIntegrationSync } from "@/hooks/useIntegrationSync";
import { useSyncSourceFilter } from "@/hooks/useSyncSourceFilter";
import { useSyncTabState } from "@/hooks/useSyncTabState";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { useExistingTranscripts } from "@/hooks/useExistingTranscripts";
import { useSyncTabSelection } from "@/hooks/useSyncTabSelection";
import { useUnsyncedMeetingPreview } from "@/hooks/useUnsyncedMeetingPreview";
import { useCancelSyncJob } from "@/hooks/useCancelSyncJob";
import { useSyncTabOrchestration } from "@/hooks/useSyncTabOrchestration";
import { useSyncTabStateBridge } from "@/hooks/useSyncTabStateBridge";
import { WorkspaceSelector } from "@/components/workspace/WorkspaceSelector";
import { DateRange } from "react-day-picker";
import type { IntegrationPlatform } from "@/lib/integration-platforms";
import { getMeetingSourcePlatform } from "./syncSelection";

// Module-level empty Set passed to UnsyncedMeetingsSection's `syncingMeetings`
// prop. The component still expects the prop (future per-row spinner hook);
// SyncTab no longer mutates a per-meeting in-flight set, so we hand it a
// stable empty set rather than allocating one every render.
const EMPTY_SYNCING_MEETINGS: ReadonlySet<string> = new Set();

export function SyncTab() {
  // -------------------- Filters + pagination --------------------
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [existingPage, setExistingPage] = useState(1);
  const [existingPageSize, setExistingPageSize] = useState(20);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>("");

  // -------------------- Misc UI dialogs --------------------
  const [categorizeDialogOpen, setCategorizeDialogOpen] = useState(false);
  const [categorizingCallId, setCategorizingCallId] = useState<string | null>(
    null,
  );
  const [bulkCategorizingIds, setBulkCategorizingIds] = useState<string[]>([]);
  const [createCategoryDialogOpen, setCreateCategoryDialogOpen] =
    useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // -------------------- Org context --------------------
  const { activeOrganizationId } = useOrganizationContext();

  // -------------------- Scroll-to-section ref --------------------
  const syncedSectionRef = useRef<HTMLDivElement>(null);
  const scrollToSyncedSection = useCallback(() => {
    syncedSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  // -------------------- Preview / view-dialog hook --------------------
  const preview = useUnsyncedMeetingPreview();

  // -------------------- Selection state ---------------------------
  // `selectAll*` callbacks take the visible list at call-time so selection
  // does not depend on the orchestration's meetings list. That breaks the
  // would-be circular dep between orchestration and selection.
  const selection = useSyncTabSelection();

  // -------------------- Integrations + source filter --------------------
  const { integrations } = useIntegrationSync();
  const connectedIntegrations = integrations.filter((i) => i.connected);
  // Memoize so useSyncSourceFilter doesn't reset every render — only when
  // the actual platform list changes (stringified for stable identity).
  const connectedPlatformsKey = JSON.stringify(
    connectedIntegrations.map((i) => i.platform).sort(),
  );
  const connectedPlatforms = useMemo(
    () => connectedIntegrations.map((i) => i.platform),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [connectedPlatformsKey],
  );
  const { enabledSources, toggleSource } = useSyncSourceFilter({
    connectedPlatforms,
  });
  const workspaceDefaultSource = useMemo<IntegrationPlatform>(() => {
    const firstEnabledConnected = enabledSources.find((source) =>
      connectedPlatforms.includes(source),
    );
    return firstEnabledConnected ?? connectedPlatforms[0] ?? "fathom";
  }, [connectedPlatforms, enabledSources]);

  // -------------------- Existing transcripts (paginated) --------------------
  const existingQuery = useExistingTranscripts({
    dateRange,
    page: existingPage,
    pageSize: existingPageSize,
    organizationId: activeOrganizationId,
    workspaceId: selectedWorkspaceId || null,
  });
  const existingTranscripts = existingQuery.data?.rows ?? [];
  const existingTagAssignments = existingQuery.data?.tagAssignments ?? {};
  const existingTotalCount = existingQuery.data?.totalCount ?? 0;
  const loadExistingTranscripts = useCallback(async () => {
    await existingQuery.refetch();
  }, [existingQuery]);

  // Bridge forwards the structural setMeetings + setActiveSyncJobs setters
  // between orchestration and useSyncTabState (which run in order below)
  // via refs, so SyncTab itself stays free of cast/ref plumbing.
  const bridge = useSyncTabStateBridge();
  const orchestration = useSyncTabOrchestration({
    dateRange,
    connectedIntegrations,
    enabledSources,
    selectedWorkspaceId,
    unsyncedSelected: selection.unsyncedSelected,
    clearUnsyncedSelection: selection.clearUnsynced,
    setActiveSyncJobs: bridge.forwardSetActiveSyncJobs,
  });
  bridge.bindSetMeetings(orchestration.setMeetings);
  const { meetings } = orchestration;

  const {
    hostEmail,
    categories,
    activeSyncJobs,
    recentlyCompletedJobs,
    setActiveSyncJobs,
  } = useSyncTabState({
    meetings,
    loadExistingTranscripts,
    checkSyncStatus: bridge.checkSyncStatus,
    setMeetings: bridge.bridgeSetMeetings,
  });
  bridge.bindSetActiveSyncJobs(setActiveSyncJobs);

  // -------------------- Cancel-job mutation --------------------
  const cancelJobMutation = useCancelSyncJob();
  const cancelSyncJob = useCallback(
    async (jobId: string) => {
      await cancelJobMutation.mutateAsync(jobId);
      // Optimistically clear the active jobs card — the polling loop in
      // useSyncTabState repopulates from the DB on its next tick.
      setActiveSyncJobs([]);
    },
    [cancelJobMutation, setActiveSyncJobs],
  );

  const handleClearFilters = () => {
    setDateRange(undefined);
    orchestration.setMeetings([]);
    selection.clearUnsynced();
    orchestration.setHasFetchedResults(false);
    setExistingPage(1);
    toast.success("Filters cleared");
  };

  const handleCategorizeClick = (callId: string) => {
    setCategorizingCallId(callId);
    setCategorizeDialogOpen(true);
  };

  const handleBulkCategorize = () => {
    if (selection.existingSelected.length === 0) {
      toast.error("Please select at least one transcript");
      return;
    }
    setBulkCategorizingIds(selection.existingSelected.map(String));
    setCategorizeDialogOpen(true);
  };

  // Source filter applied to the already-synced list. The v1 code threaded
  // hardcoded `selectedCategory/searchQuery/participantFilter` const literals
  // through additional filter steps that were never user-driven — they're
  // dropped here. When real inputs come back, they'll be applied at the DB
  // level inside `useExistingTranscripts`.
  const filteredExistingTranscripts = existingTranscripts.filter((t) => {
    const platform = getMeetingSourcePlatform(t);
    return enabledSources.includes(platform);
  });

  const showEmptyState =
    !orchestration.hasFetchedResults && meetings.length === 0;
  const hasConnectedIntegrations = connectedIntegrations.length > 0;
  const hasDateRange = !!(dateRange?.from && dateRange?.to);

  return (
    <div className="space-y-6">
      {(activeSyncJobs.length > 0 || recentlyCompletedJobs.length > 0) && (
        <SyncStatusIndicator
          activeSyncJobs={activeSyncJobs}
          recentlyCompletedJobs={recentlyCompletedJobs}
          onViewSynced={scrollToSyncedSection}
        />
      )}

      {/* === STEP 1: CHOOSE SOURCE === */}
      <section>
        <StepLabel step={1} label="Choose source" />
        <IntegrationSourceGroup
          onIntegrationChange={loadExistingTranscripts}
          enabledSources={enabledSources}
          onSourceToggle={toggleSource}
        />
      </section>

      {/* === STEP 2: CHOOSE DATE RANGE === */}
      <section>
        <StepLabel step={2} label="Choose date range" />
        <DatePresetBar
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          disabled={orchestration.loading}
        />
      </section>

      {/* === STEP 3: FETCH & SYNC CALLS === */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <StepLabel step={3} label="Fetch & sync calls" className="mb-0" />
          <div className="flex items-center gap-2">
            <Button
              variant="hollow"
              onClick={orchestration.fetchMeetings}
              disabled={
                orchestration.loading ||
                !hasDateRange ||
                !hasConnectedIntegrations
              }
              className="h-9 px-4"
            >
              {orchestration.loading ? "Fetching..." : "Fetch calls"}
            </Button>
            {(hasDateRange || orchestration.hasFetchedResults) && (
              <Button
                variant="ghost"
                onClick={handleClearFilters}
                className="h-9 px-3 text-muted-foreground"
              >
                Clear filters
              </Button>
            )}
          </div>
        </div>

        <WorkspaceSelector
          integration={workspaceDefaultSource}
          value={selectedWorkspaceId}
          onWorkspaceChange={setSelectedWorkspaceId}
          label="Sync to Workspace"
          disabled={orchestration.syncing}
          className="mb-4"
        />
        <p className="text-xs text-muted-foreground -mt-2 mb-4">
          Calls sync to your current workspace. Switch workspace in the header
          to sync elsewhere.
        </p>

        <ActiveSyncJobsCard
          activeSyncJobs={activeSyncJobs}
          recentlyCompletedJobs={recentlyCompletedJobs}
          onCancelJob={cancelSyncJob}
          onViewSynced={scrollToSyncedSection}
        />

        {showEmptyState && (
          <SyncEmptyState
            hasConnectedIntegrations={hasConnectedIntegrations}
            hasDateRange={hasDateRange}
          />
        )}

        {orchestration.hasFetchedResults && (
          <UnsyncedMeetingsSection
            meetings={meetings}
            selectedMeetings={selection.unsyncedSelected}
            syncing={orchestration.syncing}
            categories={categories}
            hostEmail={hostEmail}
            syncingMeetings={EMPTY_SYNCING_MEETINGS as Set<string>}
            loadingUnsyncedMeeting={preview.loadingUnsyncedMeeting}
            onSelectCall={selection.toggleUnsynced}
            onSelectAll={() => selection.selectAllUnsynced(meetings)}
            onSync={orchestration.syncMeetings}
            onApplyUpdates={orchestration.applyRemoteUpdates}
            onClearSelection={selection.clearUnsynced}
            onViewCall={preview.viewUnsyncedMeeting}
            onDownload={preview.downloadUnsyncedMeeting}
          />
        )}
      </section>

      <div ref={syncedSectionRef}>
        <SyncedTranscriptsSection
          existingTranscripts={existingTranscripts}
          filteredExistingTranscripts={filteredExistingTranscripts}
          selectedExistingTranscripts={selection.existingSelected}
          existingPage={existingPage}
          existingPageSize={existingPageSize}
          existingTotalCount={existingTotalCount}
          categories={categories}
          categoryAssignments={existingTagAssignments}
          hostEmail={hostEmail}
          dateRange={dateRange}
          onSelectCall={selection.toggleExisting}
          onSelectAll={() =>
            selection.selectAllExisting(filteredExistingTranscripts)
          }
          onCallClick={preview.openExistingCall}
          onCategorizeCall={(callId) => handleCategorizeClick(String(callId))}
          onPageChange={setExistingPage}
          onPageSizeChange={setExistingPageSize}
          onClearSelection={selection.clearExisting}
          onDelete={() => setShowDeleteDialog(true)}
          onBulkCategorize={handleBulkCategorize}
        />
      </div>

      <SyncTabDialogs
        viewingUnsyncedMeeting={preview.viewingUnsyncedMeeting}
        dialogOpen={preview.dialogOpen}
        setDialogOpen={preview.setDialogOpen}
        setSelectedCallId={preview.setSelectedCallId}
        setViewingUnsyncedMeeting={preview.setViewingUnsyncedMeeting}
        loadExistingTranscripts={loadExistingTranscripts}
        tagDialogOpen={categorizeDialogOpen}
        setTagDialogOpen={setCategorizeDialogOpen}
        taggingCallId={categorizingCallId}
        bulkTaggingIds={bulkCategorizingIds}
        setTaggingCallId={setCategorizingCallId}
        setBulkTaggingIds={setBulkCategorizingIds}
        createTagDialogOpen={createCategoryDialogOpen}
        setCreateTagDialogOpen={setCreateCategoryDialogOpen}
        showDeleteDialog={showDeleteDialog}
        setShowDeleteDialog={setShowDeleteDialog}
        selectedExistingTranscripts={selection.existingSelected}
        setSelectedExistingTranscripts={selection.setExistingSelected}
      />
    </div>
  );
}
