import { type ToolModule, type McpRequestArgs } from '../types.ts';
import { mcpOk, mcpError, fetchOrgWorkspaceIds } from '../utils.ts';


export const schema = {
    name: 'create_share_link',
    description: 'Create a share link for a call recording, optionally restricted to a specific email.',
    inputSchema: {
      type: 'object',
      properties: {
        recording_id: { type: 'string', description: 'Recording UUID' },
        recipient_email: { type: 'string', description: 'Optional email to restrict access to' },
        expires_in_days: { type: 'number', description: 'Days until expiration (default 30)' },
      },
      required: ['recording_id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Share link details including URL, expiration date, optional recipient restriction, and link ID.' },
      },
      required: ['text'],
    },
  };

export const handler = async ({ params, mcpToken, id, supabase, corsHeaders }: McpRequestArgs): Promise<Response> => {
const recordingId = typeof params.recording_id === 'string' ? params.recording_id.trim() : '';
if (!recordingId) return mcpError(id, -32602, 'recording_id is required', corsHeaders);
const recipientEmail = typeof params.recipient_email === 'string' ? params.recipient_email.trim() : null;
const expiresInDays = typeof params.expires_in_days === 'number' ? Math.max(1, params.expires_in_days) : 30;
if (mcpToken.scope === 'workspace') {
          const { data: access } = await supabase
            .from('workspace_entries')
            .select('recording_id')
            .eq('recording_id', recordingId)
            .eq('workspace_id', mcpToken.workspace_id!)
            .maybeSingle();
          if (!access) return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
        } else {
          const { ids: orgWsIds, error: wsErr } = await fetchOrgWorkspaceIds(supabase, mcpToken.org_id!);
          if (wsErr || !orgWsIds || orgWsIds.length === 0) return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
          const { data: access } = await supabase
            .from('workspace_entries')
            .select('recording_id')
            .eq('recording_id', recordingId)
            .in('workspace_id', orgWsIds)
            .maybeSingle();
          if (!access) return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
        }
const { data: rec } = await supabase
          .from('recordings')
          .select('legacy_recording_id')
          .eq('id', recordingId)
          .maybeSingle();
if (!rec?.legacy_recording_id) {
          return mcpError(id, -32603, 'Recording does not have a legacy ID required for share links', corsHeaders);
        }
const tokenArray = new Uint8Array(16);
crypto.getRandomValues(tokenArray);
const shareToken = Array.from(tokenArray).map(b => b.toString(16).padStart(2, '0')).join('');
const expiresAt = new Date();
expiresAt.setDate(expiresAt.getDate() + expiresInDays);
const insertData: Record<string, unknown> = {
          call_recording_id: rec.legacy_recording_id,
          user_id: mcpToken.user_id,
          created_by_user_id: mcpToken.user_id,
          share_token: shareToken,
          status: 'active',
          expires_at: expiresAt.toISOString(),
        };
if (recipientEmail) insertData.recipient_email = recipientEmail;
const { data: shareLink, error: shareErr } = await supabase
          .from('call_share_links')
          .insert(insertData)
          .select('id, share_token')
          .single();
if (shareErr) {
          console.error('mcp-server create_share_link error:', shareErr);
          return mcpError(id, -32603, `Failed to create share link: ${shareErr.message}`, corsHeaders);
        }
const shareUrl = `https://app.callvaultai.com/shared/${shareLink.share_token}`;
return mcpOk(id, `Share link created:\nURL: ${shareUrl}\nExpires: ${expiresAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}${recipientEmail ? `\nRestricted to: ${recipientEmail}` : ''}\nLink ID: ${shareLink.id}`);
};
