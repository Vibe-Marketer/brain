import { mcpError, mcpOk } from '../../protocol.ts';
import type { ToolModule } from '../_types.ts';

export const listTagsTool: ToolModule = {
  definition: { name: 'list_tags' },
  category: 'read',
  async handler({ id, params, supabase, mcpToken, corsHeaders }) {
    const limit = typeof params.limit === 'number' ? Math.min(Math.max(1, params.limit), 200) : 50;

    let query = supabase
      .from('personal_tags')
      .select('id, name, color, created_at, organization_id')
      .eq('user_id', mcpToken.user_id)
      .order('name')
      .limit(limit);

    if (mcpToken.scope === 'workspace') {
      const { data: ws } = await supabase
        .from('workspaces')
        .select('organization_id')
        .eq('id', mcpToken.workspace_id!)
        .maybeSingle();
      if (ws) query = query.eq('organization_id', ws.organization_id);
    } else if (mcpToken.org_id) {
      query = query.eq('organization_id', mcpToken.org_id);
    }

    const { data: tags, error: tagsError } = await query;

    if (tagsError) {
      return mcpError(id, -32603, `Failed to list tags: ${tagsError.message}`, corsHeaders);
    }

    if (!tags || tags.length === 0) {
      return mcpOk(id, 'No tags found.');
    }

    type TagRow = { id: string; name: string; color: string | null };
    return mcpOk(
      id,
      (tags as TagRow[])
        .map((t) => `ID: ${t.id}\nName: ${t.name}${t.color ? `\nColor: ${t.color}` : ''}`)
        .join('\n\n---\n\n'),
    );
  },
};
