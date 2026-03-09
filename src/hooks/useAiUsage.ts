import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getSafeUser } from '@/lib/auth-utils';
import { logger } from '@/lib/logger';
import { useSubscription } from '@/hooks/useSubscription';

export type AiActionType = 'smart_import' | 'auto_name' | 'auto_tag' | 'chat_message';

/** Returns the current month in YYYY-MM format */
function currentMonthYear(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}

export interface AiUsageState {
  /** Loading state */
  isLoading: boolean;
  /** AI actions used this month */
  used: number;
  /** Monthly limit for the current tier */
  limit: number;
  /** Remaining actions this month */
  remaining: number;
  /** Usage percentage 0–100 */
  percentage: number;
  /** Whether the user can still perform an AI action */
  canPerformAction: boolean;
  /** Track an AI action — returns true if allowed */
  trackAction: (params: {
    actionType: AiActionType;
    recordingId?: string;
    orgId?: string;
  }) => Promise<boolean>;
}

/**
 * useAiUsage - Track and enforce AI action limits
 *
 * Reads current month's usage from the ai_usage table and exposes
 * helpers to track new actions via the track-ai-usage edge function.
 *
 * @example
 * ```tsx
 * const { canPerformAction, trackAction, used, limit } = useAiUsage();
 *
 * async function handleSmartImport() {
 *   const allowed = await trackAction({ actionType: 'smart_import', recordingId });
 *   if (!allowed) {
 *     toast.error('AI action limit reached. Upgrade to continue.');
 *     return;
 *   }
 *   // proceed with import
 * }
 * ```
 */
export function useAiUsage(): AiUsageState {
  const queryClient = useQueryClient();
  const { aiActionsLimit, isLoading: subLoading } = useSubscription();

  const monthYear = currentMonthYear();

  // Fetch current month usage from ai_usage table
  const { data: usageData, isLoading: usageLoading } = useQuery({
    queryKey: ['ai-usage', monthYear],
    queryFn: async () => {
      const { user, error: authError } = await getSafeUser();
      if (authError || !user) return 0;

      const { data, error } = await supabase
        .from('ai_usage')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('month_year', monthYear);

      if (error) {
        logger.error('Error fetching AI usage', error);
        return 0;
      }

      return data?.length ?? 0;
    },
    staleTime: 30000, // 30 seconds — relatively fresh for enforcement
    gcTime: 120000,
  });

  // Call the edge function to track an action (checks limit server-side)
  const trackMutation = useMutation({
    mutationFn: async (params: {
      actionType: AiActionType;
      recordingId?: string;
      orgId?: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/track-ai-usage`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            actionType: params.actionType,
            recordingId: params.recordingId,
            orgId: params.orgId,
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json() as { error?: string };
        throw new Error(err.error ?? 'Failed to track AI action');
      }

      const result = await response.json() as {
        allowed: boolean;
        used: number;
        limit: number;
        remaining: number;
      };

      return result;
    },
    onSuccess: (result) => {
      // Update cached usage count with the server-confirmed value
      queryClient.setQueryData(['ai-usage', monthYear], result.used);
    },
    onError: (err) => {
      logger.error('Failed to track AI action', err);
    },
  });

  const used = usageData ?? 0;
  const limit = aiActionsLimit;
  const remaining = Math.max(0, limit - used);
  const percentage = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const canPerformAction = used < limit;
  const isLoading = subLoading || usageLoading;

  const trackAction = async (params: {
    actionType: AiActionType;
    recordingId?: string;
    orgId?: string;
  }): Promise<boolean> => {
    try {
      const result = await trackMutation.mutateAsync(params);
      return result.allowed;
    } catch {
      // If tracking fails, default to allowing the action
      // (don't block users due to tracking infrastructure issues)
      logger.warn('AI usage tracking failed — allowing action');
      return true;
    }
  };

  return {
    isLoading,
    used,
    limit,
    remaining,
    percentage,
    canPerformAction,
    trackAction,
  };
}
