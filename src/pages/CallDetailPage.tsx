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
  RiEmotionLine,
  RiPriceTag3Line,
  RiShareLine,
  RiDownloadLine,
} from '@remixicon/react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { InsightCard } from '@/components/loop/InsightCard';
import { ContentGenerator } from '@/components/loop/ContentGenerator';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

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
      <div className="min-h-full bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading call details...</p>
        </div>
      </div>
    );
  }

  if (!call) {
    return (
      <div className="min-h-full bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Call not found
          </h2>
          <Button onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </div>
    );
  }

  // Extract sentiment from sentiment_cache if available
  const sentimentCache = call.sentiment_cache as { sentiment?: string; score?: number } | null;
  const sentiment = sentimentCache?.sentiment;
  const sentimentScore = sentimentCache?.score;
  
  const sentimentColor = {
    positive: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20',
    neutral: 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800',
    negative: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20',
  }[sentiment || 'neutral'];

  return (
    <div className="min-h-full bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="mb-4"
          >
            <RiArrowLeftLine className="w-4 h-4 mr-2" />
            Back
          </Button>

          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {call.title || 'Untitled Call'}
              </h1>
              <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                <span>{new Date(call.created_at).toLocaleDateString()}</span>
                {sentiment && (
                  <Badge className={sentimentColor}>
                    {sentiment}
                    {sentimentScore && ` (${Math.round(sentimentScore)}%)`}
                  </Badge>
                )}
                {call.ai_generated_title && (
                  <Badge variant="outline" className="text-purple-600 border-purple-600">
                    <RiSparklingLine className="w-3 h-3 mr-1" />
                    AI Processed
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex gap-2">
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
          </div>

          {/* Summary */}
          {call.summary && (
            <div className="mt-6 p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Summary
              </h3>
              <p className="text-gray-900 dark:text-white">{call.summary}</p>
            </div>
          )}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="insights" className="space-y-6">
          <TabsList>
            <TabsTrigger value="insights">
              <RiLightbulbLine className="w-4 h-4 mr-2" />
              Insights ({insights?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="transcript">
              <RiFileTextLine className="w-4 h-4 mr-2" />
              Transcript
            </TabsTrigger>
            <TabsTrigger value="profits">
              <RiPriceTag3Line className="w-4 h-4 mr-2" />
              PROFITS Framework
            </TabsTrigger>
            <TabsTrigger value="actions">
              <RiCheckboxCircleLine className="w-4 h-4 mr-2" />
              Action Items (0)
            </TabsTrigger>
          </TabsList>

          {/* Insights Tab */}
          <TabsContent value="insights" className="space-y-6">
            {insightsLoading ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">Loading insights...</p>
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
                <RiLightbulbLine className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">
                  No insights extracted yet
                </p>
              </div>
            )}
          </TabsContent>

          {/* Transcript Tab */}
          <TabsContent value="transcript">
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
              <pre className="whitespace-pre-wrap font-sans text-gray-900 dark:text-white">
                {call.full_transcript || 'No transcript available'}
              </pre>
            </div>
          </TabsContent>

          {/* PROFITS Framework Tab */}
          <TabsContent value="profits">
            <div className="text-center py-16">
              <RiPriceTag3Line className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                PROFITS framework not applied yet
              </p>
            </div>
          </TabsContent>

          {/* Action Items Tab */}
          <TabsContent value="actions">
            <div className="text-center py-16">
              <RiCheckboxCircleLine className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                No action items identified
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Content Generator Modal */}
      <ContentGenerator
        open={showContentGenerator}
        onOpenChange={setShowContentGenerator}
        insights={selectedInsights}
      />
    </div>
  );
};
