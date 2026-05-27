import { type ToolModule, type McpRequestArgs } from '../types.ts';
import { mcpOk, mcpError, fetchOrgWorkspaceIds } from '../utils.ts';


export const schema = {
    name: 'create_folder',
    description: 'Create a new personal folder for organizing calls.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Folder name' },
      },
      required: ['name'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Confirmation message: "Created folder <name> (ID: <uuid>)".' },
      },
      required: ['text'],
    },
  };

export const handler = async ({ params, mcpToken, id, supabase, corsHeaders }: McpRequestArgs): Promise<Response> => {
const name = typeof params.name === 'string' ? params.name.trim() : '';
if (!name) return mcpError(id, -32602, 'name is required', corsHeaders);
const orgId = mcpToken.org_id ?? (
          mcpToken.scope === 'workspace'
            ? (await supabase.from('workspaces').select('organization_id').eq('id', mcpToken.workspace_id!).maybeSingle()).data?.organization_id
            : null
        );
if (!orgId) return mcpError(id, -32603, 'Could not determine organization', corsHeaders);
const { data: folder, error: createErr } = await supabase
          .from('personal_folders')
          .insert({
            user_id: mcpToken.user_id,
            organization_id: orgId,
            name,
          })
          .select('id, name')
          .single();
if (createErr) {
          console.error('mcp-server create_folder error:', createErr);
          return mcpError(id, -32603, `Failed to create folder: ${createErr.message}`, corsHeaders);
        }
return mcpOk(id, `Created folder "${folder.name}" (ID: ${folder.id})`);
};
