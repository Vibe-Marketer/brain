import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import type { DateRange } from "react-day-picker";

import type { Meeting } from "@/hooks/useMeetingsSync";
import type { SyncJob } from "@/hooks/useSyncTabState";
import { logger } from "@/lib/logger";
import { requireUser } from "@/lib/auth-utils";
import { invalidateCallListCaches, queryKeys } from "@/lib/query-config";
import {
  usesLegacySourceLessSync,
  type IntegrationPlatform,
} from "@/lib/integration-platforms";
import { getConnectorAdapter } from "@/components/connectors/registry/connectorRegistry";
import { searchAllAvailableConnectorCalls } from "@/components/connectors/connectorSearch";
import type { AvailableCall } from "@/components/connectors/registry/types";
import {
  getMeetingSourcePlatform,
  getUnsyncedMeetingSelectionKey,
} from "@/components/transcripts/syncSelection";
import {
  invokeFathomFetchMeetings,
  invokeFathomRefreshForSyncTab,
  invokeSyncMeetingsForTab,
  listSyncJobsByIds,
} from "@/services/sync-tab.service";

/**
 * Owns the multi-source fetch + sync orchestration for the Sync tab.
 *
 * Lives outside `SyncTab.tsx` so the view component stays presentational and
 * the orchestration logic stays testable and reusable. The hook hangs onto:
 *   - the unsynced `meetings` list and its `loading` flag
 *   - the in-flight `syncing` flag
 *   - the `hasFetchedResults` gate that toggles the empty state
 *
 * The hook DOES NOT own selection state (see `useSyncTabSelection`) or the
 * existing-transcripts query (`useExistingTranscripts`); those layers are
 * threaded in via the args object so the orchestration can clear selection
 * and trigger refetches at the right moments.
 */

// Bounded so a hostile provider can't loop us forever; matches the prior
// inline constant in `SyncTab.tsx` (every relevant connector pages well
// inside this ceiling for the date ranges users actually pick).
export const MAX_SYNC_TAB_SEARCH_PAGES = 10;

// --------------------------------------------------------------------------
// Pure helpers — exported for the registry test + reuse
// --------------------------------------------------------------------------

export function getUtcDateRangeBounds(dateRange: DateRange | undefined) {
  return {
    dateStart: dateRange?.from
      ? new Date(
          Date.UTC(
            dateRange.from.getFullYear(),
            dateRange.from.getMonth(),
            dateRange.from.getDate(),
            0,
            0,
            0,
            0,
          ),
        )
      : null,
    dateEnd: dateRange?.to
      ? new Date(
          Date.UTC(
            dateRange.to.getFullYear(),
            dateRange.to.getMonth(),
            dateRange.to.getDate(),
            23,
            59,
            59,
            999,
          ),
        )
      : null,
  };
}

export function availableCallToMeeting(
  platform: IntegrationPlatform,
  call: AvailableCall,
): Meeting {
  const startTime = call.startTime ?? new Date().toISOString();
  return {
    recording_id: call.externalId,
    recording_uuid: call.recordingUuid ?? undefined,
    title: call.title,
    created_at: startTime,
    recording_start_time: startTime,
    synced: call.alreadyImported,
    calendar_invitees: call.participants?.map((participant) => ({
      name: participant.name ?? "",
      email: participant.email ?? "",
    })),
    share_url: call.externalUrl ?? undefined,
    source_platform: platform,
    sync_state: call.syncState ?? (call.alreadyImported ? "imported" : "available"),
    local_title: call.localTitle ?? null,
    remote_title: call.remoteTitle ?? null,
  };
}

export async function searchAllAvailableCalls(params: {
  platform: IntegrationPlatform;
  sourceId: string;
  dateStart: Date;
  dateEnd: Date;
  limit?: number;
}): Promise<Meeting[]> {
  const adapter = getConnectorAdapter(params.platform);
  if (!adapter.searchAvailable) return [];
  const calls = await searchAllAvailableConnectorCalls({
    searchAvailable: adapter.searchAvailable,
    sourceId: params.sourceId,
    dateStart: params.dateStart,
    dateEnd: params.dateEnd,
    limit: params.limit ?? 50,
    maxPages: MAX_SYNC_TAB_SEARCH_PAGES,
  });
  return calls.map((call) => availableCallToMeeting(params.platform, call));
}

