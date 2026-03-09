import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { ChangeSpeakerDialog } from "@/components/transcript-library/ChangeSpeakerDialog";
import { TrimConfirmDialog } from "@/components/transcript-library/TrimConfirmDialog";
import { ResyncConfirmDialog } from "@/components/transcript-library/ResyncConfirmDialog";
import { SplitConfirmDialog } from "@/components/transcript-library/SplitConfirmDialog";
import { useTranscriptExport } from "@/hooks/useTranscriptExport";
import { useCallDetailQueries } from "@/hooks/useCallDetailQueries";
import { useCallDetailMutations } from "@/hooks/useCallDetailMutations";
import { Badge } from "@/components/ui/badge";
import { RiCheckboxCircleLine, RiRefreshLine } from "@remixicon/react";
import { CallStatsFooter } from "@/components/call-detail/CallStatsFooter";
import { CallInviteesTab } from "@/components/call-detail/CallInviteesTab";
import { CallParticipantsTab } from "@/components/call-detail/CallParticipantsTab";
import { CallDetailHeader } from "@/components/call-detail/CallDetailHeader";
import { CallOverviewTab } from "@/components/call-detail/CallOverviewTab";
import {
  CallTranscriptTab,
  type TranscriptViewState,
  type TranscriptHandlers,
  type TranscriptData,
} from "@/components/call-detail/CallTranscriptTab";
import { logger } from "@/lib/logger";
import { Meeting } from "@/types";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * Row in the post-split dialog that shows a recording title and a
 * "Regenerate summary" button with proper async handling.
 */
