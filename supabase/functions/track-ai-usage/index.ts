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
import { authenticateRequest } from '../_shared/auth.ts';

// Monthly AI action limits per tier (mirrors AI_ACTION_LIMITS in useSubscription.ts)
const AI_ACTION_LIMITS: Record<string, number> = {
  free: 25,
  pro: 1000,
  team: 5000,
};

const POLAR_PRODUCT_TIERS: Record<string, string> = {
  '30020903-fa8f-4534-9cf1-6e9fba26584c': 'pro',
  '9ff62255-446c-41fe-a84d-c04aed23725c': 'pro',
  '88f3f07e-afa3-4cb1-ac9d-d2429a1ce1b7': 'team',
  '6a1bcf14-86b4-4ec9-bcbe-660bb714b19f': 'team',
};

const VALID_ACTION_TYPES = [
  // Existing in-app actions
  'smart_import',
  'auto_name',
  'auto_tag',
  'chat_message',
  // Phase 22: MCP AI tools (D-09)
  'mcp_action_items',
  'mcp_ask_call',
  'mcp_sentiment',
  'mcp_coaching',
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

  if (productId === 'pro-trial') {
    if (status !== 'trialing') return 'free';
    if (periodEnd && new Date(periodEnd) < new Date()) return 'free';
    return 'pro';
  }

  return POLAR_PRODUCT_TIERS[productId] ?? 'free';
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
        // SEC-02A: Authenticate via shared helper (Phase 37 shared-auth migration)
    const authResult = await authenticateRequest(req, supabase, corsHeaders);
    if (authResult instanceof Response) return authResult;
    const userId = authResult.userId;

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

    // Compute month_year string (e.g., '2026-03')
    const monthYear = new Date().toISOString().slice(0, 7);

    // Step 1: Get user's subscription tier from user_profiles
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('product_id, subscription_status, current_period_end')
      .eq('user_id', userId)
      .maybeSingle();

    if (profileError) {
      console.error('track-ai-usage: profile fetch error:', profileError);
      return new Response(
        JSON.stringify({ error: 'Failed to retrieve subscription data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Step 2: Derive tier and get limit
    const tier = deriveTier(
      profile?.product_id ?? null,
      profile?.subscription_status ?? null,
      profile?.current_period_end ?? null,
    );
    const limit = AI_ACTION_LIMITS[tier] ?? AI_ACTION_LIMITS.free;

    // Team plans use pooled org usage. Free/Pro plans stay user-scoped.
    let effectiveOrgId: string | null = null;
    if (tier === 'team' && orgId) {
      const { data: membership, error: membershipError } = await supabase
        .from('organization_memberships')
        .select('id')
        .eq('organization_id', orgId)
        .eq('user_id', userId)
        .maybeSingle();

      if (membershipError) {
        console.error('track-ai-usage: membership check error:', membershipError);
        return new Response(
          JSON.stringify({ error: 'Failed to verify organization membership' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      if (!membership) {
        return new Response(
          JSON.stringify({ error: 'User is not a member of this organization' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      effectiveOrgId = orgId;
    }

    // Step 3: Get current monthly usage via RPC
    const usageRpc = effectiveOrgId ? 'get_monthly_org_ai_usage' : 'get_monthly_ai_usage';
    const usageParams = effectiveOrgId
      ? { p_org_id: effectiveOrgId, p_month_year: monthYear }
      : { p_user_id: userId, p_month_year: monthYear };

    const { data: currentUsage, error: usageError } = await supabase.rpc(
      usageRpc,
      usageParams,
    );

    if (usageError) {
      console.error(`track-ai-usage: ${usageRpc} RPC error:`, usageError);
      return new Response(
        JSON.stringify({ error: 'Failed to retrieve usage data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const usage = currentUsage ?? 0;

    // Step 4: Enforce limit — return 429 if at or over limit
    if (usage >= limit) {
      console.log(
        `track-ai-usage: limit reached for user ${userId} — usage=${usage} limit=${limit} tier=${tier}`,
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
      user_id: userId,
      org_id: effectiveOrgId,
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
      `track-ai-usage: recorded ${actionType} for user ${userId} — usage=${newUsage}/${limit} tier=${tier}`,
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
