import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getSafeUser } from '@/lib/auth-utils';
import { logger } from '@/lib/logger';

/**
 * Subscription tier derived from product_id
 * Free: No product_id (null)
 * Solo: solo-monthly, solo-annual
 * Team: team-monthly, team-annual
 * Business: business-monthly, business-annual
 */
export type SubscriptionTier = 'free' | 'solo' | 'team' | 'business';

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
  /** Polar product ID (e.g., 'solo-monthly') */
  productId: string | null;
  /** Subscription period end date */
  periodEnd: Date | null;
  /** Derived tier from product_id */
  tier: SubscriptionTier;
  /** Can upgrade to a higher tier */
  canUpgrade: boolean;
  /** Can downgrade to a lower tier */
  canDowngrade: boolean;
  /** Has active paid subscription */
  isPaid: boolean;
  /** Refetch subscription state */
  refetch: () => void;
}

/**
 * Tier hierarchy for upgrade/downgrade logic
 * Higher index = higher tier
 */
const TIER_HIERARCHY: SubscriptionTier[] = ['free', 'solo', 'team', 'business'];

/**
 * Derive tier from product_id
 * Product IDs follow format: {tier}-{interval} (e.g., solo-monthly, team-annual)
 */
function deriveTier(productId: string | null): SubscriptionTier {
  if (!productId) return 'free';
  
  const lowerProductId = productId.toLowerCase();
  
  if (lowerProductId.startsWith('solo')) return 'solo';
  if (lowerProductId.startsWith('team')) return 'team';
  if (lowerProductId.startsWith('business')) return 'business';
  
  // Unknown product_id - treat as free
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
 * const { tier, canUpgrade, isPaid, isLoading } = useSubscription();
 * 
 * if (isLoading) return <Skeleton />;
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
    staleTime: 60000, // 1 minute
    gcTime: 300000, // 5 minutes
  });
  
  // Extract values from query result
  const subscriptionId = data?.subscription_id ?? null;
  const status = (data?.subscription_status as SubscriptionStatus) ?? 'free';
  const productId = data?.product_id ?? null;
  const periodEnd = data?.current_period_end ? new Date(data.current_period_end) : null;
  
  // Derive tier from product_id
  const tier = deriveTier(productId);
  
  // Calculate upgrade/downgrade capability
  const tierIndex = TIER_HIERARCHY.indexOf(tier);
  const canUpgrade = tierIndex < TIER_HIERARCHY.length - 1;
  const canDowngrade = tierIndex > 0;
  
  // Has active paid subscription
  const isPaid = tier !== 'free' && (status === 'active' || status === 'trialing');
  
  return {
    isLoading,
    error: error as Error | null,
    subscriptionId,
    status,
    productId,
    periodEnd,
    tier,
    canUpgrade,
    canDowngrade,
    isPaid,
    refetch,
  };
}
