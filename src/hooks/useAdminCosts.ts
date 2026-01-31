import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Period filter for admin cost queries
 */
export type AdminCostPeriod = 'month' | 'last_month' | 'all';

/**
 * Raw response row from get_admin_cost_summary RPC
 * (function isn't in generated types yet - manual definition)
 */
interface AdminCostSummaryRow {
  model_breakdown: Array<{
    model: string;
    cost_cents: number;
    requests: number;
    tokens: number;
  }>;
  feature_breakdown: Array<{
    operation_type: string;
    cost_cents: number;
    requests: number;
  }>;
  user_breakdown: Array<{
    user_id: string;
    email: string;
    cost_cents: number;
    requests: number;
  }>;
  total_cost_cents: number;
  total_tokens: number;
  total_requests: number;
}

/**
 * Model usage breakdown
 */
export interface ModelBreakdown {
  model: string;
  costCents: number;
  requests: number;
  tokens: number;
}

/**
 * Feature (operation type) usage breakdown
 */
export interface FeatureBreakdown {
  feature: string;
  costCents: number;
  requests: number;
}

/**
 * User usage breakdown
 */
export interface UserBreakdown {
  userId: string;
  email: string;
  costCents: number;
  requests: number;
}

/**
 * Admin cost data structure
 */
export interface AdminCostData {
  byModel: ModelBreakdown[];
  byFeature: FeatureBreakdown[];
  byUser: UserBreakdown[];
  totals: {
    costCents: number;
    tokens: number;
    requests: number;
  };
}

/**
 * Return type from useAdminCosts hook
 */
export interface UseAdminCostsResult extends AdminCostData {
  isLoading: boolean;
  error: Error | null;
  period: AdminCostPeriod;
}

/**
 * Convert cents to USD
 */
export function centsToUsd(cents: number): number {
  return cents / 100;
}

/**
 * Format USD with appropriate precision
 * Shows more decimals for small amounts
 */
export function formatUsd(amount: number): string {
  if (amount === 0) return '$0.00';
  if (amount < 0.01) return `$${amount.toFixed(6)}`;
  if (amount < 1) return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(2)}`;
}

/**
 * Format large numbers with K/M suffix
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return tokens.toString();
}

/**
 * Custom hook to fetch admin-level AI usage costs with detailed breakdowns
 *
 * @param period - Time period filter (month, last_month, all)
 * @returns Aggregated cost data with breakdowns by model, feature, and user
 *
 * @example
 * ```tsx
 * const { byModel, byUser, totals, isLoading } = useAdminCosts('month');
 *
 * if (isLoading) return <Skeleton />;
 * return <div>Total: ${formatUsd(centsToUsd(totals.costCents))}</div>;
 * ```
 */
export function useAdminCosts(period: AdminCostPeriod = 'month'): UseAdminCostsResult {
  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['admin-costs', period],
    queryFn: async (): Promise<AdminCostData> => {
      // Call the admin cost aggregation RPC
      // Note: Function not yet in generated types, using type assertion
      const { data: result, error: rpcError } = await supabase
        .rpc('get_admin_cost_summary' as never, { p_period: period } as never) as unknown as {
          data: AdminCostSummaryRow[] | null;
          error: Error | null;
        };

      if (rpcError) {
        throw new Error(`Failed to fetch admin costs: ${rpcError.message}`);
      }

      // Handle empty result (non-admin user or no data)
      if (!result || result.length === 0) {
        return {
          byModel: [],
          byFeature: [],
          byUser: [],
          totals: { costCents: 0, tokens: 0, requests: 0 },
        };
      }

      // RPC returns a single row with JSONB columns
      const row = result[0];

      // Transform JSONB response to typed arrays
      // Model breakdown
      const modelBreakdown = row.model_breakdown || [];
      
      const byModel: ModelBreakdown[] = modelBreakdown.map((m) => ({
        model: m.model,
        costCents: Number(m.cost_cents) || 0,
        requests: Number(m.requests) || 0,
        tokens: Number(m.tokens) || 0,
      }));

      // Feature breakdown
      const featureBreakdown = row.feature_breakdown || [];
      
      const byFeature: FeatureBreakdown[] = featureBreakdown.map((f) => ({
        feature: f.operation_type,
        costCents: Number(f.cost_cents) || 0,
        requests: Number(f.requests) || 0,
      }));

      // User breakdown
      const userBreakdown = row.user_breakdown || [];
      
      const byUser: UserBreakdown[] = userBreakdown.map((u) => ({
        userId: u.user_id,
        email: u.email || 'Unknown',
        costCents: Number(u.cost_cents) || 0,
        requests: Number(u.requests) || 0,
      }));

      return {
        byModel,
        byFeature,
        byUser,
        totals: {
          costCents: Number(row.total_cost_cents) || 0,
          tokens: Number(row.total_tokens) || 0,
          requests: Number(row.total_requests) || 0,
        },
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - admin data doesn't need real-time updates
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Return empty data while loading or on error
  const emptyData: AdminCostData = {
    byModel: [],
    byFeature: [],
    byUser: [],
    totals: { costCents: 0, tokens: 0, requests: 0 },
  };

  return {
    ...(data || emptyData),
    isLoading,
    error: error as Error | null,
    period,
  };
}
