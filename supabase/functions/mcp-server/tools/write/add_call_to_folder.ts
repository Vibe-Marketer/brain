import { mcpError, mcpOk } from '../../protocol.ts';
import type { ToolModule } from '../_types.ts';
import { verifyRecordingAccess } from './_access.ts';

export const addCallToFolderTool: ToolModule = {
  definition: { name: 'add_call_to_folder' },
  category: 'write',
  async handler(context) {
    const { id, params, supabase, mcpToken, corsHeaders } = context;
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

    const accessError = await verifyRecordingAccess(context, recordingId);
    if (accessError) return accessError;

    const { error: insertErr } = await supabase
      .from('personal_folder_recordings')
      .upsert({
        user_id: mcpToken.user_id,
        folder_id: folderId,
        recording_id: recordingId,
      }, { onConflict: 'folder_id,recording_id' });

    if (insertErr) {
      console.error('mcp-server add_call_to_folder error:', insertErr);
      return mcpError(id, -32603, `Failed to add call to folder: ${insertErr.message}`, corsHeaders);
    }

    return mcpOk(id, `Added call to folder "${folderCheck.name}"`);
  },
};
