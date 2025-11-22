import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RiRefreshLine, RiCalendarLine, RiCloseLine } from "@remixicon/react";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useIsMobile } from "@/hooks/use-mobile";
import { SyncFilters } from "./SyncFilters";
import { SyncProgress } from "./SyncProgress";
import { SyncTabDialogs } from "./SyncTabDialogs";
import { UnsyncedMeetingsSection } from "./UnsyncedMeetingsSection";
import { SyncedTranscriptsSection } from "./SyncedTranscriptsSection";
import { ActiveSyncJobsCard } from "./ActiveSyncJobsCard";
import { useMeetingsSync, type Meeting, type CalendarInvitee } from "@/hooks/useMeetingsSync";
import { useCategorySync, type Category } from "@/hooks/useCategorySync";
import { useSyncTabState } from "@/hooks/useSyncTabState";
import { DateRange } from "react-day-picker";
import { logger } from "@/lib/logger";

export function SyncTab() {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [existingTranscripts, setExistingTranscripts] = useState<Meeting[]>([]);
  const [selectedMeetings, setSelectedMeetings] = useState<Set<string>>(new Set());
  const [selectedExistingTranscripts, setSelectedExistingTranscripts] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [categoryAssignments, setCategoryAssignments] = useState<Record<string, string[]>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [participantFilter, setParticipantFilter] = useState("");
  const [categorizeDialogOpen, setCategorizeDialogOpen] = useState(false);
  const [categorizingCallId, setCategorizingCallId] = useState<string | null>(null);
  const [bulkCategorizingIds, setBulkCategorizingIds] = useState<string[]>([]);
  const [preSyncCategoryId, setPreSyncCategoryId] = useState<string>("none");
  const [createCategoryDialogOpen, setCreateCategoryDialogOpen] = useState(false);
  const [perMeetingCategories, setPerMeetingCategories] = useState<Record<string, string>>({});
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedCategoryForManual, setSelectedCategoryForManual] = useState<string | null>(null);
  const [hasFetchedResults, setHasFetchedResults] = useState(false);

  // Individual meeting sync and preview states
  const [syncingMeetings, setSyncingMeetings] = useState<Set<string>>(new Set());
  const [loadingUnsyncedMeeting, setLoadingUnsyncedMeeting] = useState<string | null>(null);
  const [viewingUnsyncedMeeting, setViewingUnsyncedMeeting] = useState<any | null>(null);

  const {
    fetchMeetings: hookFetchMeetings,
    syncMeetings: hookSyncMeetings,
    syncSingleMeeting: hookSyncSingleMeeting,
    viewUnsyncedMeeting: hookViewUnsyncedMeeting,
    downloadUnsyncedTranscript: hookDownloadUnsyncedTranscript,
  } = useMeetingsSync();

  // Pagination state for existing transcripts
  const [existingPage, setExistingPage] = useState(1);
  const [existingPageSize, setExistingPageSize] = useState(20);
  const [existingTotalCount, setExistingTotalCount] = useState(0);

  // Functions needed by useSyncTabState hook
  const checkSyncStatus = async (recordingIds: string[]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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

  const loadExistingTranscripts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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
          calendar_invitees: (t.calendar_invitees as any) as CalendarInvitee[],
        }))
      );

      setExistingTotalCount(count || 0);

      // Load category assignments
      if (data && data.length > 0) {
        const recordingIds = data.map((t) => t.recording_id);
        const { data: assignments } = await supabase
          .from("call_category_assignments")
          .select("call_recording_id, category_id")
          .in("call_recording_id", recordingIds);

        const assignmentMap: Record<string, string[]> = {};
        assignments?.forEach((a) => {
          const key = String(a.call_recording_id);
          if (!assignmentMap[key]) assignmentMap[key] = [];
          assignmentMap[key].push(a.category_id);
        });
        setCategoryAssignments(assignmentMap);
      }
    } catch (error) {
      logger.error("Error loading existing transcripts", error);
    }
  };

  // Use custom hook for state management
  const {
    userTimezone,
    hostEmail,
    categories,
    activeSyncJobs,
    setCategories,
    setActiveSyncJobs,
  } = useSyncTabState({
    meetings,
    loadExistingTranscripts,
    checkSyncStatus,
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

  // Cancel sync job

  // View unsynced meeting (fetches from Fathom API)
  const viewUnsyncedMeeting = async (recordingId: string) => {
    setLoadingUnsyncedMeeting(recordingId);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-single-meeting', {
        body: { recording_id: parseInt(recordingId) }
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
            ? data.meeting.transcript.map((t: any, idx: number) => ({
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
    } catch (error: any) {
      console.error('Error fetching meeting:', error);
      toast.error(error.message || 'Failed to fetch meeting details');
    } finally {
      setLoadingUnsyncedMeeting(null);
    }
  };

  // Download unsynced transcript (fetches from Fathom API)
  const downloadUnsyncedTranscript = async (recordingId: string, title: string) => {
    setLoadingUnsyncedMeeting(recordingId);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-single-meeting', {
        body: { recording_id: parseInt(recordingId) }
      });

      if (error) throw error;

      if (data?.meeting?.transcript) {
        const transcriptText = data.meeting.transcript
          .map((t: any) => `[${t.timestamp}] ${t.speaker?.display_name || 'Unknown'}: ${t.text}`)
          .join('\n\n');
        
        const blob = new Blob([transcriptText], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title.replace(/[^a-z0-9]/gi, '_')}_transcript.txt`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast.success('Transcript downloaded');
      } else {
        toast.error('No transcript available');
      }
    } catch (error: any) {
      console.error('Error downloading transcript:', error);
      toast.error(error.message || 'Failed to download transcript');
    } finally {
      setLoadingUnsyncedMeeting(null);
    }
  };

  // Load existing transcripts when filters change
  useEffect(() => {
    loadExistingTranscripts();
  }, [existingPage, existingPageSize, selectedCategory, searchQuery, participantFilter, dateRange]);

  const formatCallDateTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const zonedDate = toZonedTime(date, userTimezone);
      const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      const dayOfWeek = days[zonedDate.getDay()];
      const formattedDate = format(zonedDate, "MM/dd/yy");
      const formattedTime = format(zonedDate, "h:mm a");
      return `${dayOfWeek} • ${formattedDate} • ${formattedTime}`;
    } catch (error) {
      return format(new Date(isoString), "MMM d, yyyy");
    }
  };

  const loadCategoryAssignments = async (recordingIds: string[]) => {
    try {
      const { data } = await supabase
        .from('call_category_assignments')
        .select('call_recording_id, category_id')
        .in('call_recording_id', recordingIds.map(id => parseInt(id)));

      const assignments: Record<string, string[]> = {};
      (data || []).forEach(assignment => {
        const id = assignment.call_recording_id.toString();
        if (!assignments[id]) assignments[id] = [];
        assignments[id].push(assignment.category_id);
      });

      setCategoryAssignments(assignments);
    } catch (error) {
      logger.error('Error loading category assignments', error);
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
        
        await loadCategoryAssignments(unsyncedMeetings.map((m: Meeting) => m.recording_id));
      } else {
        setMeetings([]);
        toast.success('No unsynced meetings found');
      }
    } catch (error: any) {
      logger.error('Error fetching meetings', error);
      const errorMsg = error.message || 'Failed to fetch meetings';
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

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
        setPerMeetingCategories({});
        
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
    } catch (error: any) {
      logger.error("Error during sync", error);
      toast.error(error.message || "Failed to sync meetings");
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

  const handleViewCall = (recordingId: string) => {
    setSelectedCallId(recordingId);
    setDialogOpen(true);
  };

  const handleDownloadTranscript = async (recordingId: string) => {
    try {
      const { data, error } = await supabase
        .from("fathom_calls")
        .select("title, full_transcript")
        .eq("recording_id", Number(recordingId))
        .single();

      if (error) throw error;

      const blob = new Blob([data.full_transcript || "No transcript available"], {
        type: "text/plain",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${data.title}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Transcript downloaded");
    } catch (error) {
      logger.error("Error downloading transcript", error);
      toast.error("Failed to download transcript");
    }
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

  const handleCategoryChange = (recordingId: string, categoryId: string) => {
    setPerMeetingCategories((prev) => ({
      ...prev,
      [recordingId]: categoryId,
    }));
  };

  const filteredExistingTranscripts = existingTranscripts.filter(t => {
    // Category filter (date range and search are now applied at DB level)
    if (selectedCategory !== "all" && !categoryAssignments[t.recording_id]?.includes(selectedCategory)) {
      return false;
    }
    
    return true;
  });

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

      {/* Active Sync Jobs Status */}
      <ActiveSyncJobsCard
        activeSyncJobs={activeSyncJobs}
        onCancelJob={cancelSyncJob}
      />


      {/* Sync Progress */}
      {syncing && (
        <div className="p-4 border border-cb-gray-light dark:border-cb-gray-dark rounded-lg bg-white/50 dark:bg-card/50">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Syncing meetings...</span>
              <span className="text-muted-foreground">
                {syncProgress.current} / {syncProgress.total}
              </span>
            </div>
            <Progress
              value={(syncProgress.current / syncProgress.total) * 100}
              className="h-2"
            />
          </div>
        </div>
      )}

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
        categoryAssignments={categoryAssignments}
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
