import { type ToolModule, type McpRequestArgs } from '../types.ts';
import { mcpOk, mcpError, fetchOrgWorkspaceIds } from '../utils.ts';


export const schema = {
    name: 'rename_folder',
    description: 'Rename an existing personal folder.',
    inputSchema: {
      type: 'object',
      properties: {
        folder_id: { type: 'string', description: 'Folder UUID' },
        name: { type: 'string', description: 'New folder name' },
      },
      required: ['folder_id', 'name'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Confirmation message: "Renamed folder to: <new name>".' },
      },
      required: ['text'],
    },
  };

export const handler = async ({ params, mcpToken, id, supabase, corsHeaders }: McpRequestArgs): Promise<Response> => {
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
};
