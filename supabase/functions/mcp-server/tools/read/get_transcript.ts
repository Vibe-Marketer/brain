import { mcpError, mcpOk } from '../../protocol.ts';
import type { ToolModule } from '../_types.ts';

export const getTranscriptTool: ToolModule = {
  definition: { name: 'get_transcript' },
  category: 'read',
  async handler({ id, params, supabase, mcpToken, corsHeaders, fetchOrgWorkspaceIds }) {
    const recordingId = typeof params.recording_id === 'string' ? params.recording_id.trim() : '';
    if (!recordingId) return mcpError(id, -32602, 'recording_id is required', corsHeaders);

    if (mcpToken.scope === 'workspace') {
      const { data: access } = await supabase
        .from('workspace_entries')
        .select('recording_id')
        .eq('recording_id', recordingId)
        .eq('workspace_id', mcpToken.workspace_id!)
        .maybeSingle();
      if (!access) {
        return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
      }
    } else {
      const { ids: orgWorkspaceIds, error: wsLookupError } = await fetchOrgWorkspaceIds(supabase, mcpToken.org_id!);
      if (wsLookupError || !orgWorkspaceIds) {
        return mcpError(id, -32603, 'Failed to resolve organization workspaces', corsHeaders);
      }
      if (orgWorkspaceIds.length === 0) {
        return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
      }
      const { data: access } = await supabase
        .from('workspace_entries')
        .select('recording_id')
        .eq('recording_id', recordingId)
        .in('workspace_id', orgWorkspaceIds)
        .maybeSingle();
      if (!access) {
        return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
      }
    }

    const { data: recording, error: recError } = await supabase
      .from('recordings')
      .select('id, title, full_transcript, recording_start_time')
      .eq('id', recordingId)
      .maybeSingle();

    if (recError || !recording) {
      return mcpError(id, -32603, 'Failed to fetch recording', corsHeaders);
    }

    if (!recording.full_transcript) {
      return mcpOk(id, `No transcript available for: ${recording.title || recordingId}`);
    }

    const date = recording.recording_start_time
      ? new Date(recording.recording_start_time).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : 'Unknown date';

    return mcpOk(
      id,
      `# Transcript: ${recording.title || 'Untitled'}\nDate: ${date}\n\n${recording.full_transcript}`,
    );
  },
};
