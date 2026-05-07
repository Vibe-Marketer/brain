/**
 * track-ai-usage-inline.ts
 *
 * Phase 22 (D-10, D-11): in-process tier check + quota enforcement for the MCP server.
 * Mirrors `supabase/functions/track-ai-usage/index.ts` but without HTTP / JWT auth —
 * called from `mcp-server/index.ts` case-blocks before invoking OpenRouter.
 *
 * The HTTP version remains canonical for frontend services; this version exists ONLY
 * because MCP tokens are not Supabase JWTs and we don't want to mint one per tool call.
 *
 * Contract:
 *   - Cache hits MUST NOT call this function (per D-11; cache reads don't consume quota).
 *   - LLM-call paths MUST call this function BEFORE invoking generateObject/generateText.
 *   - On `allowed: false`, the case-block returns `mcpError(id, -32001, reason, corsHeaders)`.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

export type McpAiActionType =
  | 'mcp_action_items'
  | 'mcp_ask_call'
  | 'mcp_sentiment'
  | 'mcp_coaching';

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

export interface EnforceParams {
  supabase: SupabaseClient;        // service-role client (already exists in mcp-server)
  userId: string;                   // from mcpToken.user_id
  orgId: string | null;             // from mcpToken.org_id (null for workspace-scope tokens)
  actionType: McpAiActionType;
  recordingId: string | null;
}

export type EnforceResult =
  | { allowed: true; tier: string; usage: number; limit: number }
  | { allowed: false; reason: string };

/**
 * Server-side gate: derive tier, fetch monthly usage, return allowed/denied.
 * On allowed: also inserts the ai_usage row (best-effort — insert failure logs but
 * does not deny the call, mirroring the HTTP version's behavior).
 *
 * Reason strings on denial are user-facing (sent through MCP -32001) — keep
 * concise + actionable (mention upgrade path).
 */
export async function enforceMcpAiUsage(params: EnforceParams): Promise<EnforceResult> {
  const { supabase, userId, orgId, actionType, recordingId } = params;
  const monthYear = new Date().toISOString().slice(0, 7);

  // 1. Tier derivation
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('product_id, subscription_status, current_period_end')
    .eq('user_id', userId)
    .maybeSingle();

  if (profileError) {
    console.error('enforceMcpAiUsage: profile fetch error:', profileError);
    return { allowed: false, reason: 'Failed to verify subscription. Try again later.' };
  }

  const tier = deriveTier(
    profile?.product_id ?? null,
    profile?.subscription_status ?? null,
    profile?.current_period_end ?? null,
  );
  const limit = AI_ACTION_LIMITS[tier] ?? AI_ACTION_LIMITS.free;

  // 2. Effective org-scope (team tier pools usage org-wide)
  let effectiveOrgId: string | null = null;
  if (tier === 'team' && orgId) {
    const { data: membership, error: memErr } = await supabase
      .from('organization_memberships')
      .select('id')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .maybeSingle();
    if (memErr) {
      console.error('enforceMcpAiUsage: membership check error:', memErr);
      return { allowed: false, reason: 'Failed to verify organization membership.' };
    }
    if (!membership) {
      return { allowed: false, reason: 'User is not a member of this organization.' };
    }
    effectiveOrgId = orgId;
  }

  // 3. Current usage
  const usageRpc = effectiveOrgId ? 'get_monthly_org_ai_usage' : 'get_monthly_ai_usage';
  const usageParams = effectiveOrgId
    ? { p_org_id: effectiveOrgId, p_month_year: monthYear }
    : { p_user_id: userId, p_month_year: monthYear };

  const { data: currentUsage, error: usageError } = await supabase.rpc(usageRpc, usageParams);
  if (usageError) {
    console.error(`enforceMcpAiUsage: ${usageRpc} RPC error:`, usageError);
    return { allowed: false, reason: 'Failed to check usage quota. Try again later.' };
  }

  const usage = (currentUsage as number | null) ?? 0;

  // 4. Limit enforcement
  if (usage >= limit) {
    return {
      allowed: false,
      reason:
        `Monthly AI action limit reached (${usage}/${limit}, ${tier} plan). ` +
        `Upgrade at https://app.callvaultai.com/settings/billing.`,
    };
  }

  // 5. Insert usage row (best-effort)
  const { error: insertError } = await supabase.from('ai_usage').insert({
    user_id: userId,
    org_id: effectiveOrgId,
    action_type: actionType,
    recording_id: recordingId,
    month_year: monthYear,
    created_at: new Date().toISOString(),
  });
  if (insertError) {
    // Log but don't deny — the LLM call already paid for; deny would be worse than over-count.
    console.error('enforceMcpAiUsage: ai_usage insert error:', insertError);
  }

  return { allowed: true, tier, usage: usage + 1, limit };
}
