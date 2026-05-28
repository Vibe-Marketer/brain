import { mcpError, mcpOk } from '../../protocol.ts';
import type { ToolModule } from '../_types.ts';

export const searchCallsTool: ToolModule = {
  definition: { name: 'search_calls' },
  category: 'read',
  async handler({ id, params, supabase, mcpToken, corsHeaders, fetchOrgWorkspaceIds }) {
    const query = typeof params.query === 'string' ? params.query.trim() : '';
    if (!query) return mcpError(id, -32602, 'query is required', corsHeaders);

    const limit = typeof params.limit === 'number' ? Math.min(Math.max(1, params.limit), 50) : 10;

    if (mcpToken.scope === 'workspace') {
      const rpcParams: Record<string, unknown> = {
        query_text: query,
        filter_user_id: mcpToken.user_id,
        filter_workspace_id: mcpToken.workspace_id,
        filter_date_start: null,
        filter_date_end: null,
        filter_source_apps: null,
        filter_tag_ids: null,
        filter_folder_ids: null,
        match_count: limit,
      };

      const { data: rows, error: searchError } = await supabase.rpc('global_search', rpcParams);

      if (searchError) {
        console.error('mcp-server search_calls error:', searchError);
        return mcpError(id, -32603, `Search failed: ${searchError.message}`, corsHeaders);
      }

      const calls = (rows ?? []).filter((r: { entity_type: string }) => r.entity_type === 'call');

      return mcpOk(
        id,
        calls.length === 0
          ? `No calls found for query: "${query}"`
          : calls
              .map(
                (c: {
                  entity_id: string;
                  title: string;
                  subtitle: string;
                  relevance_score: number;
                  metadata: Record<string, unknown>;
                }) =>
                  `ID: ${c.entity_id}\nTitle: ${c.title}\nDate: ${c.subtitle}\nRelevance: ${Math.round(c.relevance_score * 100)}%\n${c.metadata?.summary ? `Summary: ${c.metadata.summary}` : ''}`,
              )
              .join('\n\n---\n\n'),
      );
    }

    const { ids: orgWorkspaceIds, error: wsLookupError } = await fetchOrgWorkspaceIds(supabase, mcpToken.org_id!);
    if (wsLookupError || !orgWorkspaceIds) {
      return mcpError(id, -32603, 'Failed to resolve organization workspaces', corsHeaders);
    }
    if (orgWorkspaceIds.length === 0) {
      return mcpOk(id, `No calls found for query: "${query}"`);
    }

    const escapedQuery = query.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
    const ilikePattern = `%${escapedQuery}%`;

    type EntrySearchRow = {
      recordings: { id: string; title: string | null; recording_start_time: string | null; summary: string | null };
    };
    const [{ data: titleRows, error: titleError }, { data: summaryRows, error: summaryError }] =
      await Promise.all([
        supabase
          .from('workspace_entries')
          .select('recordings!inner(id, title, recording_start_time, summary)')
          .in('workspace_id', orgWorkspaceIds)
          .filter('recordings.title', 'ilike', ilikePattern)
          .limit(limit),
        supabase
          .from('workspace_entries')
          .select('recordings!inner(id, title, recording_start_time, summary)')
          .in('workspace_id', orgWorkspaceIds)
          .filter('recordings.summary', 'ilike', ilikePattern)
          .limit(limit),
      ]);

    if (titleError) {
      console.error('mcp-server search_calls error:', titleError);
      return mcpError(id, -32603, `Search failed: ${titleError.message}`, corsHeaders);
    }
    if (summaryError) {
      console.error('mcp-server search_calls error:', summaryError);
      return mcpError(id, -32603, `Search failed: ${summaryError.message}`, corsHeaders);
    }

    type SearchRow = { id: string; title: string | null; recording_start_time: string | null; summary: string | null };
    const seen = new Set<string>();
    const calls: SearchRow[] = [];
    const entryRows = [...(titleRows ?? []), ...(summaryRows ?? [])] as unknown as EntrySearchRow[];
    for (const row of entryRows) {
      const rec = row.recordings;
      if (rec && !seen.has(rec.id)) {
        seen.add(rec.id);
        calls.push(rec);
        if (calls.length >= limit) break;
      }
    }

    return mcpOk(
      id,
      calls.length === 0
        ? `No calls found for query: "${query}"`
        : calls
            .map((c) => {
              const date = c.recording_start_time
                ? new Date(c.recording_start_time).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })
                : 'Unknown date';
              return `ID: ${c.id}\nTitle: ${c.title || 'Untitled'}\nDate: ${date}${c.summary ? `\nSummary: ${c.summary}` : ''}`;
            })
            .join('\n\n---\n\n'),
    );
  },
};
