/**
 * CallDetailPage
 * 
 * Detailed view of a single call with context-appropriate tabs:
 * - Regular calls: Insights, Transcript, PROFITS Framework, Action Items
 * - YouTube imports: Overview (thumbnail/metadata), Transcript (formatted), AI Chat CTA
 *
 * Detects source_platform to render the appropriate layout.
 */

import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  RiArrowLeftLine,
  RiSparklingLine,
  RiFileTextLine,
  RiLightbulbLine,
  RiCheckboxCircleLine,
  RiPriceTag3Line,
  RiShareLine,
  RiDownloadLine,
  RiYoutubeLine,
  RiPlayLine,
  RiTimeLine,
  RiCalendarLine,
  RiExternalLinkLine,
  RiChat3Line,
  RiEyeLine,
  RiThumbUpLine,
  RiInformationLine,
} from '@remixicon/react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AppShell } from '@/components/layout/AppShell';
import { Spinner } from '@/components/ui/spinner';
import { InsightCard } from '@/components/loop/InsightCard';
import { ContentGenerator } from '@/components/loop/ContentGenerator';
import { PROFITSReport } from '@/components/profits/PROFITSReport';
import { supabase } from '@/integrations/supabase/client';
import { VaultBadgeList } from '@/components/vault/VaultBadgeList';
import { parseYouTubeDuration, formatCompactNumber } from '@/lib/youtube-utils';
import type { PROFITSCitation } from '@/hooks/usePROFITS';
import type { ChatLocationState, ContextAttachment } from '@/types/chat';

/**
 * Format transcript text into paragraphs for readable display.
 * Splits on double newlines or long single-newline runs and adds spacing.
 */
function formatTranscriptDisplay(transcript: string): React.ReactNode[] {
  if (!transcript) return [];
  
  // Split into paragraphs on double newlines or groups of text
  const paragraphs = transcript.split(/\n{2,}/).filter(p => p.trim());
  
  if (paragraphs.length <= 1) {
    // Single block — split into ~3-sentence paragraphs for readability
    const sentences = transcript.split(/(?<=[.!?])\s+/);
    const chunks: string[] = [];
    let current = '';
    
    for (const sentence of sentences) {
      current += (current ? ' ' : '') + sentence;
      // Create a new paragraph roughly every 3 sentences or 500 chars
      if (current.split(/[.!?]/).length > 3 || current.length > 500) {
        chunks.push(current);
        current = '';
      }
    }
    if (current) chunks.push(current);
    
    return chunks.map((chunk, i) => (
      <p key={i} className="text-foreground/90 leading-relaxed mb-4 last:mb-0">
        {chunk}
      </p>
    ));
  }
  
  return paragraphs.map((para, i) => (
    <p key={i} className="text-foreground/90 leading-relaxed mb-4 last:mb-0">
      {para.trim()}
    </p>
  ));
}

