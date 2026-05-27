import { type ToolModule, type McpRequestArgs } from '../types.ts';
import { mcpOk, mcpError, fetchOrgWorkspaceIds } from '../utils.ts';


export const schema = {
    name: 'create_organization',
    description: 'Create a new organization and become its owner.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Organization name' },
        type: { type: 'string', description: 'Organization type: "business" or "personal" (default: business)' },
      },
      required: ['name'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Confirmation message: "Created organization <name> (ID: <uuid>)".' },
      },
      required: ['text'],
    },
  };

export const handler = async ({ params, mcpToken, id, supabase, corsHeaders }: McpRequestArgs): Promise<Response> => {
const name = typeof params.name === 'string' ? params.name.trim() : '';
if (!name) return mcpError(id, -32602, 'name is required', corsHeaders);
const orgType = typeof params.type === 'string' ? params.type.trim() : 'business';
const { data: org, error: orgErr } = await supabase
          .from('organizations')
          .insert({ name, type: orgType })
          .select('id, name')
          .single();
if (orgErr) {
          console.error('mcp-server create_organization error:', orgErr);
          return mcpError(id, -32603, `Failed to create organization: ${orgErr.message}`, corsHeaders);
        }
const { error: memErr } = await supabase
          .from('organization_memberships')
          .insert({
            organization_id: org.id,
            user_id: mcpToken.user_id,
            role: 'organization_owner',
          });
if (memErr) {
          console.error('mcp-server create_organization membership error:', memErr);
          // Org was created but membership failed — try to clean up
          await supabase.from('organizations').delete().eq('id', org.id);
          return mcpError(id, -32603, `Failed to create organization membership: ${memErr.message}`, corsHeaders);
        }
return mcpOk(id, `Created organization "${org.name}" (ID: ${org.id})`);
};
