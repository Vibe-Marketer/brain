import { mcpError, mcpOk } from '../../protocol.ts';
import { resolveTokenOrgId } from '../_org.ts';
import type { ToolModule } from '../_types.ts';

export const listSharedCallsTool: ToolModule = {
  definition: { name: 'list_shared_calls' },
  category: 'read',
  async handler({ id, params, supabase, mcpToken, corsHeaders }) {
    const limit = typeof params.limit === 'number' ? Math.min(Math.max(1, params.limit), 100) : 20;
    const orgId = await resolveTokenOrgId(supabase, mcpToken);
    if (!orgId) return mcpError(id, -32603, 'Could not determine organization', corsHeaders);

    const {
      data: { user: authUser },
    } = await supabase.auth.admin.getUserById(mcpToken.user_id);
    if (!authUser?.email) {
      return mcpOk(id, 'No shared calls found (unable to resolve user email).');
    }

    const { data: shareLinks, error: shareError } = await supabase
      .from('call_share_links')
      .select('recording_id, call_recording_id, user_id, created_at, expires_at')
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
    type ShareRow = {
      recording_id: string | null;
      call_recording_id: number | null;
      user_id: string;
      created_at: string;
      expires_at: string | null;
    };
    const activeLinks = (shareLinks as ShareRow[]).filter((s) => !s.expires_at || new Date(s.expires_at) > now);

    if (activeLinks.length === 0) {
      return mcpOk(id, 'No active shared calls found (all links have expired).');
    }

    type RecRow = {
      id: string;
      owner_user_id: string;
      fathom_provider_id: number | null;
      title: string | null;
      recording_start_time: string | null;
      duration: number | null;
      summary: string | null;
    };

    const uuidIds = activeLinks.flatMap((link) => link.recording_id ? [link.recording_id] : []);
    const uuidRecordings = uuidIds.length > 0
      ? await supabase
          .from('recordings')
          .select('id, owner_user_id, fathom_provider_id, title, recording_start_time, duration, summary')
          .eq('organization_id', orgId)
          .in('id', uuidIds)
      : { data: [] as RecRow[] };
    const uuidMap = new Map(
      ((uuidRecordings.data ?? []) as RecRow[]).map((recording) => [recording.id, recording]),
    );

    // Legacy-only links are resolved independently so provider ID collisions
    // never select another owner's recording. Exactly one match is required.
    const resolved = await Promise.all(activeLinks.map(async (link) => {
      if (link.recording_id) {
        const recording = uuidMap.get(link.recording_id);
        return recording?.owner_user_id === link.user_id ? { link, recording } : null;
      }
      if (link.call_recording_id === null) return null;

      const { data: candidates } = await supabase
        .from('recordings')
        .select('id, owner_user_id, fathom_provider_id, title, recording_start_time, duration, summary')
        .eq('organization_id', orgId)
        .eq('owner_user_id', link.user_id)
        .eq('fathom_provider_id', link.call_recording_id)
        .limit(2);
      return candidates?.length === 1
        ? { link, recording: candidates[0] as RecRow }
        : null;
    }));
    const orgScopedLinks = resolved.filter(
      (entry): entry is { link: ShareRow; recording: RecRow } => entry !== null,
    );

    if (orgScopedLinks.length === 0) {
      return mcpOk(id, 'No active shared calls found in this organization.');
    }

    return mcpOk(
      id,
      `# Calls Shared With You\n\n` +
        orgScopedLinks
          .map(({ link, recording }) => {
            const sharedDate = new Date(link.created_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            });
            const callDate = recording.recording_start_time
              ? new Date(recording.recording_start_time).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })
              : 'Unknown date';
            const duration = recording.duration ? `${Math.round(recording.duration / 60)}m` : 'Unknown duration';
            return `ID: ${recording.id}\nTitle: ${recording.title || 'Untitled'}\nCall Date: ${callDate}\nDuration: ${duration}\nShared: ${sharedDate}${recording.summary ? `\nSummary: ${recording.summary}` : ''}`;
          })
          .join('\n\n---\n\n'),
    );
  },
};
