import { useCallback, useState } from "react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import type { Meeting } from "@/hooks/useMeetingsSync";
import { fetchSingleMeetingViaEdge } from "@/services/meetings-sync.service";
import { getMeetingSourcePlatform } from "@/components/transcripts/syncSelection";
import {
  downloadTextFile,
  formatFathomUnsyncedTranscript,
  formatConnectorUnsyncedMeeting,
} from "@/lib/transcript-download";

/**
 * Owns the view-unsynced-meeting and download-unsynced-meeting flows for the
 * Sync tab.
 *
 * Two providers, one surface:
 *   - Fathom legacy rows (numeric recording_id) round-trip through the
 *     `fetch-single-meeting` edge function via the meetings-sync service.
 *   - Every other connector hands us enough data from its search result that
 *     we can render the dialog and dump a file without a second network hop.
 *
 * Returns the dialog state + the two callbacks. Selection / list state lives
 * elsewhere — this hook is preview-only.
 */
export interface UseUnsyncedMeetingPreviewResult {
  loadingUnsyncedMeeting: string | null;
  viewingUnsyncedMeeting: Meeting | null;
  setViewingUnsyncedMeeting: (m: Meeting | null) => void;
  selectedCallId: string | null;
  setSelectedCallId: (id: string | null) => void;
  dialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
  viewUnsyncedMeeting: (meeting: Meeting) => Promise<void>;
  downloadUnsyncedMeeting: (meeting: Meeting, title: string) => Promise<void>;
  openExistingCall: (call: Meeting) => void;
}

export function useUnsyncedMeetingPreview(): UseUnsyncedMeetingPreviewResult {
  const [loadingUnsyncedMeeting, setLoadingUnsyncedMeeting] = useState<
    string | null
  >(null);
  const [viewingUnsyncedMeeting, setViewingUnsyncedMeeting] =
    useState<Meeting | null>(null);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const viewUnsyncedMeeting = useCallback(async (meeting: Meeting) => {
    const platform = getMeetingSourcePlatform(meeting);
    const recordingId = meeting.recording_id;
    const legacyFathomId = Number.parseInt(recordingId, 10);

    if (platform !== "fathom" || !Number.isFinite(legacyFathomId)) {
      setViewingUnsyncedMeeting(meeting);
      setSelectedCallId(recordingId);
      setDialogOpen(true);
      return;
    }

    setLoadingUnsyncedMeeting(recordingId);
    try {
      const { meeting: raw } = await fetchSingleMeetingViaEdge(recordingId);
      const formattedMeeting: Meeting = {
        recording_id: String(raw.recording_id),
        title: raw.title,
        created_at: raw.created_at,
        recording_start_time: raw.recording_start_time ?? raw.created_at,
        recording_end_time: raw.recording_end_time,
        recorded_by_email: raw.recorded_by?.email,
        recorded_by_name: raw.recorded_by?.name,
        url: raw.url,
        share_url: raw.share_url,
        summary: raw.default_summary?.markdown_formatted ?? null,
        calendar_invitees: raw.calendar_invitees as Meeting["calendar_invitees"],
        synced: false,
        unsyncedTranscripts: raw.transcript
          ? raw.transcript.map((t, idx) => ({
              id: `temp-${idx}`,
              recording_id: String(raw.recording_id),
              speaker_name: t.speaker?.display_name || "Unknown",
              speaker_email: t.speaker?.matched_calendar_invitee_email || null,
              text: t.text,
              timestamp: t.timestamp,
              is_deleted: false,
              edited_text: null,
              edited_speaker_name: null,
              edited_speaker_email: null,
            }))
          : [],
      };

      setViewingUnsyncedMeeting(formattedMeeting);
      setSelectedCallId(recordingId);
      setDialogOpen(true);
    } catch (error) {
      logger.error("Error fetching meeting", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to fetch meeting details",
      );
    } finally {
      setLoadingUnsyncedMeeting(null);
    }
  }, []);

  const downloadUnsyncedMeeting = useCallback(
    async (meeting: Meeting, title: string) => {
      const platform = getMeetingSourcePlatform(meeting);
      const recordingId = meeting.recording_id;
      const legacyFathomId = Number.parseInt(recordingId, 10);

      setLoadingUnsyncedMeeting(recordingId);
      try {
        if (platform === "fathom" && Number.isFinite(legacyFathomId)) {
          const { meeting: raw } =
            await fetchSingleMeetingViaEdge(recordingId);
          downloadTextFile({
            title,
            contents: formatFathomUnsyncedTranscript(raw),
          });
          toast.success("Transcript downloaded");
          return;
        }

        downloadTextFile({
          title,
          contents: formatConnectorUnsyncedMeeting(meeting, platform),
        });
        toast.success("Call details downloaded");
      } catch (error) {
        logger.error("Error downloading unsynced meeting", error);
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to download call details",
        );
      } finally {
        setLoadingUnsyncedMeeting(null);
      }
    },
    [],
  );

  const openExistingCall = useCallback((call: Meeting) => {
    setViewingUnsyncedMeeting(call);
    setSelectedCallId(String(call.recording_id));
    setDialogOpen(true);
  }, []);

  return {
    loadingUnsyncedMeeting,
    viewingUnsyncedMeeting,
    setViewingUnsyncedMeeting,
    selectedCallId,
    setSelectedCallId,
    dialogOpen,
    setDialogOpen,
    viewUnsyncedMeeting,
    downloadUnsyncedMeeting,
    openExistingCall,
  };
}
