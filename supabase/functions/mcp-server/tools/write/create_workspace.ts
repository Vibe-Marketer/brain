import { type ToolModule, type McpRequestArgs } from '../types.ts';
import { mcpOk, mcpError, fetchOrgWorkspaceIds } from '../utils.ts';


export const schema = {
    name: 'create_workspace',
    description: 'Create a new workspace within the current organization.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Workspace name' },
        workspace_type: { type: 'string', description: 'Workspace type: "team", "personal", or "youtube" (default: team)' },
      },
      required: ['name'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Confirmation message: "Created workspace <name> (ID: <uuid>)".' },
      },
      required: ['text'],
    },
  };

export const handler = async ({ params, mcpToken, id, supabase, corsHeaders }: McpRequestArgs): Promise<Response> => {
const name = typeof params.name === 'string' ? params.name.trim() : '';
const workspaceType = typeof params.workspace_type === 'string' ? params.workspace_type.trim() : 'team';
if (!name) return mcpError(id, -32602, 'name is required', corsHeaders);
const orgId = mcpToken.org_id ?? (
          mcpToken.scope === 'workspace'
            ? (await supabase.from('workspaces').select('organization_id').eq('id', mcpToken.workspace_id!).maybeSingle()).data?.organization_id
            : null
        );
if (!orgId) return mcpError(id, -32603, 'Could not determine organization', corsHeaders);
const { data: membership } = await supabase
          .from('organization_memberships')
          .select('role')
          .eq('organization_id', orgId)
          .eq('user_id', mcpToken.user_id)
          .maybeSingle();
if (!membership) {
          return mcpError(id, -32001, 'You do not have access to this organization', corsHeaders);
        }
const { data: ws, error: wsErr } = await supabase
          .from('workspaces')
          .insert({
            name,
            organization_id: orgId,
            workspace_type: workspaceType,
          })
          .select('id, name')
          .single();
if (wsErr) {
          console.error('mcp-server create_workspace error:', wsErr);
          return mcpError(id, -32603, `Failed to create workspace: ${wsErr.message}`, corsHeaders);
        }
const { error: wmErr } = await supabase
          .from('workspace_memberships')
          .insert({
            workspace_id: ws.id,
            user_id: mcpToken.user_id,
            role: 'owner',
          });
if (wmErr) {
          console.error('mcp-server create_workspace membership error:', wmErr);
          // Workspace created but membership failed
        }
return mcpOk(id, `Created workspace "${ws.name}" (ID: ${ws.id})`);
};
