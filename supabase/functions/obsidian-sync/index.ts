/**
 * obsidian-sync Edge Function
 *
 * REST API for the CallVault Obsidian plugin to pull calls and transcripts.
 * Authentication: Bearer token looked up in mcp_tokens WHERE token_source = 'obsidian'.
 *
 * Routes:
 *   GET /obsidian-sync/calls                        — list calls with cursor
 *   GET /obsidian-sync/calls/{recording_id}/transcript — get markdown transcript
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';

// ─── CORS ─────────────────────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

// ─── Response helpers ─────────────────────────────────────────────────────────

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResponse(message: string, status: number): Response {
  return jsonResponse({ error: message }, status);
}

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const callsQuerySchema = z.object({
  since: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v).toISOString() : new Date(0).toISOString()))
    .refine((v) => !isNaN(Date.parse(v)), { message: 'since must be a valid ISO 8601 timestamp' }),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? Math.min(100, Math.max(1, parseInt(v, 10))) : 50))
    .refine((v) => !isNaN(v), { message: 'limit must be a number' }),
  workspace_id: z.string().uuid({ message: 'workspace_id must be a valid UUID' }).optional(),
});

// ─── Token auth ───────────────────────────────────────────────────────────────

interface ObsidianTokenRow {
  id: string;
  user_id: string;
  org_id: string;
}

async function authenticateObsidianToken(
  req: Request,
  supabase: ReturnType<typeof createClient>,
): Promise<{ tokenRow: ObsidianTokenRow } | Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return errorResponse('Missing or invalid Authorization header', 401);
  }

  const rawToken = authHeader.replace(/^bearer\s+/i, '').trim();
  if (!rawToken) {
    return errorResponse('Missing token', 401);
  }

  const { data: tokenRow, error: tokenError } = await supabase
    .from('mcp_tokens')
    .select('id, user_id, org_id')
    .eq('token', rawToken)
    .eq('token_source', 'obsidian')
    .is('revoked_at', null)
    .maybeSingle();

  if (tokenError || !tokenRow) {
    return errorResponse('Invalid or revoked Obsidian token', 401);
  }

  // Update last_used_at asynchronously — don't block the response
  supabase
    .from('mcp_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', tokenRow.id)
    .then(() => {
      /* fire-and-forget */
    });

  return { tokenRow: tokenRow as ObsidianTokenRow };
}

// ─── Route: GET /obsidian-sync/calls ─────────────────────────────────────────

async function handleListCalls(
  req: Request,
  supabase: ReturnType<typeof createClient>,
  orgId: string,
): Promise<Response> {
  const url = new URL(req.url);

  // Parse + validate query params
  const parseResult = callsQuerySchema.safeParse({
    since: url.searchParams.get('since') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
    workspace_id: url.searchParams.get('workspace_id') ?? undefined,
  });

  if (!parseResult.success) {
    const message = parseResult.error.errors[0]?.message ?? 'Invalid query parameters';
    return errorResponse(message, 400);
  }

  const { since, limit, workspace_id } = parseResult.data;

  // Resolve workspace IDs (either the requested one or all org workspaces)
  let workspaceIds: string[];

  if (workspace_id) {
    // Verify workspace belongs to the token's org
    const { data: wsCheck } = await supabase
      .from('workspaces')
      .select('id')
      .eq('id', workspace_id)
      .eq('organization_id', orgId)
      .maybeSingle();

    if (!wsCheck) {
      return errorResponse('workspace_id not found in this organization', 404);
    }
    workspaceIds = [workspace_id];
  } else {
    const { data: orgWs, error: wsError } = await supabase
      .from('workspaces')
      .select('id')
      .eq('organization_id', orgId);

    if (wsError) {
      console.error('obsidian-sync: failed to resolve org workspaces', wsError);
      return errorResponse('Failed to resolve organization workspaces', 500);
    }

    workspaceIds = (orgWs ?? []).map((w: { id: string }) => w.id);
  }

  if (workspaceIds.length === 0) {
    return jsonResponse({ calls: [], next_since: since, total: 0 });
  }

  // Fetch workspace_entries → recordings with cursor filter
  const { data: entries, error: listError } = await supabase
    .from('workspace_entries')
    .select(`
      recording_id,
      workspace_id,
      recordings (
        id,
        title,
        recording_start_time,
        duration,
        source_app,
        summary,
        full_transcript
      )
    `)
    .in('workspace_id', workspaceIds)
    .gte('recordings.recording_start_time', since)
    .order('recordings(recording_start_time)', { ascending: false })
    .limit(limit);

  if (listError) {
    console.error('obsidian-sync: list calls error', listError);
    return errorResponse(`Failed to list calls: ${listError.message}`, 500);
  }

  // Join workspace names for context
  const { data: workspaceRows } = await supabase
    .from('workspaces')
    .select('id, name')
    .in('id', workspaceIds);

  const workspaceNameMap = new Map(
    (workspaceRows ?? []).map((w: { id: string; name: string }) => [w.id, w.name]),
  );

  type EntryRow = {
    recording_id: string;
    workspace_id: string;
    recordings: {
      id: string;
      title: string | null;
      recording_start_time: string | null;
      duration: number | null;
      source_app: string | null;
      summary: string | null;
      full_transcript: string | null;
    } | null;
  };

  const validEntries = ((entries ?? []) as unknown as EntryRow[]).filter(
    (e) => e.recordings && e.recordings.recording_start_time && new Date(e.recordings.recording_start_time) > new Date(since),
  );

  const calls = validEntries.map((e) => {
    const r = e.recordings!;
    return {
      id: r.id,
      title: r.title ?? 'Untitled',
      date: r.recording_start_time,
      duration_seconds: r.duration ?? null,
      source: r.source_app ?? 'unknown',
      summary: r.summary ?? null,
      has_transcript: !!r.full_transcript,
      workspace_id: e.workspace_id,
      workspace_name: workspaceNameMap.get(e.workspace_id) ?? null,
    };
  });

  // Cursor = MAX recording_start_time of returned rows
  const maxDate = calls.reduce<string | null>((acc, c) => {
    if (!c.date) return acc;
    if (!acc) return c.date;
    return c.date > acc ? c.date : acc;
  }, null);

  const nextSince = maxDate ?? new Date().toISOString();

  return jsonResponse({ calls, next_since: nextSince, total: calls.length });
}

