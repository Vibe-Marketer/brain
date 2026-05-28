import { mcpError, mcpOk } from '../../protocol.ts';
import type { ToolModule } from '../_types.ts';

export const renameFolderTool: ToolModule = {
  definition: { name: 'rename_folder' },
  category: 'admin',
  async handler({ id, params, supabase, mcpToken, corsHeaders }) {
    const folderId = typeof params.folder_id === 'string' ? params.folder_id.trim() : '';
    const name = typeof params.name === 'string' ? params.name.trim() : '';
    if (!folderId) return mcpError(id, -32602, 'folder_id is required', corsHeaders);
    if (!name) return mcpError(id, -32602, 'name is required', corsHeaders);

    const { data: existing } = await supabase
      .from('personal_folders')
      .select('id')
      .eq('id', folderId)
      .eq('user_id', mcpToken.user_id)
      .maybeSingle();
    if (!existing) return mcpError(id, -32001, 'Folder not found or not accessible', corsHeaders);

    const { error: updateErr } = await supabase
      .from('personal_folders')
      .update({ name, updated_at: new Date().toISOString() })
      .eq('id', folderId)
      .eq('user_id', mcpToken.user_id);

    if (updateErr) {
      console.error('mcp-server rename_folder error:', updateErr);
      return mcpError(id, -32603, `Failed to rename folder: ${updateErr.message}`, corsHeaders);
    }

    return mcpOk(id, `Renamed folder to: ${name}`);
  },
};
