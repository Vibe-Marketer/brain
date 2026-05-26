import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { DateRange } from "react-day-picker";
import type { IntegrationPlatform } from "@/lib/integration-platforms";
import {
  fetchSingleMeetingViaEdge,
  getSyncJob,
  loadTagAssignmentsForRecordings,
  loadHostEmail as loadHostEmailService,
  persistSyncedMeeting,
  assignTagToSyncedRecording,
  invokeFetchMeetings,
  invokeSyncMeetings,
  formatUnsyncedTranscriptText,
  type SyncJobRow,
} from "@/services/meetings-sync.service";

export interface CalendarInvitee {
  name: string;
  email: string;
  email_domain?: string;
  is_external?: boolean;
  matched_speaker_display_name?: string;
}

/**
 * Transcript segment for unsynced meetings (from Fathom API)
 */
export interface UnsyncedTranscriptSegment {
  id: string;
  recording_id: string | number;
  speaker_name: string;
  speaker_email: string | null;
  text: string;
  timestamp: string;
  is_deleted: boolean;
  edited_text: string | null;
  edited_speaker_name: string | null;
  edited_speaker_email: string | null;
}

export interface Meeting {
  recording_id: string;
  title: string;
  created_at: string;
  recording_start_time: string;
  synced: boolean;
  calendar_invitees?: CalendarInvitee[];
  recording_end_time?: string;
  full_transcript?: string;
  recorded_by_email?: string;
  recorded_by_name?: string;
  url?: string;
  share_url?: string;
  summary?: string | null;
  unsyncedTranscripts?: UnsyncedTranscriptSegment[];
  /** Source platform for multi-source deduplication */
  source_platform?: IntegrationPlatform | null;
}

