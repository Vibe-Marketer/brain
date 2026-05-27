import { type ToolModule, type McpRequestArgs } from '../types.ts';
import { mcpOk, mcpError, fetchOrgWorkspaceIds } from '../utils.ts';


export const schema = {
    name: 'delete_folder',
    description: 'Delete a personal folder. Recordings in the folder are NOT deleted.',
    inputSchema: {
      type: 'object',
      properties: {
        folder_id: { type: 'string', description: 'Folder UUID to delete' },
      },
      required: ['folder_id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Confirmation message: "Deleted folder <name>".' },
      },
      required: ['text'],
    },
  };

export const handler = async ({ params, mcpToken, id, supabase, corsHeaders }: McpRequestArgs): Promise<Response> => {
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
};
