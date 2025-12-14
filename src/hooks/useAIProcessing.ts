/**
 * useAIProcessing Hook
 * 
 * React hook for managing AI processing state and operations
 * Provides easy interface for components to trigger AI analysis
 */

import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  extractKnowledgeFromTranscript, 
  generateContent,
  applyInsightsToCall,
  type CallAnalysis,
  type ExtractedInsight 
} from '@/lib/ai-agent';
import { toast } from 'sonner';

export interface AIProcessingState {
  isProcessing: boolean;
  progress: number;
  currentTask: string | null;
  error: Error | null;
}

export function useAIProcessing() {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AIProcessingState>({
    isProcessing: false,
    progress: 0,
    currentTask: null,
    error: null,
  });

  // Mutation for extracting knowledge from transcript
  const extractKnowledgeMutation = useMutation({
    mutationFn: async ({
      transcript,
      metadata,
    }: {
      transcript: string;
      metadata?: any;
    }) => {
      setState({
        isProcessing: true,
        progress: 0,
        currentTask: 'Analyzing transcript...',
        error: null,
      });

      try {
        const analysis = await extractKnowledgeFromTranscript(transcript, metadata);
        
        setState(prev => ({
          ...prev,
          progress: 100,
          currentTask: 'Analysis complete',
        }));

        return analysis;
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: error as Error,
          currentTask: 'Analysis failed',
        }));
        throw error;
      } finally {
        setTimeout(() => {
          setState({
            isProcessing: false,
            progress: 0,
            currentTask: null,
            error: null,
          });
        }, 2000);
      }
    },
    onSuccess: (data) => {
      toast.success('Transcript analyzed successfully!');
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['insights'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
    onError: (error) => {
      toast.error('Failed to analyze transcript');
      console.error('Analysis error:', error);
    },
  });

  // Mutation for generating content
  const generateContentMutation = useMutation({
    mutationFn: async ({
      type,
      insights,
      context,
    }: {
      type: 'email' | 'social-post' | 'blog-outline' | 'case-study';
      insights: ExtractedInsight[];
      context?: any;
    }) => {
      setState({
        isProcessing: true,
        progress: 0,
        currentTask: `Generating ${type}...`,
        error: null,
      });

      try {
        const stream = await generateContent(type, insights, context);
        return stream;
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: error as Error,
          currentTask: 'Generation failed',
        }));
        throw error;
      }
    },
    onSuccess: () => {
      toast.success('Content generated successfully!');
      setState({
        isProcessing: false,
        progress: 100,
        currentTask: 'Generation complete',
        error: null,
      });
    },
    onError: (error) => {
      toast.error('Failed to generate content');
      console.error('Generation error:', error);
    },
  });

  // Mutation for applying insights
  const applyInsightsMutation = useMutation({
    mutationFn: async ({
      currentTranscript,
      relevantInsights,
    }: {
      currentTranscript: string;
      relevantInsights: ExtractedInsight[];
    }) => {
      setState({
        isProcessing: true,
        progress: 0,
        currentTask: 'Analyzing current call...',
        error: null,
      });

      try {
        const suggestions = await applyInsightsToCall(currentTranscript, relevantInsights);
        
        setState(prev => ({
          ...prev,
          progress: 100,
          currentTask: 'Suggestions ready',
        }));

        return suggestions;
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: error as Error,
          currentTask: 'Analysis failed',
        }));
        throw error;
      } finally {
        setTimeout(() => {
          setState({
            isProcessing: false,
            progress: 0,
            currentTask: null,
            error: null,
          });
        }, 2000);
      }
    },
    onSuccess: () => {
      toast.success('Coaching suggestions generated!');
    },
    onError: (error) => {
      toast.error('Failed to generate suggestions');
      console.error('Suggestions error:', error);
    },
  });

  // Convenience methods
  const analyzeTranscript = useCallback(
    (transcript: string, metadata?: any) => {
      return extractKnowledgeMutation.mutateAsync({ transcript, metadata });
    },
    [extractKnowledgeMutation]
  );

  const createContent = useCallback(
    (
      type: 'email' | 'social-post' | 'blog-outline' | 'case-study',
      insights: ExtractedInsight[],
      context?: any
    ) => {
      return generateContentMutation.mutateAsync({ type, insights, context });
    },
    [generateContentMutation]
  );

  const getCoachingSuggestions = useCallback(
    (currentTranscript: string, relevantInsights: ExtractedInsight[]) => {
      return applyInsightsMutation.mutateAsync({ currentTranscript, relevantInsights });
    },
    [applyInsightsMutation]
  );

  return {
    // State
    state,
    isProcessing: state.isProcessing,
    progress: state.progress,
    currentTask: state.currentTask,
    error: state.error,

    // Methods
    analyzeTranscript,
    createContent,
    getCoachingSuggestions,

    // Raw mutations (for advanced usage)
    extractKnowledgeMutation,
    generateContentMutation,
    applyInsightsMutation,
  };
}

/**
 * Hook for batch processing multiple transcripts
 */
export function useBatchAIProcessing() {
  const [batchState, setBatchState] = useState({
    isProcessing: false,
    processed: 0,
    total: 0,
    errors: [] as string[],
  });

  const processBatch = useCallback(
    async (
      transcripts: Array<{
        id: string;
        content: string;
        metadata?: any;
      }>
    ) => {
      setBatchState({
        isProcessing: true,
        processed: 0,
        total: transcripts.length,
        errors: [],
      });

      const results: Array<{ id: string; analysis?: CallAnalysis; error?: string }> = [];

      for (let i = 0; i < transcripts.length; i++) {
        const transcript = transcripts[i];

        try {
          const analysis = await extractKnowledgeFromTranscript(
            transcript.content,
            transcript.metadata
          );
          results.push({ id: transcript.id, analysis });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          results.push({ id: transcript.id, error: errorMessage });
          setBatchState(prev => ({
            ...prev,
            errors: [...prev.errors, `${transcript.id}: ${errorMessage}`],
          }));
        }

        setBatchState(prev => ({
          ...prev,
          processed: i + 1,
        }));
      }

      setBatchState(prev => ({
        ...prev,
        isProcessing: false,
      }));

      if (batchState.errors.length > 0) {
        toast.error(`Batch processing completed with ${batchState.errors.length} errors`);
      } else {
        toast.success('All transcripts processed successfully!');
      }

      return results;
    },
    []
  );

  return {
    batchState,
    processBatch,
  };
}
