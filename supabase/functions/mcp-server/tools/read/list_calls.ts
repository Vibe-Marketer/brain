import { type ToolModule, type McpRequestArgs } from '../types.ts';
import { mcpOk, mcpError, fetchOrgWorkspaceIds } from '../utils.ts';


export const schema = {
    name: 'list_calls',
    description: 'List calls accessible to this token with optional workspace scoping and pagination.',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_id: { type: 'string', description: 'Filter to a specific workspace (UUID)' },
        limit: { type: 'number', description: 'Page size (default 20, max 100)' },
        offset: { type: 'number', description: 'Pagination offset (default 0)' },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Formatted list of calls with ID, title, date, duration, source, and summary for each, separated by ---. Returns "No calls found." if empty.' },
      },
      required: ['text'],
    },
  };

export const handler = async ({ params, mcpToken, id, supabase, corsHeaders }: McpRequestArgs): Promise<Response> => {
const limit = typeof params.limit === 'number' ? Math.min(Math.max(1, params.limit), 100) : 20;
const offset = typeof params.offset === 'number' ? Math.max(0, params.offset) : 0;
let workspaceIds: string[] | null = null;
if (mcpToken.scope === 'workspace') {
          workspaceIds = [mcpToken.workspace_id!];
        } else if (typeof params.workspace_id === 'string' && params.workspace_id) {
          // Org-scoped token requesting a specific workspace — verify it belongs to the org
          const { data: wsCheck } = await supabase
            .from('workspaces')
            .select('id')
            .eq('id', params.workspace_id)
            .eq('organization_id', mcpToken.org_id!)
            .maybeSingle();
          if (!wsCheck) return mcpError(id, -32602, 'workspace_id not found in this organization', corsHeaders);
          workspaceIds = [params.workspace_id as string];
        }
let query = supabase
          .from('workspace_entries')
          .select(`
            recording_id,
            recordings (
              id,
              title,
              recording_start_time,
              duration,
              source_app,
              summary
            )
          `);
if (workspaceIds) {
          query = query.in('workspace_id', workspaceIds);
        } else {
          // Org-scoped: filter to workspaces in the org
          const { data: orgWs } = await supabase
            .from('workspaces')
            .select('id')
            .eq('organization_id', mcpToken.org_id!);
          const ids = (orgWs ?? []).map((w: { id: string }) => w.id);
          if (ids.length === 0) return mcpOk(id, 'No workspaces found in this organization.');
          query = query.in('workspace_id', ids);
        }
const { data: entries, error: listError } = await query
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);
if (listError) {
          console.error('mcp-server list_calls error:', listError);
          return mcpError(id, -32603, `Failed to list calls: ${listError.message}`, corsHeaders);
        }
type EntryRow = {
          recording_id: string;
          recordings: {
            id: string;
            title: string | null;
            recording_start_time: string | null;
            duration: number | null;
            source_app: string | null;
            summary: string | null;
          } | null;
        };
const calls = ((entries ?? []) as unknown as EntryRow[]).filter((e) => e.recordings);
if (calls.length === 0) return mcpOk(id, 'No calls found.');
return mcpOk(
          id,
          calls
            .map((e) => {
              const r = e.recordings!;
              const date = r.recording_start_time
                ? new Date(r.recording_start_time).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })
                : 'Unknown date';
              const duration = r.duration ? `${Math.round(r.duration / 60)}m` : 'Unknown duration';
              return `ID: ${r.id}\nTitle: ${r.title || 'Untitled'}\nDate: ${date}\nDuration: ${duration}\nSource: ${r.source_app || 'unknown'}${r.summary ? `\nSummary: ${r.summary}` : ''}`;
            })
            .join('\n\n---\n\n'),
        );
};
