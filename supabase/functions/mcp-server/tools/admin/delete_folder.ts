import { mcpError, mcpOk } from '../../protocol.ts';
import type { ToolModule } from '../_types.ts';

export const deleteFolderTool: ToolModule = {
  definition: { name: 'delete_folder' },
  category: 'admin',
  async handler({ id, params, supabase, mcpToken, corsHeaders }) {
    const folderId = typeof params.folder_id === 'string' ? params.folder_id.trim() : '';
    if (!folderId) return mcpError(id, -32602, 'folder_id is required', corsHeaders);

    const { data: existing } = await supabase
      .from('personal_folders')
      .select('id, name')
      .eq('id', folderId)
      .eq('user_id', mcpToken.user_id)
      .maybeSingle();
    if (!existing) return mcpError(id, -32001, 'Folder not found or not accessible', corsHeaders);

    const { error: deleteErr } = await supabase
      .from('personal_folders')
      .delete()
      .eq('id', folderId)
      .eq('user_id', mcpToken.user_id);

    if (deleteErr) {
      console.error('mcp-server delete_folder error:', deleteErr);
      return mcpError(id, -32603, `Failed to delete folder: ${deleteErr.message}`, corsHeaders);
    }

    return mcpOk(id, `Deleted folder "${existing.name}"`);
  },
};
