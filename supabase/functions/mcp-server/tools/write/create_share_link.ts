import { mcpError, mcpOk } from '../../protocol.ts';
import type { ToolModule } from '../_types.ts';
import { verifyRecordingAccess } from './_access.ts';

export const createShareLinkTool: ToolModule = {
  definition: { name: 'create_share_link' },
  category: 'write',
  async handler(context) {
    const { id, params, supabase, mcpToken, corsHeaders } = context;
    const recordingId = typeof params.recording_id === 'string' ? params.recording_id.trim() : '';
    if (!recordingId) return mcpError(id, -32602, 'recording_id is required', corsHeaders);
    const recipientEmail = typeof params.recipient_email === 'string' ? params.recipient_email.trim() : null;
    const expiresInDays = typeof params.expires_in_days === 'number' ? Math.max(1, params.expires_in_days) : 30;

    const accessError = await verifyRecordingAccess(context, recordingId);
    if (accessError) return accessError;

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
  },
};
