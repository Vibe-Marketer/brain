import { mcpError, mcpOk } from '../../protocol.ts';
import type { ToolModule } from '../_types.ts';

export const listFoldersTool: ToolModule = {
  definition: { name: 'list_folders' },
  category: 'read',
  async handler({ id, params, supabase, mcpToken, corsHeaders }) {
    const limit = typeof params.limit === 'number' ? Math.min(Math.max(1, params.limit), 200) : 50;

    let query = supabase
      .from('personal_folders')
      .select('id, name, created_at, organization_id')
      .eq('user_id', mcpToken.user_id)
      .order('name')
      .limit(limit);

    if (mcpToken.scope === 'workspace') {
      const { data: ws } = await supabase
        .from('workspaces')
        .select('organization_id')
        .eq('id', mcpToken.workspace_id!)
        .maybeSingle();
      if (ws) query = query.eq('organization_id', ws.organization_id);
    } else if (mcpToken.org_id) {
      query = query.eq('organization_id', mcpToken.org_id);
    }

    const { data: folders, error: foldersError } = await query;

    if (foldersError) {
      return mcpError(id, -32603, `Failed to list folders: ${foldersError.message}`, corsHeaders);
    }

    if (!folders || folders.length === 0) {
      return mcpOk(id, 'No folders found.');
    }

    type FolderRow = { id: string; name: string; created_at: string };
    return mcpOk(
      id,
      (folders as FolderRow[]).map((f) => `ID: ${f.id}\nName: ${f.name}`).join('\n\n---\n\n'),
    );
  },
};
