import { mcpError, mcpOk } from '../../protocol.ts';
import type { ToolModule } from '../_types.ts';

export const getActionItemsTool: ToolModule = {
  definition: { name: 'get_action_items' },
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

    const { data: recording, error: recError } = await supabase
      .from('recordings')
      .select('id, title, summary, source_metadata')
      .eq('id', recordingId)
      .maybeSingle();

    if (recError || !recording) {
      return mcpError(id, -32603, 'Failed to fetch recording', corsHeaders);
    }

    const meta = recording.source_metadata as Record<string, unknown> | null;
    const metaActionItems = meta?.action_items as string[] | undefined;

    const sections: string[] = [`# Action Items: ${recording.title || 'Untitled'}`];

    if (metaActionItems && metaActionItems.length > 0) {
      sections.push('', '## Extracted Action Items');
      metaActionItems.forEach((item: string, i: number) => {
        sections.push(`${i + 1}. ${item}`);
      });
    }

    if (recording.summary) {
      sections.push('', '## Summary (may contain additional action items)');
      sections.push(recording.summary);
    }

    if (!metaActionItems?.length && !recording.summary) {
      sections.push('', 'No action items or summary available for this recording.');
    }

    return mcpOk(id, sections.join('\n'));
  },
};
