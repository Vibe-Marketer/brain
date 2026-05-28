import { mcpError, mcpOk } from '../../protocol.ts';
import type { ToolModule } from '../_types.ts';
import { verifyRecordingAccess } from './_access.ts';

export const deleteCallTool: ToolModule = {
  definition: { name: 'delete_call' },
  category: 'write',
  async handler(context) {
    const { id, params, supabase, corsHeaders } = context;
    const recordingId = typeof params.recording_id === 'string' ? params.recording_id.trim() : '';
    if (!recordingId) return mcpError(id, -32602, 'recording_id is required', corsHeaders);

    const accessError = await verifyRecordingAccess(context, recordingId);
    if (accessError) return accessError;

    const { data: deleteResult, error: deleteError } = await supabase
      .rpc('delete_recording', { p_recording_id: recordingId });

    if (deleteError) {
      console.error('mcp-server delete_call error:', deleteError);
      return mcpError(id, -32603, `Failed to delete call: ${deleteError.message}`, corsHeaders);
    }

    const result = deleteResult as Record<string, unknown> | null;
    if (result?.error) {
      return mcpError(id, -32603, `Failed to delete call: ${result.error}`, corsHeaders);
    }

    return mcpOk(id, `Call deleted successfully`);
  },
};
