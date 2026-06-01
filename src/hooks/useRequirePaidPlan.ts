import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getSafeUser } from '@/lib/auth-utils';
import { useSubscription } from './useSubscription';

export interface RequirePaidPlanState {
  /** True if the user must be directed to billing */
  isRequired: boolean;
  /** True while subscription + profile data are still loading */
  isLoading: boolean;
  /** Where to send the user — null when not required */
  redirectUrl: string | null;
  /** Inline gate metadata for surfaces that open paywalls without redirecting. */
  gateContext: {
    canShowInlineGate: boolean;
    reason: 'paid-plan-required' | 'not-required';
  };
}

interface GrandfatheredRow {
  grandfathered: boolean;
  user_id: string | null;
}

/**
 * useRequirePaidPlan — Phase 31 payment gate.
 *
 * Returns isRequired=true when:
 *   1. The user is loaded (not anon)
 *   2. The user is NOT on a paid plan (free tier, expired trial, canceled, etc.)
 *   3. The user is NOT grandfathered (pre-2026-05-12 accounts bypass)
 *
 * Used by paid-feature gates to direct non-paid accounts to in-app billing.
 *
 * Soft-fails on a missing grandfathered column (e.g. if the migration is
 * not yet applied in a given environment) — treats as not-grandfathered.
 */
export function useRequirePaidPlan(): RequirePaidPlanState {
  const sub = useSubscription();

  const { data: grandfathered, isLoading: gfLoading } = useQuery<GrandfatheredRow | null>({
    queryKey: ['user-profile-grandfathered'],
    queryFn: async () => {
      const { user } = await getSafeUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from('user_profiles')
        .select('grandfathered, user_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) {
        // Soft-fail: if the column doesn't exist yet OR the row is missing,
        // treat as not-grandfathered so the gate behaves safely (stricter).
        return { grandfathered: false, user_id: user.id };
      }
      const row = data as { grandfathered?: boolean; user_id?: string } | null;
      return {
        grandfathered: row?.grandfathered === true,
        user_id: row?.user_id ?? user.id,
      };
    },
    staleTime: 60_000,
    gcTime: 300_000,
  });

  const isLoading = sub.isLoading || gfLoading;
  const userId = grandfathered?.user_id ?? null;
  const isGrandfathered = grandfathered?.grandfathered === true;

  // Gate fires when: loaded AND not paid AND not grandfathered
  const isRequired = !isLoading && !sub.isPaid && !isGrandfathered;

  const redirectUrl = isRequired
    ? `/settings?tab=billing${userId ? `&user=${userId}` : ''}`
    : null;

  return {
    isRequired,
    isLoading,
    redirectUrl,
    gateContext: {
      canShowInlineGate: isRequired,
      reason: isRequired ? 'paid-plan-required' : 'not-required',
    },
  };
}
