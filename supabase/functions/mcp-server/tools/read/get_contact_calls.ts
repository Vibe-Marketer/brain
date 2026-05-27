import { type ToolModule, type McpRequestArgs } from '../types.ts';
import { mcpOk, mcpError, fetchOrgWorkspaceIds } from '../utils.ts';


export const schema = {
    name: 'get_contact_calls',
    description: 'List all calls involving a specific contact.',
    inputSchema: {
      type: 'object',
      properties: {
        contact_id: { type: 'string', description: 'Contact UUID' },
        limit: { type: 'number', description: 'Max results (default 20, max 100)' },
      },
      required: ['contact_id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Formatted list of calls with ID, title, date, duration, and summary for each, separated by ---.' },
      },
      required: ['text'],
    },
  };

export const handler = async ({ params, mcpToken, id, supabase, corsHeaders }: McpRequestArgs): Promise<Response> => {
const contactId = typeof params.contact_id === 'string' ? params.contact_id.trim() : '';
if (!contactId) return mcpError(id, -32602, 'contact_id is required', corsHeaders);
const limit = typeof params.limit === 'number' ? Math.min(Math.max(1, params.limit), 100) : 20;
const { data: contactCheck } = await supabase
          .from('contacts')
          .select('id')
          .eq('id', contactId)
          .eq('user_id', mcpToken.user_id)
          .maybeSingle();
if (!contactCheck) {
          return mcpError(id, -32001, 'Contact not found or not accessible', corsHeaders);
        }
const { data: appearances, error: appError } = await supabase
          .from('contact_call_appearances')
          .select('recording_id, appeared_at')
          .eq('contact_id', contactId)
          .eq('user_id', mcpToken.user_id)
          .order('appeared_at', { ascending: false })
          .limit(limit);
if (appError) {
          return mcpError(id, -32603, `Failed to fetch contact calls: ${appError.message}`, corsHeaders);
        }
if (!appearances || appearances.length === 0) {
          return mcpOk(id, 'No calls found for this contact.');
        }
const recIds = appearances.map((a: { recording_id: number }) => a.recording_id);
const { data: recordings } = await supabase
          .from('recordings')
          .select('id, legacy_recording_id, title, recording_start_time, duration, summary')
          .in('legacy_recording_id', recIds);
type RecRow = { id: string; legacy_recording_id: number; title: string | null; recording_start_time: string | null; duration: number | null; summary: string | null };
const recMap = new Map((recordings ?? []).map((r: RecRow) => [r.legacy_recording_id, r]));
return mcpOk(
          id,
          appearances
            .map((a: { recording_id: number; appeared_at: string | null }) => {
              const rec = recMap.get(a.recording_id) as RecRow | undefined;
              const date = a.appeared_at ? new Date(a.appeared_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Unknown date';
              if (rec) {
                const duration = rec.duration ? `${Math.round(rec.duration / 60)}m` : 'Unknown duration';
                return `ID: ${rec.id}\nTitle: ${rec.title || 'Untitled'}\nDate: ${date}\nDuration: ${duration}${rec.summary ? `\nSummary: ${rec.summary}` : ''}`;
              }
              return `Legacy Recording ID: ${a.recording_id}\nDate: ${date}`;
            })
            .join('\n\n---\n\n'),
        );
};
