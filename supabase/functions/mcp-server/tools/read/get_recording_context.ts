import { type ToolModule, type McpRequestArgs } from '../types.ts';
import { mcpOk, mcpError, fetchOrgWorkspaceIds } from '../utils.ts';


export const schema = {
    name: 'get_recording_context',
    description: 'Get rich context for a call: metadata, AI summary, speakers, and tags.',
    inputSchema: {
      type: 'object',
      properties: {
        recording_id: { type: 'string', description: 'Recording UUID' },
      },
      required: ['recording_id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Markdown document with sections: Metadata (date, duration, source, recording ID), Summary, Speakers (name and role), Tags, and Auto-tags.' },
      },
      required: ['text'],
    },
  };

export const handler = async ({ params, mcpToken, id, supabase, corsHeaders }: McpRequestArgs): Promise<Response> => {
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
          .select('id, title, summary, recording_start_time, recording_end_time, duration, source_app, global_tags, source_metadata')
          .eq('id', recordingId)
          .maybeSingle();
if (recError || !recording) {
          return mcpError(id, -32603, 'Failed to fetch recording', corsHeaders);
        }
const { data: participants } = await supabase
          .from('call_participants')
          .select('name, email, role')
          .eq('recording_id', recordingId)
          .order('name');
const { data: tagAssignments } = await supabase
          .from('call_tag_assignments')
          .select('tag:personal_tags(name, color)')
          .eq('recording_id', recordingId);
const date = recording.recording_start_time
          ? new Date(recording.recording_start_time).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
          : 'Unknown date';
const durationStr = recording.duration
          ? `${Math.floor(recording.duration / 3600) > 0 ? `${Math.floor(recording.duration / 3600)}h ` : ''}${Math.floor((recording.duration % 3600) / 60)}m ${recording.duration % 60}s`
          : 'Unknown';
const speakersStr =
          participants && participants.length > 0
            ? participants
                .map((p: { name: string | null; email: string | null; role: string | null }) =>
                  `  - ${p.name || p.email || 'Unknown'}${p.role ? ` (${p.role})` : ''}`,
                )
                .join('\n')
            : '  - No participant data';
type TagAssignment = { tag: { name: string; color: string | null } | null };
const tagsStr =
          tagAssignments && tagAssignments.length > 0
            ? (tagAssignments as unknown as TagAssignment[])
                .filter((t) => t.tag)
                .map((t) => `  - ${t.tag!.name}`)
                .join('\n')
            : '  - No tags';
const globalTagsStr =
          recording.global_tags && Array.isArray(recording.global_tags) && recording.global_tags.length > 0
            ? (recording.global_tags as string[]).join(', ')
            : null;
const context = [
          `# ${recording.title || 'Untitled Call'}`,
          ``,
          `## Metadata`,
          `- **Date**: ${date}`,
          `- **Duration**: ${durationStr}`,
          `- **Source**: ${recording.source_app || 'unknown'}`,
          `- **Recording ID**: ${recording.id}`,
          ``,
          `## Summary`,
          recording.summary || 'No summary available.',
          ``,
          `## Speakers`,
          speakersStr,
          ``,
          `## Tags`,
          tagsStr,
          globalTagsStr ? `\n## Auto-tags\n${globalTagsStr}` : '',
        ]
          .filter((line) => line !== null)
          .join('\n');
return mcpOk(id, context);
};