// --------------------------------------------------------------------------
// Hook
// --------------------------------------------------------------------------

export interface SyncTabIntegration {
  platform: IntegrationPlatform;
  connected: boolean;
  sourceId?: string | null;
}

export interface UseSyncTabOrchestrationArgs {
  dateRange: DateRange | undefined;
  connectedIntegrations: SyncTabIntegration[];
  enabledSources: IntegrationPlatform[];
  selectedWorkspaceId: string;
  unsyncedSelected: Set<string>;
  clearUnsyncedSelection: () => void;
  setActiveSyncJobs: (
    updater: SyncJob[] | ((prev: SyncJob[]) => SyncJob[]),
  ) => void;
}

export interface UseSyncTabOrchestrationResult {
  meetings: Meeting[];
  setMeetings: React.Dispatch<React.SetStateAction<Meeting[]>>;
  loading: boolean;
  syncing: boolean;
  hasFetchedResults: boolean;
  setHasFetchedResults: (value: boolean) => void;
  fetchMeetings: () => Promise<void>;
  syncMeetings: () => Promise<void>;
  applyRemoteUpdates: () => Promise<void>;
}

export function useSyncTabOrchestration(
  args: UseSyncTabOrchestrationArgs,
): UseSyncTabOrchestrationResult {
  const queryClient = useQueryClient();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [hasFetchedResults, setHasFetchedResults] = useState(false);

  const fetchMeetings = useCallback(async () => {
    setLoading(true);
    try {
      const { dateStart, dateEnd } = getUtcDateRangeBounds(args.dateRange);
      if (!dateStart || !dateEnd) {
        toast.error("Choose a complete date range before fetching calls");
        return;
      }

      const sourcesToFetch = args.connectedIntegrations.filter(
        (integration) =>
          integration.connected &&
          args.enabledSources.includes(integration.platform),
      );

      const fetchedMeetings = (
        await Promise.all(
          sourcesToFetch.map(async (integration) => {
            const adapter = getConnectorAdapter(integration.platform);
            if (!adapter.searchAvailable) return [];

            if (
              usesLegacySourceLessSync({
                platform: integration.platform,
                sourceId: integration.sourceId,
              })
            ) {
              const raw = await invokeFathomFetchMeetings({
                createdAfter: dateStart.toISOString(),
                createdBefore: dateEnd.toISOString(),
              });
              return (raw as Meeting[]).map((meeting) => ({
                ...meeting,
                source_platform: "fathom" as const,
              }));
            }

            if (!integration.sourceId) {
              throw new Error(
                `${adapter.metadata.label} is missing an active source row`,
              );
            }

            return searchAllAvailableCalls({
              platform: integration.platform,
              sourceId: integration.sourceId,
              dateStart,
              dateEnd,
              limit: 50,
            });
          }),
        )
      ).flat();

      setHasFetchedResults(true);

      const unsyncedMeetings = fetchedMeetings.filter((m: Meeting) =>
        m.sync_state === "updated_remotely" ? true : !m.synced,
      );
      if (unsyncedMeetings.length > 0) {
        setMeetings(unsyncedMeetings);
        args.clearUnsyncedSelection();
        toast.success(`Found ${unsyncedMeetings.length} unsynced meetings`);
      } else {
        setMeetings([]);
        args.clearUnsyncedSelection();
        toast.success("No unsynced meetings found");
      }
    } catch (error) {
      logger.error("Error fetching meetings", error);
      const errorMsg =
        error instanceof Error ? error.message : "Failed to fetch meetings";
      toast.error(
        errorMsg.includes("API")
          ? errorMsg
          : `${errorMsg}. Check your API key in Settings.`,
      );
    } finally {
      setLoading(false);
    }
  }, [args]);

  const applyRemoteUpdates = useCallback(async () => {
    const selectedRemoteUpdated = meetings.filter((meeting) => {
      if (!args.unsyncedSelected.has(getUnsyncedMeetingSelectionKey(meeting))) {
        return false;
      }
      return (
        getMeetingSourcePlatform(meeting) === "fathom" &&
        meeting.sync_state === "updated_remotely" &&
        !!meeting.recording_uuid
      );
    });

    if (selectedRemoteUpdated.length === 0) {
      toast.error("Select at least one Fathom call with remote updates");
      return;
    }

    setSyncing(true);
    try {
      for (const meeting of selectedRemoteUpdated) {
        await invokeFathomRefreshForSyncTab(meeting.recording_uuid as string);
      }
      invalidateCallListCaches(queryClient);
      queryClient.invalidateQueries({ queryKey: queryKeys.transcripts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.syncJobs.all });
      args.clearUnsyncedSelection();
      await fetchMeetings();
      toast.success(`Applied ${selectedRemoteUpdated.length} remote update(s)`);
    } catch (error) {
      logger.error("Error applying remote updates", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to apply updates",
      );
    } finally {
      setSyncing(false);
    }
  }, [args, meetings, fetchMeetings, queryClient]);

  const syncMeetings = useCallback(async () => {
    const meetingsToSync = Array.from(args.unsyncedSelected);
    if (meetingsToSync.length === 0) {
      toast.error("Please select at least one meeting to sync");
      return;
    }

    setSyncing(true);
    try {
      await requireUser();

      const selectedBySource = new Map<IntegrationPlatform, string[]>();
      for (const meeting of meetings) {
        if (
          !args.unsyncedSelected.has(getUnsyncedMeetingSelectionKey(meeting))
        ) {
          continue;
        }
        const platform = getMeetingSourcePlatform(meeting);
        selectedBySource.set(platform, [
          ...(selectedBySource.get(platform) ?? []),
          meeting.recording_id,
        ]);
      }

      const jobs: Array<{ jobId: string; total: number }> = [];
      const { dateStart, dateEnd } = getUtcDateRangeBounds(args.dateRange);

      for (const [platform, externalIds] of selectedBySource.entries()) {
        const integration = args.connectedIntegrations.find(
          (item) => item.platform === platform,
        );
        const adapter = getConnectorAdapter(platform);

        if (
          usesLegacySourceLessSync({
            platform,
            sourceId: integration?.sourceId,
          })
        ) {
          const recordingIds = externalIds.map((id) => parseInt(id, 10));
          const result = await invokeSyncMeetingsForTab({
            recordingIds,
            createdAfter: dateStart?.toISOString(),
            createdBefore: dateEnd?.toISOString(),
            workspaceId: args.selectedWorkspaceId || undefined,
          });
          jobs.push(result);
          continue;
        }

        if (!adapter.importSelected) {
          throw new Error(
            `${adapter.metadata.label} does not support selected imports`,
          );
        }
        if (!integration?.sourceId) {
          throw new Error(
            `${adapter.metadata.label} is missing an active source row`,
          );
        }

        const job = await adapter.importSelected({
          sourceId: integration.sourceId,
          externalIds,
          workspaceId: args.selectedWorkspaceId || "",
        });
        jobs.push({ jobId: job.jobId, total: job.total });
      }

      if (jobs.length > 0) {
        const total = jobs.reduce((sum, job) => sum + job.total, 0);
        toast.success(
          `Sync job started for ${total} meetings. Progress will update automatically.`,
        );
        args.clearUnsyncedSelection();

        // Pull the freshly created sync_jobs rows so the active-jobs card
        // renders immediately. The polling loop in useSyncTabState will
        // keep them current from here on.
        const rows = (await listSyncJobsByIds(
          jobs.map((j) => j.jobId),
        )) as SyncJob[];
        if (rows.length > 0) {
          args.setActiveSyncJobs((prev) => [...prev, ...rows]);
        }

        // Invalidate the synced-transcripts and sync-jobs caches so newly
        // synced rows appear without the prior setTimeout cache-bust hack.
        queryClient.invalidateQueries({
          queryKey: queryKeys.transcripts.all,
        });
        queryClient.invalidateQueries({ queryKey: queryKeys.syncJobs.all });
        invalidateCallListCaches(queryClient);

        await fetchMeetings();
      }
    } catch (error) {
      logger.error("Error during sync", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to sync meetings",
      );
    } finally {
      setSyncing(false);
    }
  }, [args, meetings, queryClient, fetchMeetings]);

  return {
    meetings,
    setMeetings,
    loading,
    syncing,
    hasFetchedResults,
    setHasFetchedResults,
    fetchMeetings,
    syncMeetings,
    applyRemoteUpdates,
  };
}
