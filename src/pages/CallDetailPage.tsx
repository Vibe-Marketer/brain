/**
 * CallDetailPage
 * 
 * Detailed view of a single call with:
 * - Full transcript
 * - AI-extracted insights
 * - PROFITS framework breakdown
 * - Action items
 * - Sentiment analysis
 * - Content generation tools
 */

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import type { PROFITSCitation } from '@/hooks/usePROFITS';

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

  // Fetch insights for this call
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
    enabled: !!recordingId && !isNaN(recordingId),
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

  // Extract sentiment from sentiment_cache if available
  const sentimentCache = call.sentiment_cache as { sentiment?: string; score?: number } | null;
  const sentiment = sentimentCache?.sentiment;
  const sentimentScore = sentimentCache?.score;
  
  const sentimentColor = {
    positive: 'bg-success-bg text-success-text border border-success-border',
    neutral: 'bg-neutral-bg text-neutral-text border border-neutral-border',
    negative: 'bg-danger-bg text-danger-text border border-danger-border',
  }[sentiment || 'neutral'];

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
