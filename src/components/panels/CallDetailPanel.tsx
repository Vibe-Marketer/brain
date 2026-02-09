/**
 * CallDetailPanel - Side panel for viewing call details
 *
 * Displays call information in Pane 4 (detail panel) when clicking
 * citation sources in chat. Read-only view optimized for quick reference.
 *
 * @pattern detail-panel
 * @brand-version v4.2
 */

import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import ReactMarkdown from "react-markdown";
import {
  RiPhoneLine,
  RiCloseLine,
  RiPushpinLine,
  RiPushpinFill,
  RiRobotLine,
  RiVidiconLine,
  RiFileCopyLine,
  RiCalendarLine,
  RiTimeLine,
  RiUserLine,
  RiErrorWarningLine,
} from "@remixicon/react";
import { toast } from "sonner";
import { usePanelStore } from "@/stores/panelStore";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query-config";
import { groupTranscriptsBySpeaker } from "@/lib/transcriptUtils";
import { Meeting, TranscriptSegmentDisplay, Speaker, Category } from "@/types";
import { logger } from "@/lib/logger";

interface CallDetailPanelProps {
  recordingId: number;
}

export function CallDetailPanel({ recordingId }: CallDetailPanelProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { closePanel, togglePin, isPinned } = usePanelStore();

  // Fetch call data
  const { data: call, isLoading: isLoadingCall } = useQuery({
    queryKey: queryKeys.calls.detail(recordingId),
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("fathom_calls")
        .select("*")
        .eq("recording_id", recordingId)
        .eq("user_id", user.id)
        .single();
      if (error) {
        logger.error("Failed to fetch call:", error);
        throw error;
      }
      return data as Meeting;
    },
    enabled: !!user?.id && !!recordingId,
  });

  // Fetch user settings for host email
  const { data: userSettings } = useQuery({
    queryKey: queryKeys.user.settings(user?.id ?? ''),
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("user_settings")
        .select("host_email")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch transcripts for this call
  const { data: transcripts, isLoading: isLoadingTranscripts } = useQuery({
    queryKey: queryKeys.calls.transcripts(recordingId),
    queryFn: async () => {
      if (!call || !user?.id) return [];

      // PRIMARY METHOD: Parse from full_transcript field
      const { data: callData, error: callError } = await supabase
        .from("fathom_calls")
        .select("full_transcript")
        .eq("recording_id", recordingId)
        .eq("user_id", user.id)
        .single();

      if (callError) {
        logger.error("Error fetching full_transcript", callError);
      }

      if (callData?.full_transcript) {
        const segmentRegex = /\[(\d{2}:\d{2}:\d{2})\]\s+([^:]+):\s+([^\n]+)/g;
        const segments: TranscriptSegmentDisplay[] = [];
        let match;
        let segmentIndex = 0;

        while ((match = segmentRegex.exec(callData.full_transcript)) !== null) {
          segments.push({
            id: `parsed-${segmentIndex}`,
            recording_id: recordingId,
            timestamp: match[1] || "",
            speaker_name: (match[2] || "").trim(),
            speaker_email: null,
            text: (match[3] || "").trim(),
            edited_text: null,
            edited_speaker_name: null,
            edited_speaker_email: null,
            is_deleted: false,
            created_at: new Date().toISOString(),
            display_text: (match[3] || "").trim(),
            display_speaker_name: (match[2] || "").trim(),
            display_speaker_email: null,
            has_edits: false,
          });
          segmentIndex++;
        }

        return segments;
      }

      // Fallback: fetch from fathom_transcripts
      const { data, error } = await supabase
        .from("fathom_transcripts")
        .select("*")
        .eq("recording_id", recordingId)
        .eq("user_id", user.id)
        .order("timestamp")
        .limit(1000);

      if (error) throw error;

      return (data || []).map((t): TranscriptSegmentDisplay => ({
        ...t,
        display_text: t.edited_text || t.text,
        display_speaker_name: t.edited_speaker_name || t.speaker_name,
        display_speaker_email: t.edited_speaker_email || t.speaker_email,
        has_edits: !!(t.edited_text || t.edited_speaker_name),
      }));
    },
    enabled: !!call && !!user?.id,
  });

  // Fetch speakers for this call
  const { data: callSpeakers } = useQuery({
    queryKey: queryKeys.calls.speakers(recordingId),
    queryFn: async () => {
      if (!call || !user?.id) return [];
      const { data, error } = await supabase
        .from("fathom_transcripts")
        .select("speaker_name, speaker_email")
        .eq("recording_id", recordingId)
        .eq("user_id", user.id);

      if (error) throw error;

      const speakerMap = new Map<string, string | null>();
      data?.forEach((t) => {
        if (!speakerMap.has(t.speaker_name)) {
          speakerMap.set(t.speaker_name, t.speaker_email || null);
        }
      });

      return Array.from(speakerMap.entries()).map(([name, email]) => ({
        speaker_name: name,
        speaker_email: email,
      })) as Speaker[];
    },
    enabled: !!call && !!user?.id,
  });

  // Fetch folders/categories for this call
  const { data: callCategories } = useQuery({
    queryKey: queryKeys.calls.categories(recordingId),
    queryFn: async () => {
      if (!call || !user?.id) return [];
      const { data, error } = await supabase
        .from("call_tag_assignments")
        .select(`
          tag_id,
          call_tags (
            id,
            name,
            color
          )
        `)
        .eq("call_recording_id", recordingId)
        .eq("user_id", user.id);
      if (error) throw error;
      return (data?.map((d) => d.call_tags).filter(Boolean) || []) as Category[];
    },
    enabled: !!call && !!user?.id,
  });

  // Calculate duration
  const duration = useMemo(() => {
    if (!call?.recording_start_time || !call?.recording_end_time) return null;
    return Math.round(
      (new Date(call.recording_end_time).getTime() -
        new Date(call.recording_start_time).getTime()) /
        1000 /
        60
    );
  }, [call?.recording_start_time, call?.recording_end_time]);

  // Prepare transcript groups for display
  const transcriptGroups = useMemo(() => {
    if (!transcripts?.length) return [];
    return groupTranscriptsBySpeaker(transcripts);
  }, [transcripts]);

  // Handle chat with AI navigation
  const handleChatWithAI = () => {
    if (!call?.recording_id) return;
    closePanel();

    const initialContext = [
      {
        type: "call" as const,
        id: Number(call.recording_id),
        title: call.title || `Call ${call.recording_id}`,
        date: call.created_at,
      },
    ];

    navigate("/chat", {
      state: {
        prefilter: { recordingIds: [call.recording_id] },
        callTitle: call.title,
        initialContext,
        newSession: true,
      },
    });
  };

  // Handle copy share link
  const handleCopyLink = () => {
    if (call?.share_url) {
      navigator.clipboard.writeText(call.share_url);
      toast.success("Link copied to clipboard");
    }
  };

  // Handle view in Fathom
  const handleViewInFathom = () => {
    if (call?.share_url) {
      window.open(call.share_url, "_blank");
    }
  };

  // Loading state
  if (isLoadingCall) {
    return (
      <div className="h-full flex flex-col">
        <header className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="flex items-center gap-1">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
          </div>
        </header>
        <div className="p-4 space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  // Not found state
  if (!call) {
    return (
      <div className="h-full flex flex-col">
        <header className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold text-ink">Call Not Found</h3>
          <Button variant="ghost" size="sm" onClick={closePanel}>
            <RiCloseLine className="h-4 w-4" />
          </Button>
        </header>
        <div className="p-4">
          <p className="text-sm text-ink-muted">
            The selected call could not be found. It may have been deleted.
          </p>
        </div>
      </div>
    );
  }

  // Determine host email for styling
  const hostEmail = (
    userSettings?.host_email ||
    call.recorded_by_email ||
    ""
  ).toLowerCase();
  const hostName = (call.recorded_by_name || "").toLowerCase();

  return (
    <div
      className="h-full flex flex-col"
      role="region"
      aria-label={`Call details: ${call.title}`}
    >
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-8 h-8 rounded-lg bg-vibe-orange/10 flex items-center justify-center flex-shrink-0"
            aria-hidden="true"
          >
            <RiPhoneLine className="h-5 w-5 text-vibe-orange" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-ink truncate" id="call-panel-title">
              {call.title || "Untitled Call"}
            </h3>
            <p className="text-xs text-ink-muted">
              {new Date(call.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0" role="toolbar" aria-label="Panel actions">
          <Button
            variant="ghost"
            size="sm"
            onClick={togglePin}
            aria-label={isPinned ? "Unpin panel" : "Pin panel"}
            aria-pressed={isPinned}
          >
            {isPinned ? (
              <RiPushpinFill className="h-4 w-4 text-ink" aria-hidden="true" />
            ) : (
              <RiPushpinLine className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={closePanel}
            aria-label="Close panel"
          >
            <RiCloseLine className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </header>

      {/* Quick Actions */}
      <div className="flex items-center gap-2 p-3 border-b border-border bg-muted/30">
        <Button
          variant="default"
          size="sm"
          onClick={handleChatWithAI}
          className="gap-1"
        >
          <RiRobotLine className="h-4 w-4" />
          Chat with AI
        </Button>
        {call.share_url && (
          <>
            <Button
              variant="hollow"
              size="sm"
              onClick={handleViewInFathom}
              className="gap-1"
            >
              <RiVidiconLine className="h-4 w-4" />
              View
            </Button>
            <Button
              variant="hollow"
              size="sm"
              onClick={handleCopyLink}
              className="gap-1"
            >
              <RiFileCopyLine className="h-4 w-4" />
              Copy Link
            </Button>
          </>
        )}
      </div>

      {/* Tabs Content */}
      <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="flex-shrink-0 mx-4 mt-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="transcript">Transcript</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="flex-1 overflow-hidden m-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-cb-card rounded-lg p-3 border border-border">
                  <div className="flex items-center gap-2 text-ink-muted mb-1">
                    <RiCalendarLine className="h-4 w-4" aria-hidden="true" />
                    <span className="text-xs">Date</span>
                  </div>
                  <p className="text-sm font-medium text-ink">
                    {new Date(call.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="bg-cb-card rounded-lg p-3 border border-border">
                  <div className="flex items-center gap-2 text-ink-muted mb-1">
                    <RiTimeLine className="h-4 w-4" aria-hidden="true" />
                    <span className="text-xs">Duration</span>
                  </div>
                  <p className="text-sm font-medium text-ink">
                    {duration ? `${duration} min` : "N/A"}
                  </p>
                </div>
                <div className="bg-cb-card rounded-lg p-3 border border-border">
                  <div className="flex items-center gap-2 text-ink-muted mb-1">
                    <RiUserLine className="h-4 w-4" aria-hidden="true" />
                    <span className="text-xs">Speakers</span>
                  </div>
                  <p className="text-sm font-medium text-ink">
                    {callSpeakers?.length || 0}
                  </p>
                </div>
                <div className="bg-cb-card rounded-lg p-3 border border-border">
                  <div className="flex items-center gap-2 text-ink-muted mb-1">
                    <RiUserLine className="h-4 w-4" aria-hidden="true" />
                    <span className="text-xs">Invitees</span>
                  </div>
                  <p className="text-sm font-medium text-ink">
                    {call.calendar_invitees?.length || 0}
                  </p>
                </div>
              </div>

              {/* Missing Data Warning */}
              {(!call.recording_start_time || !call.recording_end_time || !call.share_url) && (
                <div className="p-3 bg-cb-warning-bg border border-cb-warning-border rounded-md text-cb-warning-text">
                  <div className="flex gap-2 text-sm">
                    <RiErrorWarningLine className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>Some meeting data is unavailable</span>
                  </div>
                </div>
              )}

              {/* Folders */}
              {callCategories && callCategories.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase text-ink-muted">Folders</Label>
                  <div className="flex flex-wrap gap-2">
                    {callCategories.map((category) => (
                      <Badge key={category.id} variant="hollow" className="text-xs">
                        {category.icon && <span className="mr-1">{category.icon}</span>}
                        {category.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Auto Tags */}
              {call.auto_tags && call.auto_tags.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase text-ink-muted">Auto Tags</Label>
                  <div className="flex flex-wrap gap-2">
                    {call.auto_tags.map((tag: string) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase text-ink-muted">Summary</Label>
                <div className="p-4 border border-border rounded-lg bg-card">
                  {call.summary ? (
                    <div className="prose prose-sm max-w-none text-ink [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_p]:mb-2 [&_ul]:mb-2 [&_li]:text-sm">
                      <ReactMarkdown>{call.summary}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm text-ink-muted text-center py-4">
                      No summary available
                    </p>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Transcript Tab */}
        <TabsContent value="transcript" className="flex-1 overflow-hidden m-0">
          <ScrollArea className="h-full">
            <div className="p-4">
              {isLoadingTranscripts ? (
                <div className="space-y-4">
                  <Skeleton className="h-16 w-3/4" />
                  <Skeleton className="h-16 w-2/3 ml-auto" />
                  <Skeleton className="h-16 w-3/4" />
                </div>
              ) : transcriptGroups.length > 0 ? (
                <div className="space-y-4">
                  {transcriptGroups.map((group, groupIndex) => {
                    const speakerEmail = group.email?.toLowerCase();
                    const speakerName = group.speaker?.toLowerCase();
                    const isHost =
                      (hostEmail && speakerEmail && speakerEmail === hostEmail) ||
                      (hostName && speakerName && speakerName === hostName);

                    return (
                      <div
                        key={groupIndex}
                        className={`flex ${isHost ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[85%] ${
                            isHost ? "items-end" : "items-start"
                          } flex flex-col gap-1`}
                        >
                          <div className="flex items-center gap-2 px-2">
                            <span className="text-xs font-medium text-ink-muted">
                              {group.speaker || "Unknown"}
                            </span>
                            {group.messages[0].timestamp && (
                              <span className="text-[10px] text-ink-muted">
                                {group.messages[0].timestamp}
                              </span>
                            )}
                          </div>
                          {group.messages.map((message, msgIndex) => (
                            <div
                              key={message.id || msgIndex}
                              className={`rounded-2xl px-3 py-2 ${
                                isHost
                                  ? "bg-[#007AFF] dark:bg-[#0A84FF] text-white rounded-br-sm"
                                  : "bg-hover dark:bg-cb-panel-dark text-ink rounded-bl-sm"
                              }`}
                            >
                              <p className="text-sm leading-relaxed">
                                {message.display_text}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <p className="text-sm text-ink-muted">No transcript available</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default CallDetailPanel;
