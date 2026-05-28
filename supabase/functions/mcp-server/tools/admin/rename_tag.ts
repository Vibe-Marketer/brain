import { mcpError, mcpOk } from '../../protocol.ts';
import type { ToolModule } from '../_types.ts';

export const renameTagTool: ToolModule = {
  definition: { name: 'rename_tag' },
  category: 'admin',
  async handler({ id, params, supabase, mcpToken, corsHeaders }) {
    const tagId = typeof params.tag_id === 'string' ? params.tag_id.trim() : '';
    const name = typeof params.name === 'string' ? params.name.trim() : '';
    if (!tagId) return mcpError(id, -32602, 'tag_id is required', corsHeaders);
    if (!name) return mcpError(id, -32602, 'name is required', corsHeaders);

    const { data: existing } = await supabase
      .from('personal_tags')
      .select('id')
      .eq('id', tagId)
      .eq('user_id', mcpToken.user_id)
      .maybeSingle();
    if (!existing) return mcpError(id, -32001, 'Tag not found or not accessible', corsHeaders);

    const { error: updateErr } = await supabase
      .from('personal_tags')
      .update({ name, updated_at: new Date().toISOString() })
      .eq('id', tagId)
      .eq('user_id', mcpToken.user_id);

    if (updateErr) {
      console.error('mcp-server rename_tag error:', updateErr);
      return mcpError(id, -32603, `Failed to rename tag: ${updateErr.message}`, corsHeaders);
    }

    return mcpOk(id, `Renamed tag to: ${name}`);
  },
};
