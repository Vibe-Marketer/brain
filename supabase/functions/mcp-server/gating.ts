import { TOOL_CATEGORIES } from '../_shared/mcp-tool-categories.ts';
import { mcpError } from './protocol.ts';
import type { McpToken, SupabaseClient } from './tools/_types.ts';

const POLAR_PRODUCT_TIERS: Record<string, 'pro' | 'team'> = {
  '30020903-fa8f-4534-9cf1-6e9fba26584c': 'pro',
  '9ff62255-446c-41fe-a84d-c04aed23725c': 'pro',
  '88f3f07e-afa3-4cb1-ac9d-d2429a1ce1b7': 'team',
  '6a1bcf14-86b4-4ec9-bcbe-660bb714b19f': 'team',
};

function isPaidTier(
  productId: string | null,
  status: string | null,
  periodEnd: string | null,
): boolean {
  if (!productId || !status) return false;

  if (productId === 'pro-trial') {
    if (status !== 'trialing') return false;
    if (periodEnd && new Date(periodEnd) < new Date()) return false;
    return true;
  }

  return Boolean(POLAR_PRODUCT_TIERS[productId])
    && (status === 'active' || status === 'trialing');
}

export async function enforcePlanGate(
  supabase: SupabaseClient,
  mcpToken: McpToken,
  id: string | number | null,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  const { data: ownerProfile } = await supabase
    .from('user_profiles')
    .select('subscription_status, product_id, current_period_end')
    .eq('user_id', mcpToken.user_id)
    .maybeSingle();

  const paid = isPaidTier(
    ownerProfile?.product_id ?? null,
    ownerProfile?.subscription_status ?? null,
    ownerProfile?.current_period_end ?? null,
  );
  if (!paid) {
    console.warn(`mcp-server: user ${mcpToken.user_id} has no active paid plan (product_id=${ownerProfile?.product_id})`);
    return mcpError(id, -32001, 'MCP access requires a Pro or Team plan. Upgrade at https://app.callvaultai.com/settings', corsHeaders);
  }

  return null;
}

export function enforceCategoryGate(
  mcpToken: McpToken,
  method: string,
  toolName: string,
  id: string | number | null,
  corsHeaders: Record<string, string>,
): Response | null {
  if (
    mcpToken.enabled_categories !== null &&
    method === 'tools/call'
  ) {
    const category = TOOL_CATEGORIES[toolName];
    if (!category) {
      return mcpError(
        id,
        -32001,
        `Tool '${toolName}' is not recognized. The MCP token's category whitelist does not cover unknown tools — contact CallVault support if this is a server-side bug.`,
        corsHeaders,
      );
    }
    if (!mcpToken.enabled_categories.includes(category)) {
      return mcpError(
        id,
        -32001,
        `Tool '${toolName}' is disabled for this token. Enable the '${category}' category in Settings > Integrations.`,
        corsHeaders,
      );
    }
  }

  return null;
}
