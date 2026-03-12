import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

/**
 * MCP SERVER — Model Context Protocol endpoint for CallVault
 *
 * Implements JSON-RPC 2.0 over HTTP for the MCP protocol.
 * Authentication: Bearer token from mcp_tokens table (NOT a Supabase JWT).
 *
 * Each token is scoped to either a single workspace or an entire organization.
 * Access control is enforced via token scoping — we use the service role key
 * to query data and verify ownership through the token metadata.
 *
 * Tools exposed:
 *   tools/list                     — enumerate available tools
 *   callvault/search_calls         — full-text + semantic search
 *   callvault/get_transcript       — full transcript for a recording
 *   callvault/list_calls           — paginated call list
 *   callvault/get_recording_context — metadata + summary + speakers + tags
 *   callvault/list_workspaces      — workspaces visible to this token
 *
 * MCP response envelope:
 *   { id, result: { content: [{ type: "text", text: "..." }] } }
 *
 * Error envelope:
 *   { id, error: { code, message } }
 */

// ─── Types ────────────────────────────────────────────────────────────────────

interface JsonRpcRequest {
  jsonrpc?: string;
  id: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

interface McpToken {
  id: string;
  user_id: string;
  org_id: string | null;
  workspace_id: string | null;
  scope: 'workspace' | 'organization';
  name: string;
}

interface McpContent {
  type: 'text';
  text: string;
}

interface McpResult {
  content: McpContent[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mcpOk(id: string | number | null, data: unknown): Response {
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  return Response.json({
    jsonrpc: '2.0',
    id,
    result: {
      content: [{ type: 'text', text }],
    } satisfies McpResult,
  });
}

function mcpError(
  id: string | number | null,
  code: number,
  message: string,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(
    JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}

// ─── Tool Definitions ─────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'callvault/search_calls',
    description: 'Search calls by keyword across titles, transcripts, summaries, tags, and participants.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term' },
        limit: { type: 'number', description: 'Max results (default 10, max 50)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'callvault/list_calls',
    description: 'List calls accessible to this token with optional workspace scoping and pagination.',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_id: { type: 'string', description: 'Filter to a specific workspace (UUID)' },
        limit: { type: 'number', description: 'Page size (default 20, max 100)' },
        offset: { type: 'number', description: 'Pagination offset (default 0)' },
      },
    },
  },
  {
    name: 'callvault/get_transcript',
    description: 'Retrieve the full transcript text for a specific call recording.',
    inputSchema: {
      type: 'object',
      properties: {
        recording_id: { type: 'string', description: 'Recording UUID' },
      },
      required: ['recording_id'],
    },
  },
  {
    name: 'callvault/get_recording_context',
    description: 'Get rich context for a call: metadata, AI summary, speakers, and tags.',
    inputSchema: {
      type: 'object',
      properties: {
        recording_id: { type: 'string', description: 'Recording UUID' },
      },
      required: ['recording_id'],
    },
  },
  {
    name: 'callvault/list_workspaces',
    description: 'List workspaces accessible to this token (org-scoped tokens see all org workspaces).',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // Parse JSON-RPC body
  let body: JsonRpcRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const { id = null, method, params = {} } = body;

  // ── Authenticate via MCP Bearer token ──────────────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return mcpError(id, -32001, 'Missing or invalid Authorization header', corsHeaders);
  }
  const rawToken = authHeader.replace('Bearer ', '').trim();

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Look up the token record
  const { data: tokenRow, error: tokenError } = await supabase
    .from('mcp_tokens')
    .select('id, user_id, org_id, workspace_id, scope, name')
    .eq('token', rawToken)
    .maybeSingle();

  if (tokenError || !tokenRow) {
    return mcpError(id, -32001, 'Invalid MCP token', corsHeaders);
  }

  const mcpToken = tokenRow as McpToken;

  // Update last_used_at asynchronously (fire-and-forget)
  supabase
    .from('mcp_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', mcpToken.id)
    .then(() => {/* no-op */});

  // ── Route to tool handler ───────────────────────────────────────────────────

