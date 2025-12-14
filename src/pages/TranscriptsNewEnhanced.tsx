/**
 * TranscriptsNewEnhanced Page
 * 
 * Enhanced transcripts page with:
 * - AI processing integration
 * - Auto-processing toggle
 * - Insights preview
 * - Batch processing
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  RiUploadLine, 
  RiSparklingLine,
  RiFileTextLine,
  RiTimeLine,
  RiCheckLine
} from '@remixicon/react';
import { Button } from '@/components/ui/button';
import { AutoProcessingToggle } from '@/components/loop/AutoProcessingToggle';
import { AIStatusWidget } from '@/components/loop/AIStatusWidget';
import { useAIProcessing, useBatchAIProcessing } from '@/hooks/useAIProcessing';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export const TranscriptsNewEnhanced: React.FC = () => {
  const [selectedCalls, setSelectedCalls] = useState<string[]>([]);
  const { analyzeTranscript, state: aiState } = useAIProcessing();
  const { processBatch, batchState } = useBatchAIProcessing();

  // Fetch calls
  const { data: calls, isLoading, refetch } = useQuery({
    queryKey: ['calls'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('calls')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const handleProcessCall = async (callId: string, transcript: string, metadata: any) => {
    try {
      const analysis = await analyzeTranscript(transcript, metadata);
      
      // Update call in database with analysis results
      const { error } = await supabase
        .from('calls')
        .update({
          summary: analysis.summary,
          sentiment: analysis.sentiment,
          sentiment_score: analysis.sentimentScore,
          key_topics: analysis.keyTopics,
          action_items: analysis.actionItems,
          profits_framework: analysis.profitsFramework,
          ai_processed: true,
          ai_processed_at: new Date().toISOString(),
        })
        .eq('id', callId);

      if (error) throw error;

      // Store insights
      for (const insight of analysis.insights) {
        await supabase.from('insights').insert({
          call_id: callId,
          type: insight.type,
          content: insight.content,
          confidence: insight.confidence,
          context: insight.context,
          tags: insight.tags,
        });
      }

      toast.success('Call processed successfully!');
      refetch();
    } catch (error) {
      console.error('Processing error:', error);
      toast.error('Failed to process call');
    }
  };

  const handleBatchProcess = async () => {
    if (selectedCalls.length === 0) {
      toast.error('No calls selected');
      return;
    }

    const callsToProcess = calls?.filter(call => 
      selectedCalls.includes(call.id) && !call.ai_processed
    ) || [];

    if (callsToProcess.length === 0) {
      toast.error('All selected calls are already processed');
      return;
    }

    const transcripts = callsToProcess.map(call => ({
      id: call.id,
      content: call.transcript || '',
      metadata: {
        title: call.title,
        date: call.created_at,
      },
    }));

    await processBatch(transcripts);
    refetch();
  };

  const unprocessedCalls = calls?.filter(call => !call.ai_processed) || [];
  const processedCalls = calls?.filter(call => call.ai_processed) || [];

  return (
    <div className="min-h-full bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Calls & Transcripts
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                {calls?.length || 0} total calls • {processedCalls.length} processed • {unprocessedCalls.length} pending
              </p>
            </div>
            <div className="flex gap-3">
              {selectedCalls.length > 0 && (
                <Button
                  onClick={handleBatchProcess}
                  variant="outline"
                  disabled={batchState.isProcessing}
                >
                  <RiSparklingLine className="w-5 h-5 mr-2" />
                  Process {selectedCalls.length} Selected
                </Button>
              )}
              <Button className="bg-purple-600 hover:bg-purple-700 text-white">
                <RiUploadLine className="w-5 h-5 mr-2" />
                Upload Call
              </Button>
            </div>
          </div>

          {/* Auto Processing Toggle */}
          <AutoProcessingToggle />
        </div>

        {/* AI Status Widget */}
        {(aiState.isProcessing || batchState.isProcessing) && (
          <div className="mb-6">
            <AIStatusWidget
              isProcessing={aiState.isProcessing || batchState.isProcessing}
              currentTask={aiState.currentTask || `Processing ${batchState.processed}/${batchState.total} calls`}
              progress={batchState.isProcessing 
                ? (batchState.processed / batchState.total) * 100 
                : aiState.progress
              }
            />
          </div>
        )}

        {/* Calls List */}
        <div className="space-y-4">
          {/* Unprocessed Calls */}
          {unprocessedCalls.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <RiTimeLine className="w-5 h-5 text-orange-600" />
                Pending Processing ({unprocessedCalls.length})
              </h2>
              <div className="space-y-3">
                {unprocessedCalls.map((call) => (
                  <div
                    key={call.id}
                    className="bg-white dark:bg-gray-900 rounded-lg border-2 border-orange-200 dark:border-orange-800 p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <input
                          type="checkbox"
                          checked={selectedCalls.includes(call.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCalls([...selectedCalls, call.id]);
                            } else {
                              setSelectedCalls(selectedCalls.filter(id => id !== call.id));
                            }
                          }}
                          className="w-4 h-4 rounded border-gray-300"
                        />
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 dark:text-white">
                            {call.title || 'Untitled Call'}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {new Date(call.created_at).toLocaleDateString()} • {call.transcript?.length || 0} characters
                          </p>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleProcessCall(call.id, call.transcript, {
                          title: call.title,
                          date: call.created_at,
                        })}
                        size="sm"
                        className="bg-orange-600 hover:bg-orange-700 text-white"
                      >
                        <RiSparklingLine className="w-4 h-4 mr-2" />
                        Process Now
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Processed Calls */}
          {processedCalls.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <RiCheckLine className="w-5 h-5 text-green-600" />
                Processed ({processedCalls.length})
              </h2>
              <div className="space-y-3">
                {processedCalls.map((call) => (
                  <div
                    key={call.id}
                    className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                          {call.title || 'Untitled Call'}
                        </h3>
                        {call.summary && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            {call.summary}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                          <span>{new Date(call.created_at).toLocaleDateString()}</span>
                          {call.sentiment && (
                            <span className={cn(
                              "px-2 py-0.5 rounded-full",
                              call.sentiment === 'positive' && "bg-green-100 text-green-700",
                              call.sentiment === 'neutral' && "bg-gray-100 text-gray-700",
                              call.sentiment === 'negative' && "bg-red-100 text-red-700"
                            )}>
                              {call.sentiment}
                            </span>
                          )}
                          {call.key_topics && call.key_topics.length > 0 && (
                            <span>{call.key_topics.length} topics</span>
                          )}
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        <RiFileTextLine className="w-4 h-4 mr-2" />
                        View Details
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && (!calls || calls.length === 0) && (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <RiUploadLine className="w-8 h-8 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No calls yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Upload your first call to start extracting insights
              </p>
              <Button className="bg-purple-600 hover:bg-purple-700 text-white">
                <RiUploadLine className="w-5 h-5 mr-2" />
                Upload Call
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
