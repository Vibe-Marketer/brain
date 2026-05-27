import { type ToolModule, type McpRequestArgs } from '../types.ts';
import { mcpOk, mcpError, fetchOrgWorkspaceIds } from '../utils.ts';


export const schema = {
    name: 'add_call_to_folder',
    description: 'Add a recording to a personal folder.',
    inputSchema: {
      type: 'object',
      properties: {
        recording_id: { type: 'string', description: 'Recording UUID' },
        folder_id: { type: 'string', description: 'Folder UUID' },
      },
      required: ['recording_id', 'folder_id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Confirmation message: "Added call to folder <name>".' },
      },
      required: ['text'],
    },
  };

export const handler = async ({ params, mcpToken, id, supabase, corsHeaders }: McpRequestArgs): Promise<Response> => {
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
if (mcpToken.scope === 'workspace') {
          const { data: access } = await supabase
            .from('workspace_entries')
            .select('recording_id')
            .eq('recording_id', recordingId)
            .eq('workspace_id', mcpToken.workspace_id!)
            .maybeSingle();
          if (!access) return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
        } else {
          const { ids: orgWsIds, error: wsErr } = await fetchOrgWorkspaceIds(supabase, mcpToken.org_id!);
          if (wsErr || !orgWsIds || orgWsIds.length === 0) return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
          const { data: access } = await supabase
            .from('workspace_entries')
            .select('recording_id')
            .eq('recording_id', recordingId)
            .in('workspace_id', orgWsIds)
            .maybeSingle();
          if (!access) return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
        }
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
};
