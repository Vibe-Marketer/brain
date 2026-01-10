import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { requireUser } from '@/lib/auth-utils';

/**
 * Monthly cost summary from get_embedding_cost_summary function
 */
interface MonthlyCostSummary {
  month: string;
  operation_type: string;
  total_tokens: number;
  total_cost_cents: number;
  request_count: number;
  avg_tokens_per_request: number;
}

/**
 * Aggregated monthly cost data for chart display
 */
export interface MonthlyTrend {
  /** Month label (e.g., "Jan '24") */
  name: string;
  /** Total cost in USD for the month */
  cost: number;
  /** Total tokens used in the month */
  tokens: number;
}

/**
 * Return type from useEmbeddingCosts hook
 */
export interface UseEmbeddingCostsResult {
  /** Total cost across all time in USD */
  totalCostUsd: number;
  /** Total tokens used across all time */
  totalTokens: number;
  /** Average cost per transcript/recording in USD */
  avgCostPerTranscript: number;
  /** Total number of transcripts processed */
  totalTranscripts: number;
  /** Monthly cost trends for chart */
  monthlyTrends: MonthlyTrend[];
  /** Cost breakdown by operation type */
  costByOperationType: Array<{ name: string; value: number }>;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
}

/**
 * Format cents to USD string
 */
function centsToUsd(cents: number): number {
  return cents / 100;
}

/**
 * Custom hook to fetch embedding usage costs for billing display
 *
 * Fetches data from embedding_usage_logs table using the
 * get_embedding_cost_summary database function.
 *
 * @param months - Number of months to fetch (default: 6)
 * @returns Aggregated cost data for billing display
 *
 * @example
 * ```tsx
 * const { totalCostUsd, monthlyTrends, isLoading } = useEmbeddingCosts();
 *
 * if (isLoading) return <Skeleton />;
 * return <div>Total: ${totalCostUsd.toFixed(4)}</div>;
 * ```
 */
export function useEmbeddingCosts(months: number = 6): UseEmbeddingCostsResult {
  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['embedding-costs', months],
    queryFn: async () => {
      const user = await requireUser();

      // Fetch monthly cost summary using the database function
      const { data: monthlySummary, error: summaryError } = await supabase
        .rpc('get_embedding_cost_summary', {
          p_user_id: user.id,
          p_months: months,
        });

      if (summaryError) {
        throw new Error(`Failed to fetch cost summary: ${summaryError.message}`);
      }

      // Fetch total transcripts processed (unique recording_ids with usage)
      const { count: transcriptCount, error: countError } = await supabase
        .from('embedding_usage_logs')
        .select('recording_id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .not('recording_id', 'is', null);

      if (countError) {
        throw new Error(`Failed to fetch transcript count: ${countError.message}`);
      }

      // Fetch distinct recording count for accurate average
      const { data: distinctRecordings, error: distinctError } = await supabase
        .from('embedding_usage_logs')
        .select('recording_id')
        .eq('user_id', user.id)
        .not('recording_id', 'is', null);

      if (distinctError) {
        throw new Error(`Failed to fetch distinct recordings: ${distinctError.message}`);
      }

      const uniqueRecordingIds = new Set(distinctRecordings?.map(r => r.recording_id) || []);
      const totalTranscripts = uniqueRecordingIds.size;

      return {
        monthlySummary: (monthlySummary || []) as MonthlyCostSummary[],
        totalTranscripts,
      };
    },
    staleTime: 60000, // Cache for 1 minute
    gcTime: 300000, // Keep in cache for 5 minutes
  });

  // Process the raw data into display formats
  const monthlySummary = data?.monthlySummary || [];
  const totalTranscripts = data?.totalTranscripts || 0;

  // Aggregate totals across all operation types
  const totalCostCents = monthlySummary.reduce(
    (sum, row) => sum + (row.total_cost_cents || 0),
    0
  );
  const totalTokens = monthlySummary.reduce(
    (sum, row) => sum + (row.total_tokens || 0),
    0
  );
  const totalCostUsd = centsToUsd(totalCostCents);

  // Calculate average cost per transcript
  const avgCostPerTranscript = totalTranscripts > 0
    ? totalCostUsd / totalTranscripts
    : 0;

  // Aggregate monthly trends (combine all operation types per month)
  const monthlyMap = new Map<string, { cost: number; tokens: number }>();
  for (const row of monthlySummary) {
    const monthKey = row.month;
    const existing = monthlyMap.get(monthKey) || { cost: 0, tokens: 0 };
    monthlyMap.set(monthKey, {
      cost: existing.cost + centsToUsd(row.total_cost_cents || 0),
      tokens: existing.tokens + (row.total_tokens || 0),
    });
  }

  // Convert to array and sort by date
  const monthlyTrends: MonthlyTrend[] = Array.from(monthlyMap.entries())
    .map(([month, data]) => {
      // Format month string (from "2024-01-01" to "Jan '24")
      const date = new Date(month);
      const name = date.toLocaleDateString('en-US', {
        month: 'short',
        year: '2-digit',
      });
      return {
        name,
        cost: data.cost,
        tokens: data.tokens,
      };
    })
    .sort((a, b) => {
      // Sort chronologically
      const dateA = new Date(a.name);
      const dateB = new Date(b.name);
      return dateA.getTime() - dateB.getTime();
    });

  // Aggregate cost by operation type
  const operationTypeMap = new Map<string, number>();
  for (const row of monthlySummary) {
    const opType = row.operation_type;
    const existing = operationTypeMap.get(opType) || 0;
    operationTypeMap.set(opType, existing + centsToUsd(row.total_cost_cents || 0));
  }

  const costByOperationType = Array.from(operationTypeMap.entries())
    .map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1), // Capitalize
      value,
    }))
    .sort((a, b) => b.value - a.value);

  return {
    totalCostUsd,
    totalTokens,
    avgCostPerTranscript,
    totalTranscripts,
    monthlyTrends,
    costByOperationType,
    isLoading,
    error: error as Error | null,
  };
}
