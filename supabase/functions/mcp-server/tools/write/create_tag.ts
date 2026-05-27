import { type ToolModule, type McpRequestArgs } from '../types.ts';
import { mcpOk, mcpError, fetchOrgWorkspaceIds } from '../utils.ts';


export const schema = {
    name: 'create_tag',
    description: 'Create a new personal tag for labeling calls.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Tag name' },
        color: { type: 'string', description: 'Optional color (hex or name)' },
      },
      required: ['name'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Confirmation message: "Created tag <name> (ID: <uuid>)" with optional color info.' },
      },
      required: ['text'],
    },
  };

export const handler = async ({ params, mcpToken, id, supabase, corsHeaders }: McpRequestArgs): Promise<Response> => {
const name = typeof params.name === 'string' ? params.name.trim() : '';
const color = typeof params.color === 'string' ? params.color.trim() : null;
if (!name) return mcpError(id, -32602, 'name is required', corsHeaders);
const orgId = mcpToken.org_id ?? (
          mcpToken.scope === 'workspace'
            ? (await supabase.from('workspaces').select('organization_id').eq('id', mcpToken.workspace_id!).maybeSingle()).data?.organization_id
            : null
        );
if (!orgId) return mcpError(id, -32603, 'Could not determine organization', corsHeaders);
const insertData: Record<string, unknown> = {
          user_id: mcpToken.user_id,
          organization_id: orgId,
          name,
        };
if (color) insertData.color = color;
const { data: tag, error: createErr } = await supabase
          .from('personal_tags')
          .insert(insertData)
          .select('id, name, color')
          .single();
if (createErr) {
          console.error('mcp-server create_tag error:', createErr);
          return mcpError(id, -32603, `Failed to create tag: ${createErr.message}`, corsHeaders);
        }
return mcpOk(id, `Created tag "${tag.name}" (ID: ${tag.id})${tag.color ? ` with color ${tag.color}` : ''}`);
};
