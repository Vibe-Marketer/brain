import { mcpError, mcpOk } from '../../protocol.ts';
import type { ToolModule } from '../_types.ts';

export const revokeShareLinkTool: ToolModule = {
  definition: { name: 'revoke_share_link' },
  category: 'write',
  async handler({ id, params, supabase, mcpToken, corsHeaders }) {
    const shareLinkId = typeof params.share_link_id === 'string' ? params.share_link_id.trim() : '';
    if (!shareLinkId) return mcpError(id, -32602, 'share_link_id is required', corsHeaders);

    const { data: existing } = await supabase
      .from('call_share_links')
      .select('id')
      .eq('id', shareLinkId)
      .eq('user_id', mcpToken.user_id)
      .maybeSingle();
    if (!existing) return mcpError(id, -32001, 'Share link not found or not accessible', corsHeaders);

    const { error: revokeErr } = await supabase
      .from('call_share_links')
      .update({ status: 'revoked', revoked_at: new Date().toISOString() })
      .eq('id', shareLinkId)
      .eq('user_id', mcpToken.user_id);

    if (revokeErr) {
      console.error('mcp-server revoke_share_link error:', revokeErr);
      return mcpError(id, -32603, `Failed to revoke share link: ${revokeErr.message}`, corsHeaders);
    }

    return mcpOk(id, `Share link revoked`);
  },
};
