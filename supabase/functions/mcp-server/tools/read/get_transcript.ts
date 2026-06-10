import { mcpError, mcpOk } from '../../protocol.ts';
import type { ToolModule } from '../_types.ts';

function formatTranscriptSegments(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const lines = value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const text = typeof row.text === 'string' ? row.text.trim() : '';
      if (!text) return null;
      const timestamp = typeof row.timestamp === 'string' && row.timestamp.trim()
        ? `[${row.timestamp.trim()}] `
        : '';
      const speakerName = typeof row.speaker_name === 'string' ? row.speaker_name.trim() : '';
      const speakerEmail = typeof row.speaker_email === 'string' ? row.speaker_email.trim() : '';
      if (!speakerName) return `${timestamp}${text}`;
      const speaker = speakerEmail ? `${speakerName} (${speakerEmail})` : speakerName;
      return `${timestamp}${speaker}: ${text}`;
    })
    .filter((line): line is string => Boolean(line));

  return lines.length > 0 ? lines.join('\n\n') : null;
}

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
      .select('id, title, full_transcript, transcript_segments, recording_start_time')
      .eq('id', recordingId)
      .maybeSingle();

    if (recError || !recording) {
      return mcpError(id, -32603, 'Failed to fetch recording', corsHeaders);
    }

    const transcriptText = formatTranscriptSegments(recording.transcript_segments) ?? recording.full_transcript;

    if (!transcriptText) {
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
      `# Transcript: ${recording.title || 'Untitled'}\nDate: ${date}\n\n${transcriptText}`,
    );
  },
};
