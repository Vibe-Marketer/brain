import { useState, useEffect, useMemo, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { ChangeSpeakerDialog } from "@/components/transcript-library/ChangeSpeakerDialog";
import { TrimConfirmDialog } from "@/components/transcript-library/TrimConfirmDialog";
import { ResyncConfirmDialog } from "@/components/transcript-library/ResyncConfirmDialog";
import { useTranscriptExport } from "@/hooks/useTranscriptExport";
import { useCallDetailQueries } from "@/hooks/useCallDetailQueries";
import { useCallDetailMutations } from "@/hooks/useCallDetailMutations";
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
    type: "this" | "before";
    segmentId: string | null;
  }>({ open: false, type: "this", segmentId: null });
  const [resyncDialog, setResyncDialog] = useState(false);

  // Use custom hooks for queries and mutations
  const {
    userSettings,
    allTranscripts,
    transcripts,
    callCategories,
    callTags,
    callSpeakers,
    transcriptStats,
    editedCount,
    deletedCount,
    hasTranscriptChanges,
    isHostedByUser,
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
  } = useCallDetailMutations({
    call,
    userId: user?.id,
    queryClient,
    onDataChange,
  });

  // Update local state when call changes
  useEffect(() => {
    if (call?.title) {
      setEditedTitle(call.title);
    }
    if (call?.summary) {
      setEditedSummary(call.summary);
    }
  }, [call]);

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
    } else {
      // Find the index in VISIBLE transcripts (excluding deleted)
      const segmentIndex = transcripts.findIndex((t: any) => t.id === trimDialog.segmentId);
      // Get all VISIBLE segments before it
      const segmentIds = transcripts.slice(0, segmentIndex).map((t: any) => t.id);
      logger.info("Trimming segments", segmentIds);
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

  const handleRevert = useCallback((segmentId: string) => {
    revertSegmentMutation.mutate({ segmentId });
  }, [revertSegmentMutation]);

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
    onRevert: handleRevert,
    onResyncCall: handleResyncCall,
  }), [
    handleExport,
    handleCopyTranscript,
    handleEditSegment,
    handleSaveEdit,
    handleCancelEdit,
    handleChangeSpeaker,
    handleTrimThis,
    handleTrimBefore,
    handleRevert,
    handleResyncCall,
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

          <CallInviteesTab calendarInvitees={call.calendar_invitees} />

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
        availableSpeakers={callSpeakers?.map((s: any) => ({
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
    </Dialog>
  );
}