export function useMeetingsSync() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const [hasFetchedResults, setHasFetchedResults] = useState(false);
  const [appliedDateRange, setAppliedDateRange] = useState<DateRange | undefined>(undefined);
  const [syncingMeetings, setSyncingMeetings] = useState<Set<string>>(new Set());
  const [loadingUnsyncedMeeting, setLoadingUnsyncedMeeting] = useState<string | null>(null);
  const [hostEmail, setHostEmail] = useState("");
  const [perMeetingTags, setPerMeetingTags] = useState<Record<string, string>>({});

  const syncJobRef = useRef<SyncJobRow | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load host email on mount
  useEffect(() => {
    (async () => {
      const email = await loadHostEmailService();
      if (email) setHostEmail(email);
    })();
  }, []);

  // CRITICAL: Cleanup the poll interval on unmount. Previously this only
  // cleared on terminal status (completed/failed); if the component unmounted
  // mid-sync the interval leaked and kept polling a freed syncJobRef.
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []);

  const fetchMeetings = useCallback(async (dateRange?: DateRange) => {
    setLoading(true);
    try {
      // Convert dates to UTC to avoid timezone issues
      const createdAfter = dateRange?.from
        ? new Date(Date.UTC(dateRange.from.getFullYear(), dateRange.from.getMonth(), dateRange.from.getDate(), 0, 0, 0, 0)).toISOString()
        : undefined;

      const createdBefore = dateRange?.to
        ? new Date(Date.UTC(dateRange.to.getFullYear(), dateRange.to.getMonth(), dateRange.to.getDate(), 23, 59, 59, 999)).toISOString()
        : undefined;

      const fetchedMeetings = (await invokeFetchMeetings({
        createdAfter,
        createdBefore,
      })) as Meeting[];

      setAppliedDateRange(dateRange);
      setHasFetchedResults(true);

      const unsyncedMeetings = fetchedMeetings.filter((m) => !m.synced);
      setMeetings(unsyncedMeetings);

      if (unsyncedMeetings.length > 0) {
        const recordingIds = unsyncedMeetings.map((m) => m.recording_id);
        const assignments = await loadTagAssignmentsForRecordings(recordingIds);
        setPerMeetingTags(assignments);
      }

      toast.success(`Found ${unsyncedMeetings.length} unsynced meetings`);
    } catch (error) {
      logger.error("Error fetching meetings", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch meetings";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const syncMeetings = useCallback(async (selectedMeetings: Set<string>, preSyncTagId?: string) => {
    if (selectedMeetings.size === 0) {
      toast.error("Please select at least one meeting to sync");
      return;
    }

    setSyncing(true);
    setSyncProgress({ current: 0, total: selectedMeetings.size });

    try {
      const recordingIds = Array.from(selectedMeetings).map((id) => parseInt(id));

      const createdAfter = appliedDateRange?.from
        ? new Date(Date.UTC(appliedDateRange.from.getFullYear(), appliedDateRange.from.getMonth(), appliedDateRange.from.getDate(), 0, 0, 0, 0)).toISOString()
        : undefined;

      const createdBefore = appliedDateRange?.to
        ? new Date(Date.UTC(appliedDateRange.to.getFullYear(), appliedDateRange.to.getMonth(), appliedDateRange.to.getDate(), 23, 59, 59, 999)).toISOString()
        : undefined;

      const jobId = await invokeSyncMeetings({
        recordingIds,
        createdAfter,
        createdBefore,
        tagId: preSyncTagId,
      });

      syncJobRef.current = {
        id: jobId,
        user_id: "",
        status: "running",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        completed_at: null,
        error_message: null,
        progress_current: 0,
        progress_total: selectedMeetings.size,
        recording_ids: recordingIds,
        synced_ids: [],
        failed_ids: [],
      };

      // Clear any prior interval before starting a new one — defense against
      // a caller invoking syncMeetings twice without waiting for completion.
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }

      pollIntervalRef.current = setInterval(async () => {
        const job = await getSyncJob(jobId);

        if (!job) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          syncJobRef.current = null;
          setSyncing(false);
          return;
        }

        syncJobRef.current = job;
        setSyncProgress({
          current: job.progress_current,
          total: job.progress_total,
        });

        if (job.status === "completed" || job.status === "failed") {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          syncJobRef.current = null;
          setSyncing(false);

          if (job.status === "completed") {
            toast.success(`Successfully synced ${job.synced_ids?.length || 0} meetings`);
            setMeetings((prev) =>
              prev.filter((m) => !recordingIds.includes(parseInt(m.recording_id)))
            );
          } else {
            toast.error("Some meetings failed to sync");
          }
        }
      }, 1000);
    } catch (error) {
      logger.error("Error syncing meetings", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to sync meetings";
      toast.error(errorMessage);
      setSyncing(false);
    }
  }, [appliedDateRange]);

  const syncSingleMeeting = useCallback(async (recordingId: string, tagId?: string) => {
    setSyncingMeetings((prev) => new Set(prev).add(recordingId));

    try {
      const { meeting, userId } = await fetchSingleMeetingViaEdge(recordingId);

      await persistSyncedMeeting(meeting, userId);

      if (tagId && tagId !== "none") {
        await assignTagToSyncedRecording(meeting.recording_id, tagId, userId);
      }

      toast.success("Meeting synced successfully");
      setMeetings((prev) => prev.filter((m) => m.recording_id !== recordingId));
    } catch (error) {
      logger.error("Error syncing meeting", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to sync meeting";
      toast.error(errorMessage);
    } finally {
      setSyncingMeetings((prev) => {
        const next = new Set(prev);
        next.delete(recordingId);
        return next;
      });
    }
  }, []);

  const viewUnsyncedMeeting = useCallback(async (recordingId: string, onOpen: (id: string) => void) => {
    setLoadingUnsyncedMeeting(recordingId);
    try {
      // Validate by fetching; discard the payload — the consumer's onOpen
      // handler is what actually surfaces the detail view.
      await fetchSingleMeetingViaEdge(recordingId);
      onOpen(recordingId);
    } catch (error) {
      logger.error("Error loading meeting", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to load meeting details";
      toast.error(errorMessage);
    } finally {
      setLoadingUnsyncedMeeting(null);
    }
  }, []);

  const downloadUnsyncedTranscript = useCallback(async (recordingId: string, title: string) => {
    setLoadingUnsyncedMeeting(recordingId);
    try {
      const { meeting } = await fetchSingleMeetingViaEdge(recordingId);
      const formattedTranscript = formatUnsyncedTranscriptText(meeting);

      const blob = new Blob([formattedTranscript], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.replace(/[^a-z0-9]/gi, "_")}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Transcript downloaded");
    } catch (error) {
      logger.error("Error downloading transcript", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to download transcript";
      toast.error(errorMessage);
    } finally {
      setLoadingUnsyncedMeeting(null);
    }
  }, []);

  return {
    meetings,
    loading,
    syncing,
    syncProgress,
    hasFetchedResults,
    appliedDateRange,
    syncingMeetings,
    loadingUnsyncedMeeting,
    hostEmail,
    perMeetingTags,
    setPerMeetingTags,
    fetchMeetings,
    syncMeetings,
    syncSingleMeeting,
    viewUnsyncedMeeting,
    downloadUnsyncedTranscript,
  };
}
