import { type ToolModule, type McpRequestArgs } from '../types.ts';
import { mcpOk, mcpError, fetchOrgWorkspaceIds } from '../utils.ts';


export const schema = {
    name: 'move_calls_to_workspace',
    description: 'Move one or more recordings to a different workspace within the same organization.',
    inputSchema: {
      type: 'object',
      properties: {
        recording_ids: { type: 'array', items: { type: 'string' }, description: 'Array of recording UUIDs to move' },
        target_workspace_id: { type: 'string', description: 'Target workspace UUID' },
      },
      required: ['recording_ids', 'target_workspace_id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Confirmation message: "Moved N of M call(s) to workspace <name>".' },
      },
      required: ['text'],
    },
  };

export const handler = async ({ params, mcpToken, id, supabase, corsHeaders }: McpRequestArgs): Promise<Response> => {
const recordingIds = Array.isArray(params.recording_ids) ? params.recording_ids as string[] : [];
const targetWsId = typeof params.target_workspace_id === 'string' ? params.target_workspace_id.trim() : '';
if (recordingIds.length === 0) return mcpError(id, -32602, 'recording_ids is required (non-empty array)', corsHeaders);
if (!targetWsId) return mcpError(id, -32602, 'target_workspace_id is required', corsHeaders);
const { data: targetWs } = await supabase
          .from('workspaces')
          .select('id, organization_id, name')
          .eq('id', targetWsId)
          .maybeSingle();
if (!targetWs) return mcpError(id, -32602, 'Target workspace not found', corsHeaders);
const orgId = mcpToken.org_id ?? (
          mcpToken.scope === 'workspace'
            ? (await supabase.from('workspaces').select('organization_id').eq('id', mcpToken.workspace_id!).maybeSingle()).data?.organization_id
            : null
        );
if (targetWs.organization_id !== orgId) {
          return mcpError(id, -32001, 'Target workspace is not in the same organization', corsHeaders);
        }
let moved = 0;
for (const recId of recordingIds) {
          const { error: moveErr } = await supabase
            .from('workspace_entries')
            .update({ workspace_id: targetWsId })
            .eq('recording_id', recId);
          if (!moveErr) moved++;
        }
return mcpOk(id, `Moved ${moved} of ${recordingIds.length} call(s) to workspace "${targetWs.name}"`);
};
