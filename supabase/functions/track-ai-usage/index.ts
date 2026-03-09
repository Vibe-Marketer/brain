/**
 * Track AI Usage Edge Function
 *
 * Records an AI action for the authenticated user and enforces monthly limits.
 * Returns whether the action was allowed and the updated usage count.
 *
 * POST /track-ai-usage
 * Body: {
 *   actionType: 'smart_import' | 'auto_name' | 'auto_tag' | 'chat_message'
 *   recordingId?: string  // optional UUID reference
 *   orgId?: string        // optional org UUID for team pooling
 * }
 * Returns: {
 *   allowed: boolean
 *   used: number
 *   limit: number
 *   remaining: number
 * }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

/** AI action limits per product tier */
const AI_ACTION_LIMITS: Record<string, number> = {
  'free': 25,
  'pro-monthly': 1000,
  'pro-annual': 1000,
  'pro-trial': 1000,
  'team-monthly': 5000,
  'team-annual': 5000,
};

/** Derive action limit from product_id stored in user_profiles */
function getActionLimit(productId: string | null, status: string | null): number {
  // Expired trial or revoked → free limit
  if (!productId || !status || status === 'revoked' || status === 'incomplete_expired') {
    return AI_ACTION_LIMITS['free'];
  }
  // Active trial for Pro
  if (productId === 'pro-trial' && status === 'trialing') {
    return AI_ACTION_LIMITS['pro-trial'];
  }
  return AI_ACTION_LIMITS[productId] ?? AI_ACTION_LIMITS['free'];
}

/** Returns YYYY-MM string for the current month */
function currentMonthYear(): string {
  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${now.getUTCFullYear()}-${month}`;
}

const VALID_ACTION_TYPES = ['smart_import', 'auto_name', 'auto_tag', 'chat_message'] as const;
type ActionType = typeof VALID_ACTION_TYPES[number];

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('Origin'));

  // CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Initialize Supabase client with service role to bypass RLS for usage counting
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body = await req.json() as { actionType?: unknown; recordingId?: unknown; orgId?: unknown };
    const { actionType, recordingId, orgId } = body;

    // Validate action type
    if (!actionType || !VALID_ACTION_TYPES.includes(actionType as ActionType)) {
      return new Response(
        JSON.stringify({
          error: `actionType must be one of: ${VALID_ACTION_TYPES.join(', ')}`,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const monthYear = currentMonthYear();

    // Fetch user subscription state
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('product_id, subscription_status, current_period_end')
      .eq('user_id', user.id)
      .maybeSingle();

    // Check if trial has expired (handle expired trial as free)
    let effectiveProductId = profile?.product_id ?? null;
    let effectiveStatus = profile?.subscription_status ?? null;

    if (
      effectiveProductId === 'pro-trial' &&
      effectiveStatus === 'trialing' &&
      profile?.current_period_end
    ) {
      const trialEnd = new Date(profile.current_period_end);
      if (trialEnd < new Date()) {
        // Trial expired — treat as free
        effectiveProductId = null;
        effectiveStatus = null;

        // Revert trial fields in background (non-blocking)
        supabase
          .from('user_profiles')
          .update({ subscription_status: null, product_id: null, current_period_end: null })
          .eq('user_id', user.id)
          .then(() => {
            console.log(`Trial expired for user ${user.id} — reverted to free`);
          });
      }
    }

    const limit = getActionLimit(effectiveProductId, effectiveStatus);

    // Count current month usage
    // For team orgs, count at org level if orgId provided
    let used: number;
    if (orgId && typeof orgId === 'string') {
      const { data: orgCount } = await supabase.rpc('get_monthly_org_ai_usage', {
        p_org_id: orgId,
        p_month_year: monthYear,
      });
      used = (orgCount as number | null) ?? 0;
    } else {
      const { data: userCount } = await supabase.rpc('get_monthly_ai_usage', {
        p_user_id: user.id,
        p_month_year: monthYear,
      });
      used = (userCount as number | null) ?? 0;
    }

    const remaining = Math.max(0, limit - used);
    const allowed = used < limit;

    if (!allowed) {
      console.log(`AI action blocked for user ${user.id}: ${used}/${limit} ${actionType}`);
      return new Response(
        JSON.stringify({ allowed: false, used, limit, remaining: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Record the action
    const { error: insertError } = await supabase
      .from('ai_usage')
      .insert({
        user_id: user.id,
        org_id: (typeof orgId === 'string' && orgId) ? orgId : null,
        action_type: actionType as ActionType,
        recording_id: (typeof recordingId === 'string' && recordingId) ? recordingId : null,
        month_year: monthYear,
      });

    if (insertError) {
      console.error('Error recording AI usage:', insertError);
      // Don't block the action if tracking fails — still allow it
    }

    console.log(`AI action recorded for user ${user.id}: ${actionType} (${used + 1}/${limit})`);

    return new Response(
      JSON.stringify({
        allowed: true,
        used: used + 1,
        limit,
        remaining: remaining - 1,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('track-ai-usage error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
