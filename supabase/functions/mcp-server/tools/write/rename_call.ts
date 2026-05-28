import { mcpError, mcpOk } from '../../protocol.ts';
import type { ToolModule } from '../_types.ts';
import { verifyRecordingAccess } from './_access.ts';

export const renameCallTool: ToolModule = {
  definition: { name: 'rename_call' },
  category: 'write',
  async handler(context) {
    const { id, params, supabase, corsHeaders } = context;
    const recordingId = typeof params.recording_id === 'string' ? params.recording_id.trim() : '';
    const title = typeof params.title === 'string' ? params.title.trim() : '';
    if (!recordingId) return mcpError(id, -32602, 'recording_id is required', corsHeaders);
    if (!title) return mcpError(id, -32602, 'title is required', corsHeaders);

    const accessError = await verifyRecordingAccess(context, recordingId);
    if (accessError) return accessError;

    const { error: updateError } = await supabase
      .from('recordings')
      .update({ title })
      .eq('id', recordingId);

    if (updateError) {
      console.error('mcp-server rename_call error:', updateError);
      return mcpError(id, -32603, `Failed to rename call: ${updateError.message}`, corsHeaders);
    }

    return mcpOk(id, `Renamed call to: ${title}`);
  },
};