  try {
    switch (method) {
      case 'tools/list': {
        return mcpOk(id, { tools: TOOLS });
      }

      case 'initialize': {
        // MCP handshake — return server capabilities
        return mcpOk(id, {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'callvault-mcp', version: '1.0.0' },
        });
      }

      case 'callvault/search_calls': {
        const query = typeof params.query === 'string' ? params.query.trim() : '';
        if (!query) return mcpError(id, -32602, 'query is required', corsHeaders);

        const limit = typeof params.limit === 'number' ? Math.min(Math.max(1, params.limit), 50) : 10;

        const rpcParams: Record<string, unknown> = {
          query_text: query,
          filter_user_id: mcpToken.user_id,
          filter_workspace_id: mcpToken.scope === 'workspace' ? mcpToken.workspace_id : null,
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

      case 'callvault/list_calls': {
        const limit = typeof params.limit === 'number' ? Math.min(Math.max(1, params.limit), 100) : 20;
        const offset = typeof params.offset === 'number' ? Math.max(0, params.offset) : 0;

        // Determine which workspace IDs are in scope
        let workspaceIds: string[] | null = null;

        if (mcpToken.scope === 'workspace') {
          workspaceIds = [mcpToken.workspace_id!];
        } else if (typeof params.workspace_id === 'string' && params.workspace_id) {
          // Org-scoped token requesting a specific workspace — verify it belongs to the org
          const { data: wsCheck } = await supabase
            .from('workspaces')
            .select('id')
            .eq('id', params.workspace_id)
            .eq('organization_id', mcpToken.org_id!)
            .maybeSingle();
          if (!wsCheck) return mcpError(id, -32602, 'workspace_id not found in this organization', corsHeaders);
          workspaceIds = [params.workspace_id as string];
        }

        // Build query through workspace_entries → recordings join
        let query = supabase
          .from('workspace_entries')
          .select(`
            recording_id,
            recordings (
              id,
              title,
              recording_start_time,
              duration,
              source_app,
              summary
            )
          `)
          .eq('user_id', mcpToken.user_id);

        if (workspaceIds) {
          query = query.in('workspace_id', workspaceIds);
        } else {
          // Org-scoped: filter to workspaces in the org
          const { data: orgWs } = await supabase
            .from('workspaces')
            .select('id')
            .eq('organization_id', mcpToken.org_id!);
          const ids = (orgWs ?? []).map((w: { id: string }) => w.id);
          if (ids.length === 0) return mcpOk(id, 'No workspaces found in this organization.');
          query = query.in('workspace_id', ids);
        }

        const { data: entries, error: listError } = await query
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (listError) {
          console.error('mcp-server list_calls error:', listError);
          return mcpError(id, -32603, `Failed to list calls: ${listError.message}`, corsHeaders);
        }

        type EntryRow = {
          recording_id: string;
          recordings: {
            id: string;
            title: string | null;
            recording_start_time: string | null;
            duration: number | null;
            source_app: string | null;
            summary: string | null;
          } | null;
        };

        const calls = (entries ?? [] as EntryRow[]).filter((e: EntryRow) => e.recordings);
        if (calls.length === 0) return mcpOk(id, 'No calls found.');

        return mcpOk(
          id,
          calls
            .map((e: EntryRow) => {
              const r = e.recordings!;
              const date = r.recording_start_time
                ? new Date(r.recording_start_time).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })
                : 'Unknown date';
              const duration = r.duration ? `${Math.round(r.duration / 60)}m` : 'Unknown duration';
              return `ID: ${r.id}\nTitle: ${r.title || 'Untitled'}\nDate: ${date}\nDuration: ${duration}\nSource: ${r.source_app || 'unknown'}${r.summary ? `\nSummary: ${r.summary}` : ''}`;
            })
            .join('\n\n---\n\n'),
        );
      }

      case 'callvault/get_transcript': {
        const recordingId = typeof params.recording_id === 'string' ? params.recording_id.trim() : '';
        if (!recordingId) return mcpError(id, -32602, 'recording_id is required', corsHeaders);

        // Verify the user owns this recording via workspace_entries
        const { data: access } = await supabase
          .from('workspace_entries')
          .select('recording_id')
          .eq('recording_id', recordingId)
          .eq('user_id', mcpToken.user_id)
          .maybeSingle();

        if (!access) {
          return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
        }

        // Additionally verify it's in scope for workspace-scoped tokens
        if (mcpToken.scope === 'workspace') {
          const { data: scopeCheck } = await supabase
            .from('workspace_entries')
            .select('recording_id')
            .eq('recording_id', recordingId)
            .eq('workspace_id', mcpToken.workspace_id!)
            .maybeSingle();
          if (!scopeCheck) {
            return mcpError(id, -32001, 'Recording is not in this token\'s workspace', corsHeaders);
          }
        }

        const { data: recording, error: recError } = await supabase
          .from('recordings')
          .select('id, title, full_transcript, recording_start_time')
          .eq('id', recordingId)
          .maybeSingle();

        if (recError || !recording) {
          return mcpError(id, -32603, 'Failed to fetch recording', corsHeaders);
        }

        if (!recording.full_transcript) {
          return mcpOk(id, `No transcript available for: ${recording.title || recordingId}`);
        }

        const date = recording.recording_start_time
          ? new Date(recording.recording_start_time).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })
          : 'Unknown date';

