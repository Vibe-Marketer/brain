import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getSafeUser } from '@/lib/auth-utils';
import { logger } from '@/lib/logger';

/**
 * Subscription tier derived from product_id
 * Free: No active subscription (null product_id or expired trial)
 * Pro: PRO_MONTHLY, PRO_ANNUAL, pro-trial (trialing)
 * Team: TEAM_MONTHLY, TEAM_ANNUAL
 */
export type SubscriptionTier = 'free' | 'pro' | 'team';

/**
 * Polar product IDs — single source of truth.
 * These UUIDs come from the Polar dashboard and identify each plan/billing cycle.
 */
export const POLAR_PRODUCT_IDS = {
  PRO_MONTHLY: '30020903-fa8f-4534-9cf1-6e9fba26584c',
  PRO_ANNUAL: '9ff62255-446c-41fe-a84d-c04aed23725c',
  TEAM_MONTHLY: '88f3f07e-afa3-4cb1-ac9d-d2429a1ce1b7',
  TEAM_ANNUAL: '6a1bcf14-86b4-4ec9-bcbe-660bb714b19f',
} as const;

/** Team self-serve plan seat cap. Enterprise/custom plans should bypass this. */
export const TEAM_MEMBER_LIMIT = 10;

/**
 * TEMPORARY: every account resolves as a paid 'pro' plan regardless of real
 * Polar subscription state, so new signups onboard with zero gates. Ticket
 * 81e9ee1b (filed 2026-07-27, confirmed 2026-07-30): "every person that joins
 * is automatically given PRO access ... with ZERO gates ... removed or
 * disabled." Flip to false to restore real billing-derived tiers — this only
 * overrides what the UI/API derive from subscription state; the real Polar
 * columns in user_profiles are untouched.
 */
export const FREE_PRO_FOR_ALL_ENABLED = true;

/** Reverse lookup: product_id → tier. */
const PRODUCT_TIER_MAP: Record<string, SubscriptionTier> = {
  [POLAR_PRODUCT_IDS.PRO_MONTHLY]: 'pro',
  [POLAR_PRODUCT_IDS.PRO_ANNUAL]: 'pro',
  [POLAR_PRODUCT_IDS.TEAM_MONTHLY]: 'team',
  [POLAR_PRODUCT_IDS.TEAM_ANNUAL]: 'team',
};

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
  /** Polar product UUID for the current paid plan, or 'pro-trial' for the signup trial */
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

  // Pro trial: only active if still within trial window
  if (productId === 'pro-trial') {
    if (status !== 'trialing') return 'free';
    if (periodEnd && periodEnd < new Date()) return 'free';
    return 'pro';
  }

  // Map real Polar product UUID → tier
  return PRODUCT_TIER_MAP[productId] ?? 'free';
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
  const tier: SubscriptionTier = FREE_PRO_FOR_ALL_ENABLED
    ? 'pro'
    : deriveTier(productId, status, periodEnd);

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
  const isPaid = FREE_PRO_FOR_ALL_ENABLED
    ? true
    : tier !== 'free' && (status === 'active' || status === 'trialing');

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
