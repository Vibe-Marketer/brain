/**
 * CallDetailPanel - Side panel for viewing call details
 *
 * Displays call information in Pane 4 (detail panel) when clicking
 * citation sources in chat. Read-only view optimized for quick reference.
 *
 * @pattern detail-panel
 * @brand-version v4.2
 */

import { useMemo } from "react";
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
  RiVidiconLine,
  RiFileCopyLine,
  RiCalendarLine,
  RiTimeLine,
  RiUserLine,
  RiEyeLine,
  RiThumbUpLine,
  RiChat1Line,
  RiYoutubeLine,
} from "@remixicon/react";
import { toast } from "sonner";
import { usePanelStore } from "@/stores/panelStore";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/query-config";
import { groupTranscriptsBySpeaker } from "@/lib/transcriptUtils";
import { useCallDetailQueries } from "@/hooks/useCallDetailQueries";
import { getRecordingById, getRecordingByLegacyId } from "@/services/recordings.service";
import { getRawCallData } from "@/services/raw-calls.service";
import type { RecordingDetail } from "@/services/recordings.service";
import type { FathomRawCall, YouTubeRawCall } from "@/types/raw-calls";
import type { Meeting } from "@/types";

interface CallDetailPanelProps {
  recordingId: number | string;
}

export function CallDetailPanel({ recordingId }: CallDetailPanelProps) {
  const { user } = useAuth();
  const { closePanel, togglePin, isPinned } = usePanelStore();

  // Fetch canonical recording from recordings table
  const { data: call, isLoading: isLoadingCall } = useQuery({
    queryKey: queryKeys.calls.detail(recordingId),
    queryFn: async () => {
      if (!user?.id) return null;
      // UUID strings contain hyphens and are 36 chars; integers (or integer strings) use the legacy path
      const isUuid =
        typeof recordingId === 'string' &&
        recordingId.length === 36 &&
        recordingId.includes('-');
      if (isUuid) {
        return getRecordingById(recordingId);
      }
      return getRecordingByLegacyId(Number(recordingId));
    },
    enabled: !!user?.id && !!recordingId,
  });

  // Fetch source-specific raw data
  const { data: rawData } = useQuery({
    queryKey: call?.source_app
      ? queryKeys.rawCalls[call.source_app as keyof typeof queryKeys.rawCalls]?.(call.id) ?? ['raw-calls', call.source_app, call.id]
      : ['raw-calls', 'none'],
    queryFn: async () => {
      if (!call) return null;
      return getRawCallData(call.id, call.source_app);
    },
    enabled: !!call?.id && !!call?.source_app,
  });

  // Cast raw data for source-specific fields
  const fathomRaw = call?.source_app === 'fathom' ? (rawData as FathomRawCall | null) : null;
  const youtubeRaw = call?.source_app === 'youtube' ? (rawData as YouTubeRawCall | null) : null;

  // Build a Meeting-compatible object from RecordingDetail for useCallDetailQueries
  const callAsMeeting: Meeting | null = useMemo(() => {
    if (!call) return null;
    return {
      recording_id: call.legacy_recording_id ?? call.id,
      canonical_uuid: call.id,
      title: call.title ?? '',
      created_at: call.created_at,
      recording_start_time: call.recording_start_time,
      recording_end_time: call.recording_end_time,
      full_transcript: call.full_transcript,
      summary: call.summary,
      recorded_by_name: fathomRaw?.recorded_by_name ?? null,
      recorded_by_email: fathomRaw?.recorded_by_email ?? null,
      calendar_invitees: fathomRaw?.calendar_invitees ?? null,
    };
  }, [call, fathomRaw]);

  // Delegate transcript, speaker, category, and settings queries to the shared hook
  const {
    userSettings,
    transcripts,
    callSpeakers,
    callCategories,
  } = useCallDetailQueries({
    call: callAsMeeting,
    userId: user?.id,
    open: true,
  });

  const isLoadingTranscripts = !transcripts.length && !!call;

  // Calculate duration in minutes
  const duration = useMemo(() => {
    if (call?.recording_start_time && call?.recording_end_time) {
      return Math.round(
        (new Date(call.recording_end_time).getTime() -
          new Date(call.recording_start_time).getTime()) /
          1000 /
          60
      );
    }
    // Fallback: use stored duration (seconds → minutes) for sources like YouTube
    if (call?.duration) return Math.round(call.duration / 60);
    return null;
  }, [call?.recording_start_time, call?.recording_end_time, call?.duration]);

  // Prepare transcript groups for display
  const transcriptGroups = useMemo(() => {
    if (!transcripts?.length) return [];
    return groupTranscriptsBySpeaker(transcripts);
  }, [transcripts]);

  // Derive source-specific fields
  const shareUrl = fathomRaw?.share_url ?? null;
  const recordedByName = fathomRaw?.recorded_by_name ?? null;
  const recordedByEmail = fathomRaw?.recorded_by_email ?? null;
  const calendarInvitees = fathomRaw?.calendar_invitees ?? null;

  // Handle copy share link
  const handleCopyLink = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied to clipboard");
    }
  };

  // Handle view in Fathom
  const handleViewInFathom = () => {
    if (shareUrl) {
      window.open(shareUrl, "_blank");
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
    recordedByEmail ||
    ""
  ).toLowerCase();
  const hostName = (recordedByName || "").toLowerCase();

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
        {shareUrl && (
          <>
            <Button
              variant="hollow"
              size="sm"
              onClick={handleViewInFathom}
              className="gap-1"
            >
              <RiVidiconLine className="h-4 w-4" />
              View in Fathom
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
        {youtubeRaw?.youtube_video_id && (
          <Button
            variant="hollow"
            size="sm"
            onClick={() => window.open(`https://www.youtube.com/watch?v=${youtubeRaw.youtube_video_id}`, '_blank')}
            className="gap-1"
          >
            <RiYoutubeLine className="h-4 w-4" />
            Watch
          </Button>
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
                    {calendarInvitees?.length || 0}
                  </p>
                </div>
              </div>

              {/* YouTube Metrics */}
              {youtubeRaw && (
                <div className="space-y-3">
                  <Label className="text-xs font-medium uppercase text-ink-muted">YouTube Stats</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {youtubeRaw.youtube_view_count != null && (
                      <div className="bg-cb-card rounded-lg p-2 border border-border text-center">
                        <div className="flex items-center justify-center gap-1 text-ink-muted mb-1">
                          <RiEyeLine className="h-3.5 w-3.5" />
                        </div>
                        <p className="text-sm font-semibold text-ink tabular-nums">
                          {youtubeRaw.youtube_view_count.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-ink-muted">views</p>
                      </div>
                    )}
                    {youtubeRaw.youtube_like_count != null && (
                      <div className="bg-cb-card rounded-lg p-2 border border-border text-center">
                        <div className="flex items-center justify-center gap-1 text-ink-muted mb-1">
                          <RiThumbUpLine className="h-3.5 w-3.5" />
                        </div>
                        <p className="text-sm font-semibold text-ink tabular-nums">
                          {youtubeRaw.youtube_like_count.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-ink-muted">likes</p>
                      </div>
                    )}
                    {youtubeRaw.youtube_comment_count != null && (
                      <div className="bg-cb-card rounded-lg p-2 border border-border text-center">
                        <div className="flex items-center justify-center gap-1 text-ink-muted mb-1">
                          <RiChat1Line className="h-3.5 w-3.5" />
                        </div>
                        <p className="text-sm font-semibold text-ink tabular-nums">
                          {youtubeRaw.youtube_comment_count.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-ink-muted">comments</p>
                      </div>
                    )}
                  </div>

                  {/* Channel info */}
                  {(youtubeRaw.youtube_channel_title || youtubeRaw.youtube_subscriber_count != null) && (
                    <div className="bg-cb-card rounded-lg p-3 border border-border space-y-1">
                      {youtubeRaw.youtube_channel_title && (
                        <p className="text-sm font-medium text-ink">{youtubeRaw.youtube_channel_title}</p>
                      )}
                      {youtubeRaw.youtube_subscriber_count != null && (
                        <p className="text-xs text-ink-muted tabular-nums">
                          {youtubeRaw.youtube_subscriber_count.toLocaleString()} subscribers
                        </p>
                      )}
                    </div>
                  )}

                  {/* Published date */}
                  {youtubeRaw.youtube_published_at && (
                    <div className="space-y-1">
                      <Label className="text-xs font-medium uppercase text-ink-muted">Published</Label>
                      <p className="text-sm text-ink">
                        {new Date(youtubeRaw.youtube_published_at).toLocaleDateString(undefined, {
                          year: 'numeric', month: 'long', day: 'numeric',
                        })}
                      </p>
                    </div>
                  )}

                  {/* Tags */}
                  {youtubeRaw.youtube_tags && youtubeRaw.youtube_tags.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs font-medium uppercase text-ink-muted">YouTube Tags</Label>
                      <div className="flex flex-wrap gap-1">
                        {youtubeRaw.youtube_tags.slice(0, 10).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {youtubeRaw.youtube_tags.length > 10 && (
                          <Badge variant="secondary" className="text-xs text-ink-muted">
                            +{youtubeRaw.youtube_tags.length - 10} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
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

              {/* Global Tags */}
              {call.global_tags && call.global_tags.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase text-ink-muted">Tags</Label>
                  <div className="flex flex-wrap gap-2">
                    {call.global_tags.map((tag: string) => (
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
                              <span className="text-2xs text-ink-muted">
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
