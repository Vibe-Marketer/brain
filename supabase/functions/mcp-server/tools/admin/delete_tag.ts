import { mcpError, mcpOk } from '../../protocol.ts';
import type { ToolModule } from '../_types.ts';

export const deleteTagTool: ToolModule = {
  definition: { name: 'delete_tag' },
  category: 'admin',
  async handler({ id, params, supabase, mcpToken, corsHeaders }) {
    const tagId = typeof params.tag_id === 'string' ? params.tag_id.trim() : '';
    if (!tagId) return mcpError(id, -32602, 'tag_id is required', corsHeaders);

    const { data: existing } = await supabase
      .from('personal_tags')
      .select('id, name')
      .eq('id', tagId)
      .eq('user_id', mcpToken.user_id)
      .maybeSingle();
    if (!existing) return mcpError(id, -32001, 'Tag not found or not accessible', corsHeaders);

    const { error: deleteErr } = await supabase
      .from('personal_tags')
      .delete()
      .eq('id', tagId)
      .eq('user_id', mcpToken.user_id);

    if (deleteErr) {
      console.error('mcp-server delete_tag error:', deleteErr);
      return mcpError(id, -32603, `Failed to delete tag: ${deleteErr.message}`, corsHeaders);
    }

    return mcpOk(id, `Deleted tag "${existing.name}"`);
  },
};
