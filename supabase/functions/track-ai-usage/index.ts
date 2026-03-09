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
 *
 * NOTE on concurrency: The check-then-insert pattern has a known soft TOCTOU race.
 * Two simultaneous requests can both read `used < limit` and both insert, allowing
 * a user to slightly exceed their monthly limit in burst scenarios (e.g., batch imports).
 * This is intentional: limits are soft caps, not hard financial guarantees.
 * The window is small (single-user burst) and the over-count is bounded by concurrency.
 * If hard enforcement is needed in the future, replace with an atomic SQL INSERT
 * conditional on a sub-select count — e.g.:
 *   INSERT INTO ai_usage (...) SELECT ... WHERE (SELECT COUNT(*) ... < limit)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';
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

/** Derive action limit from product_id + status */
function getActionLimit(productId: string | null, status: string | null): number {
  if (!productId || !status || status === 'revoked' || status === 'incomplete_expired') {
    return AI_ACTION_LIMITS['free'];
  }
  if (productId === 'pro-trial' && status === 'trialing') {
    return AI_ACTION_LIMITS['pro-trial'];
  }
  return AI_ACTION_LIMITS[productId] ?? AI_ACTION_LIMITS['free'];
}

/** Returns YYYY-MM string for the current month in UTC */
function currentMonthYear(): string {
  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${now.getUTCFullYear()}-${month}`;
}

/** Zod schema for the request body */
const bodySchema = z.object({
  actionType: z.enum(['smart_import', 'auto_name', 'auto_tag', 'chat_message']),
  recordingId: z.string().uuid().optional(),
  orgId: z.string().uuid().optional(),
});

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

    // Validate request body with Zod (validates UUIDs and enum values)
    const parseResult = bodySchema.safeParse(await req.json());
    if (!parseResult.success) {
      const errorMessage = parseResult.error.errors[0]?.message ?? 'Invalid input';
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { actionType, recordingId, orgId: resolvedOrgId } = parseResult.data;
    const monthYear = currentMonthYear();

    // Fetch caller's subscription state (used for personal-tier limit)
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('product_id, subscription_status, current_period_end')
      .eq('user_id', user.id)
      .maybeSingle();

    // Check if personal trial has expired
    let effectiveProductId = profile?.product_id ?? null;
    let effectiveStatus = profile?.subscription_status ?? null;

    if (
      effectiveProductId === 'pro-trial' &&
      effectiveStatus === 'trialing' &&
      profile?.current_period_end
    ) {
      const trialEnd = new Date(profile.current_period_end);
      if (trialEnd < new Date()) {
        effectiveProductId = null;
        effectiveStatus = null;

        // Revert trial fields — log any failure so it's observable
        supabase
          .from('user_profiles')
          .update({ subscription_status: null, product_id: null, current_period_end: null })
          .eq('user_id', user.id)
          .then(({ error: revertError }) => {
            if (revertError) {
              console.error(`Failed to revert expired trial for user ${user.id}:`, revertError);
            } else {
              console.log(`Trial expired for user ${user.id} — reverted to free`);
            }
          });
      }
    }

    // Validate org membership and resolve org-level limit when orgId is provided.
    // Security: without this check a user could pass any org's ID to consume their
    // quota or benefit from a higher team limit they're not entitled to.
    //
    // Limit resolution: the org's Team subscription is owned by the org_owner, so we
    // look up the owner's subscription — not the caller's — to get the correct pooled
    // limit. This ensures all org members are gated by the Team 5,000 limit, not their
    // own personal tier (which might be Free).
    if (resolvedOrgId) {
      const { data: membership } = await supabase
        .from('organization_memberships')
        .select('id')
        .eq('organization_id', resolvedOrgId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!membership) {
        return new Response(
          JSON.stringify({ error: 'Not a member of this organization' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch the org owner's subscription to get the correct tier limit
      const { data: ownerProfile } = await supabase
        .from('organization_memberships')
        .select('user_profiles!inner(product_id, subscription_status)')
        .eq('organization_id', resolvedOrgId)
        .eq('role', 'organization_owner')
        .maybeSingle();

      if (ownerProfile) {
        // deno-lint-ignore no-explicit-any
        const ownerData = (ownerProfile as any).user_profiles as {
          product_id: string | null;
          subscription_status: string | null;
        } | null;
        effectiveProductId = ownerData?.product_id ?? effectiveProductId;
        effectiveStatus = ownerData?.subscription_status ?? effectiveStatus;
      }
    }

    const limit = getActionLimit(effectiveProductId, effectiveStatus);

    // Count current month usage (org-level pooled or personal)
    let used: number;
    if (resolvedOrgId) {
      const { data: orgCount } = await supabase.rpc('get_monthly_org_ai_usage', {
        p_org_id: resolvedOrgId,
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

    // Record the action.
    // Note: there is a soft TOCTOU race between the count check above and this
    // insert — see the file-level comment for details and the chosen trade-off.
    const { error: insertError } = await supabase
      .from('ai_usage')
      .insert({
        user_id: user.id,
        org_id: resolvedOrgId ?? null,
        action_type: actionType,
        recording_id: recordingId ?? null,
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
