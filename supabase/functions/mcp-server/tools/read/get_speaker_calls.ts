import { type ToolModule, type McpRequestArgs } from '../types.ts';
import { mcpOk, mcpError, fetchOrgWorkspaceIds } from '../utils.ts';


export const schema = {
    name: 'get_speaker_calls',
    description: 'Get all calls a specific speaker appeared in.',
    inputSchema: {
      type: 'object',
      properties: {
        speaker_name: { type: 'string', description: 'Speaker name to search for' },
        speaker_email: { type: 'string', description: 'Speaker email to search for' },
        limit: { type: 'number', description: 'Max results (default 20, max 100)' },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Speaker name header followed by a formatted list of calls with ID, title, date, duration, and summary for each, separated by ---.' },
      },
      required: ['text'],
    },
  };

export const handler = async ({ params, mcpToken, id, supabase, corsHeaders }: McpRequestArgs): Promise<Response> => {
const speakerName = typeof params.speaker_name === 'string' ? params.speaker_name.trim() : '';
const speakerEmail = typeof params.speaker_email === 'string' ? params.speaker_email.trim() : '';
if (!speakerName && !speakerEmail) return mcpError(id, -32602, 'speaker_name or speaker_email is required', corsHeaders);
const limit = typeof params.limit === 'number' ? Math.min(Math.max(1, params.limit), 100) : 20;
let wsIds: string[];
if (mcpToken.scope === 'workspace') {
          wsIds = [mcpToken.workspace_id!];
        } else {
          const { ids, error: wsErr } = await fetchOrgWorkspaceIds(supabase, mcpToken.org_id!);
          if (wsErr || !ids) return mcpError(id, -32603, 'Failed to resolve organization workspaces', corsHeaders);
          wsIds = ids;
        }
if (wsIds.length === 0) return mcpOk(id, 'No calls found for this speaker.');
const { data: wsOrgs } = await supabase
          .from('workspaces')
          .select('organization_id')
          .in('id', wsIds);
const orgIds = [...new Set((wsOrgs ?? []).map((w: { organization_id: string }) => w.organization_id))];
let partQuery = supabase
          .from('call_participants')
          .select('recording_id')
          .in('organization_id', orgIds)
          .limit(limit);
if (speakerEmail) {
          partQuery = partQuery.ilike('email', speakerEmail.toLowerCase());
        } else {
          const escaped = speakerName.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
          partQuery = partQuery.ilike('name', `%${escaped}%`);
        }
const { data: partRows, error: partError } = await partQuery;
if (partError) {
          return mcpError(id, -32603, `Failed to fetch speaker calls: ${partError.message}`, corsHeaders);
        }
if (!partRows || partRows.length === 0) {
          return mcpOk(id, `No calls found for speaker "${speakerName || speakerEmail}".`);
        }
const recIds = [...new Set(partRows.map((p: { recording_id: string }) => p.recording_id))];
const { data: recordings } = await supabase
          .from('recordings')
          .select('id, title, recording_start_time, duration, summary')
          .in('id', recIds)
          .order('recording_start_time', { ascending: false })
          .limit(limit);
if (!recordings || recordings.length === 0) {
          return mcpOk(id, `No calls found for speaker "${speakerName || speakerEmail}".`);
        }
type RecRow = { id: string; title: string | null; recording_start_time: string | null; duration: number | null; summary: string | null };
return mcpOk(
          id,
          `# Calls with ${speakerName || speakerEmail}\n\n` +
          (recordings as RecRow[])
            .map((r) => {
              const date = r.recording_start_time
                ? new Date(r.recording_start_time).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                : 'Unknown date';
              const duration = r.duration ? `${Math.round(r.duration / 60)}m` : 'Unknown duration';
              return `ID: ${r.id}\nTitle: ${r.title || 'Untitled'}\nDate: ${date}\nDuration: ${duration}${r.summary ? `\nSummary: ${r.summary}` : ''}`;
            })
            .join('\n\n---\n\n'),
        );
};
