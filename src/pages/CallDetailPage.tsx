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

  // Fetch call details
  const { data: call, isLoading: callLoading } = useQuery({
    queryKey: ['call', callId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('calls')
        .select('*')
        .eq('id', callId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!callId,
  });

  // Fetch insights for this call
  const { data: insights, isLoading: insightsLoading } = useQuery({
    queryKey: ['call-insights', callId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('insights')
        .select('*')
        .eq('call_id', callId)
        .order('confidence', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!callId,
  });

  // Fetch quotes for this call
  const { data: quotes } = useQuery({
    queryKey: ['call-quotes', callId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .eq('call_id', callId)
        .order('significance', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!callId,
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

  const profitsData = call.profits_framework as any;
  const sentimentColor = {
    positive: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20',
    neutral: 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800',
    negative: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20',
  }[call.sentiment || 'neutral'];

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
                {call.sentiment && (
                  <Badge className={sentimentColor}>
                    {call.sentiment}
                    {call.sentiment_score && ` (${Math.round(call.sentiment_score)}%)`}
                  </Badge>
                )}
                {call.ai_processed && (
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
              Action Items ({call.action_items?.length || 0})
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
                    type={insight.type}
                    content={insight.content}
                    source={{
                      callId: call.id,
                      callTitle: call.title || 'Untitled Call',
                      date: new Date(call.created_at),
                    }}
                    confidence={insight.confidence}
                    tags={insight.tags || []}
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
                {call.transcript || 'No transcript available'}
              </pre>
            </div>
          </TabsContent>

          {/* PROFITS Framework Tab */}
          <TabsContent value="profits">
            {profitsData ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.entries(profitsData).map(([key, values]: [string, any]) => (
                  <div
                    key={key}
                    className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6"
                  >
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 capitalize">
                      {key}
                    </h3>
                    {Array.isArray(values) && values.length > 0 ? (
                      <ul className="space-y-2">
                        {values.map((item: string, index: number) => (
                          <li
                            key={index}
                            className="text-gray-700 dark:text-gray-300 pl-4 border-l-2 border-purple-600"
                          >
                            {item}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400 italic">
                        No {key} identified
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <RiPriceTag3Line className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">
                  PROFITS framework not applied yet
                </p>
              </div>
            )}
          </TabsContent>

          {/* Action Items Tab */}
          <TabsContent value="actions">
            {call.action_items && call.action_items.length > 0 ? (
              <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
                <ul className="space-y-3">
                  {call.action_items.map((item: string, index: number) => (
                    <li
                      key={index}
                      className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                    >
                      <RiCheckboxCircleLine className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-900 dark:text-white">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="text-center py-16">
                <RiCheckboxCircleLine className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">
                  No action items identified
                </p>
              </div>
            )}
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
