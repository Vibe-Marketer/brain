import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getSafeUser } from '@/lib/auth-utils';
import { logger } from '@/lib/logger';

/**
 * Subscription tier derived from product_id
 * Free: No active subscription (null product_id or expired trial)
 * Pro: pro-monthly, pro-annual, pro-trial (trialing)
 * Team: team-monthly, team-annual
 */
export type SubscriptionTier = 'free' | 'pro' | 'team';

/**
 * Subscription status from Polar
 * Maps to subscription_status column in user_profiles
 */
export type SubscriptionStatus =
  | 'active'
  | 'canceled'
  | 'revoked'
  | 'incomplete'
  | 'incomplete_expired'
  | 'trialing'
  | 'past_due'
  | 'unpaid'
  | 'free'
  | null;

/** Monthly AI action limits per tier */
export const AI_ACTION_LIMITS: Record<SubscriptionTier, number> = {
  free: 25,
  pro: 1000,
  team: 5000,
};

/** Monthly import limits per tier (null = unlimited) */
export const IMPORT_LIMITS: Record<SubscriptionTier, number | null> = {
  free: 10,
  pro: null,
  team: null,
};

/**
 * Subscription state returned by useSubscription hook
 */
export interface SubscriptionState {
  /** Loading state */
  isLoading: boolean;
  /** Error if fetch failed */
  error: Error | null;
  /** Polar subscription ID (null if no active subscription) */
  subscriptionId: string | null;
  /** Current subscription status */
  status: SubscriptionStatus;
  /** Polar product ID (e.g., 'pro-monthly', 'team-annual') */
  productId: string | null;
  /** Subscription period end date */
  periodEnd: Date | null;
  /** Derived tier from product_id */
  tier: SubscriptionTier;
  /** Whether the user is currently on a trial */
  isTrialing: boolean;
  /** Monthly AI action limit for the current tier */
  aiActionsLimit: number;
  /** Monthly import limit for the current tier (null = unlimited) */
  importLimit: number | null;
  /** Can upgrade to a higher tier */
  canUpgrade: boolean;
  /** Can downgrade to a lower tier */
  canDowngrade: boolean;
  /** Has active paid subscription (not free, not expired) */
  isPaid: boolean;
  /** Refetch subscription state */
  refetch: () => void;
}

/**
 * Tier hierarchy for upgrade/downgrade logic
 * Higher index = higher tier
 */
const TIER_HIERARCHY: SubscriptionTier[] = ['free', 'pro', 'team'];

/**
 * Derive tier from product_id and subscription status.
 * Handles trial expiry inline — expired pro-trial → free.
 */
function deriveTier(
  productId: string | null,
  status: SubscriptionStatus,
  periodEnd: Date | null,
): SubscriptionTier {
  if (!productId) return 'free';

  const lower = productId.toLowerCase();

  // Pro trial: only active if still within trial window
  if (lower === 'pro-trial') {
    if (status !== 'trialing') return 'free';
    if (periodEnd && periodEnd < new Date()) return 'free';
    return 'pro';
  }

  if (lower.startsWith('pro')) return 'pro';
  if (lower.startsWith('team')) return 'team';

  // Unknown product_id — treat as free
  return 'free';
}

/**
 * useSubscription - Fetch and manage subscription state
 *
 * Queries user_profiles for billing fields and derives tier information.
 * Uses TanStack Query for caching and automatic refetching.
 *
 * @example
 * ```tsx
 * const { tier, aiActionsLimit, canUpgrade, isTrialing } = useSubscription();
 *
 * if (tier === 'free' && canUpgrade) {
 *   return <UpgradePrompt />;
 * }
 * ```
 */
export function useSubscription(): SubscriptionState {
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['subscription'],
    queryFn: async () => {
      const { user, error: authError } = await getSafeUser();

      if (authError || !user) {
        logger.debug('No authenticated user for subscription check');
        return null;
      }

      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('subscription_id, subscription_status, product_id, current_period_end')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError) {
        logger.error('Error fetching subscription data', profileError);
        throw new Error(`Failed to fetch subscription: ${profileError.message}`);
      }

      return profile;
    },
    staleTime: 60000,  // 1 minute
    gcTime: 300000,    // 5 minutes
  });

  // Extract values from query result
  const subscriptionId = data?.subscription_id ?? null;
  const status = (data?.subscription_status as SubscriptionStatus) ?? null;
  const productId = data?.product_id ?? null;
  const periodEnd = data?.current_period_end ? new Date(data.current_period_end) : null;

  // Derive tier (handles expired trials → free)
  const tier = deriveTier(productId, status, periodEnd);

  // Trial: product_id is pro-trial and tier resolved to pro (not expired)
  const isTrialing = productId === 'pro-trial' && tier === 'pro' && status === 'trialing';

  // AI action limit for current tier
  const aiActionsLimit = AI_ACTION_LIMITS[tier];
  const importLimit = IMPORT_LIMITS[tier];

  // Calculate upgrade/downgrade capability
  const tierIndex = TIER_HIERARCHY.indexOf(tier);
  const canUpgrade = tierIndex < TIER_HIERARCHY.length - 1;
  const canDowngrade = tierIndex > 0;

  // Has active paid subscription (not free, not expired)
  const isPaid = tier !== 'free' && (status === 'active' || status === 'trialing');

  return {
    isLoading,
    error: error as Error | null,
    subscriptionId,
    status,
    productId,
    periodEnd,
    tier,
    isTrialing,
    aiActionsLimit,
    importLimit,
    canUpgrade,
    canDowngrade,
    isPaid,
    refetch,
  };
}
