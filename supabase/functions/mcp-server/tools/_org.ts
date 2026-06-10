import type { McpToken, SupabaseClient } from './_types.ts';

export async function resolveTokenOrgId(
  supabase: SupabaseClient,
  mcpToken: McpToken,
): Promise<string | null> {
  if (mcpToken.org_id) return mcpToken.org_id;
  if (!mcpToken.workspace_id) return null;

  const { data } = await supabase
    .from('workspaces')
    .select('organization_id')
    .eq('id', mcpToken.workspace_id)
    .maybeSingle();

  return data?.organization_id ?? null;
}

export function tokenHasAdminCategory(mcpToken: McpToken): boolean {
  return mcpToken.enabled_categories === null || mcpToken.enabled_categories.includes('admin');
}
