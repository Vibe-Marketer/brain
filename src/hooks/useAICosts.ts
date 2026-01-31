import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { requireUser } from '@/lib/auth-utils';

/**
 * Model usage statistics
 */
export interface ModelUsage {
  model: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costCents: number;
}

/**
 * Recent activity log entry
 */
export interface RecentActivity {
  id: string;
  model: string;
  operationType: string;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  latencyMs: number | null;
  createdAt: string;
}

/**
 * Operation type usage statistics
 */
export interface OperationTypeUsage {
  operationType: string;
  requests: number;
  totalTokens: number;
  costCents: number;
}

/**
 * Period filter for cost queries
 */
export type CostPeriod = 'today' | 'week' | 'month' | 'all';

/**
 * Return type from useAICosts hook
 */
export interface UseAICostsResult {
  /** Total cost in USD for the period */
  totalCostUsd: number;
  /** Total requests for the period */
  totalRequests: number;
  /** Average cost per request in USD */
  avgCostPerRequest: number;
  /** Total tokens used */
  totalTokens: number;
  /** Breakdown by model */
  byModel: ModelUsage[];
  /** Breakdown by operation type */
  byOperationType: OperationTypeUsage[];
  /** Recent activity (last 10 requests) */
  recentActivity: RecentActivity[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Currently selected period */
  period: CostPeriod;
}

/**
 * Convert cents to USD
 */
function centsToUsd(cents: number): number {
  return cents / 100;
}

/**
 * Get date range for period
 */
function getDateRange(period: CostPeriod): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString();

  switch (period) {
    case 'today': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { start: start.toISOString(), end };
    }
    case 'week': {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { start: start.toISOString(), end };
    }
    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: start.toISOString(), end };
    }
    case 'all':
    default:
      return { start: '1970-01-01T00:00:00Z', end };
  }
}

/**
 * Custom hook to fetch AI usage costs with detailed breakdowns
 *
 * @param period - Time period filter (today, week, month, all)
 * @returns Aggregated cost data with breakdowns
 *
 * @example
 * ```tsx
 * const { totalCostUsd, byModel, isLoading } = useAICosts('month');
 *
 * if (isLoading) return <Skeleton />;
 * return <div>Total: ${totalCostUsd.toFixed(4)}</div>;
 * ```
 */
export function useAICosts(period: CostPeriod = 'month'): UseAICostsResult {
  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['ai-costs', period],
    queryFn: async () => {
      const user = await requireUser();
      const { start, end } = getDateRange(period);

      // Fetch usage logs for the period
      const { data: logs, error: logsError } = await supabase
        .from('embedding_usage_logs')
        .select('id, model, operation_type, input_tokens, output_tokens, total_tokens, cost_cents, latency_ms, created_at')
        .eq('user_id', user.id)
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: false });

      if (logsError) {
        throw new Error(`Failed to fetch usage logs: ${logsError.message}`);
      }

      return logs || [];
    },
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes
  });

  const logs = data || [];

  // Calculate totals
  const totalCostCents = logs.reduce((sum, log) => sum + (log.cost_cents || 0), 0);
  const totalTokens = logs.reduce((sum, log) => sum + (log.total_tokens || 0), 0);
  const totalRequests = logs.length;
  const totalCostUsd = centsToUsd(totalCostCents);
  const avgCostPerRequest = totalRequests > 0 ? totalCostUsd / totalRequests : 0;

  // Aggregate by model
  const modelMap = new Map<string, ModelUsage>();
  for (const log of logs) {
    const existing = modelMap.get(log.model) || {
      model: log.model,
      requests: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      costCents: 0,
    };
    modelMap.set(log.model, {
      ...existing,
      requests: existing.requests + 1,
      inputTokens: existing.inputTokens + (log.input_tokens || 0),
      outputTokens: existing.outputTokens + (log.output_tokens || 0),
      totalTokens: existing.totalTokens + (log.total_tokens || 0),
      costCents: existing.costCents + (log.cost_cents || 0),
    });
  }
  const byModel = Array.from(modelMap.values()).sort((a, b) => b.costCents - a.costCents);

  // Aggregate by operation type
  const opTypeMap = new Map<string, OperationTypeUsage>();
  for (const log of logs) {
    const existing = opTypeMap.get(log.operation_type) || {
      operationType: log.operation_type,
      requests: 0,
      totalTokens: 0,
      costCents: 0,
    };
    opTypeMap.set(log.operation_type, {
      ...existing,
      requests: existing.requests + 1,
      totalTokens: existing.totalTokens + (log.total_tokens || 0),
      costCents: existing.costCents + (log.cost_cents || 0),
    });
  }
  const byOperationType = Array.from(opTypeMap.values()).sort((a, b) => b.costCents - a.costCents);

  // Recent activity (first 10 logs, already sorted by created_at desc)
  const recentActivity: RecentActivity[] = logs.slice(0, 10).map(log => ({
    id: log.id,
    model: log.model,
    operationType: log.operation_type,
    inputTokens: log.input_tokens || 0,
    outputTokens: log.output_tokens || 0,
    costCents: log.cost_cents || 0,
    latencyMs: log.latency_ms,
    createdAt: log.created_at || '',
  }));

  return {
    totalCostUsd,
    totalRequests,
    avgCostPerRequest,
    totalTokens,
    byModel,
    byOperationType,
    recentActivity,
    isLoading,
    error: error as Error | null,
    period,
  };
}
