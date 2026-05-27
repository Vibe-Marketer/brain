import { type ToolModule, type McpRequestArgs } from '../types.ts';
import { mcpOk, mcpError, fetchOrgWorkspaceIds } from '../utils.ts';


export const schema = {
    name: 'untag_call',
    description: 'Remove a personal tag from a recording.',
    inputSchema: {
      type: 'object',
      properties: {
        recording_id: { type: 'string', description: 'Recording UUID' },
        tag_id: { type: 'string', description: 'Tag UUID' },
      },
      required: ['recording_id', 'tag_id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Confirmation message: "Removed tag <name> from call".' },
      },
      required: ['text'],
    },
  };

export const handler = async ({ params, mcpToken, id, supabase, corsHeaders }: McpRequestArgs): Promise<Response> => {
const recordingId = typeof params.recording_id === 'string' ? params.recording_id.trim() : '';
const tagId = typeof params.tag_id === 'string' ? params.tag_id.trim() : '';
if (!recordingId) return mcpError(id, -32602, 'recording_id is required', corsHeaders);
if (!tagId) return mcpError(id, -32602, 'tag_id is required', corsHeaders);
const { data: tagCheck } = await supabase
          .from('personal_tags')
          .select('id, name')
          .eq('id', tagId)
          .eq('user_id', mcpToken.user_id)
          .maybeSingle();
if (!tagCheck) return mcpError(id, -32001, 'Tag not found or not accessible', corsHeaders);
const { error: deleteErr } = await supabase
          .from('personal_tag_recordings')
          .delete()
          .eq('tag_id', tagId)
          .eq('recording_id', recordingId)
          .eq('user_id', mcpToken.user_id);
if (deleteErr) {
          console.error('mcp-server untag_call error:', deleteErr);
          return mcpError(id, -32603, `Failed to untag call: ${deleteErr.message}`, corsHeaders);
        }
return mcpOk(id, `Removed tag "${tagCheck.name}" from call`);
};
