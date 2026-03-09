import { useMutation, UseMutationResult, QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { Meeting } from "@/types";
import { queryKeys } from "@/lib/query-config";

interface UseCallDetailMutationsOptions {
  call: Meeting | null;
  userId?: string;
  queryClient: QueryClient;
  onDataChange?: () => void;
}

interface UpdateCallParams {
  title: string;
  summary: string;
  originalTitle: string;
  originalSummary: string | null;
}

interface EditSegmentParams {
  segmentId: string;
  text: string;
}

interface ChangeSpeakerParams {
  segmentId: string;
  name: string;
  email?: string;
}

interface TrimSegmentParams {
  segmentIds: string[];
}

interface RevertSegmentParams {
  segmentId: string;
}

interface SplitRecordingParams {
  /**
   * ID of the segment to split at — the fathom_transcripts row UUID for legacy recordings,
   * or a "parsed-N" synthetic id for UUID recordings (assigned by the frontend when
   * rendering full_transcript segments).
   */
  segmentId: string;
}

export interface SplitRecordingResult {
  part1_recording_id: string | number;
  part2_recording_id: string;
  part1_title: string;
  part2_title: string;
  part1_segment_count: number;
  part2_segment_count: number;
}

export interface UseCallDetailMutationsReturn {
  updateCall: UseMutationResult<void, Error, UpdateCallParams, unknown>;
  editSegment: UseMutationResult<void, Error, EditSegmentParams, unknown>;
  changeSpeaker: UseMutationResult<void, Error, ChangeSpeakerParams, unknown>;
  trimSegment: UseMutationResult<void, Error, TrimSegmentParams, unknown>;
  revertSegment: UseMutationResult<void, Error, RevertSegmentParams, unknown>;
  resyncCall: UseMutationResult<void, Error, void, unknown>;
  splitRecording: UseMutationResult<SplitRecordingResult, Error, SplitRecordingParams, unknown>;
}

export function useCallDetailMutations({
  call,
  userId,
  queryClient,
  onDataChange,
}: UseCallDetailMutationsOptions): UseCallDetailMutationsReturn {

  const updateCall = useMutation({
    mutationFn: async ({ title, summary, originalTitle, originalSummary }: UpdateCallParams) => {
      if (!call || !userId) return;

      const recordingId = call.recording_id;
      const isLegacyId = typeof recordingId === 'number';
      const updatePayload = { title, summary, updated_at: new Date().toISOString() };

      // 1. Update the canonical recordings table (SSoT for title/summary)
      if (isLegacyId) {
        const { error } = await supabase
          .from("recordings")
          .update(updatePayload)
          .eq("legacy_recording_id", recordingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("recordings")
          .update(updatePayload)
          .eq("id", recordingId);
        if (error) throw error;
      }

      // 2. Also update fathom_calls for legacy compat (best-effort)
      if (isLegacyId) {
        await supabase
          .from("fathom_calls")
          .update({
            title,
            summary,
            title_edited_by_user: title !== originalTitle,
            summary_edited_by_user: summary !== (originalSummary || ""),
          })
          .eq("recording_id", recordingId)
          .eq("user_id", userId);
      }
    },
    onSuccess: () => {
      // Invalidate all views that display call data
      queryClient.invalidateQueries({ queryKey: queryKeys.calls.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all });
      toast.success("Call updated successfully");
      onDataChange?.();
    },
    onError: () => {
      toast.error("Failed to update call");
    },
  });

  const editSegment = useMutation({
    mutationFn: async ({ segmentId, text }: EditSegmentParams) => {
      const { error } = await supabase
        .from("fathom_transcripts")
        .update({
          edited_text: text,
          edited_at: new Date().toISOString(),
          edited_by: userId
        })
        .eq("id", segmentId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.calls.transcripts(call?.recording_id) });
      await queryClient.refetchQueries({ queryKey: queryKeys.calls.transcripts(call?.recording_id) });
      toast.success("Transcript segment updated");
    },
    onError: () => {
      toast.error("Failed to update segment");
    }
  });

  const changeSpeaker = useMutation({
    mutationFn: async ({ segmentId, name, email }: ChangeSpeakerParams) => {
      const { error } = await supabase
        .from("fathom_transcripts")
        .update({
          edited_speaker_name: name,
          edited_speaker_email: email || null,
          edited_at: new Date().toISOString(),
          edited_by: userId
        })
        .eq("id", segmentId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.calls.transcripts(call?.recording_id) });
      await queryClient.refetchQueries({ queryKey: queryKeys.calls.transcripts(call?.recording_id) });
      toast.success("Speaker changed");
    },
    onError: () => {
      toast.error("Failed to change speaker");
    }
  });

  const trimSegment = useMutation({
    mutationFn: async ({ segmentIds }: TrimSegmentParams) => {
      const { error } = await supabase
        .from("fathom_transcripts")
        .update({
          is_deleted: true,
          edited_at: new Date().toISOString(),
          edited_by: userId
        })
        .in("id", segmentIds);
      if (error) throw error;

      // Add small delay to ensure database commits
      await new Promise(resolve => setTimeout(resolve, 100));
    },
    onSuccess: async () => {
      // Force complete cache reset for aggressive refresh
      await queryClient.resetQueries({ queryKey: queryKeys.calls.transcripts(call?.recording_id) });

      // Wait a bit more to ensure UI updates
      await new Promise(resolve => setTimeout(resolve, 150));

      toast.success("Section(s) trimmed");
    },
    onError: () => {
      toast.error("Failed to trim section");
    }
  });

  const revertSegment = useMutation({
    mutationFn: async ({ segmentId }: RevertSegmentParams) => {
      const { error } = await supabase
        .from("fathom_transcripts")
        .update({
          edited_text: null,
          edited_speaker_name: null,
          edited_speaker_email: null,
          edited_at: null,
          edited_by: null
        })
        .eq("id", segmentId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.calls.transcripts(call?.recording_id) });
      await queryClient.refetchQueries({ queryKey: queryKeys.calls.transcripts(call?.recording_id) });
      toast.success("Changes reverted");
    },
    onError: () => {
      toast.error("Failed to revert changes");
    }
  });

  const resyncCall = useMutation({
    mutationFn: async () => {
      // Fetch fresh meeting data from Fathom
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData?.user) {
        throw new Error("Not authenticated");
      }

      const { data: meetingData, error: fetchError } = await supabase.functions.invoke('fetch-single-meeting', {
        body: { recording_id: call.recording_id, user_id: authData.user.id }
      });
      if (fetchError) throw fetchError;
      if (!meetingData?.meeting) throw new Error("No meeting data received");

      const meeting = meetingData.meeting;

      // Delete all existing transcripts for this recording (use composite key)
      const { error: deleteError } = await supabase
        .from('fathom_transcripts')
        .delete()
        .eq('recording_id', call.recording_id)
        .eq('user_id', userId);

      if (deleteError) throw deleteError;

      // Insert fresh transcripts from Fathom (include user_id for composite FK)
      if (meeting.transcript && meeting.transcript.length > 0) {
        const transcripts = meeting.transcript.map((t: { speaker?: { display_name?: string; matched_calendar_invitee_email?: string }; text: string; timestamp: string }) => ({
          recording_id: call.recording_id,
          user_id: userId, // Include user_id for composite foreign key
          speaker_name: t.speaker?.display_name || 'Unknown',
          speaker_email: t.speaker?.matched_calendar_invitee_email || null,
          text: t.text,
          timestamp: t.timestamp,
        }));

        const { error: insertError } = await supabase
          .from('fathom_transcripts')
          .insert(transcripts);

        if (insertError) throw insertError;
      }

      // Update call metadata if not user-edited
      const updateData: {
        synced_at: string;
        calendar_invitees: unknown;
        title?: string;
        summary?: string;
      } = {
        synced_at: new Date().toISOString(),
        calendar_invitees: meeting.calendar_invitees || null,
      };

      // Only update title/summary if they haven't been manually edited
      if (!call.title_edited_by_user && meeting.title) {
        updateData.title = meeting.title;
      }
      if (!call.summary_edited_by_user && meeting.default_summary?.markdown_formatted) {
        updateData.summary = meeting.default_summary.markdown_formatted;
      }

      // Update call metadata (use composite key)
      const { error: updateError } = await supabase
        .from('fathom_calls')
        .update(updateData)
        .eq('recording_id', call.recording_id)
        .eq('user_id', userId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calls.transcripts(call?.recording_id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.calls.list() });
      toast.success("Call resynced from Fathom");
    },
    onError: (error: Error) => {
      logger.error("Resync error", error);
      toast.error("Failed to resync call: " + (error.message || "Unknown error"));
    }
  });

  const splitRecording = useMutation({
    mutationFn: async ({ segmentId }: SplitRecordingParams): Promise<SplitRecordingResult> => {
      if (!call) throw new Error("No call loaded");

      const { data, error } = await supabase.functions.invoke('split-recording', {
        body: {
          recording_id: call.recording_id,
          segment_id: segmentId,
        },
      });

      if (error) {
        // The Supabase client sets data=null on non-2xx responses and returns a generic
        // FunctionsHttpError. Parse the response body to surface the specific message
        // returned by the edge function (e.g. "Cannot split at the first segment").
        let message = error.message;
        try {
          const body = await (error as { context?: Response }).context?.json();
          if (body?.error) message = body.error;
        } catch {
          // ignore — fall back to the generic client message
        }
        throw new Error(message);
      }
      if (!data?.success) throw new Error(data?.error || 'Split failed');

      return data as SplitRecordingResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calls.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all });
      onDataChange?.();
    },
    onError: (error: Error) => {
      logger.error("Split recording error", error);
      toast.error("Failed to split recording: " + (error.message || "Unknown error"));
    },
  });

  return {
    updateCall,
    editSegment,
    changeSpeaker,
    trimSegment,
    revertSegment,
    resyncCall,
    splitRecording,
  };
}
