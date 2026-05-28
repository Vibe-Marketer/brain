import { mcpError, mcpOk } from '../../protocol.ts';
import type { ToolModule } from '../_types.ts';

export const createNoteTool: ToolModule = {
  definition: { name: 'create_note' },
  category: 'write',
  async handler({ id, params, supabase, mcpToken, corsHeaders, fetchOrgWorkspaceIds }) {
    const recordingId = typeof params.recording_id === 'string' ? params.recording_id.trim() : '';
    const rawContent = typeof params.content === 'string' ? params.content : '';
    const content = rawContent.trim();
    const explicitWorkspaceId =
      typeof params.workspace_id === 'string' ? params.workspace_id.trim() : '';

    if (!recordingId) return mcpError(id, -32602, 'recording_id is required', corsHeaders);
    if (!content) return mcpError(id, -32602, 'content is required and cannot be empty', corsHeaders);
    if (content.length > 10_000) {
      return mcpError(id, -32602, 'content exceeds 10,000 character limit', corsHeaders);
    }

    let targetWorkspaceId: string;
    if (mcpToken.scope === 'workspace') {
      targetWorkspaceId = mcpToken.workspace_id!;
      if (explicitWorkspaceId && explicitWorkspaceId !== targetWorkspaceId) {
        return mcpError(
          id,
          -32602,
          'workspace_id does not match the workspace this token is scoped to',
          corsHeaders,
        );
      }
    } else {
      if (!explicitWorkspaceId) {
        return mcpError(
          id,
          -32602,
          'workspace_id is required for organization-scoped tokens',
          corsHeaders,
        );
      }
      const { ids: orgWsIds, error: wsErr } = await fetchOrgWorkspaceIds(
        supabase,
        mcpToken.org_id!,
      );
      if (wsErr || !orgWsIds || orgWsIds.length === 0) {
        return mcpError(id, -32603, 'Failed to resolve organization workspaces', corsHeaders);
      }
      if (!orgWsIds.includes(explicitWorkspaceId)) {
        return mcpError(id, -32001, 'workspace_id is not in this organization', corsHeaders);
      }
      targetWorkspaceId = explicitWorkspaceId;
    }

    const { data: entry } = await supabase
      .from('workspace_entries')
      .select('recording_id')
      .eq('recording_id', recordingId)
      .eq('workspace_id', targetWorkspaceId)
      .maybeSingle();
    if (!entry) {
      return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
    }

    const { error: insertError } = await supabase
      .from('call_notes')
      .insert({
        recording_id: recordingId,
        workspace_id: targetWorkspaceId,
        user_id: mcpToken.user_id,
        content,
      });

    if (insertError) {
      console.error('mcp-server create_note error:', insertError);
      return mcpError(id, -32603, `Failed to create note: ${insertError.message}`, corsHeaders);
    }

    const { data: rec } = await supabase
      .from('recordings')
      .select('title')
      .eq('id', recordingId)
      .maybeSingle();

    return mcpOk(
      id,
      `Created note on "${rec?.title || 'Untitled'}" (${content.length} chars)`,
    );
  },
};
