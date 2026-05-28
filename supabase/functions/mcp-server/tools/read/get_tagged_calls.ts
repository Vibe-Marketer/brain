import { mcpError, mcpOk } from '../../protocol.ts';
import type { ToolModule } from '../_types.ts';

export const getTaggedCallsTool: ToolModule = {
  definition: { name: 'get_tagged_calls' },
  category: 'read',
  async handler({ id, params, supabase, mcpToken, corsHeaders }) {
    const tagId = typeof params.tag_id === 'string' ? params.tag_id.trim() : '';
    const tagName = typeof params.tag_name === 'string' ? params.tag_name.trim() : '';
    if (!tagId && !tagName) return mcpError(id, -32602, 'tag_id or tag_name is required', corsHeaders);
    const limit = typeof params.limit === 'number' ? Math.min(Math.max(1, params.limit), 100) : 20;

    let resolvedTagId = tagId;
    if (!resolvedTagId && tagName) {
      let tagQuery = supabase
        .from('personal_tags')
        .select('id')
        .eq('user_id', mcpToken.user_id)
        .ilike('name', tagName)
        .limit(1)
        .maybeSingle();

      if (mcpToken.org_id) {
        tagQuery = supabase
          .from('personal_tags')
          .select('id')
          .eq('user_id', mcpToken.user_id)
          .eq('organization_id', mcpToken.org_id)
          .ilike('name', tagName)
          .limit(1)
          .maybeSingle();
      }

      const { data: tagRow } = await tagQuery;
      if (!tagRow) return mcpOk(id, `No tag found with name "${tagName}".`);
      resolvedTagId = tagRow.id;
    }

    const { data: tagRecs, error: trError } = await supabase
      .from('personal_tag_recordings')
      .select('recording_id, recordings(id, title, recording_start_time, duration, summary)')
      .eq('tag_id', resolvedTagId)
      .eq('user_id', mcpToken.user_id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (trError) {
      return mcpError(id, -32603, `Failed to fetch tagged calls: ${trError.message}`, corsHeaders);
    }

    if (!tagRecs || tagRecs.length === 0) {
      return mcpOk(id, 'No calls found with this tag.');
    }

    type TagRecRow = {
      recording_id: string;
      recordings: {
        id: string;
        title: string | null;
        recording_start_time: string | null;
        duration: number | null;
        summary: string | null;
      } | null;
    };

    return mcpOk(
      id,
      ((tagRecs ?? []) as unknown as TagRecRow[])
        .filter((tr) => tr.recordings)
        .map((tr) => {
          const r = tr.recordings!;
          const date = r.recording_start_time
            ? new Date(r.recording_start_time).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })
            : 'Unknown date';
          const duration = r.duration ? `${Math.round(r.duration / 60)}m` : 'Unknown duration';
          return `ID: ${r.id}\nTitle: ${r.title || 'Untitled'}\nDate: ${date}\nDuration: ${duration}${r.summary ? `\nSummary: ${r.summary}` : ''}`;
        })
        .join('\n\n---\n\n'),
    );
  },
};
