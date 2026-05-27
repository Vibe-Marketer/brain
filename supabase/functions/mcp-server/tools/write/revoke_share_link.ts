import { type ToolModule, type McpRequestArgs } from '../types.ts';
import { mcpOk, mcpError, fetchOrgWorkspaceIds } from '../utils.ts';


export const schema = {
    name: 'revoke_share_link',
    description: 'Revoke an active share link so it can no longer be used.',
    inputSchema: {
      type: 'object',
      properties: {
        share_link_id: { type: 'string', description: 'Share link UUID to revoke' },
      },
      required: ['share_link_id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Confirmation message: "Share link revoked".' },
      },
      required: ['text'],
    },
  };

export const handler = async ({ params, mcpToken, id, supabase, corsHeaders }: McpRequestArgs): Promise<Response> => {
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
};
