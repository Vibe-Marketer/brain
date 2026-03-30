import { useQuery } from '@tanstack/react-query'
import { getMonthlyAiUsage } from '@/services/ai-usage.service'
import { useSubscription } from '@/hooks/useSubscription'

/**
 * AI usage state returned by useAiUsage
 */
export interface AiUsageState {
  /** Number of AI actions used this month */
  used: number
  /** Monthly AI action limit for the current subscription tier */
  limit: number
  /** Percentage of limit used (0–100, capped at 100) */
  percentUsed: number
  /** Whether data is still loading */
  isLoading: boolean
  /** Error if fetch failed */
  error: Error | null
}

/**
 * useAiUsage — fetch and derive monthly AI action usage data.
 *
 * Combines the raw usage count from ai_usage table (via RPC get_monthly_ai_usage)
 * with the subscription limit from useSubscription.
 *
 * Refreshes every 30 seconds since AI actions can be consumed frequently.
 *
 * @example
 * ```tsx
 * const { used, limit, percentUsed, isLoading } = useAiUsage();
 *
 * if (percentUsed >= 100) {
 *   return <LimitReachedBanner />;
 * }
 * ```
 */
export function useAiUsage(): AiUsageState {
  const { aiActionsLimit, isLoading: subscriptionLoading } = useSubscription()

  // Format current month as YYYY-MM — used as query cache key so data resets each month
  const monthYear = new Date().toISOString().slice(0, 7)

  const {
    data,
    isLoading: usageLoading,
    error,
  } = useQuery({
    queryKey: ['ai-usage', monthYear],
    queryFn: getMonthlyAiUsage,
    staleTime: 30000,   // 30 seconds — usage updates frequently
    gcTime: 60000,      // 1 minute cache
  })

  const used = data ?? 0
  const limit = aiActionsLimit
  const percentUsed = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0
  const isLoading = subscriptionLoading || usageLoading

  return {
    used,
    limit,
    percentUsed,
    isLoading,
    error: error as Error | null,
  }
}
