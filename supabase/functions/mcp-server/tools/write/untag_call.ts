import { mcpError, mcpOk } from '../../protocol.ts';
import type { ToolModule } from '../_types.ts';

export const untagCallTool: ToolModule = {
  definition: { name: 'untag_call' },
  category: 'write',
  async handler({ id, params, supabase, mcpToken, corsHeaders }) {
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
  },
};
