import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useSubscription, type SubscriptionTier } from '@/hooks/useSubscription';
import { useOrgContext } from '@/hooks/useOrgContext';

/**
 * AI action types that are tracked against monthly limits.
 * Must match action_type CHECK constraint in ai_usage table.
 */
export type AiActionType = 'smart_import' | 'auto_name' | 'auto_tag' | 'chat_message' | 'summarize_call' | 'generate_content';

/**
 * Result returned by trackAction after calling track-ai-usage.
 */
export interface TrackActionResult {
  allowed: boolean;
  usage: number;
  limit: number;
  remaining: number;
}

/**
 * Result returned by useAiGate hook.
 *
 * @example
 * ```tsx
 * const { trackAction, tier } = useAiGate();
 *
 * async function handleAutoTag() {
 *   const { allowed } = await trackAction('auto_tag', { recordingId: call.id });
 *   if (!allowed) return;
 *   // proceed with AI operation
 * }
 * ```
 */
export interface AiGateResult {
  /**
   * Optimistic check: true if the user likely has AI actions remaining.
   * The real enforcement happens in trackAction — canUse defaults to true
   * since we don't cache the current usage count in this hook.
   * Use trackAction's returned `allowed` for the authoritative gate.
   */
  canUse: boolean;
  /**
   * Call before executing an AI operation. Records the action server-side
   * and returns whether the action was allowed.
   * Shows a toast notification if the monthly limit has been reached.
   * Invalidates the ['ai-usage'] query cache on success or limit-reached.
   */
  trackAction: (
    type: AiActionType,
    opts?: { recordingId?: string; orgId?: string },
  ) => Promise<TrackActionResult>;
  /** Current subscription tier */
  tier: SubscriptionTier;
  /** Monthly AI action limit for the current tier */
  limit: number;
  /** True while subscription data is loading */
  isLoading: boolean;
}

/**
 * useAiGate — AI usage gate hook
 *
 * Provides the `trackAction` function that all AI-consuming features should call
 * before executing AI operations. Enforces monthly limits via the track-ai-usage
 * edge function and notifies the user when their limit is reached.
 *
 * PAY-05: AI features degrade gracefully when tier limit is reached.
 */
export function useAiGate(): AiGateResult {
  const { tier, aiActionsLimit: limit, isLoading } = useSubscription();
  const { activeOrgId } = useOrgContext();
  const queryClient = useQueryClient();

  async function trackAction(
    type: AiActionType,
    opts?: { recordingId?: string; orgId?: string },
  ): Promise<TrackActionResult> {
    try {
      // Get current session token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        // No session — fail open to avoid blocking unauthenticated renders
        return { allowed: true, usage: 0, limit, remaining: limit };
      }

      const { data, error } = await supabase.functions.invoke('track-ai-usage', {
        headers: { Authorization: `Bearer ${token}` },
        body: {
          actionType: type,
          recordingId: opts?.recordingId,
          orgId: opts?.orgId ?? activeOrgId,
        },
      });

      // Handle limit-reached (edge function returns 429 as a FunctionsFetchError
      // with the response body parsed into `data` by the Supabase JS client)
      if (error) {
        // Supabase functions.invoke wraps non-2xx as FunctionsHttpError
        // The response body is accessible via error.context.json()
        const context = (error as { context?: Response })?.context;
        if (context) {
          try {
            const body = await context.json();
            if (context.status === 429) {
              toast.error('Monthly AI limit reached. Upgrade for more.');
              // Invalidate usage cache so useAiUsage refetches
              queryClient.invalidateQueries({ queryKey: ['ai-usage'] });
              return {
                allowed: false,
                usage: body?.usage ?? 0,
                limit: body?.limit ?? limit,
                remaining: 0,
              };
            }
          } catch {
            // Could not parse body — fall through to fail-open
          }
        }
        // Other errors — fail open (don't block user on tracking failures)
        console.error('[useAiGate] trackAction error:', error);
        return { allowed: true, usage: 0, limit, remaining: limit };
      }

      // Success — invalidate usage cache so useAiUsage refetches
      queryClient.invalidateQueries({ queryKey: ['ai-usage'] });

      return {
        allowed: true,
        usage: data?.usage ?? 0,
        limit: data?.limit ?? limit,
        remaining: data?.remaining ?? limit,
      };
    } catch (err) {
      // Unhandled error — fail open to avoid blocking the user
      console.error('[useAiGate] unexpected error in trackAction:', err);
      return { allowed: true, usage: 0, limit, remaining: limit };
    }
  }

  return {
    canUse: true, // optimistic — real gate is trackAction's returned `allowed`
    trackAction,
    tier,
    limit,
    isLoading,
  };
}
