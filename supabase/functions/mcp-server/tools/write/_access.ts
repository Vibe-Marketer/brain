import { mcpError } from '../../protocol.ts';
import type { ToolHandlerContext } from '../_types.ts';

export async function verifyRecordingAccess(
  context: Pick<ToolHandlerContext, 'id' | 'supabase' | 'mcpToken' | 'corsHeaders' | 'fetchOrgWorkspaceIds'>,
  recordingId: string,
): Promise<Response | null> {
  const { id, supabase, mcpToken, corsHeaders, fetchOrgWorkspaceIds } = context;

  if (mcpToken.scope === 'workspace') {
    const { data: access } = await supabase
      .from('workspace_entries')
      .select('recording_id')
      .eq('recording_id', recordingId)
      .eq('workspace_id', mcpToken.workspace_id!)
      .maybeSingle();
    if (!access) return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
    return null;
  }

  const { ids: orgWsIds, error: wsErr } = await fetchOrgWorkspaceIds(supabase, mcpToken.org_id!);
  if (wsErr || !orgWsIds || orgWsIds.length === 0) {
    return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
  }

  const { data: access } = await supabase
    .from('workspace_entries')
    .select('recording_id')
    .eq('recording_id', recordingId)
    .in('workspace_id', orgWsIds)
    .maybeSingle();
  if (!access) return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);

  return null;
}
