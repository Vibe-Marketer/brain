import { mcpError, mcpOk } from '../../protocol.ts';
import type { ToolModule } from '../_types.ts';

export const moveCallsToWorkspaceTool: ToolModule = {
  definition: { name: 'move_calls_to_workspace' },
  category: 'write',
  async handler({ id, params, supabase, mcpToken, corsHeaders }) {
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
  },
};