// ─── Route: GET /obsidian-sync/calls/{id}/transcript ─────────────────────────

async function handleGetTranscript(
  recordingId: string,
  supabase: ReturnType<typeof createClient>,
  orgId: string,
): Promise<Response> {
  // Validate it's a UUID
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(recordingId)) {
    return errorResponse('recording_id must be a valid UUID', 400);
  }

  // Verify recording belongs to a workspace in this org
  const { data: orgWs, error: wsError } = await supabase
    .from('workspaces')
    .select('id')
    .eq('organization_id', orgId);

  if (wsError) {
    console.error('obsidian-sync: failed to resolve org workspaces for transcript', wsError);
    return errorResponse('Failed to resolve organization workspaces', 500);
  }

  const orgWorkspaceIds = (orgWs ?? []).map((w: { id: string }) => w.id);
  if (orgWorkspaceIds.length === 0) {
    return errorResponse('Recording not found or not accessible', 404);
  }

  const { data: access } = await supabase
    .from('workspace_entries')
    .select('recording_id, workspace_id')
    .eq('recording_id', recordingId)
    .in('workspace_id', orgWorkspaceIds)
    .maybeSingle();

  if (!access) {
    return errorResponse('Recording not found or not accessible', 404);
  }

  // Fetch workspace name for markdown context
  const { data: workspaceRow } = await supabase
    .from('workspaces')
    .select('name')
    .eq('id', access.workspace_id)
    .maybeSingle();

  // Fetch recording details
  const { data: recording, error: recError } = await supabase
    .from('recordings')
    .select('id, title, full_transcript, recording_start_time, duration, source_app, summary')
    .eq('id', recordingId)
    .maybeSingle();

  if (recError || !recording) {
    console.error('obsidian-sync: failed to fetch recording', recError);
    return errorResponse('Failed to fetch recording', 500);
  }

  // Build Obsidian-friendly markdown note
  const title = recording.title ?? 'Untitled Call';
  const dateRaw = recording.recording_start_time
    ? new Date(recording.recording_start_time)
    : null;

  const dateDisplay = dateRaw
    ? dateRaw.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Unknown date';

  const dateISO = dateRaw ? dateRaw.toISOString().split('T')[0] : '';

  const durationMin = recording.duration
    ? Math.round(recording.duration / 60)
    : null;
  const durationDisplay = durationMin !== null ? `${durationMin} min` : 'Unknown duration';

  const source = recording.source_app ?? 'unknown';
  const workspace = workspaceRow?.name ?? 'Unknown workspace';

  // YAML frontmatter + markdown body
  const frontmatter = [
    '---',
    `callvault_id: "${recording.id}"`,
    `date: "${dateISO}"`,
    `duration_min: ${durationMin ?? 'null'}`,
    `source: "${source}"`,
    `workspace: "${workspace}"`,
    `synced_at: "${new Date().toISOString()}"`,
    '---',
  ].join('\n');

  const summarySection =
    recording.summary
      ? `\n## Summary\n\n${recording.summary}\n`
      : '';

  const transcriptSection = recording.full_transcript
    ? `\n## Transcript\n\n${recording.full_transcript}`
    : '\n## Transcript\n\nTranscript not available.';

  const markdown = [
    frontmatter,
    '',
    `# ${title}`,
    '',
    `**Date:** ${dateDisplay}`,
    `**Duration:** ${durationDisplay}`,
    `**Source:** ${source}`,
    `**Workspace:** ${workspace}`,
    summarySection,
    transcriptSection,
  ].join('\n');

  return jsonResponse({
    id: recording.id,
    title,
    date: recording.recording_start_time,
    markdown,
  });
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only GET requests are supported
  if (req.method !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate Obsidian token (NOT a Supabase JWT)
    const authResult = await authenticateObsidianToken(req, supabase);
    if (authResult instanceof Response) return authResult;
    const { tokenRow } = authResult;

    // Route matching via pathname
    const url = new URL(req.url);
    const pathname = url.pathname;

    // Strip the function prefix (/functions/v1/obsidian-sync or just /obsidian-sync)
    // so we can match on the resource path consistently
    const stripped = pathname.replace(/^\/(functions\/v1\/)?obsidian-sync/, '');

    // Route 1: GET /calls
    if (stripped === '/calls' || stripped === '/calls/') {
      return await handleListCalls(req, supabase, tokenRow.org_id);
    }

    // Route 2: GET /calls/{uuid}/transcript
    const transcriptMatch = stripped.match(
      /^\/calls\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/transcript$/i,
    );
    if (transcriptMatch) {
      const recordingId = transcriptMatch[1];
      return await handleGetTranscript(recordingId, supabase, tokenRow.org_id);
    }

    return errorResponse('Not found', 404);
  } catch (error) {
    console.error('obsidian-sync: unhandled error', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return errorResponse(message, 500);
  }
});