        return mcpOk(
          id,
          `# Transcript: ${recording.title || 'Untitled'}\nDate: ${date}\n\n${recording.full_transcript}`,
        );
      }

      case 'callvault/get_recording_context': {
        const recordingId = typeof params.recording_id === 'string' ? params.recording_id.trim() : '';
        if (!recordingId) return mcpError(id, -32602, 'recording_id is required', corsHeaders);

        // Verify access
        const { data: access } = await supabase
          .from('workspace_entries')
          .select('recording_id')
          .eq('recording_id', recordingId)
          .eq('user_id', mcpToken.user_id)
          .maybeSingle();

        if (!access) {
          return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
        }

        if (mcpToken.scope === 'workspace') {
          const { data: scopeCheck } = await supabase
            .from('workspace_entries')
            .select('recording_id')
            .eq('recording_id', recordingId)
            .eq('workspace_id', mcpToken.workspace_id!)
            .maybeSingle();
          if (!scopeCheck) {
            return mcpError(id, -32001, 'Recording is not in this token\'s workspace', corsHeaders);
          }
        }

        // Fetch core recording info
        const { data: recording, error: recError } = await supabase
          .from('recordings')
          .select('id, title, summary, recording_start_time, recording_end_time, duration, source_app, global_tags, source_metadata')
          .eq('id', recordingId)
          .maybeSingle();

        if (recError || !recording) {
          return mcpError(id, -32603, 'Failed to fetch recording', corsHeaders);
        }

        // Fetch speakers (call_participants)
        const { data: participants } = await supabase
          .from('call_participants')
          .select('name, email, role')
          .eq('recording_id', recordingId)
          .order('name');

        // Fetch tags (call_tag_assignments)
        const { data: tagAssignments } = await supabase
          .from('call_tag_assignments')
          .select('tag:personal_tags(name, color)')
          .eq('recording_id', recordingId);

        // Build context document
        const date = recording.recording_start_time
          ? new Date(recording.recording_start_time).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
          : 'Unknown date';

        const durationStr = recording.duration
          ? `${Math.floor(recording.duration / 3600) > 0 ? `${Math.floor(recording.duration / 3600)}h ` : ''}${Math.floor((recording.duration % 3600) / 60)}m ${recording.duration % 60}s`
          : 'Unknown';

        const speakersStr =
          participants && participants.length > 0
            ? participants
                .map((p: { name: string | null; email: string | null; role: string | null }) =>
                  `  - ${p.name || p.email || 'Unknown'}${p.role ? ` (${p.role})` : ''}`,
                )
                .join('\n')
            : '  - No participant data';

        type TagAssignment = { tag: { name: string; color: string | null } | null };
        const tagsStr =
          tagAssignments && tagAssignments.length > 0
            ? (tagAssignments as TagAssignment[])
                .filter((t) => t.tag)
                .map((t) => `  - ${t.tag!.name}`)
                .join('\n')
            : '  - No tags';

        const globalTagsStr =
          recording.global_tags && Array.isArray(recording.global_tags) && recording.global_tags.length > 0
            ? (recording.global_tags as string[]).join(', ')
            : null;

        const context = [
          `# ${recording.title || 'Untitled Call'}`,
          ``,
          `## Metadata`,
          `- **Date**: ${date}`,
          `- **Duration**: ${durationStr}`,
          `- **Source**: ${recording.source_app || 'unknown'}`,
          `- **Recording ID**: ${recording.id}`,
          ``,
          `## Summary`,
          recording.summary || 'No summary available.',
          ``,
          `## Speakers`,
          speakersStr,
          ``,
          `## Tags`,
          tagsStr,
          globalTagsStr ? `\n## Auto-tags\n${globalTagsStr}` : '',
        ]
          .filter((line) => line !== null)
          .join('\n');

        return mcpOk(id, context);
      }

      case 'callvault/list_workspaces': {
        let workspacesQuery = supabase
          .from('workspaces')
          .select('id, name, workspace_type, created_at')
          .order('name');

        if (mcpToken.scope === 'workspace') {
          // Token is scoped to a single workspace
          workspacesQuery = workspacesQuery.eq('id', mcpToken.workspace_id!);
        } else {
          // Org-scoped: return all workspaces in the org that this user belongs to
          workspacesQuery = workspacesQuery
            .eq('organization_id', mcpToken.org_id!)
            .in(
              'id',
              // Sub-filter to workspaces the user is a member of
              (
                await supabase
                  .from('workspace_memberships')
                  .select('workspace_id')
                  .eq('user_id', mcpToken.user_id)
              ).data?.map((m: { workspace_id: string }) => m.workspace_id) ?? [],
            );
        }

        const { data: workspaces, error: wsError } = await workspacesQuery;

        if (wsError) {
          return mcpError(id, -32603, `Failed to list workspaces: ${wsError.message}`, corsHeaders);
        }

        if (!workspaces || workspaces.length === 0) {
          return mcpOk(id, 'No workspaces found.');
        }

        type WsRow = { id: string; name: string; workspace_type: string | null; created_at: string };
        return mcpOk(
          id,
          (workspaces as WsRow[])
            .map((w) => `ID: ${w.id}\nName: ${w.name}\nType: ${w.workspace_type || 'standard'}`)
            .join('\n\n---\n\n'),
        );
      }

      default: {
        return mcpError(id, -32601, `Method not found: ${method}`, corsHeaders);
      }
    }
  } catch (err) {
    console.error('mcp-server unhandled error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return mcpError(id, -32603, message, corsHeaders);
  }
});
