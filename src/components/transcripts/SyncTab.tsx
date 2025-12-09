import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RiCloseLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "@/hooks/use-mobile";
import { SyncTabDialogs } from "./SyncTabDialogs";
import { UnsyncedMeetingsSection } from "./UnsyncedMeetingsSection";
import { SyncedTranscriptsSection } from "./SyncedTranscriptsSection";
import { ActiveSyncJobsCard } from "./ActiveSyncJobsCard";
import { useMeetingsSync, type Meeting, type CalendarInvitee } from "@/hooks/useMeetingsSync";
import { useSyncTabState } from "@/hooks/useSyncTabState";
import { DateRange } from "react-day-picker";
import { logger } from "@/lib/logger";
import { getSafeUser, requireUser } from "@/lib/auth-utils";

export function SyncTab() {
  const isMobile = useIsMobile();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [existingTranscripts, setExistingTranscripts] = useState<Meeting[]>([]);
  const [selectedMeetings, setSelectedMeetings] = useState<Set<string>>(new Set());
  const [selectedExistingTranscripts, setSelectedExistingTranscripts] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCategory] = useState<string>("all");
  const [tagAssignments, setTagAssignments] = useState<Record<string, string[]>>({});
  const [searchQuery] = useState("");
  const [participantFilter] = useState("");
  const [categorizeDialogOpen, setCategorizeDialogOpen] = useState(false);
  const [categorizingCallId, setCategorizingCallId] = useState<string | null>(null);
  const [bulkCategorizingIds, setBulkCategorizingIds] = useState<string[]>([]);
  const [createCategoryDialogOpen, setCreateCategoryDialogOpen] = useState(false);
  const [perMeetingTags, setPerMeetingTags] = useState<Record<string, string>>({});
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [hasFetchedResults, setHasFetchedResults] = useState(false);

  // Individual meeting sync and preview states
  const [syncingMeetings] = useState<Set<string>>(new Set());
  const [loadingUnsyncedMeeting, setLoadingUnsyncedMeeting] = useState<string | null>(null);
  const [viewingUnsyncedMeeting, setViewingUnsyncedMeeting] = useState<Meeting | null>(null);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);

  const {
    syncSingleMeeting: hookSyncSingleMeeting,
    downloadUnsyncedTranscript: hookDownloadUnsyncedTranscript,
  } = useMeetingsSync();

  // Pagination state for existing transcripts
  const [existingPage, setExistingPage] = useState(1);
  const [existingPageSize, setExistingPageSize] = useState(20);
  const [existingTotalCount, setExistingTotalCount] = useState(0);

  // Functions needed by useSyncTabState hook
  const checkSyncStatus = async (recordingIds: string[]) => {
    try {
      const { user, error: authError } = await getSafeUser();
      if (authError || !user) return;

      const { data: syncedCalls } = await supabase
        .from('fathom_calls')
        .select('recording_id')
        .eq('user_id', user.id)
        .in('recording_id', recordingIds.map(id => parseInt(id)));

      const syncedIds = new Set((syncedCalls || []).map(c => c.recording_id.toString()));

      setMeetings(prev => prev.map(m => ({
        ...m,
        synced: syncedIds.has(m.recording_id)
      })));
    } catch (error) {
      logger.error('Error checking sync status', error);
    }
  };

  const loadExistingTranscripts = useCallback(async () => {
    try {
      const { user, error: authError } = await getSafeUser();
      if (authError || !user) return;

      let query = supabase
        .from("fathom_calls")
        .select("*", { count: "exact" })
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      // Apply date range filter at database level
      if (dateRange?.from) {
        const filterStart = new Date(Date.UTC(
          dateRange.from.getFullYear(),
          dateRange.from.getMonth(),
          dateRange.from.getDate(), 0, 0, 0, 0
        )).toISOString();
        query = query.gte('created_at', filterStart);
      }

      if (dateRange?.to) {
        const filterEnd = new Date(Date.UTC(
          dateRange.to.getFullYear(),
          dateRange.to.getMonth(),
          dateRange.to.getDate(), 23, 59, 59, 999
        )).toISOString();
        query = query.lte('created_at', filterEnd);
      }

      // Apply search filter
      if (searchQuery.trim()) {
        query = query.or(`title.ilike.%${searchQuery}%,summary.ilike.%${searchQuery}%`);
      }

      // Apply participant filter
      if (participantFilter.trim()) {
        query = query.contains('calendar_invitees', [{ email: participantFilter }]);
      }

      // Apply pagination
      const from = (existingPage - 1) * existingPageSize;
      const to = from + existingPageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      setExistingTranscripts(
        (data || []).map((t) => ({
          recording_id: String(t.recording_id),
          title: t.title,
          created_at: t.created_at,
          recording_start_time: t.recording_start_time,
          recording_end_time: t.recording_end_time,
          full_transcript: t.full_transcript,
          summary: t.summary,
          url: t.url,
          share_url: t.share_url,
          recorded_by_name: t.recorded_by_name,
          recorded_by_email: t.recorded_by_email,
          synced: true,
          calendar_invitees: t.calendar_invitees as CalendarInvitee[],
        }))
      );

      setExistingTotalCount(count || 0);

      // Load tag assignments
      if (data && data.length > 0) {
        const recordingIds = data.map((t) => t.recording_id);
        const { data: assignments } = await supabase
          .from("call_tag_assignments")
          .select("call_recording_id, tag_id")
          .in("call_recording_id", recordingIds);

        const assignmentMap: Record<string, string[]> = {};
        assignments?.forEach((a) => {
          const key = String(a.call_recording_id);
          if (!assignmentMap[key]) assignmentMap[key] = [];
          assignmentMap[key].push(a.tag_id);
        });
        setTagAssignments(assignmentMap);
      }
    } catch (error) {
      logger.error("Error loading existing transcripts", error);
    }
  }, [dateRange, searchQuery, participantFilter, existingPage, existingPageSize]);

  // Use custom hook for state management
  const {
    hostEmail,
    categories,
    activeSyncJobs,
    recentlyCompletedJobs,
    setActiveSyncJobs,
  } = useSyncTabState({
    meetings,
    loadExistingTranscripts,
    checkSyncStatus,
    setMeetings,
  });

  const cancelSyncJob = async (jobId: string) => {
    try {
      const { error } = await supabase
        .from('sync_jobs')
        .update({
          status: 'failed',
          error_message: 'Cancelled by user',
          completed_at: new Date().toISOString()
        })
        .eq('id', jobId);

      if (error) throw error;

      toast.success('Sync job cancelled');
      setActiveSyncJobs([]);

      // Refresh the data after a brief delay
      setTimeout(async () => {
        const { data } = await supabase
          .from('sync_jobs')
          .select('*')
          .in('status', ['pending', 'processing'])
          .order('created_at', { ascending: false });
        setActiveSyncJobs(data || []);
      }, 500);
    } catch (error) {
      logger.error('Error cancelling sync job', error);
      toast.error('Failed to cancel sync job');
    }
  };

  // View unsynced meeting (fetches from Fathom API)
  const viewUnsyncedMeeting = async (recordingId: string) => {
    setLoadingUnsyncedMeeting(recordingId);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData?.user) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase.functions.invoke('fetch-single-meeting', {
        body: { recording_id: parseInt(recordingId, 10), user_id: authData.user.id }
      });

      if (error) throw error;

      if (data?.meeting) {
        // Format the meeting data for the dialog - convert Fathom API format to DB format
        const formattedMeeting = {
          recording_id: data.meeting.recording_id,
          title: data.meeting.title || data.meeting.meeting_title,
          created_at: data.meeting.created_at,
          recording_start_time: data.meeting.recording_start_time,
          recording_end_time: data.meeting.recording_end_time,
          recorded_by_email: data.meeting.recorded_by?.email,
          recorded_by_name: data.meeting.recorded_by?.name,
          url: data.meeting.url,
          share_url: data.meeting.share_url,
          summary: data.meeting.default_summary?.markdown_formatted || null,
          calendar_invitees: data.meeting.calendar_invitees,
          // Convert transcript to match DB format that CallDetailDialog expects
          unsyncedTranscripts: data.meeting.transcript
            ? data.meeting.transcript.map((t: { speaker?: { display_name?: string; matched_calendar_invitee_email?: string }; text: string; timestamp: string }, idx: number) => ({
                id: `temp-${idx}`,
                recording_id: data.meeting.recording_id,
                speaker_name: t.speaker?.display_name || 'Unknown',
                speaker_email: t.speaker?.matched_calendar_invitee_email || null,
                text: t.text,
                timestamp: t.timestamp,
                is_deleted: false,
                edited_text: null,
                edited_speaker_name: null,
                edited_speaker_email: null
              }))
            : []
        };

        setViewingUnsyncedMeeting(formattedMeeting);
        setSelectedCallId(recordingId);
        setDialogOpen(true);
      }
    } catch (error) {
      logger.error('Error fetching meeting', error);
      toast.error(error instanceof Error ? error.message : 'Failed to fetch meeting details');
    } finally {
      setLoadingUnsyncedMeeting(null);
    }
  };

  // Load existing transcripts only when a date range is set (user has searched)
  useEffect(() => {
    if (dateRange?.from || dateRange?.to) {
      loadExistingTranscripts();
    } else {
      // Clear existing transcripts when no date range is set
      setExistingTranscripts([]);
      setExistingTotalCount(0);
    }
  }, [dateRange, loadExistingTranscripts]);

  const loadTagAssignments = async (recordingIds: string[]) => {
    try {
      const { data } = await supabase
        .from('call_tag_assignments')
        .select('call_recording_id, tag_id')
        .in('call_recording_id', recordingIds.map(id => parseInt(id)));

      const assignments: Record<string, string[]> = {};
      (data || []).forEach(assignment => {
        const id = assignment.call_recording_id.toString();
        if (!assignments[id]) assignments[id] = [];
        assignments[id].push(assignment.tag_id);
      });

      setTagAssignments(assignments);
    } catch (error) {
      logger.error('Error loading tag assignments', error);
    }
  };

  const fetchMeetings = async () => {
    setLoading(true);
    try {
      // Convert dates to UTC to avoid timezone issues
      const createdAfter = dateRange?.from
        ? new Date(Date.UTC(dateRange.from.getFullYear(), dateRange.from.getMonth(), dateRange.from.getDate(), 0, 0, 0, 0)).toISOString()
        : undefined;

      // Set end date to 23:59:59.999 UTC of the selected day
      const createdBefore = dateRange?.to
        ? new Date(Date.UTC(dateRange.to.getFullYear(), dateRange.to.getMonth(), dateRange.to.getDate(), 23, 59, 59, 999)).toISOString()
        : undefined;

      const { data, error } = await supabase.functions.invoke('fetch-meetings', {
        body: { createdAfter, createdBefore }
      });

      // Check for errors from the edge function
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Use the sync status from the backend response directly
      const fetchedMeetings = data.meetings || [];

      // Mark that a fetch has been performed
      setHasFetchedResults(true);

      // Filter out already synced meetings
      const unsyncedMeetings = fetchedMeetings.filter((m: Meeting) => !m.synced);

      if (unsyncedMeetings.length > 0) {
        setMeetings(unsyncedMeetings);

        toast.success(`Found ${unsyncedMeetings.length} unsynced meetings`);

        await loadTagAssignments(unsyncedMeetings.map((m: Meeting) => m.recording_id));
      } else {
        setMeetings([]);
        toast.success('No unsynced meetings found');
      }
    } catch (error) {
      logger.error('Error fetching meetings', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to fetch meetings';
      toast.error(errorMsg.includes('API') ? errorMsg : `${errorMsg}. Check your API key in Settings.`);
    } finally {
      setLoading(false);
    }
  };

  const syncMeetings = async () => {
    const meetingsToSync = Array.from(selectedMeetings);

    if (meetingsToSync.length === 0) {
      toast.error("Please select at least one meeting to sync");
      return;
    }

    const recordingIds = meetingsToSync.map(id => parseInt(id));
    setSyncing(true);

    try {
      const user = await requireUser();

      // Convert dates to UTC to match the fetch filter
      const createdAfter = dateRange?.from
        ? new Date(Date.UTC(
            dateRange.from.getFullYear(),
            dateRange.from.getMonth(),
            dateRange.from.getDate(), 0, 0, 0, 0
          )).toISOString()
        : undefined;

      const createdBefore = dateRange?.to
        ? new Date(Date.UTC(
            dateRange.to.getFullYear(),
            dateRange.to.getMonth(),
            dateRange.to.getDate(), 23, 59, 59, 999
          )).toISOString()
        : undefined;

      // Start the sync job
      const { data, error } = await supabase.functions.invoke('sync-meetings', {
        body: {
          recordingIds,
          createdAfter,
          createdBefore
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.jobId) {
        toast.success(`Sync job started for ${recordingIds.length} meetings. Progress will update automatically.`);

        // Clear selections
        setSelectedMeetings(new Set());
        setPerMeetingTags({});

        // Immediately check for the new sync job
        setTimeout(async () => {
          const { data: jobs } = await supabase
            .from('sync_jobs')
            .select('*')
            .eq('id', data.jobId)
            .single();

          if (jobs) {
            setActiveSyncJobs(prev => [...prev, jobs]);
          }
        }, 500);

        // Refresh both unsynced and synced tables
        await Promise.all([
          fetchMeetings(),
          loadExistingTranscripts()
        ]);
      }
    } catch (error) {
      logger.error("Error during sync", error);
      toast.error(error instanceof Error ? error.message : "Failed to sync meetings");
    } finally {
      setSyncing(false);
    }
  };

  const handleClearDateRange = () => {
    setDateRange(undefined);
    setMeetings([]);
    setSelectedMeetings(new Set());
    setHasFetchedResults(false);
    toast.success("Date range cleared");
  };

  const handleCategorizeClick = (callId: string) => {
    setCategorizingCallId(callId);
    setCategorizeDialogOpen(true);
  };

  const handleBulkCategorize = () => {
    if (selectedExistingTranscripts.length === 0) {
      toast.error("Please select at least one transcript");
      return;
    }
    setBulkCategorizingIds(selectedExistingTranscripts.map(String));
    setCategorizeDialogOpen(true);
  };

  const filteredExistingTranscripts = existingTranscripts.filter(t => {
    // Category filter (date range and search are now applied at DB level)
    if (selectedCategory !== "all" && !tagAssignments[t.recording_id]?.includes(selectedCategory)) {
      return false;
    }

    return true;
  });

  // Suppress unused variable warnings for state that may be used later
  void perMeetingTags;
  void selectedCallId;

  return (
    <div>
      {/* Top separator for breathing room */}
      <Separator className="mb-12" />

      {/* Date Range and Fetch Controls - Single Row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pb-4 border-b border-cb-gray-light dark:border-cb-gray-dark">
        <div className="flex-1 min-w-[240px]">
          <DateRangePicker
            dateRange={dateRange || { from: undefined, to: undefined }}
            onDateRangeChange={(range) => setDateRange(range as DateRange)}
            className="w-full"
            onFetch={fetchMeetings}
            fetchButtonText={loading ? "Fetching..." : "Fetch Meetings"}
            disabled={loading}
            extendedQuickSelect={true}
          />
        </div>

        <div className="flex items-center gap-2 sm:flex-shrink-0">
          <Button
            variant="hollow"
            onClick={handleClearDateRange}
            disabled={!dateRange}
            className="h-9 px-3 gap-2"
          >
            <RiCloseLine className="h-4 w-4" />
            {!isMobile && <span className="text-xs">Clear</span>}
          </Button>
        </div>
      </div>

      {/* Active Sync Jobs Status - Shows real-time progress */}
      <ActiveSyncJobsCard
        activeSyncJobs={activeSyncJobs}
        recentlyCompletedJobs={recentlyCompletedJobs}
        onCancelJob={cancelSyncJob}
      />

      {/* Unsynced Meetings Section */}
      {hasFetchedResults && (
        <UnsyncedMeetingsSection
          meetings={meetings}
          selectedMeetings={selectedMeetings}
          syncing={syncing}
          categories={categories}
          hostEmail={hostEmail}
          syncingMeetings={syncingMeetings}
          loadingUnsyncedMeeting={loadingUnsyncedMeeting}
          onSelectCall={(id) => {
            const newSelected = new Set(selectedMeetings);
            if (newSelected.has(id)) {
              newSelected.delete(id);
            } else {
              newSelected.add(id);
            }
            setSelectedMeetings(newSelected);
          }}
          onSelectAll={() => {
            if (selectedMeetings.size === meetings.length) {
              setSelectedMeetings(new Set());
            } else {
              setSelectedMeetings(new Set(meetings.map(m => m.recording_id)));
            }
          }}
          onSync={syncMeetings}
          onClearSelection={() => setSelectedMeetings(new Set())}
          onViewCall={viewUnsyncedMeeting}
          onDirectCategorize={async (callId, categoryId) => {
            await hookSyncSingleMeeting(String(callId), categoryId);
            setMeetings(prev => prev.filter(m => m.recording_id !== String(callId)));
            await loadExistingTranscripts();
          }}
          onDownload={hookDownloadUnsyncedTranscript}
        />
      )}

      {/* Synced Transcripts Section */}
      <SyncedTranscriptsSection
        existingTranscripts={existingTranscripts}
        filteredExistingTranscripts={filteredExistingTranscripts}
        selectedExistingTranscripts={selectedExistingTranscripts}
        existingPage={existingPage}
        existingPageSize={existingPageSize}
        existingTotalCount={existingTotalCount}
        categories={categories}
        categoryAssignments={tagAssignments}
        hostEmail={hostEmail}
        dateRange={dateRange}
        onSelectCall={(id) => {
          if (selectedExistingTranscripts.includes(id)) {
            setSelectedExistingTranscripts(selectedExistingTranscripts.filter((i) => i !== id));
          } else {
            setSelectedExistingTranscripts([...selectedExistingTranscripts, id]);
          }
        }}
        onSelectAll={() => {
          if (selectedExistingTranscripts.length === filteredExistingTranscripts.length) {
            setSelectedExistingTranscripts([]);
          } else {
            setSelectedExistingTranscripts(
              filteredExistingTranscripts.map((t) => Number(t.recording_id))
            );
          }
        }}
        onCallClick={(call) => {
          setViewingUnsyncedMeeting(call);
          setSelectedCallId(String(call.recording_id));
          setDialogOpen(true);
        }}
        onCategorizeCall={(callId) => handleCategorizeClick(String(callId))}
        onPageChange={setExistingPage}
        onPageSizeChange={setExistingPageSize}
        onClearSelection={() => setSelectedExistingTranscripts([])}
        onDelete={() => setShowDeleteDialog(true)}
        onBulkCategorize={handleBulkCategorize}
      />

      {/* Dialogs */}
      <SyncTabDialogs
        viewingUnsyncedMeeting={viewingUnsyncedMeeting}
        dialogOpen={dialogOpen}
        setDialogOpen={setDialogOpen}
        setSelectedCallId={setSelectedCallId}
        setViewingUnsyncedMeeting={setViewingUnsyncedMeeting}
        loadExistingTranscripts={loadExistingTranscripts}
        categorizeDialogOpen={categorizeDialogOpen}
        setCategorizeDialogOpen={setCategorizeDialogOpen}
        categorizingCallId={categorizingCallId}
        bulkCategorizingIds={bulkCategorizingIds}
        setCategorizingCallId={setCategorizingCallId}
        setBulkCategorizingIds={setBulkCategorizingIds}
        createCategoryDialogOpen={createCategoryDialogOpen}
        setCreateCategoryDialogOpen={setCreateCategoryDialogOpen}
        showDeleteDialog={showDeleteDialog}
        setShowDeleteDialog={setShowDeleteDialog}
        selectedExistingTranscripts={selectedExistingTranscripts}
        setSelectedExistingTranscripts={setSelectedExistingTranscripts}
      />
    </div>
  );
}
