import { mcpError, mcpOk } from '../../protocol.ts';
import type { ToolModule } from '../_types.ts';

export const removeCallFromFolderTool: ToolModule = {
  definition: { name: 'remove_call_from_folder' },
  category: 'write',
  async handler({ id, params, supabase, mcpToken, corsHeaders }) {
    const recordingId = typeof params.recording_id === 'string' ? params.recording_id.trim() : '';
    const folderId = typeof params.folder_id === 'string' ? params.folder_id.trim() : '';
    if (!recordingId) return mcpError(id, -32602, 'recording_id is required', corsHeaders);
    if (!folderId) return mcpError(id, -32602, 'folder_id is required', corsHeaders);

    const { data: folderCheck } = await supabase
      .from('personal_folders')
      .select('id, name')
      .eq('id', folderId)
      .eq('user_id', mcpToken.user_id)
      .maybeSingle();
    if (!folderCheck) return mcpError(id, -32001, 'Folder not found or not accessible', corsHeaders);

    const { error: deleteErr } = await supabase
      .from('personal_folder_recordings')
      .delete()
      .eq('folder_id', folderId)
      .eq('recording_id', recordingId)
      .eq('user_id', mcpToken.user_id);

    if (deleteErr) {
      console.error('mcp-server remove_call_from_folder error:', deleteErr);
      return mcpError(id, -32603, `Failed to remove call from folder: ${deleteErr.message}`, corsHeaders);
    }

    return mcpOk(id, `Removed call from folder "${folderCheck.name}"`);
  },
};
