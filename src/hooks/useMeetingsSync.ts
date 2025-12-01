import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { DateRange } from "react-day-picker";

export interface CalendarInvitee {
  name: string;
  email: string;
  email_domain?: string;
  is_external?: boolean;
  matched_speaker_display_name?: string;
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
}

interface SyncJob {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  error_message: string | null;
  recording_ids: number[];
  progress_current: number;
  progress_total: number;
  synced_ids: number[] | null;
  failed_ids: number[] | null;
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
  
  const syncJobRef = useRef<SyncJob | null>(null);

  // Load host email on mount
  useEffect(() => {
    loadHostEmail();
  }, []);

  const loadHostEmail = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: settings } = await supabase
        .from("user_settings")
        .select("host_email")
        .eq("user_id", user.id)
        .single();

      if (settings?.host_email) {
        setHostEmail(settings.host_email);
      }
    } catch (error) {
      logger.error("Error loading host email", error);
    }
  };

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

      const { data, error } = await supabase.functions.invoke('fetch-meetings', {
        body: { createdAfter, createdBefore }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const fetchedMeetings = data.meetings || [];
      setAppliedDateRange(dateRange);
      setHasFetchedResults(true);
      
      const unsyncedMeetings = fetchedMeetings.filter((m: Meeting) => !m.synced);
      setMeetings(unsyncedMeetings);

      if (unsyncedMeetings.length > 0) {
        const recordingIds = unsyncedMeetings.map((m: Meeting) => m.recording_id);
        await loadTagAssignments(recordingIds);
      }

      toast.success(`Found ${unsyncedMeetings.length} unsynced meetings`);
    } catch (error: any) {
      logger.error("Error fetching meetings", error);
      toast.error(error.message || "Failed to fetch meetings");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTagAssignments = async (recordingIds: string[]) => {
    try {
      const { data } = await supabase
        .from('call_tag_assignments')
        .select('call_recording_id, tag_id')
        .in('call_recording_id', recordingIds.map(id => parseInt(id)));

      const assignments: Record<string, string> = {};
      (data || []).forEach(assignment => {
        const id = assignment.call_recording_id.toString();
        assignments[id] = assignment.tag_id;
      });

      setPerMeetingTags(assignments);
    } catch (error) {
      logger.error('Error loading tag assignments', error);
    }
  };

  const checkSyncStatus = useCallback(async (jobId: string): Promise<SyncJob | null> => {
    try {
      const { data, error } = await supabase
        .from('sync_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error checking sync status', error);
      return null;
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

      // Convert date range to match what Edge Function expects
      const createdAfter = appliedDateRange?.from
        ? new Date(Date.UTC(appliedDateRange.from.getFullYear(), appliedDateRange.from.getMonth(), appliedDateRange.from.getDate(), 0, 0, 0, 0)).toISOString()
        : undefined;

      const createdBefore = appliedDateRange?.to
        ? new Date(Date.UTC(appliedDateRange.to.getFullYear(), appliedDateRange.to.getMonth(), appliedDateRange.to.getDate(), 23, 59, 59, 999)).toISOString()
        : undefined;

      const { data, error } = await supabase.functions.invoke("sync-meetings", {
        body: {
          recordingIds,  // Changed from recording_ids (snake_case) to recordingIds (camelCase)
          createdAfter,  // Added date range parameters
          createdBefore, // Added date range parameters
          tag_id: preSyncTagId !== 'none' ? preSyncTagId : undefined
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const jobId = data.job_id;
      syncJobRef.current = { 
        id: jobId, 
        user_id: '', // Will be set by backend
        status: 'running', 
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        completed_at: null,
        error_message: null,
        progress_current: 0, 
        progress_total: selectedMeetings.size,
        recording_ids: recordingIds,
        synced_ids: [],
        failed_ids: []
      };

      const pollInterval = setInterval(async () => {
        const job = await checkSyncStatus(jobId);
        
        if (!job) {
          clearInterval(pollInterval);
          syncJobRef.current = null;
          setSyncing(false);
          return;
        }

        syncJobRef.current = job;
        setSyncProgress({
          current: job.progress_current,
          total: job.progress_total
        });

        if (job.status === 'completed' || job.status === 'failed') {
          clearInterval(pollInterval);
          syncJobRef.current = null;
          setSyncing(false);
          
          if (job.status === 'completed') {
            toast.success(`Successfully synced ${job.synced_ids?.length || 0} meetings`);
            
            setMeetings((prev) =>
              prev.filter((m) => !recordingIds.includes(parseInt(m.recording_id)))
            );
          } else {
            toast.error("Some meetings failed to sync");
          }
        }
      }, 1000);
    } catch (error: any) {
      logger.error("Error syncing meetings", error);
      toast.error(error.message || "Failed to sync meetings");
      setSyncing(false);
    }
  }, [appliedDateRange, checkSyncStatus]);

  const syncSingleMeeting = useCallback(async (recordingId: string, tagId?: string) => {
    setSyncingMeetings((prev) => new Set(prev).add(recordingId));

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData?.user) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("fetch-single-meeting", {
        body: { recording_id: parseInt(recordingId, 10), user_id: authData.user.id }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const meeting = data.meeting;
      const user = authData.user;

      // Build full_transcript from transcript array
      const fullTranscript = meeting.transcript && Array.isArray(meeting.transcript)
        ? meeting.transcript.map((t: any) =>
            `[${t.timestamp}] ${t.speaker?.display_name || 'Unknown'}: ${t.text}`
          ).join('\n\n')
        : null;

      // Get summary from default_summary
      const summary = meeting.default_summary?.markdown_formatted || null;

      const { error: insertError } = await supabase.from("fathom_calls").insert({
        recording_id: meeting.recording_id,
        title: meeting.title,
        created_at: meeting.created_at,
        url: meeting.url,
        share_url: meeting.share_url,
        full_transcript: fullTranscript,
        summary: summary,
        recorded_by_name: meeting.recorded_by?.name,
        recorded_by_email: meeting.recorded_by?.email,
        recording_start_time: meeting.recording_start_time,
        recording_end_time: meeting.recording_end_time,
        calendar_invitees: meeting.calendar_invitees,
        user_id: user.id,
        synced_at: new Date().toISOString(),
      });

      if (insertError) throw insertError;

      // Insert transcript segments
      if (meeting.transcript && Array.isArray(meeting.transcript)) {
        const transcriptInserts = meeting.transcript.map((t: any) => ({
          recording_id: meeting.recording_id,
          speaker_name: t.speaker?.display_name,
          speaker_email: t.speaker?.matched_calendar_invitee_email,
          text: t.text,
          timestamp: t.timestamp,
        }));

        await supabase.from('fathom_transcripts').insert(transcriptInserts);
      }

      if (tagId && tagId !== 'none') {
        await supabase.from('call_tag_assignments').insert({
          call_recording_id: meeting.recording_id,
          tag_id: tagId,
          auto_assigned: false
        });
      }

      toast.success("Meeting synced successfully");
      setMeetings((prev) => prev.filter((m) => m.recording_id !== recordingId));
    } catch (error: any) {
      logger.error("Error syncing meeting", error);
      toast.error(error.message || "Failed to sync meeting");
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
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData?.user) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("fetch-single-meeting", {
        body: { recording_id: parseInt(recordingId, 10), user_id: authData.user.id }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      onOpen(recordingId);
    } catch (error: any) {
      logger.error("Error loading meeting", error);
      toast.error(error.message || "Failed to load meeting details");
    } finally {
      setLoadingUnsyncedMeeting(null);
    }
  }, []);

  const downloadUnsyncedTranscript = useCallback(async (recordingId: string, title: string) => {
    setLoadingUnsyncedMeeting(recordingId);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData?.user) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("fetch-single-meeting", {
        body: { recording_id: parseInt(recordingId, 10), user_id: authData.user.id }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const meeting = data.meeting;
      
      // Format transcript properly
      let formattedTranscript = `${meeting.title}\n`;
      formattedTranscript += `VIEW RECORDING - ${meeting.url || 'N/A'}\n\n`;
      formattedTranscript += `---\n\n`;
      
      if (meeting.transcript && Array.isArray(meeting.transcript)) {
        meeting.transcript.forEach((segment: any) => {
          const timestamp = segment.timestamp || "00:00:00";
          const speaker = segment.speaker?.display_name || "Unknown";
          const text = segment.text || "";
          
          formattedTranscript += `${timestamp} - ${speaker}\n`;
          formattedTranscript += `  ${text}\n\n`;
        });
      } else {
        formattedTranscript += "No transcript available\n";
      }
      
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
    } catch (error: any) {
      logger.error("Error downloading transcript", error);
      toast.error(error.message || "Failed to download transcript");
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
