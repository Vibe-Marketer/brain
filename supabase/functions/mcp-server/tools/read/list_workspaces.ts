import { type ToolModule, type McpRequestArgs } from '../types.ts';
import { mcpOk, mcpError, fetchOrgWorkspaceIds } from '../utils.ts';


export const schema = {
    name: 'list_workspaces',
    description: 'List workspaces accessible to this token (org-scoped tokens see all org workspaces).',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Formatted list of workspaces with ID, name, and type for each, separated by ---.' },
      },
      required: ['text'],
    },
  };

export const handler = async ({ params, mcpToken, id, supabase, corsHeaders }: McpRequestArgs): Promise<Response> => {
let workspacesQuery = supabase
          .from('workspaces')
          .select('id, name, workspace_type, created_at')
          .order('name');
if (mcpToken.scope === 'workspace') {
          // Token is scoped to a single workspace
          workspacesQuery = workspacesQuery.eq('id', mcpToken.workspace_id!);
        } else {
          // Org-scoped: return all workspaces in the org that this user belongs to
          workspacesQuery = workspacesQuery
            .eq('organization_id', mcpToken.org_id!)
            .in(
              'id',
              // Sub-filter to workspaces the user is a member of
              (
                await supabase
                  .from('workspace_memberships')
                  .select('workspace_id')
                  .eq('user_id', mcpToken.user_id)
              ).data?.map((m: { workspace_id: string }) => m.workspace_id) ?? [],
            );
        }
const { data: workspaces, error: wsError } = await workspacesQuery;
if (wsError) {
          return mcpError(id, -32603, `Failed to list workspaces: ${wsError.message}`, corsHeaders);
        }
if (!workspaces || workspaces.length === 0) {
          return mcpOk(id, 'No workspaces found.');
        }
type WsRow = { id: string; name: string; workspace_type: string | null; created_at: string };
return mcpOk(
          id,
          (workspaces as WsRow[])
            .map((w) => `ID: ${w.id}\nName: ${w.name}\nType: ${w.workspace_type || 'standard'}`)
            .join('\n\n---\n\n'),
        );
};
