/**
 * track-ai-usage Edge Function
 *
 * Records an AI action for the authenticated user and enforces monthly limits.
 *
 * POST /track-ai-usage
 * Body: { actionType: string, recordingId?: string, orgId?: string }
 * Returns 200: { success: true, usage: number, limit: number, remaining: number }
 * Returns 429: { error: string, usage: number, limit: number, tier: string } when limit reached
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

// Monthly AI action limits per tier (mirrors AI_ACTION_LIMITS in useSubscription.ts)
const AI_ACTION_LIMITS: Record<string, number> = {
  free: 25,
  pro: 1000,
  team: 5000,
};

// Simple UUID v4 regex for input validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALID_ACTION_TYPES = [
  'smart_import',
  'auto_name',
  'auto_tag',
  'chat_message',
  'summarize_call',
  'generate_content',
] as const;
type AiActionType = typeof VALID_ACTION_TYPES[number];

/**
 * Derive subscription tier from product_id and subscription_status.
 * Mirrors the deriveTier function in useSubscription.ts.
 */
function deriveTier(
  productId: string | null,
  status: string | null,
  periodEnd: string | null,
): string {
  if (!productId) return 'free';

  const lower = productId.toLowerCase();

  if (lower === 'pro-trial') {
    if (status !== 'trialing') return 'free';
    if (periodEnd && new Date(periodEnd) < new Date()) return 'free';
    return 'pro';
  }

  if (lower.startsWith('pro')) return 'pro';
  if (lower.startsWith('team')) return 'team';

  return 'free';
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('Origin'));

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  try {
    // Initialize Supabase service-role client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Parse request body
    const body = await req.json();
    const { actionType, recordingId, orgId } = body as {
      actionType: string;
      recordingId?: string;
      orgId?: string;
    };

    // Validate actionType
    if (!actionType || !(VALID_ACTION_TYPES as readonly string[]).includes(actionType)) {
      return new Response(
        JSON.stringify({
          error: `Invalid actionType. Must be one of: ${VALID_ACTION_TYPES.join(', ')}`,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Validate recordingId is a valid UUID if provided
    if (recordingId && !UUID_REGEX.test(recordingId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid recordingId — must be a valid UUID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Step 1: Get organization context and type
    let effectiveOrgId = orgId;
    let isPersonal = false;

    if (effectiveOrgId) {
      // Validate org exists
      const { data: org } = await supabase
        .from('organizations')
        .select('id, type')
        .eq('id', effectiveOrgId)
        .maybeSingle();

      if (!org) {
        return new Response(
          JSON.stringify({ error: 'Organization not found' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      // Verify user belongs to the specified organization
      const { data: membership } = await supabase
        .from('organization_memberships')
        .select('id')
        .eq('organization_id', effectiveOrgId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!membership) {
        return new Response(
          JSON.stringify({ error: 'Not a member of this organization' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      if (org.type === 'personal') {
        isPersonal = true;
      }
    }

    // Compute month_year string (e.g., '2026-03')
    const monthYear = new Date().toISOString().slice(0, 7);

    // Step 2: Get current monthly usage and subscription tier
    let usage = 0;
    let limit = AI_ACTION_LIMITS.free;
    let tier = 'free';

    if (effectiveOrgId && !isPersonal) {
      // TEAM/BUSINESS USAGE: Pooled count for the organization
      const { data: orgUsage, error: orgUsageError } = await supabase.rpc(
        'get_monthly_org_ai_usage',
        { p_org_id: effectiveOrgId, p_month_year: monthYear },
      );

      if (orgUsageError) {
        console.error('track-ai-usage: get_monthly_org_ai_usage RPC error:', orgUsageError);
        return new Response(
          JSON.stringify({ error: 'Failed to retrieve org usage data' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      usage = orgUsage ?? 0;

      // Find organization owner's subscription
      const { data: ownerMembership } = await supabase
        .from('organization_memberships')
        .select('user_id')
        .eq('organization_id', effectiveOrgId)
        .eq('role', 'organization_owner')
        .maybeSingle();

      const ownerUserId = ownerMembership?.user_id;
      if (!ownerUserId) {
        console.error(`track-ai-usage: org ${effectiveOrgId} has no organization_owner`);
        return new Response(
          JSON.stringify({ error: 'Organization has no owner — cannot determine subscription tier' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      const { data: profile, error: ownerProfileError } = await supabase
        .from('user_profiles')
        .select('product_id, subscription_status, current_period_end')
        .eq('user_id', ownerUserId)
        .maybeSingle();

      if (ownerProfileError) {
        console.error('track-ai-usage: owner profile fetch error:', ownerProfileError);
        return new Response(
          JSON.stringify({ error: 'Failed to retrieve owner subscription data' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      
      tier = deriveTier(
        profile?.product_id ?? null,
        profile?.subscription_status ?? null,
        profile?.current_period_end ?? null,
      );
    } else {
      // PERSONAL USAGE: Count for the user where org_id is NULL or personal org
      // (Migration function get_monthly_ai_usage specifically filters org_id IS NULL)
      const { data: userUsage, error: usageError } = await supabase.rpc(
        'get_monthly_ai_usage',
        { p_user_id: user.id, p_month_year: monthYear },
      );

      if (usageError) {
        console.error('track-ai-usage: get_monthly_ai_usage RPC error:', usageError);
        return new Response(
          JSON.stringify({ error: 'Failed to retrieve usage data' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      usage = userUsage ?? 0;

      // Get user's subscription tier
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('product_id, subscription_status, current_period_end')
        .eq('user_id', user.id)
        .maybeSingle();

      tier = deriveTier(
        profile?.product_id ?? null,
        profile?.subscription_status ?? null,
        profile?.current_period_end ?? null,
      );
      
      // Personal orgs use the NULL org_id bucket to match get_monthly_ai_usage's filter
      if (isPersonal) {
        effectiveOrgId = undefined;
      }
    }

    limit = AI_ACTION_LIMITS[tier] ?? AI_ACTION_LIMITS.free;

    // Step 4: Enforce limit — return 429 if at or over limit
    if (usage >= limit) {
      console.log(
        `track-ai-usage: limit reached for ${effectiveOrgId ? 'org ' + effectiveOrgId : 'user ' + user.id} — usage=${usage} limit=${limit} tier=${tier}`,
      );
      return new Response(
        JSON.stringify({
          error: 'Monthly AI action limit reached',
          usage,
          limit,
          tier,
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Step 5: Insert usage record
    const { error: insertError } = await supabase.from('ai_usage').insert({
      user_id: user.id,
      org_id: effectiveOrgId ?? null,
      action_type: actionType as AiActionType,
      recording_id: recordingId ?? null,
      month_year: monthYear,
      created_at: new Date().toISOString(),
    });

    if (insertError) {
      console.error('track-ai-usage: insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to record AI action' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Step 6: Return success with updated usage counts
    const newUsage = usage + 1;
    console.log(
      `track-ai-usage: recorded ${actionType} for ${effectiveOrgId ? 'org ' + effectiveOrgId : 'user ' + user.id} — usage=${newUsage}/${limit} tier=${tier}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        usage: newUsage,
        limit,
        remaining: limit - newUsage,
        tier,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('track-ai-usage: unhandled error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
