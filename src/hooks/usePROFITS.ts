/**
 * usePROFITS - Hook for PROFITS framework extraction and display
 *
 * Queries existing PROFITS data from fathom_calls and triggers
 * extraction via the extract-profits Edge Function.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// =============================================================================
// TYPES
// =============================================================================

export type PROFITSLetter = 'P' | 'R' | 'O' | 'F' | 'I' | 'T' | 'S';

export interface PROFITSCitation {
  transcript_id: string;
  timestamp: string | null;
}

export interface PROFITSFinding {
  text: string;
  quote: string;
  citation: PROFITSCitation;
  confidence: number;
}

export interface PROFITSSection {
  letter: PROFITSLetter;
  title: string;
  findings: PROFITSFinding[];
}

export interface PROFITSReport {
  recording_id: number;
  sections: PROFITSSection[];
  generated_at: string;
  model_used: string;
}

// Query key for PROFITS data
export const profitsQueryKey = (recordingId: number) =>
  ['profits', recordingId] as const;

// =============================================================================
// HOOK
// =============================================================================

export function usePROFITS(recordingId: number | undefined) {
  const queryClient = useQueryClient();

  // Query existing PROFITS data from fathom_calls
  const query = useQuery({
    queryKey: profitsQueryKey(recordingId!),
    queryFn: async () => {
      if (!recordingId) return null;

      // Note: profits_framework column exists in database but may not be in generated types
      // Using RPC-style raw query to bypass type checking for this JSONB column
      const { data, error } = await supabase
        .from('fathom_calls')
        .select('*')
        .eq('recording_id', recordingId)
        .single();

      if (error) {
        console.error('Error fetching PROFITS data:', error);
        throw error;
      }

      // Cast through unknown since profits_framework exists in DB but types may be stale
      const callData = data as unknown as { profits_framework: PROFITSReport | null } | null;
      return callData?.profits_framework ?? null;
    },
    enabled: !!recordingId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Mutation to trigger extraction
  const extractMutation = useMutation({
    mutationFn: async ({ forceRefresh = false }: { forceRefresh?: boolean }) => {
      if (!recordingId) {
        throw new Error('No recording ID provided');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await supabase.functions.invoke('extract-profits', {
        body: {
          recording_id: recordingId,
          force_refresh: forceRefresh,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Extraction failed');
      }

      return response.data as {
        success: boolean;
        profits_framework: PROFITSReport;
        cached: boolean;
        extracted_at?: string;
      };
    },
    onSuccess: (data) => {
      // Update the cache with the new data
      queryClient.setQueryData(
        profitsQueryKey(recordingId!),
        data.profits_framework
      );

      if (data.cached) {
        toast.success('PROFITS data loaded from cache');
      } else {
        const totalFindings = data.profits_framework.sections.reduce(
          (sum, s) => sum + s.findings.length,
          0
        );
        toast.success(`PROFITS Analysis complete`, {
          description: `Found ${totalFindings} insights across 7 categories`,
        });
      }
    },
    onError: (error) => {
      console.error('PROFITS extraction error:', error);
      toast.error('PROFITS extraction failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });

  return {
    // Query state
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,

    // Extraction state
    isExtracting: extractMutation.isPending,

    // Actions
    runExtraction: (forceRefresh = false) =>
      extractMutation.mutate({ forceRefresh }),

    // Refetch
    refetch: query.refetch,
  };
}
