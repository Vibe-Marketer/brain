import { mcpError, mcpOk } from '../../protocol.ts';
import type { ToolModule } from '../_types.ts';
import { verifyRecordingAccess } from './_access.ts';

const MAX_APPEND_CHARS = 100_000;

export const appendToTranscriptTool: ToolModule = {
  definition: { name: 'append_to_transcript' },
  category: 'write',
  async handler(context) {
    const { id, params, supabase, corsHeaders } = context;
    const recordingId = typeof params.recording_id === 'string' ? params.recording_id.trim() : '';
    const appendTextRaw = typeof params.append_text === 'string' ? params.append_text : '';
    const appendText = appendTextRaw.trim();

    if (!recordingId) return mcpError(id, -32602, 'recording_id is required', corsHeaders);
    if (!appendText) return mcpError(id, -32602, 'append_text is required and cannot be empty', corsHeaders);
    if (appendText.length > MAX_APPEND_CHARS) {
      return mcpError(
        id,
        -32602,
        `append_text exceeds ${MAX_APPEND_CHARS.toLocaleString()} character limit`,
        corsHeaders,
      );
    }

    const accessError = await verifyRecordingAccess(context, recordingId);
    if (accessError) return accessError;

    const { data: existing, error: fetchError } = await supabase
      .from('recordings')
      .select('title, full_transcript')
      .eq('id', recordingId)
      .maybeSingle();

    if (fetchError || !existing) {
      return mcpError(id, -32603, 'Failed to load recording before append', corsHeaders);
    }

    const currentTranscript = typeof existing.full_transcript === 'string'
      ? existing.full_transcript.trim()
      : '';
    const nextTranscript = currentTranscript.length > 0
      ? `${currentTranscript}\n\n${appendText}`
      : appendText;

    const { error: updateError } = await supabase
      .from('recordings')
      .update({ full_transcript: nextTranscript })
      .eq('id', recordingId);

    if (updateError) {
      console.error('mcp-server append_to_transcript error:', updateError);
      return mcpError(
        id,
        -32603,
        `Failed to append transcript: ${updateError.message}`,
        corsHeaders,
      );
    }

    return mcpOk(
      id,
      [
        '# Transcript Updated',
        '',
        `Recording: \`${recordingId}\``,
        `Title: ${existing.title ?? 'Untitled'}`,
        `Appended characters: ${appendText.length}`,
      ].join('\n'),
    );
  },
};