export const CallDetailPage: React.FC = () => {
  const { callId } = useParams<{ callId: string }>();
  const navigate = useNavigate();
  const [showContentGenerator, setShowContentGenerator] = useState(false);
  const [selectedInsights, setSelectedInsights] = useState<any[]>([]);

  // Parse callId to number for recording_id query
  const recordingId = callId ? parseInt(callId, 10) : undefined;
  
  // Fetch call details
  const { data: call, isLoading: callLoading } = useQuery({
    queryKey: ['call', callId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fathom_calls')
        .select('*')
        .eq('recording_id', recordingId!)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!recordingId && !isNaN(recordingId),
  });

  // Determine if this is a YouTube import
  const isYouTube = call?.source_platform === 'youtube';
  const metadata = call?.metadata as Record<string, unknown> | null;

  // YouTube-specific metadata
  const ytMeta = useMemo(() => {
    if (!isYouTube || !metadata) return null;
    return {
      videoId: metadata.youtube_video_id as string | undefined,
      channelTitle: metadata.youtube_channel_title as string | undefined,
      thumbnail: metadata.youtube_thumbnail as string | undefined,
      duration: metadata.youtube_duration as string | undefined,
      viewCount: metadata.youtube_view_count as number | undefined,
      likeCount: metadata.youtube_like_count as number | undefined,
      description: metadata.youtube_description as string | undefined,
    };
  }, [isYouTube, metadata]);

  const ytDuration = useMemo(() => {
    return ytMeta?.duration ? parseYouTubeDuration(ytMeta.duration) : null;
  }, [ytMeta?.duration]);

  // Fetch insights for this call (only for non-YouTube)
  const { data: insights, isLoading: insightsLoading } = useQuery({
    queryKey: ['call-insights', callId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('insights')
        .select('*')
        .eq('recording_id', recordingId!)
        .order('score', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!recordingId && !isNaN(recordingId) && !isYouTube,
  });

  if (callLoading) {
    return (
      <AppShell>
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <Spinner size="lg" className="mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Loading call details...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!call) {
    return (
      <AppShell>
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-foreground mb-2">Call not found</h2>
            <Button onClick={() => navigate(-1)}>Go Back</Button>
          </div>
        </div>
      </AppShell>
    );
  }

  // Extract sentiment from sentiment_cache if available (regular calls only)
  const sentimentCache = call.sentiment_cache as { sentiment?: string; score?: number } | null;
  const sentiment = !isYouTube ? sentimentCache?.sentiment : undefined;
  const sentimentScore = !isYouTube ? sentimentCache?.score : undefined;
  
  const sentimentColor = {
    positive: 'bg-success-bg text-success-text border border-success-border',
    neutral: 'bg-neutral-bg text-neutral-text border border-neutral-border',
    negative: 'bg-danger-bg text-danger-text border border-danger-border',
  }[sentiment || 'neutral'];

  // Build Chat link state for YouTube "Open in AI Chat"
  const chatState: ChatLocationState = {
    initialContext: [{
      type: 'call' as const,
      id: call.recording_id,
      title: call.title || 'Untitled',
      date: call.created_at,
    }],
    callTitle: call.title || undefined,
    newSession: true,
  };

  // ─────── YouTube Layout ───────
  if (isYouTube) {
    return (
      <AppShell>
        <div className="h-full flex flex-col overflow-hidden">
          <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50 flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0"
                aria-hidden="true"
              >
                <RiYoutubeLine className="h-4 w-4 text-red-600" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-ink uppercase tracking-wide">
                  YOUTUBE VIDEO
                </h2>
                <p className="text-xs text-ink-muted truncate max-w-[520px]">
                  {call.title || 'Untitled Video'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
                <RiArrowLeftLine className="w-4 h-4" />
                Back
              </Button>
              {ytMeta?.videoId && (
                <Button variant="outline" asChild>
                  <a
                    href={`https://www.youtube.com/watch?v=${ytMeta.videoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <RiPlayLine className="w-4 h-4 mr-2" />
                    Watch on YouTube
                  </a>
                </Button>
              )}
              <Button variant="outline" asChild>
                <Link to="/chat" state={chatState}>
                  <RiChat3Line className="w-4 h-4 mr-2" />
                  Ask AI
                </Link>
              </Button>
            </div>
          </header>

          <div className="flex-1 overflow-auto p-6 space-y-6">
            {/* YouTube video summary card - compact horizontal layout */}
            <div className="bg-card rounded-lg border border-border p-4">
              <div className="flex gap-4">
                {/* Compact thumbnail */}
                {ytMeta?.thumbnail ? (
                  <a
                    href={ytMeta.videoId ? `https://www.youtube.com/watch?v=${ytMeta.videoId}` : undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 rounded-md overflow-hidden bg-muted hover:opacity-90 transition-opacity"
                    style={{ width: 168, height: 94 }}
                  >
                    <img
                      src={ytMeta.thumbnail}
                      alt={call.title || 'Video thumbnail'}
                      className="w-full h-full object-cover"
                    />
                  </a>
                ) : (
                  <div
                    className="flex-shrink-0 rounded-md bg-muted flex items-center justify-center"
                    style={{ width: 168, height: 94 }}
                  >
                    <RiPlayLine className="h-8 w-8 text-muted-foreground/20" />
                  </div>
                )}

                {/* Metadata alongside thumbnail */}
                <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5">
                  <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
                    {call.title || 'Untitled Video'}
                  </h3>

                  {ytMeta?.channelTitle && (
                    <p className="text-xs text-muted-foreground truncate">{ytMeta.channelTitle}</p>
                  )}

                  {/* Stats pills */}
                  <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                    {ytMeta?.viewCount != null && (
                      <div className="flex items-center gap-1">
                        <RiEyeLine className="h-3 w-3" />
                        <span className="tabular-nums">{formatCompactNumber(ytMeta.viewCount)} views</span>
                      </div>
                    )}
                    {ytMeta?.likeCount != null && (
                      <div className="flex items-center gap-1">
                        <RiThumbUpLine className="h-3 w-3" />
                        <span className="tabular-nums">{formatCompactNumber(ytMeta.likeCount)}</span>
                      </div>
                    )}
                    {ytDuration && (
                      <div className="flex items-center gap-1">
                        <RiTimeLine className="h-3 w-3" />
                        <span className="tabular-nums">{ytDuration.display}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <RiCalendarLine className="h-3 w-3" />
                      <span>{new Date(call.recording_start_time || call.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <VaultBadgeList
              legacyRecordingId={recordingId}
              maxVisible={3}
              size="md"
            />

            {/* YouTube tabs: Overview + Transcript */}
            <Tabs defaultValue="transcript" className="space-y-6">
              <TabsList>
                <TabsTrigger value="transcript">
                  <RiFileTextLine className="w-4 h-4 mr-2" />
                  TRANSCRIPT
                </TabsTrigger>
                {ytMeta?.description && (
                  <TabsTrigger value="about">
                    <RiInformationLine className="w-4 h-4 mr-2" />
                    ABOUT
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="transcript">
                <div className="bg-card rounded-lg border border-border p-6">
                  {call.full_transcript ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      {formatTranscriptDisplay(call.full_transcript)}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">No transcript available</p>
                  )}
                </div>
              </TabsContent>

              {ytMeta?.description && (
                <TabsContent value="about">
                  <div className="bg-card rounded-lg border border-border p-6">
                    <p className="text-foreground/90 whitespace-pre-line leading-relaxed">
                      {ytMeta.description}
                    </p>
                  </div>
                </TabsContent>
              )}
            </Tabs>

            {/* AI Chat CTA */}
            <div className="bg-card rounded-lg border border-border p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-vibe-orange/10 flex items-center justify-center flex-shrink-0">
                  <RiChat3Line className="w-5 h-5 text-vibe-orange" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-foreground mb-1">Chat about this video</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Ask AI questions about this video's content — summarize, find key points, or explore topics.
                  </p>
                  <Button asChild size="sm">
                    <Link to="/chat" state={chatState}>
                      Open in AI Chat
                      <RiExternalLinkLine className="w-3.5 h-3.5 ml-1.5" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  // ─────── Regular Call Layout ───────
  return (
    <AppShell>
      <div className="h-full flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-8 h-8 rounded-lg bg-vibe-orange/10 flex items-center justify-center flex-shrink-0"
              aria-hidden="true"
            >
              <RiFileTextLine className="h-4 w-4 text-vibe-orange" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-ink uppercase tracking-wide">
                CALL DETAIL
              </h2>
              <p className="text-xs text-ink-muted truncate max-w-[520px]">
                {call.title || 'Untitled Call'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
              <RiArrowLeftLine className="w-4 h-4" />
              Back
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedInsights(insights || []);
                setShowContentGenerator(true);
              }}
              disabled={!insights || insights.length === 0}
            >
              <RiSparklingLine className="w-4 h-4 mr-2" />
              Generate Content
            </Button>
            <Button variant="outline">
              <RiShareLine className="w-4 h-4 mr-2" />
              Share
            </Button>
            <Button variant="outline">
              <RiDownloadLine className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6 space-y-6">
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>{new Date(call.created_at).toLocaleDateString()}</span>
            {sentiment && (
              <Badge className={sentimentColor}>
                {sentiment}
                {sentimentScore && ` (${Math.round(sentimentScore)}%)`}
              </Badge>
            )}
            {call.ai_generated_title && (
              <Badge variant="outline">
                <RiSparklingLine className="w-3 h-3 mr-1" />
                AI PROCESSED
              </Badge>
            )}
          </div>

          <VaultBadgeList
            legacyRecordingId={recordingId}
            maxVisible={3}
            size="md"
          />

          {call.summary && (
            <div className="p-4 bg-card rounded-lg border border-border">
              <h3 className="text-sm font-semibold text-foreground mb-2 uppercase tracking-wide">Summary</h3>
              <p className="text-foreground">{call.summary}</p>
            </div>
          )}

          <Tabs defaultValue="insights" className="space-y-6">
            <TabsList>
              <TabsTrigger value="insights">
                <RiLightbulbLine className="w-4 h-4 mr-2" />
                INSIGHTS ({insights?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="transcript">
                <RiFileTextLine className="w-4 h-4 mr-2" />
                TRANSCRIPT
              </TabsTrigger>
              <TabsTrigger value="profits">
                <RiPriceTag3Line className="w-4 h-4 mr-2" />
                PROFITS FRAMEWORK
              </TabsTrigger>
              <TabsTrigger value="actions">
                <RiCheckboxCircleLine className="w-4 h-4 mr-2" />
                ACTION ITEMS (0)
              </TabsTrigger>
            </TabsList>

            <TabsContent value="insights" className="space-y-6">
              {insightsLoading ? (
                <div className="text-center py-8">
                  <Spinner size="lg" className="mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">Loading insights...</p>
                </div>
              ) : insights && insights.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {insights.map((insight: any) => (
                    <InsightCard
                      key={insight.id}
                      id={insight.id}
                      type={insight.category}
                      content={insight.exact_quote}
                      source={{
                        callId: String(call.recording_id),
                        callTitle: call.title || 'Untitled Call',
                        date: new Date(call.created_at),
                      }}
                      confidence={insight.score}
                      tags={[]}
                      onUse={() => {
                        setSelectedInsights([insight]);
                        setShowContentGenerator(true);
                      }}
                      onViewContext={() => {}}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <RiLightbulbLine className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No insights extracted yet</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="transcript">
              <div className="bg-card rounded-lg border border-border p-6">
                <pre className="whitespace-pre-wrap font-sans text-foreground">
                  {call.full_transcript || 'No transcript available'}
                </pre>
              </div>
            </TabsContent>

            <TabsContent value="profits">
              <div className="bg-card rounded-lg border border-border">
                <PROFITSReport
                  recordingId={recordingId}
                  onCitationClick={(citation: PROFITSCitation) => {
                    const transcriptTab = document.querySelector('[value="transcript"]');
                    if (transcriptTab instanceof HTMLElement) {
                      transcriptTab.click();
                    }
                  }}
                />
              </div>
            </TabsContent>

            <TabsContent value="actions">
              <div className="text-center py-16">
                <RiCheckboxCircleLine className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No action items identified</p>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <ContentGenerator
          open={showContentGenerator}
          onOpenChange={setShowContentGenerator}
          insights={selectedInsights}
        />
      </div>
    </AppShell>
  );
};
