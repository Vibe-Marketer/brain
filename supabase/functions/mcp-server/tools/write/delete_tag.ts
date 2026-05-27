import { type ToolModule, type McpRequestArgs } from '../types.ts';
import { mcpOk, mcpError, fetchOrgWorkspaceIds } from '../utils.ts';


export const schema = {
    name: 'delete_tag',
    description: 'Delete a personal tag. Removes the tag from all recordings.',
    inputSchema: {
      type: 'object',
      properties: {
        tag_id: { type: 'string', description: 'Tag UUID to delete' },
      },
      required: ['tag_id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Confirmation message: "Deleted tag <name>".' },
      },
      required: ['text'],
    },
  };

export const handler = async ({ params, mcpToken, id, supabase, corsHeaders }: McpRequestArgs): Promise<Response> => {
const tagId = typeof params.tag_id === 'string' ? params.tag_id.trim() : '';
if (!tagId) return mcpError(id, -32602, 'tag_id is required', corsHeaders);
const { data: existing } = await supabase
          .from('personal_tags')
          .select('id, name')
          .eq('id', tagId)
          .eq('user_id', mcpToken.user_id)
          .maybeSingle();
if (!existing) return mcpError(id, -32001, 'Tag not found or not accessible', corsHeaders);
const { error: deleteErr } = await supabase
          .from('personal_tags')
          .delete()
          .eq('id', tagId)
          .eq('user_id', mcpToken.user_id);
if (deleteErr) {
          console.error('mcp-server delete_tag error:', deleteErr);
          return mcpError(id, -32603, `Failed to delete tag: ${deleteErr.message}`, corsHeaders);
        }
return mcpOk(id, `Deleted tag "${existing.name}"`);
};
