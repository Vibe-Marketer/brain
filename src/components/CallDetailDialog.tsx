import { useState, useEffect, useMemo, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { RiSaveLine, RiCloseLine, RiDownloadLine, RiRefreshLine, RiErrorWarningLine, RiVidiconLine, RiFileCopyLine, RiEditLine } from "@remixicon/react";
import { useAuth } from "@/contexts/AuthContext";
import ReactMarkdown from "react-markdown";
import { jsPDF } from "jspdf";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { saveAs } from "file-saver";
import { TranscriptSegmentContextMenu } from "@/components/transcript-library/TranscriptSegmentContextMenu";
import { ChangeSpeakerDialog } from "@/components/transcript-library/ChangeSpeakerDialog";
import { TrimConfirmDialog } from "@/components/transcript-library/TrimConfirmDialog";
import { ResyncConfirmDialog } from "@/components/transcript-library/ResyncConfirmDialog";
import { groupTranscriptsBySpeaker, formatSimpleTimestamp } from "@/lib/transcriptUtils";
import { useTranscriptExport } from "@/hooks/useTranscriptExport";
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

interface CallDetailDialogProps {
  call: any;
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
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(call?.title || "");
  const [editedSummary, setEditedSummary] = useState(call?.summary || "");
  const [includeTimestamps, setIncludeTimestamps] = useState(() => {
    const saved = localStorage.getItem('transcript-include-timestamps');
    return saved ? JSON.parse(saved) : true;
  });
  const [viewRaw, setViewRaw] = useState(false);
  const queryClient = useQueryClient();

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

  // Fetch user settings to get host email
  const { data: userSettings } = useQuery({
    queryKey: ["user-settings", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("user_settings")
        .select("host_email")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open && !!user,
  });

  const isHostedByUser = userSettings?.host_email && call?.recorded_by_email && 
    userSettings.host_email.toLowerCase() === call.recorded_by_email.toLowerCase();

  useEffect(() => {
    if (call?.title) {
      setEditedTitle(call.title);
    }
    if (call?.summary) {
      setEditedSummary(call.summary);
    }
  }, [call]);

  useEffect(() => {
    localStorage.setItem('transcript-include-timestamps', JSON.stringify(includeTimestamps));
  }, [includeTimestamps]);

  // Fetch transcripts for this call - always fetch fresh to show updates
  // For unsynced meetings, use the provided transcript data instead of querying DB
  const { data: allTranscripts } = useQuery({
    queryKey: ["call-transcripts", call?.recording_id],
    queryFn: async () => {
      if (!call) return [];
      
      // If this is an unsynced meeting with provided transcripts, use those
      if (call.unsyncedTranscripts) {
        return call.unsyncedTranscripts;
      }
      
      // PRIMARY METHOD: Parse from full_transcript field (complete data, single query)
      const { data: callData, error: callError } = await supabase
        .from("fathom_calls")
        .select("full_transcript")
        .eq("recording_id", call.recording_id)
        .single();
      
      if (callError) {
        console.error("Error fetching full_transcript:", callError);
      }
      
      // Parse full_transcript into segments
      if (callData?.full_transcript) {
        const segmentRegex = /\[(\d{2}:\d{2}:\d{2})\]\s+([^:]+):\s+([^\n]+)/g;
        const segments = [];
        let match;
        let segmentIndex = 0;
        
        while ((match = segmentRegex.exec(callData.full_transcript)) !== null) {
          segments.push({
            id: `parsed-${segmentIndex}`,
            recording_id: call.recording_id,
            timestamp: match[1],
            speaker_name: match[2].trim(),
            speaker_email: null, // Will be populated from speaker mapping below
            text: match[3].trim(),
            edited_text: null,
            edited_speaker_name: null,
            edited_speaker_email: null,
            is_deleted: false,
            created_at: new Date().toISOString(),
          });
          segmentIndex++;
        }
        
        // Fetch speaker email mapping from fathom_transcripts to restore email data
        const { data: speakerData, error: speakerError } = await supabase
          .from("fathom_transcripts")
          .select("speaker_name, speaker_email")
          .eq("recording_id", call.recording_id);
        
        if (!speakerError && speakerData) {
          // Create speaker name -> email mapping (use first non-null email for each speaker)
          const speakerEmailMap = new Map<string, string>();
          speakerData.forEach((row: any) => {
            if (row.speaker_email && !speakerEmailMap.has(row.speaker_name)) {
              speakerEmailMap.set(row.speaker_name, row.speaker_email);
            }
          });
          
          // Apply email mapping to parsed segments
          segments.forEach(segment => {
            const email = speakerEmailMap.get(segment.speaker_name);
            if (email) {
              segment.speaker_email = email;
            }
          });
          
          console.log(`✅ Parsed ${segments.length} segments with ${speakerEmailMap.size} speaker email mappings`);
        } else {
          console.log(`✅ Parsed ${segments.length} segments from full_transcript (no email mapping available)`);
        }
        
        return segments;
      }
      
      // FALLBACK METHOD: Fetch from fathom_transcripts with pagination to handle 10K limit
      console.log("⚠️ full_transcript not available, using paginated query fallback");
      const segments = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("fathom_transcripts")
          .select("*")
          .eq("recording_id", call.recording_id)
          .order("timestamp")
          .range(from, from + batchSize - 1);

        if (error) throw error;
        
        if (data && data.length > 0) {
          segments.push(...data);
          from += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      console.log(`✅ Fetched ${segments.length} segments via pagination`);
      return segments;
    },
    enabled: open && !!call,
    refetchOnMount: "always",
    staleTime: 0,
  });
  
  // Process transcripts to use edited values when available and filter deleted
  const transcripts = allTranscripts?.filter((t: any) => !t.is_deleted).map((t: any) => ({
    ...t,
    display_text: t.edited_text || t.text,
    display_speaker_name: t.edited_speaker_name || t.speaker_name,
    display_speaker_email: t.edited_speaker_email || t.speaker_email,
    has_edits: !!(t.edited_text || t.edited_speaker_name)
  }));

  const editedCount = allTranscripts?.filter((t: any) => t.edited_text || t.edited_speaker_name).length || 0;
  const deletedCount = allTranscripts?.filter((t: any) => t.is_deleted).length || 0;
  const hasTranscriptChanges = editedCount > 0 || deletedCount > 0;

  // Calculate character and token counts for the entire transcript
  const transcriptStats = useMemo(() => {
    if (!transcripts || transcripts.length === 0) {
      return { characters: 0, tokens: 0, words: 0 };
    }

    // Build the full transcript text (grouped by speaker)
    const groups = groupTranscriptsBySpeaker(transcripts);
    let fullText = "";

    groups.forEach(group => {
      fullText += `${group.speaker}:\n`;
      group.messages.forEach(msg => {
        fullText += `${msg.text}\n`;
      });
      fullText += "\n";
    });

    const characters = fullText.length;
    const words = fullText.trim().split(/\s+/).length;
    // Token estimation: ~4 characters per token (common approximation for GPT models)
    const tokens = Math.ceil(characters / 4);

    return { characters, tokens, words };
  }, [transcripts]);

  // Fetch categories for this call
  const { data: callCategories } = useQuery({
    queryKey: ["call-categories", call?.recording_id],
    queryFn: async () => {
      if (!call) return [];
      const { data, error } = await supabase
        .from("call_category_assignments")
        .select(`
          category_id,
          call_categories (
            id,
            name,
            icon
          )
        `)
        .eq("call_recording_id", call.recording_id);
      if (error) throw error;
      return data?.map(d => d.call_categories).filter(Boolean) || [];
    },
    enabled: open && !!call,
  });

  // Fetch tags for this call
  const { data: callTags } = useQuery({
    queryKey: ["call-tags", call?.recording_id],
    queryFn: async () => {
      if (!call) return [];
      const { data, error } = await supabase
        .from("transcript_tag_assignments")
        .select(`
          tag_id,
          transcript_tags (
            id,
            name,
            color
          )
        `)
        .eq("call_recording_id", call.recording_id);
      if (error) throw error;
      return data?.map(d => d.transcript_tags).filter(Boolean) || [];
    },
    enabled: open && !!call,
  });

  // Fetch unique speakers from transcripts and enrich with calendar invitee data
  const { data: callSpeakers } = useQuery({
    queryKey: ["call-speakers", call?.recording_id, call?.calendar_invitees],
    queryFn: async () => {
      if (!call) return [];
      const { data: transcriptData, error } = await supabase
        .from("fathom_transcripts")
        .select("speaker_name, speaker_email")
        .eq("recording_id", call.recording_id);
      
      if (error) throw error;
      
      // Get unique speakers with their emails from transcripts
      const speakerMap = new Map();
      transcriptData?.forEach((t) => {
        if (!speakerMap.has(t.speaker_name)) {
          speakerMap.set(t.speaker_name, t.speaker_email || null);
        } else if (t.speaker_email && !speakerMap.get(t.speaker_name)) {
          speakerMap.set(t.speaker_name, t.speaker_email);
        }
      });
      
      // Enrich with calendar invitee data if email is missing
      const speakers = Array.from(speakerMap.entries()).map(([name, email]) => {
        // If we don't have an email from transcript, try to match with calendar invitees
        if (!email && call.calendar_invitees) {
          const matchedInvitee = call.calendar_invitees.find((inv: any) => 
            inv.matched_speaker_display_name === name || 
            inv.name === name
          );
          if (matchedInvitee) {
            email = matchedInvitee.email;
          }
        }
        return {
          speaker_name: name,
          speaker_email: email
        };
      });
      
      return speakers;
    },
    enabled: open && !!call,
  });

  const updateCallMutation = useMutation({
    mutationFn: async () => {
      if (!call) return;
      const { error } = await supabase
        .from("fathom_calls")
        .update({
          title: editedTitle,
          summary: editedSummary,
          title_edited_by_user: editedTitle !== call.title,
          summary_edited_by_user: editedSummary !== (call.summary || ""),
        })
        .eq("recording_id", call.recording_id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calls-with-transcripts"] });
      setIsEditing(false);
      toast.success("Call updated successfully");
      onDataChange?.();
    },
    onError: () => {
      toast.error("Failed to update call");
    },
  });

  const handleSave = () => {
    updateCallMutation.mutate();
  };

  // Transcript editing mutations
  const editSegmentMutation = useMutation({
    mutationFn: async ({ segmentId, text }: { segmentId: string; text: string }) => {
      const { error } = await supabase
        .from("fathom_transcripts")
        .update({
          edited_text: text,
          edited_at: new Date().toISOString(),
          edited_by: user?.id
        })
        .eq("id", segmentId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["call-transcripts", call?.recording_id] });
      await queryClient.refetchQueries({ queryKey: ["call-transcripts", call?.recording_id] });
      toast.success("Transcript segment updated");
      setEditingSegmentId(null);
    },
    onError: () => {
      toast.error("Failed to update segment");
    }
  });

  const changeSpeakerMutation = useMutation({
    mutationFn: async ({ segmentId, name, email }: { segmentId: string; name: string; email?: string }) => {
      const { error } = await supabase
        .from("fathom_transcripts")
        .update({
          edited_speaker_name: name,
          edited_speaker_email: email || null,
          edited_at: new Date().toISOString(),
          edited_by: user?.id
        })
        .eq("id", segmentId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["call-transcripts", call?.recording_id] });
      await queryClient.refetchQueries({ queryKey: ["call-transcripts", call?.recording_id] });
      toast.success("Speaker changed");
    },
    onError: () => {
      toast.error("Failed to change speaker");
    }
  });

  const trimSegmentMutation = useMutation({
    mutationFn: async ({ segmentIds }: { segmentIds: string[] }) => {
      const { error } = await supabase
        .from("fathom_transcripts")
        .update({
          is_deleted: true,
          edited_at: new Date().toISOString(),
          edited_by: user?.id
        })
        .in("id", segmentIds);
      if (error) throw error;
      
      // Add small delay to ensure database commits
      await new Promise(resolve => setTimeout(resolve, 100));
    },
    onSuccess: async () => {
      // Force complete cache reset for aggressive refresh
      await queryClient.resetQueries({ queryKey: ["call-transcripts", call?.recording_id] });
      
      // Wait a bit more to ensure UI updates
      await new Promise(resolve => setTimeout(resolve, 150));
      
      toast.success("Section(s) trimmed");
      setTrimDialog({ open: false, type: "this", segmentId: null });
    },
    onError: () => {
      toast.error("Failed to trim section");
      setTrimDialog({ open: false, type: "this", segmentId: null });
    }
  });

  const revertSegmentMutation = useMutation({
    mutationFn: async ({ segmentId }: { segmentId: string }) => {
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
      await queryClient.invalidateQueries({ queryKey: ["call-transcripts", call?.recording_id] });
      await queryClient.refetchQueries({ queryKey: ["call-transcripts", call?.recording_id] });
      toast.success("Changes reverted");
    },
    onError: () => {
      toast.error("Failed to revert changes");
    }
  });

  const resyncCallMutation = useMutation({
    mutationFn: async () => {
      // Fetch fresh meeting data from Fathom
      const { data: meetingData, error: fetchError } = await supabase.functions.invoke('fetch-single-meeting', {
        body: { recordingId: call.recording_id }
      });
      if (fetchError) throw fetchError;
      if (!meetingData?.meeting) throw new Error("No meeting data received");

      const meeting = meetingData.meeting;

      // Delete all existing transcripts for this recording
      const { error: deleteError } = await supabase
        .from('fathom_transcripts')
        .delete()
        .eq('recording_id', call.recording_id);
      
      if (deleteError) throw deleteError;

      // Insert fresh transcripts from Fathom
      if (meeting.transcript && meeting.transcript.length > 0) {
        const transcripts = meeting.transcript.map((t: any) => ({
          recording_id: call.recording_id,
          speaker_name: t.speaker.display_name,
          speaker_email: t.speaker.matched_calendar_invitee_email || null,
          text: t.text,
          timestamp: t.timestamp,
        }));

        const { error: insertError } = await supabase
          .from('fathom_transcripts')
          .insert(transcripts);
        
        if (insertError) throw insertError;
      }

      // Update call metadata if not user-edited
      const updateData: any = {
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

      const { error: updateError } = await supabase
        .from('fathom_calls')
        .update(updateData)
        .eq('recording_id', call.recording_id);
      
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["call-transcripts", call?.recording_id] });
      queryClient.invalidateQueries({ queryKey: ["calls-with-transcripts"] });
      toast.success("Call resynced from Fathom");
      setResyncDialog(false);
    },
    onError: (error: any) => {
      console.error("Resync error:", error);
      toast.error("Failed to resync call: " + (error.message || "Unknown error"));
    }
  });

  const handleConfirmTrim = () => {
    if (!trimDialog.segmentId || !transcripts) return;

    console.log("Trim dialog:", trimDialog);
    console.log("Visible transcripts count:", transcripts?.length);
    console.log("All transcripts count:", allTranscripts?.length);

    if (trimDialog.type === "this") {
      trimSegmentMutation.mutate({ segmentIds: [trimDialog.segmentId] });
    } else {
      // Find the index in VISIBLE transcripts (excluding deleted)
      const segmentIndex = transcripts.findIndex((t: any) => t.id === trimDialog.segmentId);
      // Get all VISIBLE segments before it
      const segmentIds = transcripts.slice(0, segmentIndex).map((t: any) => t.id);
      console.log("Trimming segments:", segmentIds);
      trimSegmentMutation.mutate({ segmentIds });
    }
    setTrimDialog({ open: false, type: "this", segmentId: null });
  };

  const duration = call?.recording_start_time && call?.recording_end_time
    ? Math.round((new Date(call.recording_end_time).getTime() - new Date(call.recording_start_time).getTime()) / 1000 / 60)
    : null;

  // Debug logging for missing data
  useEffect(() => {
    if (open && call) {
      console.log('CallDetailDialog - Call data:', {
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
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col overflow-hidden" aria-describedby="call-detail-description">
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
