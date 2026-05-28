import { mcpError, mcpOk } from '../../protocol.ts';
import type { ToolModule } from '../_types.ts';
import { verifyRecordingAccess } from './_access.ts';

export const tagCallTool: ToolModule = {
  definition: { name: 'tag_call' },
  category: 'write',
  async handler(context) {
    const { id, params, supabase, mcpToken, corsHeaders } = context;
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

    const accessError = await verifyRecordingAccess(context, recordingId);
    if (accessError) return accessError;

    const { error: insertErr } = await supabase
      .from('personal_tag_recordings')
      .upsert({
        user_id: mcpToken.user_id,
        tag_id: tagId,
        recording_id: recordingId,
      }, { onConflict: 'tag_id,recording_id' });

    if (insertErr) {
      console.error('mcp-server tag_call error:', insertErr);
      return mcpError(id, -32603, `Failed to tag call: ${insertErr.message}`, corsHeaders);
    }

    return mcpOk(id, `Tagged call with "${tagCheck.name}"`);
  },
};
