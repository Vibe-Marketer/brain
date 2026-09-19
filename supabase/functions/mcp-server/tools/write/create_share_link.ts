import { mcpError, mcpOk } from '../../protocol.ts';
import type { ToolModule } from '../_types.ts';
import { verifyRecordingAccess } from './_access.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const createShareLinkTool: ToolModule = {
  definition: { name: 'create_share_link' },
  category: 'write',
  async handler(context) {
    const { id, params, supabase, mcpToken, corsHeaders } = context;
    const recordingId = typeof params.recording_id === 'string' ? params.recording_id.trim() : '';
    if (!UUID_PATTERN.test(recordingId)) {
      return mcpError(id, -32602, 'recording_id must be a valid UUID', corsHeaders);
    }
    const recipientEmail = typeof params.recipient_email === 'string' ? params.recipient_email.trim() : null;
    const expiresInDays = typeof params.expires_in_days === 'number' ? Math.max(1, params.expires_in_days) : 30;

    const accessError = await verifyRecordingAccess(context, recordingId);
    if (accessError) return accessError;

    const { data: recording, error: recordingError } = await supabase
      .from('recordings')
      .select('id')
      .eq('id', recordingId)
      .eq('owner_user_id', mcpToken.user_id)
      .maybeSingle();

    if (recordingError || !recording) {
      return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
    }

    const tokenArray = new Uint8Array(16);
    crypto.getRandomValues(tokenArray);
    const shareToken = Array.from(tokenArray).map(b => b.toString(16).padStart(2, '0')).join('');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const insertData: Record<string, unknown> = {
      recording_id: recordingId,
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

    const shareUrl = `https://app.callvaultai.com/s/${shareLink.share_token}`;
    return mcpOk(id, `Share link created:\nURL: ${shareUrl}\nExpires: ${expiresAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}${recipientEmail ? `\nRestricted to: ${recipientEmail}` : ''}\nLink ID: ${shareLink.id}`);
  },
};
