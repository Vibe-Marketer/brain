import { mcpError, mcpOk } from '../../protocol.ts';
import type { ToolModule } from '../_types.ts';

export const listWorkspacesTool: ToolModule = {
  definition: { name: 'list_workspaces' },
  category: 'read',
  async handler({ id, supabase, mcpToken, corsHeaders }) {
    let workspacesQuery = supabase
      .from('workspaces')
      .select('id, name, workspace_type, created_at')
      .order('name');

    if (mcpToken.scope === 'workspace') {
      workspacesQuery = workspacesQuery.eq('id', mcpToken.workspace_id!);
    } else {
      workspacesQuery = workspacesQuery
        .eq('organization_id', mcpToken.org_id!)
        .in(
          'id',
          (
            await supabase
              .from('workspace_memberships')
              .select('workspace_id')
              .eq('user_id', mcpToken.user_id)
          ).data?.map((m: { workspace_id: string }) => m.workspace_id) ?? [],
        );
    }

    const { data: workspaces, error: wsError } = await workspacesQuery;

    if (wsError) {
      return mcpError(id, -32603, `Failed to list workspaces: ${wsError.message}`, corsHeaders);
    }

    if (!workspaces || workspaces.length === 0) {
      return mcpOk(id, 'No workspaces found.');
    }

    type WsRow = { id: string; name: string; workspace_type: string | null; created_at: string };
    return mcpOk(
      id,
      (workspaces as WsRow[])
        .map((w) => `ID: ${w.id}\nName: ${w.name}\nType: ${w.workspace_type || 'standard'}`)
        .join('\n\n---\n\n'),
    );
  },
};
