import { mcpError, mcpOk } from '../../protocol.ts';
import type { ToolModule } from '../_types.ts';

export const listSharedCallsTool: ToolModule = {
  definition: { name: 'list_shared_calls' },
  category: 'read',
  async handler({ id, params, supabase, mcpToken, corsHeaders }) {
    const limit = typeof params.limit === 'number' ? Math.min(Math.max(1, params.limit), 100) : 20;

    const {
      data: { user: authUser },
    } = await supabase.auth.admin.getUserById(mcpToken.user_id);
    if (!authUser?.email) {
      return mcpOk(id, 'No shared calls found (unable to resolve user email).');
    }

    const { data: shareLinks, error: shareError } = await supabase
      .from('call_share_links')
      .select('call_recording_id, user_id, created_at, expires_at')
      .eq('status', 'active')
      .ilike('recipient_email', authUser.email.toLowerCase())
      .order('created_at', { ascending: false })
      .limit(limit);

    if (shareError) {
      return mcpError(id, -32603, `Failed to list shared calls: ${shareError.message}`, corsHeaders);
    }

    if (!shareLinks || shareLinks.length === 0) {
      return mcpOk(id, 'No calls have been shared with you.');
    }

    const now = new Date();
    type ShareRow = { call_recording_id: number; user_id: string; created_at: string; expires_at: string | null };
    const activeLinks = (shareLinks as ShareRow[]).filter((s) => !s.expires_at || new Date(s.expires_at) > now);

    if (activeLinks.length === 0) {
      return mcpOk(id, 'No active shared calls found (all links have expired).');
    }

    const recIds = activeLinks.map((s) => s.call_recording_id);
    const { data: recordings } = await supabase
      .from('recordings')
      .select('id, fathom_provider_id, title, recording_start_time, duration, summary')
      .in('fathom_provider_id', recIds);

    type RecRow = {
      id: string;
      fathom_provider_id: number;
      title: string | null;
      recording_start_time: string | null;
      duration: number | null;
      summary: string | null;
    };
    const recMap = new Map((recordings ?? []).map((r: RecRow) => [r.fathom_provider_id, r]));

    return mcpOk(
      id,
      `# Calls Shared With You\n\n` +
        activeLinks
          .map((s) => {
            const rec = recMap.get(s.call_recording_id) as RecRow | undefined;
            const sharedDate = new Date(s.created_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            });
            if (rec) {
              const callDate = rec.recording_start_time
                ? new Date(rec.recording_start_time).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })
                : 'Unknown date';
              const duration = rec.duration ? `${Math.round(rec.duration / 60)}m` : 'Unknown duration';
              return `ID: ${rec.id}\nTitle: ${rec.title || 'Untitled'}\nCall Date: ${callDate}\nDuration: ${duration}\nShared: ${sharedDate}${rec.summary ? `\nSummary: ${rec.summary}` : ''}`;
            }
            return `Legacy Recording ID: ${s.call_recording_id}\nShared: ${sharedDate}`;
          })
          .join('\n\n---\n\n'),
    );
  },
};
