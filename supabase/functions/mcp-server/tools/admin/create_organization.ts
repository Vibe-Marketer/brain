import { mcpError, mcpOk } from '../../protocol.ts';
import type { ToolModule } from '../_types.ts';

export const createOrganizationTool: ToolModule = {
  definition: { name: 'create_organization' },
  category: 'admin',
  async handler({ id, params, supabase, mcpToken, corsHeaders }) {
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
      await supabase.from('organizations').delete().eq('id', org.id);
      return mcpError(id, -32603, `Failed to create organization membership: ${memErr.message}`, corsHeaders);
    }

    return mcpOk(id, `Created organization "${org.name}" (ID: ${org.id})`);
  },
};