function SplitSummaryRow({
  title,
  recordingId,
}: {
  title: string;
  recordingId: string | number | null | undefined;
}) {
  const handleRegenerate = async () => {
    if (!recordingId) return;
    const toastId = toast.loading(`Regenerating summary for "${title}"…`);
    try {
      const { error } = await supabase.functions.invoke('summarize-call', {
        body: { recording_id: recordingId, force_refresh: true },
      });
      if (error) throw error;
      toast.success(`Summary regenerated for "${title}"`, { id: toastId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Failed to regenerate summary: ${msg}`, { id: toastId });
    }
  };

  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
      <span className="text-sm font-medium truncate">{title}</span>
      <button
        onClick={handleRegenerate}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground ml-2 shrink-0"
      >
        <RiRefreshLine className="h-3 w-3" />
        Regenerate
      </button>
    </div>
  );
}

interface CallDetailDialogProps {
  call: Meeting | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDataChange?: () => void;
}


export function CallDetailDialog({
  call,
  open,
  onOpenChange,
  onDataChange,
}: CallDetailDialogProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Local UI state
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(call?.title || "");
  const [editedSummary, setEditedSummary] = useState(call?.summary || "");
  const [includeTimestamps, setIncludeTimestamps] = useState(() => {
    const saved = localStorage.getItem('transcript-include-timestamps');
    return saved ? JSON.parse(saved) : true;
  });
  const [viewRaw, setViewRaw] = useState(false);

  // Transcript editing state
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [changeSpeakerDialog, setChangeSpeakerDialog] = useState<{
    open: boolean;
    segmentId: string | null;
    currentSpeaker: string;
    currentEmail?: string;
  }>({ open: false, segmentId: null, currentSpeaker: "", currentEmail: undefined });
  const [trimDialog, setTrimDialog] = useState<{
    open: boolean;
    type: "this" | "before" | "after";
    segmentId: string | null;
  }>({ open: false, type: "this", segmentId: null });
  const [resyncDialog, setResyncDialog] = useState(false);
  const [splitDialog, setSplitDialog] = useState<{
    open: boolean;
    segmentId: string | null;
  }>({ open: false, segmentId: null });
  const [splitResult, setSplitResult] = useState<{
    part1Title: string;
    part2RecordingId: string;
    part2Title: string;
  } | null>(null);

  // Use custom hooks for queries and mutations
  const {
    userSettings,
    allTranscripts,
    transcripts,
    callCategories,
    callTags: _callTags,
    callSpeakers,
    transcriptStats,
    editedCount,
    deletedCount,
    hasTranscriptChanges: _hasTranscriptChanges,
    isHostedByUser: _isHostedByUser,
  } = useCallDetailQueries({
    call,
    userId: user?.id,
    open,
  });

  const {
    updateCall: updateCallMutation,
    editSegment: editSegmentMutation,
    changeSpeaker: changeSpeakerMutation,
    trimSegment: trimSegmentMutation,
    revertSegment: revertSegmentMutation,
    resyncCall: resyncCallMutation,
    splitRecording: splitRecordingMutation,
  } = useCallDetailMutations({
    call,
    userId: user?.id,
    queryClient,
    onDataChange,
  });

  // Update local state when call changes or dialog opens
  useEffect(() => {
    if (open && call) {
      setEditedTitle(call.title || "");
      setEditedSummary(call.summary || "");
      setIsEditing(false); // Reset editing state when opening
    }
  }, [call, open]);

  // Persist timestamps preference
  useEffect(() => {
    localStorage.setItem('transcript-include-timestamps', JSON.stringify(includeTimestamps));
  }, [includeTimestamps]);

  // Close editing mode when update succeeds
  useEffect(() => {
    if (updateCallMutation.isSuccess) {
      setIsEditing(false);
    }
  }, [updateCallMutation.isSuccess]);

  // Close editing segment when update succeeds
  useEffect(() => {
    if (editSegmentMutation.isSuccess) {
      setEditingSegmentId(null);
    }
  }, [editSegmentMutation.isSuccess]);

  // Close trim dialog when update succeeds
  useEffect(() => {
    if (trimSegmentMutation.isSuccess) {
      setTrimDialog({ open: false, type: "this", segmentId: null });
    }
  }, [trimSegmentMutation.isSuccess]);

  // Close resync dialog when update succeeds
  useEffect(() => {
    if (resyncCallMutation.isSuccess) {
      setResyncDialog(false);
    }
  }, [resyncCallMutation.isSuccess]);

  // Handle split recording success
  useEffect(() => {
    if (splitRecordingMutation.isSuccess && splitRecordingMutation.data) {
      const result = splitRecordingMutation.data;
      setSplitDialog({ open: false, segmentId: null });
      setSplitResult({
        part1Title: result.part1_title,
        part2RecordingId: result.part2_recording_id,
        part2Title: result.part2_title,
      });
      toast.success(`Recording split into "${result.part1_title}" and "${result.part2_title}"`);
    }
  }, [splitRecordingMutation.isSuccess, splitRecordingMutation.data]);

  // Debug logging for missing data
  const duration = call?.recording_start_time && call?.recording_end_time
    ? Math.round((new Date(call.recording_end_time).getTime() - new Date(call.recording_start_time).getTime()) / 1000 / 60)
    : null;

  useEffect(() => {
    if (open && call) {
      logger.info('CallDetailDialog - Call data', {
        recording_id: call.recording_id,
        has_recording_start_time: !!call.recording_start_time,
        has_recording_end_time: !!call.recording_end_time,
        has_url: !!call.url,
        has_share_url: !!call.share_url,
        has_calendar_invitees: !!call.calendar_invitees,
        calendar_invitees_count: call.calendar_invitees?.length || 0,
        duration
      });
    }
  }, [open, call, duration]);

  // Use export/copy hook
  const { handleCopyTranscript, handleExport } = useTranscriptExport({
    call,
    transcripts,
    duration,
    includeTimestamps
  });

  // Handlers
  const handleSave = () => {
    updateCallMutation.mutate({
      title: editedTitle,
      summary: editedSummary,
      originalTitle: call?.title || "",
      originalSummary: call?.summary || null,
    });
  };

  const handleConfirmTrim = () => {
    if (!trimDialog.segmentId || !transcripts) return;

    logger.info("Trim dialog", trimDialog);
    logger.info("Visible transcripts count", transcripts?.length);
    logger.info("All transcripts count", allTranscripts?.length);

    if (trimDialog.type === "this") {
      trimSegmentMutation.mutate({ segmentIds: [trimDialog.segmentId] });
    } else if (trimDialog.type === "before") {
      // Find the index in VISIBLE transcripts (excluding deleted)
      const segmentIndex = transcripts.findIndex((t: { id: string }) => t.id === trimDialog.segmentId);
      // Get all VISIBLE segments before it
      const segmentIds = transcripts.slice(0, segmentIndex).map((t: { id: string }) => t.id);
      logger.info("Trimming segments", segmentIds);
      trimSegmentMutation.mutate({ segmentIds });
    } else {
      // Find the index in VISIBLE transcripts (excluding deleted)
      const segmentIndex = transcripts.findIndex((t: { id: string }) => t.id === trimDialog.segmentId);
      // Get all VISIBLE segments after it (not including the selected segment)
      const segmentIds = transcripts.slice(segmentIndex + 1).map((t: { id: string }) => t.id);
      logger.info("Trimming segments after", segmentIds);
      trimSegmentMutation.mutate({ segmentIds });
    }
  };

  // Wrap all handlers in useCallback for performance optimization
  const handleResyncCall = useCallback(() => {
    setResyncDialog(true);
  }, []);

  const handleEditSegment = useCallback((segmentId: string, currentText: string) => {
    setEditingSegmentId(segmentId);
    setEditingText(currentText);
  }, []);

  const handleSaveEdit = useCallback((segmentId: string) => {
    editSegmentMutation.mutate({ segmentId, text: editingText });
  }, [editingText, editSegmentMutation]);

  const handleCancelEdit = useCallback(() => {
    setEditingSegmentId(null);
    setEditingText("");
  }, []);

  const handleChangeSpeaker = useCallback((segmentId: string, currentSpeaker: string, currentEmail?: string) => {
    setChangeSpeakerDialog({
      open: true,
      segmentId,
      currentSpeaker,
      currentEmail
    });
  }, []);

  const handleTrimThis = useCallback((segmentId: string) => {
    setTrimDialog({ open: true, type: "this", segmentId });
  }, []);

  const handleTrimBefore = useCallback((segmentId: string) => {
    setTrimDialog({ open: true, type: "before", segmentId });
  }, []);

  const handleTrimAfter = useCallback((segmentId: string) => {
    setTrimDialog({ open: true, type: "after", segmentId });
  }, []);

  const handleRevert = useCallback((segmentId: string) => {
    revertSegmentMutation.mutate({ segmentId });
  }, [revertSegmentMutation]);

  const handleSplitHere = useCallback((segmentId: string) => {
    // Pass the segment's database id directly to the backend so it can do an exact
    // lookup in fathom_transcripts (filtering out deleted segments). This avoids both
    // the "trimmed segments reappear in split" bug (full_transcript isn't filtered) and
    // the "wrong segment if speaker was edited" bug (name in full_transcript is original).
    setSplitDialog({ open: true, segmentId });
  }, []);

  const handleConfirmSplit = useCallback(() => {
    if (!splitDialog.segmentId) return;
    splitRecordingMutation.mutate({ segmentId: splitDialog.segmentId });
  }, [splitDialog.segmentId, splitRecordingMutation]);

  // Create grouped props using useMemo for optimal performance
  const transcriptViewState: TranscriptViewState = useMemo(() => ({
    includeTimestamps,
    viewRaw,
    editingSegmentId,
    editingText,
  }), [includeTimestamps, viewRaw, editingSegmentId, editingText]);

  const handleViewStateChange = useCallback((updates: Partial<TranscriptViewState>) => {
    if ('includeTimestamps' in updates) setIncludeTimestamps(updates.includeTimestamps!);
    if ('viewRaw' in updates) setViewRaw(updates.viewRaw!);
    if ('editingSegmentId' in updates) setEditingSegmentId(updates.editingSegmentId ?? null);
    if ('editingText' in updates) setEditingText(updates.editingText ?? '');
  }, []);

  const transcriptHandlers: TranscriptHandlers = useMemo(() => ({
    onExport: handleExport,
    onCopyTranscript: handleCopyTranscript,
    onEditSegment: handleEditSegment,
    onSaveEdit: handleSaveEdit,
    onCancelEdit: handleCancelEdit,
    onChangeSpeaker: handleChangeSpeaker,
    onTrimThis: handleTrimThis,
    onTrimBefore: handleTrimBefore,
    onTrimAfter: handleTrimAfter,
    onRevert: handleRevert,
    onResyncCall: handleResyncCall,
    onSplitHere: handleSplitHere,
  }), [
    handleExport,
    handleCopyTranscript,
    handleEditSegment,
    handleSaveEdit,
    handleCancelEdit,
    handleChangeSpeaker,
    handleTrimThis,
    handleTrimBefore,
    handleTrimAfter,
    handleRevert,
    handleResyncCall,
    handleSplitHere,
  ]);

  const transcriptData: TranscriptData = useMemo(() => ({
    call,
    transcripts: transcripts ?? [],
    userSettings,
    callSpeakers: callSpeakers ?? [],
  }), [call, transcripts, userSettings, callSpeakers]);

  if (!call) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-5xl h-[90vh] flex flex-col overflow-hidden bg-card"
        aria-describedby="call-detail-description"
      >
        <DialogDescription id="call-detail-description" className="sr-only">
          View and edit call details including overview, transcript, invitees, and participants.
        </DialogDescription>
        <CallDetailHeader
          call={call}
          isEditing={isEditing}
          setIsEditing={setIsEditing}
          editedTitle={editedTitle}
          setEditedTitle={setEditedTitle}
          setEditedSummary={setEditedSummary}
          onSave={handleSave}
          isSaving={updateCallMutation.isPending}
        />

        <Tabs defaultValue="overview" className="w-full flex-1 flex flex-col overflow-hidden">
          <TabsList className="flex-shrink-0">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="transcript">Transcript</TabsTrigger>
            <TabsTrigger value="invitees">Invitees</TabsTrigger>
            <TabsTrigger value="participants">Participants</TabsTrigger>
          </TabsList>

          <CallOverviewTab
            call={call}
            duration={duration}
            callSpeakers={callSpeakers ?? []}
            callCategories={callCategories ?? []}
            isEditing={isEditing}
            editedSummary={editedSummary}
            setEditedSummary={setEditedSummary}
          />

          <CallTranscriptTab
            viewState={transcriptViewState}
            onViewStateChange={handleViewStateChange}
            handlers={transcriptHandlers}
            data={transcriptData}
            duration={duration}
          />

          <CallInviteesTab
            calendarInvitees={call.calendar_invitees}
            callSpeakers={callSpeakers}
          />

          <CallParticipantsTab
            callSpeakers={callSpeakers}
            hasTranscripts={!!(transcripts && transcripts.length > 0)}
          />
        </Tabs>

        <CallStatsFooter
          transcriptStats={transcriptStats}
          hasTranscripts={!!(transcripts && transcripts.length > 0)}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>

      {/* Change Speaker Dialog */}
      <ChangeSpeakerDialog
        open={changeSpeakerDialog.open}
        onOpenChange={(open) => setChangeSpeakerDialog({ ...changeSpeakerDialog, open })}
        currentSpeaker={changeSpeakerDialog.currentSpeaker}
        currentEmail={changeSpeakerDialog.currentEmail}
        availableSpeakers={callSpeakers?.map((s: { speaker_name: string; speaker_email?: string }) => ({
          name: s.speaker_name,
          email: s.speaker_email
        })) || []}
        onSave={(name, email) => {
          if (changeSpeakerDialog.segmentId) {
            changeSpeakerMutation.mutate({
              segmentId: changeSpeakerDialog.segmentId,
              name,
              email
            });
          }
          setChangeSpeakerDialog({ open: false, segmentId: null, currentSpeaker: "", currentEmail: undefined });
        }}
      />

      {/* Trim Confirm Dialog */}
      <TrimConfirmDialog
        open={trimDialog.open}
        onOpenChange={(open) => setTrimDialog({ ...trimDialog, open })}
        type={trimDialog.type}
        onConfirm={handleConfirmTrim}
      />

      {/* Resync Confirm Dialog */}
      <ResyncConfirmDialog
        open={resyncDialog}
        onOpenChange={setResyncDialog}
        editedCount={editedCount}
        deletedCount={deletedCount}
        onConfirm={() => resyncCallMutation.mutate()}
      />

      {/* Split Confirm Dialog */}
      <SplitConfirmDialog
        open={splitDialog.open}
        onOpenChange={(open) => setSplitDialog((s) => ({ ...s, open }))}
        onConfirm={handleConfirmSplit}
        isPending={splitRecordingMutation.isPending}
      />

      {/* Post-split: Regenerate summary banner */}
      {splitResult && (
        <Dialog open={!!splitResult} onOpenChange={() => setSplitResult(null)}>
          <DialogContent className="max-w-md bg-card" aria-describedby="split-result-description">
            <DialogDescription id="split-result-description" className="sr-only">
              Recording split successfully.
            </DialogDescription>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <RiCheckboxCircleLine className="h-5 w-5 text-green-500" />
                <h3 className="font-semibold text-foreground">Recording split successfully</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Your call has been split into two recordings. Each summary has been cleared —
                regenerate them to get accurate summaries for each part.
              </p>
              <div className="space-y-2">
                <SplitSummaryRow
                  title={splitResult.part1Title}
                  recordingId={call?.recording_id}
                />
                <SplitSummaryRow
                  title={splitResult.part2Title}
                  recordingId={splitResult.part2RecordingId}
                />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => setSplitResult(null)}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Close
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}
