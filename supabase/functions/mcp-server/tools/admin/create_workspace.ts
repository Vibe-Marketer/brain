import { mcpError, mcpOk } from '../../protocol.ts';
import type { ToolModule } from '../_types.ts';

export const createWorkspaceTool: ToolModule = {
  definition: { name: 'create_workspace' },
  category: 'admin',
  async handler({ id, params, supabase, mcpToken, corsHeaders }) {
    const name = typeof params.name === 'string' ? params.name.trim() : '';
    const workspaceType = typeof params.workspace_type === 'string' ? params.workspace_type.trim() : 'team';
    if (!name) return mcpError(id, -32602, 'name is required', corsHeaders);
    if (isTestArtifactWorkspaceName(name)) {
      return mcpError(
        id,
        -32602,
        'Workspace name looks like a test/debug artifact. Use a real workspace name.',
        corsHeaders,
      );
    }

    const orgId = mcpToken.org_id ?? (
      mcpToken.scope === 'workspace'
        ? (await supabase.from('workspaces').select('organization_id').eq('id', mcpToken.workspace_id!).maybeSingle()).data?.organization_id
        : null
    );
    if (!orgId) return mcpError(id, -32603, 'Could not determine organization', corsHeaders);

    const { data: membership } = await supabase
      .from('organization_memberships')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', mcpToken.user_id)
      .maybeSingle();

    if (!membership) {
      return mcpError(id, -32001, 'You do not have access to this organization', corsHeaders);
    }

    const { data: ws, error: wsErr } = await supabase
      .from('workspaces')
      .insert({
        name,
        organization_id: orgId,
        workspace_type: workspaceType,
      })
      .select('id, name')
      .single();

    if (wsErr) {
      console.error('mcp-server create_workspace error:', wsErr);
      return mcpError(id, -32603, `Failed to create workspace: ${wsErr.message}`, corsHeaders);
    }

    const { error: wmErr } = await supabase
      .from('workspace_memberships')
      .insert({
        workspace_id: ws.id,
        user_id: mcpToken.user_id,
        role: 'workspace_owner',
      });

    if (wmErr) {
      console.error('mcp-server create_workspace membership error:', wmErr);
      await supabase
        .from('workspaces')
        .delete()
        .eq('id', ws.id);
      return mcpError(
        id,
        -32603,
        `Failed to create workspace membership: ${wmErr.message}`,
        corsHeaders,
      );
    }

    return mcpOk(id, `Created workspace "${ws.name}" (ID: ${ws.id})`);
  },
};

function isTestArtifactWorkspaceName(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return false;

  return [
    /^mcp debug temp \d{10,}$/,
    /^debug mcp workspace \d{10,}$/,
    /^\[phase-\d+/,
    /do-not-touch/,
    /integration fixture/,
    /test fixture/,
  ].some((pattern) => pattern.test(normalized));
}
