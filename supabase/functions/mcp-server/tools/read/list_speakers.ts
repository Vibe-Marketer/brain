import { type ToolModule, type McpRequestArgs } from '../types.ts';
import { mcpOk, mcpError, fetchOrgWorkspaceIds } from '../utils.ts';


export const schema = {
    name: 'list_speakers',
    description: 'List known speakers (participants) across calls.',
    inputSchema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Filter by speaker name or email' },
        limit: { type: 'number', description: 'Max results (default 50, max 200)' },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Deduplicated list of speakers with name, email, and participant type for each, separated by ---.' },
      },
      required: ['text'],
    },
  };

export const handler = async ({ params, mcpToken, id, supabase, corsHeaders }: McpRequestArgs): Promise<Response> => {
const limit = typeof params.limit === 'number' ? Math.min(Math.max(1, params.limit), 200) : 50;
const search = typeof params.search === 'string' ? params.search.trim() : '';
let wsIds: string[];
if (mcpToken.scope === 'workspace') {
          wsIds = [mcpToken.workspace_id!];
        } else {
          const { ids, error: wsErr } = await fetchOrgWorkspaceIds(supabase, mcpToken.org_id!);
          if (wsErr || !ids) return mcpError(id, -32603, 'Failed to resolve organization workspaces', corsHeaders);
          wsIds = ids;
        }
if (wsIds.length === 0) return mcpOk(id, 'No speakers found.');
const { data: wsOrgs } = await supabase
          .from('workspaces')
          .select('organization_id')
          .in('id', wsIds);
const orgIds = [...new Set((wsOrgs ?? []).map((w: { organization_id: string }) => w.organization_id))];
if (orgIds.length === 0) return mcpOk(id, 'No speakers found.');
let query = supabase
          .from('call_participants')
          .select('name, email, participant_type')
          .in('organization_id', orgIds)
          .not('name', 'is', null)
          .order('name')
          .limit(limit);
if (search) {
          const escaped = search.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
          const pattern = `%${escaped}%`;
          query = query.or(`name.ilike.${pattern},email.ilike.${pattern}`);
        }
const { data: speakers, error: speakersError } = await query;
if (speakersError) {
          return mcpError(id, -32603, `Failed to list speakers: ${speakersError.message}`, corsHeaders);
        }
if (!speakers || speakers.length === 0) {
          return mcpOk(id, search ? `No speakers found matching "${search}".` : 'No speakers found.');
        }
type SpeakerRow = { name: string | null; email: string | null; participant_type: string };
const seen = new Set<string>();
const unique: SpeakerRow[] = [];
for (const s of speakers as SpeakerRow[]) {
          const key = `${(s.name || '').toLowerCase()}|${(s.email || '').toLowerCase()}`;
          if (!seen.has(key)) {
            seen.add(key);
            unique.push(s);
          }
        }
return mcpOk(
          id,
          unique
            .map((s) => `Name: ${s.name || 'Unknown'}${s.email ? `\nEmail: ${s.email}` : ''}\nType: ${s.participant_type}`)
            .join('\n\n---\n\n'),
        );
};
