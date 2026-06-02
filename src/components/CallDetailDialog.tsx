import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs } from "@/components/ui/tabs";
import { SelectionButton } from "@/components/ui/selection-button";
import { useAuth } from "@/contexts/AuthContext";
import { ChangeSpeakerDialog } from "@/components/transcript-library/ChangeSpeakerDialog";
import { TrimConfirmDialog } from "@/components/transcript-library/TrimConfirmDialog";
import { ResyncConfirmDialog } from "@/components/transcript-library/ResyncConfirmDialog";
import { SplitConfirmDialog } from "@/components/transcript-library/SplitConfirmDialog";
import { useTranscriptExport } from "@/hooks/useTranscriptExport";
import { useCallDetailQueries } from "@/hooks/useCallDetailQueries";
import { useCallDetailMutations } from "@/hooks/useCallDetailMutations";
import { useRawCallData } from "@/hooks/useRawCallData";
import { useFathomRefresh, type FathomRefreshResult } from "@/hooks/useFathomRefresh";
import {
  RiCheckboxCircleLine,
  RiInformationLine,
  RiFileTextLine,
  RiCalendarEventLine,
  RiGroupLine,
} from "@remixicon/react";
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
import { supabase } from "@/integrations/supabase/client";
import { Meeting } from "@/types";
import { toast } from "sonner";

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
  const _navigate = useNavigate();
  const queryClient = useQueryClient();

  // Local UI state
  const [activeTab, setActiveTab] = useState<
    "overview" | "transcript" | "invitees" | "participants"
  >("overview");
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(call?.title || "");
  const [editedSummary, setEditedSummary] = useState(call?.summary || "");
  const [includeTimestamps, setIncludeTimestamps] = useState(() => {
    const saved = localStorage.getItem("transcript-include-timestamps");
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
  }>({
    open: false,
    segmentId: null,
    currentSpeaker: "",
    currentEmail: undefined,
  });
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

  const recordingUuid =
    call?.canonical_uuid ??
    (typeof call?.recording_id === "string" ? call.recording_id : undefined);
  const { data: rawCallData, isLoading: rawCallLoading } = useRawCallData(
    recordingUuid,
    call?.source_platform,
  );

  const {
    updateCall: updateCallMutation,
    editSegment: editSegmentMutation,
    changeSpeaker: changeSpeakerMutation,
    trimSegment: trimSegmentMutation,
    revertSegment: revertSegmentMutation,
    splitRecording: splitRecordingMutation,
  } = useCallDetailMutations({
    call,
    userId: user?.id,
    queryClient,
    onDataChange,
  });
  const handleFathomRefreshSuccess = useCallback(
    async (result: FathomRefreshResult) => {
      setEditedTitle(result.title || "");
      setIsEditing(false);

      const { data, error } = await supabase
        .from("recordings")
        .select("summary")
        .eq("id", result.recording_id)
        .maybeSingle();

      if (error) {
        logger.warn("Failed to refetch refreshed recording summary", error);
      } else {
        setEditedSummary(data?.summary || "");
      }

      onDataChange?.();
    },
    [onDataChange],
  );
  const refreshMutation = useFathomRefresh({
    onSuccess: handleFathomRefreshSuccess,
    onSettled: () => setResyncDialog(false),
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
    localStorage.setItem(
      "transcript-include-timestamps",
      JSON.stringify(includeTimestamps),
    );
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
      toast.success(
        `Recording split into "${result.part1_title}" and "${result.part2_title}"`,
      );
    }
  }, [splitRecordingMutation.isSuccess, splitRecordingMutation.data]);

  // Debug logging for missing data
  const duration =
    call?.recording_start_time && call?.recording_end_time
      ? Math.round(
          (new Date(call.recording_end_time).getTime() -
            new Date(call.recording_start_time).getTime()) /
            1000 /
            60,
        )
      : call?.source_metadata?.duration_seconds != null
        ? Math.round((call.source_metadata.duration_seconds as number) / 60)
      : null;

  useEffect(() => {
    if (open && call) {
      logger.info("CallDetailDialog - Call data", {
        recording_id: call.recording_id,
        has_recording_start_time: !!call.recording_start_time,
        has_recording_end_time: !!call.recording_end_time,
        has_url: !!call.url,
        has_share_url: !!call.share_url,
        has_calendar_invitees: !!call.calendar_invitees,
        calendar_invitees_count: call.calendar_invitees?.length || 0,
        duration,
      });
    }
  }, [open, call, duration]);

  // Use export/copy hook
  const { handleCopyTranscript, handleExport } = useTranscriptExport({
    call,
    transcripts,
    duration,
    includeTimestamps,
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
      const segmentIndex = transcripts.findIndex(
        (t: { id: string }) => t.id === trimDialog.segmentId,
      );
      // Get all VISIBLE segments before it
      const segmentIds = transcripts
        .slice(0, segmentIndex)
        .map((t: { id: string }) => t.id);
      logger.info("Trimming segments", segmentIds);
      trimSegmentMutation.mutate({ segmentIds });
    } else {
      // Find the index in VISIBLE transcripts (excluding deleted)
      const segmentIndex = transcripts.findIndex(
        (t: { id: string }) => t.id === trimDialog.segmentId,
      );
      // Get all VISIBLE segments after it (not including the selected segment)
      const segmentIds = transcripts
        .slice(segmentIndex + 1)
        .map((t: { id: string }) => t.id);
      logger.info("Trimming segments after", segmentIds);
      trimSegmentMutation.mutate({ segmentIds });
    }
  };

  // Wrap all handlers in useCallback for performance optimization
  const handleResyncCall = useCallback(() => {
    setResyncDialog(true);
  }, []);

  const handleEditSegment = useCallback(
    (segmentId: string, currentText: string) => {
      setEditingSegmentId(segmentId);
      setEditingText(currentText);
    },
    [],
  );

  const handleSaveEdit = useCallback(
    (segmentId: string) => {
      editSegmentMutation.mutate({ segmentId, text: editingText });
    },
    [editingText, editSegmentMutation],
  );

  const handleCancelEdit = useCallback(() => {
    setEditingSegmentId(null);
    setEditingText("");
  }, []);

  const handleChangeSpeaker = useCallback(
    (segmentId: string, currentSpeaker: string, currentEmail?: string) => {
      setChangeSpeakerDialog({
        open: true,
        segmentId,
        currentSpeaker,
        currentEmail,
      });
    },
    [],
  );

  const handleTrimThis = useCallback((segmentId: string) => {
    setTrimDialog({ open: true, type: "this", segmentId });
  }, []);

  const handleTrimBefore = useCallback((segmentId: string) => {
    setTrimDialog({ open: true, type: "before", segmentId });
  }, []);

  const handleTrimAfter = useCallback((segmentId: string) => {
    setTrimDialog({ open: true, type: "after", segmentId });
  }, []);

  const handleRevert = useCallback(
    (segmentId: string) => {
      revertSegmentMutation.mutate({ segmentId });
    },
    [revertSegmentMutation],
  );

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
  const transcriptViewState: TranscriptViewState = useMemo(
    () => ({
      includeTimestamps,
      viewRaw,
      editingSegmentId,
      editingText,
    }),
    [includeTimestamps, viewRaw, editingSegmentId, editingText],
  );

  const handleViewStateChange = useCallback(
    (updates: Partial<TranscriptViewState>) => {
      if ("includeTimestamps" in updates)
        setIncludeTimestamps(updates.includeTimestamps!);
      if ("viewRaw" in updates) setViewRaw(updates.viewRaw!);
      if ("editingSegmentId" in updates)
        setEditingSegmentId(updates.editingSegmentId ?? null);
      if ("editingText" in updates) setEditingText(updates.editingText ?? "");
    },
    [],
  );

  const transcriptHandlers: TranscriptHandlers = useMemo(
    () => ({
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
    }),
    [
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
    ],
  );

  const transcriptData: TranscriptData = useMemo(
    () => ({
      call,
      transcripts: transcripts ?? [],
      userSettings,
      callSpeakers: callSpeakers ?? [],
    }),
    [call, transcripts, userSettings, callSpeakers],
  );

  if (!call) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col overflow-hidden bg-card">
        <DialogDescription className="sr-only">
          View and edit call details including overview, transcript, invitees,
          and speakers.
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
          onRefreshSuccess={handleFathomRefreshSuccess}
        />

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as typeof activeTab)}
          className="w-full flex-1 flex flex-col overflow-hidden"
        >
          {/* Canonical horizontal tab row — orange pill on bottom edge */}
          <div className="flex-shrink-0 flex items-center gap-2 px-4">
            <SelectionButton
              orientation="horizontal"
              selected={activeTab === "overview"}
              icon={<RiInformationLine className="h-4 w-4" />}
              label="Overview"
              onClick={() => setActiveTab("overview")}
            />
            <SelectionButton
              orientation="horizontal"
              selected={activeTab === "transcript"}
              icon={<RiFileTextLine className="h-4 w-4" />}
              label="Transcript"
              onClick={() => setActiveTab("transcript")}
            />
            <SelectionButton
              orientation="horizontal"
              selected={activeTab === "invitees"}
              icon={<RiCalendarEventLine className="h-4 w-4" />}
              label="Invitees"
              onClick={() => setActiveTab("invitees")}
            />
            <SelectionButton
              orientation="horizontal"
              selected={activeTab === "participants"}
              icon={<RiGroupLine className="h-4 w-4" />}
              label="Speakers"
              onClick={() => setActiveTab("participants")}
            />
          </div>

          <CallOverviewTab
            call={call}
            duration={duration}
            callSpeakers={callSpeakers ?? []}
            callCategories={callCategories ?? []}
            isEditing={isEditing}
            editedSummary={editedSummary}
            setEditedSummary={setEditedSummary}
            sourceApp={call.source_platform}
            rawCallData={rawCallData}
            rawCallLoading={rawCallLoading}
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
        onOpenChange={(open) =>
          setChangeSpeakerDialog({ ...changeSpeakerDialog, open })
        }
        currentSpeaker={changeSpeakerDialog.currentSpeaker}
        currentEmail={changeSpeakerDialog.currentEmail}
        availableSpeakers={
          callSpeakers?.map(
            (s: { speaker_name: string; speaker_email?: string }) => ({
              name: s.speaker_name,
              email: s.speaker_email,
            }),
          ) || []
        }
        onSave={(name, email) => {
          if (changeSpeakerDialog.segmentId) {
            changeSpeakerMutation.mutate({
              segmentId: changeSpeakerDialog.segmentId,
              name,
              email,
            });
          }
          setChangeSpeakerDialog({
            open: false,
            segmentId: null,
            currentSpeaker: "",
            currentEmail: undefined,
          });
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
        onConfirm={() => {
          if (recordingUuid) {
            refreshMutation.mutate(recordingUuid);
          }
        }}
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
          <DialogContent className="max-w-md bg-card">
            <DialogDescription className="sr-only">
              Recording split successfully.
            </DialogDescription>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <RiCheckboxCircleLine className="h-5 w-5 text-green-500" />
                <h3 className="font-semibold text-foreground">
                  Recording split successfully
                </h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Your call has been split into two recordings. Each summary has
                been cleared.
              </p>
              <div className="space-y-2">
                <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm font-medium truncate">
                  {splitResult.part1Title}
                </div>
                <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm font-medium truncate">
                  {splitResult.part2Title}
                </div>
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
