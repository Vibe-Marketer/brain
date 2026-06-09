/**
 * obsidian-sync Edge Function
 *
 * REST API for the CallVault Obsidian daemon to pull calls and transcripts.
 * Authentication: Bearer token looked up in mcp_tokens WHERE token_source = 'obsidian'.
 *
 * Routes:
 *   GET /obsidian-sync/calls                          — list calls with cursor (ASC, has_more)
 *   GET /obsidian-sync/calls/{recording_id}/transcript — get single Obsidian-format note
 *   GET /obsidian-sync/export                         — bulk zip of all calls as .md files
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';
import JSZip from 'https://esm.sh/jszip@3.10.1';

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
  include_transcript: z.string().optional().transform((v) => v === 'true'),
  excluded_workspace_ids: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : [])),
});

const exportQuerySchema = z.object({
  since: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v).toISOString() : new Date(0).toISOString()))
    .refine((v) => !isNaN(Date.parse(v)), { message: 'since must be a valid ISO 8601 timestamp' }),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? Math.min(1000, Math.max(1, parseInt(v, 10))) : 500))
    .refine((v) => !isNaN(v), { message: 'limit must be a number' }),
  workspace_id: z.string().uuid({ message: 'workspace_id must be a valid UUID' }).optional(),
  excluded_workspace_ids: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : [])),
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

  supabase
    .from('mcp_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', tokenRow.id)
    .then(() => { /* fire-and-forget */ });

  return { tokenRow: tokenRow as ObsidianTokenRow };
}

// ─── Obsidian markdown builder ────────────────────────────────────────────────

interface RecordingData {
  id: string;
  title: string | null;
  recording_start_time: string | null;
  duration: number | null;
  source_app: string | null;
  summary: string | null;
  full_transcript: string | null;
}

interface ParticipantRow {
  name: string | null;
  email: string | null;
  participant_type: string;
}

function slugifyTitle(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 60)
      .replace(/-$/, '') || 'untitled'
  );
}

function sanitizePath(s: string): string {
  return s.replace(/[/\\:?*"<>|]/g, '-').trim() || 'Unknown';
}

function buildVaultPath(
  orgName: string,
  workspaceName: string,
  date: string,
  title: string,
): string {
  const dateStr = date.slice(0, 10);
  return `CallVault/${sanitizePath(orgName)}/${sanitizePath(workspaceName)}/${dateStr}-${slugifyTitle(title)}.md`;
}

function buildTags(source: string, workspace: string, dateISO: string): string[] {
  const tags: string[] = ['callvault'];
  if (source && source !== 'unknown') {
    tags.push(`source/${source.toLowerCase().replace(/\s+/g, '-')}`);
  }
  if (workspace && workspace !== 'Unknown workspace') {
    tags.push(`workspace/${workspace.toLowerCase().replace(/[\s/]+/g, '-')}`);
  }
  if (dateISO) {
    const [year, month] = dateISO.split('-');
    if (year && month) tags.push(`${year}/${month}`);
  }
  return tags;
}

function buildObsidianNote(
  recording: RecordingData,
  workspaceName: string,
  syncedAt: string,
  participants: ParticipantRow[] = [],
  orgName = 'Unknown',
): string {
  const title = recording.title ?? 'Untitled Call';
  const dateRaw = recording.recording_start_time
    ? new Date(recording.recording_start_time)
    : null;

  const dateISO = dateRaw ? dateRaw.toISOString().split('T')[0] : '';
  const dateDisplay = dateRaw
    ? dateRaw.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Unknown date';

  const durationMin = recording.duration ? Math.round(recording.duration / 60) : null;
  const durationDisplay = durationMin !== null ? `${durationMin} min` : 'Unknown duration';
  const source = recording.source_app ?? 'unknown';
  const tags = buildTags(source, workspaceName, dateISO);

  const vaultPath = dateISO
    ? buildVaultPath(orgName, workspaceName, dateISO, title)
    : `CallVault/${sanitizePath(orgName)}/${sanitizePath(workspaceName)}/undated-${slugifyTitle(title)}.md`;

  const wordCount = recording.full_transcript
    ? recording.full_transcript.split(/\s+/).filter(Boolean).length
    : 0;

  const speakers = participants.filter((p) => p.participant_type !== 'host' || p.name);
  const participantNames = speakers.filter((p) => p.name).map((p) => p.name as string);

  const frontmatterLines = [
    '---',
    `callvault_id: "${recording.id}"`,
    `title: "${title.replace(/"/g, '\\"')}"`,
    dateISO ? `date: ${dateISO}` : 'date: null',
    `date_time: "${recording.recording_start_time ?? ''}"`,
    `duration_min: ${durationMin ?? 'null'}`,
    `source: "${source}"`,
    `organization: "${orgName.replace(/"/g, '\\"')}"`,
    `workspace: "${workspaceName}"`,
    `vault_path: "${vaultPath}"`,
    `word_count: ${wordCount}`,
    'tags:',
    ...tags.map((t) => `  - ${t}`),
    participantNames.length > 0 ? 'participants:' : null,
    ...participantNames.map((n) => `  - "[[${n}]]"`),
    `has_transcript: ${!!recording.full_transcript}`,
    `synced_at: "${syncedAt}"`,
    '---',
  ].filter((l) => l !== null);

  const summarySection = recording.summary ? `\n## Summary\n\n${recording.summary}\n` : '';

  const participantsSection =
    speakers.length > 0
      ? `\n## Participants\n\n${speakers
          .map((p) => {
            const label = p.name ?? p.email ?? 'Unknown';
            return p.email && p.name ? `- ${p.name} (${p.email})` : `- ${label}`;
          })
          .join('\n')}\n`
      : '';

  const transcriptSection = recording.full_transcript
    ? `\n## Transcript\n\n${recording.full_transcript}`
    : '\n## Transcript\n\nTranscript not available.';

  return [
    frontmatterLines.join('\n'),
    '',
    `# ${title}`,
    '',
    `**Date:** ${dateDisplay}`,
    `**Duration:** ${durationDisplay}`,
    `**Source:** ${source}`,
    `**Workspace:** ${workspaceName}`,
    summarySection,
    participantsSection,
    transcriptSection,
  ].join('\n');
}

// ─── Shared: fetch participants for recording(s) ─────────────────────────────

async function fetchParticipants(
  supabase: ReturnType<typeof createClient>,
  recordingIds: string[],
): Promise<Map<string, ParticipantRow[]>> {
  if (recordingIds.length === 0) return new Map();
  const { data } = await supabase
    .from('call_participants')
    .select('recording_id, name, email, participant_type')
    .in('recording_id', recordingIds);

  const map = new Map<string, ParticipantRow[]>();
  for (const row of (data ?? []) as (ParticipantRow & { recording_id: string })[]) {
    if (!map.has(row.recording_id)) map.set(row.recording_id, []);
    map.get(row.recording_id)!.push({
      name: row.name,
      email: row.email,
      participant_type: row.participant_type,
    });
  }
  return map;
}

// ─── Shared: resolve org workspace IDs ───────────────────────────────────────

async function resolveWorkspaceIds(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  workspaceId?: string,
  excludedIds: string[] = [],
): Promise<{ ids: string[]; nameMap: Map<string, string>; orgName: string } | Response> {
  const { data: orgRow } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', orgId)
    .maybeSingle();
  const orgName = (orgRow as { name: string } | null)?.name ?? 'Unknown';

  if (workspaceId) {
    const { data: wsCheck } = await supabase
      .from('workspaces')
      .select('id, name')
      .eq('id', workspaceId)
      .eq('organization_id', orgId)
      .maybeSingle();

    if (!wsCheck) {
      return errorResponse('workspace_id not found in this organization', 404);
    }
    return {
      ids: [workspaceId],
      nameMap: new Map([[workspaceId, (wsCheck as { id: string; name: string }).name]]),
      orgName,
    };
  }

  const { data: orgWs, error: wsError } = await supabase
    .from('workspaces')
    .select('id, name')
    .eq('organization_id', orgId);

  if (wsError) {
    console.error('obsidian-sync: failed to resolve org workspaces', wsError);
    return errorResponse('Failed to resolve organization workspaces', 500);
  }

  const rows = (orgWs ?? []) as { id: string; name: string }[];
  const filteredRows =
    excludedIds.length > 0 ? rows.filter((w) => !excludedIds.includes(w.id)) : rows;

  return {
    ids: filteredRows.map((w) => w.id),
    nameMap: new Map(filteredRows.map((w) => [w.id, w.name])),
    orgName,
  };
}

// ─── Route: GET /obsidian-sync/calls ─────────────────────────────────────────

async function handleListCalls(
  req: Request,
  supabase: ReturnType<typeof createClient>,
  orgId: string,
): Promise<Response> {
  const url = new URL(req.url);

  const parseResult = callsQuerySchema.safeParse({
    since: url.searchParams.get('since') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
    workspace_id: url.searchParams.get('workspace_id') ?? undefined,
    include_transcript: url.searchParams.get('include_transcript') ?? undefined,
    excluded_workspace_ids: url.searchParams.get('excluded_workspace_ids') ?? undefined,
  });

  if (!parseResult.success) {
    return errorResponse(parseResult.error.errors[0]?.message ?? 'Invalid query parameters', 400);
  }

  const { since, limit, workspace_id, include_transcript, excluded_workspace_ids } =
    parseResult.data;

  const wsResult = await resolveWorkspaceIds(
    supabase,
    orgId,
    workspace_id,
    excluded_workspace_ids,
  );
  if (wsResult instanceof Response) return wsResult;
  const { ids: workspaceIds, nameMap: workspaceNameMap, orgName } = wsResult;

  if (workspaceIds.length === 0) {
    return jsonResponse({ calls: [], next_since: since, has_more: false, total: 0 });
  }

  // Cap at 25 per page when embedding transcripts inline
  const effectiveLimit = include_transcript ? Math.min(limit, 25) : limit;
  // Fetch one extra row to detect has_more without a separate count query
  const fetchLimit = effectiveLimit + 1;

  const { data: entries, error: listError } = await supabase
    .from('workspace_entries')
    .select(
      `
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
    `,
    )
    .in('workspace_id', workspaceIds)
    .gte('recordings.recording_start_time', since)
    .order('recordings(recording_start_time)', { ascending: true })
    .limit(fetchLimit);

  if (listError) {
    console.error('obsidian-sync: list calls error', listError);
    return errorResponse(`Failed to list calls: ${listError.message}`, 500);
  }

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
    (e) =>
      e.recordings &&
      e.recordings.recording_start_time &&
      new Date(e.recordings.recording_start_time) > new Date(since),
  );

  const has_more = validEntries.length > effectiveLimit;
  const pageEntries = has_more ? validEntries.slice(0, effectiveLimit) : validEntries;

  const syncedAt = new Date().toISOString();

  let participantMap = new Map<string, ParticipantRow[]>();
  if (include_transcript && pageEntries.length > 0) {
    const ids = pageEntries.map((e) => e.recordings!.id);
    participantMap = await fetchParticipants(supabase, ids);
  }

  const calls = pageEntries.map((e) => {
    const r = e.recordings!;
    const workspaceName = workspaceNameMap.get(e.workspace_id) ?? 'Unknown workspace';
    const vaultPath = r.recording_start_time
      ? buildVaultPath(orgName, workspaceName, r.recording_start_time, r.title ?? 'untitled')
      : null;

    const base = {
      id: r.id,
      title: r.title ?? 'Untitled',
      date: r.recording_start_time,
      duration_seconds: r.duration ?? null,
      source: r.source_app ?? 'unknown',
      summary: r.summary ?? null,
      has_transcript: !!r.full_transcript,
      workspace_id: e.workspace_id,
      workspace_name: workspaceName,
      org_name: orgName,
      vault_path: vaultPath,
    };

    if (include_transcript) {
      const participants = participantMap.get(r.id) ?? [];
      const markdown = buildObsidianNote(
        r as RecordingData,
        workspaceName,
        syncedAt,
        participants,
        orgName,
      );
      return { ...base, markdown };
    }

    return base;
  });

  const maxDate = pageEntries.reduce<string | null>((acc, e) => {
    const d = e.recordings?.recording_start_time;
    if (!d) return acc;
    if (!acc) return d;
    return d > acc ? d : acc;
  }, null);

  return jsonResponse({
    calls,
    next_since: maxDate ?? new Date().toISOString(),
    has_more,
    total: calls.length,
  });
}

// ─── Route: GET /obsidian-sync/calls/{id}/transcript ─────────────────────────

async function handleGetTranscript(
  recordingId: string,
  supabase: ReturnType<typeof createClient>,
  orgId: string,
): Promise<Response> {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(recordingId)) {
    return errorResponse('recording_id must be a valid UUID', 400);
  }

  const wsResult = await resolveWorkspaceIds(supabase, orgId);
  if (wsResult instanceof Response) return wsResult;
  const { ids: orgWorkspaceIds, orgName } = wsResult;

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

  const { data: workspaceRow } = await supabase
    .from('workspaces')
    .select('name')
    .eq('id', (access as { recording_id: string; workspace_id: string }).workspace_id)
    .maybeSingle();

  const { data: recording, error: recError } = await supabase
    .from('recordings')
    .select('id, title, full_transcript, recording_start_time, duration, source_app, summary')
    .eq('id', recordingId)
    .maybeSingle();

  if (recError || !recording) {
    console.error('obsidian-sync: failed to fetch recording', recError);
    return errorResponse('Failed to fetch recording', 500);
  }

  const workspaceName = (workspaceRow as { name: string } | null)?.name ?? 'Unknown workspace';
  const syncedAt = new Date().toISOString();
  const participantMap = await fetchParticipants(supabase, [recordingId]);
  const markdown = buildObsidianNote(
    recording as RecordingData,
    workspaceName,
    syncedAt,
    participantMap.get(recordingId) ?? [],
    orgName,
  );

  return jsonResponse({
    id: recording.id,
    title: (recording as RecordingData).title ?? 'Untitled Call',
    date: (recording as RecordingData).recording_start_time,
    markdown,
  });
}

// ─── Route: GET /obsidian-sync/export ────────────────────────────────────────

async function handleExportZip(
  req: Request,
  supabase: ReturnType<typeof createClient>,
  orgId: string,
): Promise<Response> {
  const url = new URL(req.url);

  const parseResult = exportQuerySchema.safeParse({
    since: url.searchParams.get('since') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
    workspace_id: url.searchParams.get('workspace_id') ?? undefined,
    excluded_workspace_ids: url.searchParams.get('excluded_workspace_ids') ?? undefined,
  });

  if (!parseResult.success) {
    return errorResponse(parseResult.error.errors[0]?.message ?? 'Invalid query parameters', 400);
  }

  const { since, limit, workspace_id, excluded_workspace_ids } = parseResult.data;

  const wsResult = await resolveWorkspaceIds(
    supabase,
    orgId,
    workspace_id,
    excluded_workspace_ids,
  );
  if (wsResult instanceof Response) return wsResult;
  const { ids: workspaceIds, nameMap: workspaceNameMap, orgName } = wsResult;

  if (workspaceIds.length === 0) {
    return errorResponse('No workspaces found in this organization', 404);
  }

  const { data: entries, error: listError } = await supabase
    .from('workspace_entries')
    .select(
      `
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
    `,
    )
    .in('workspace_id', workspaceIds)
    .gte('recordings.recording_start_time', since)
    .order('recordings(recording_start_time)', { ascending: true })
    .limit(limit);

  if (listError) {
    console.error('obsidian-sync: export query error', listError);
    return errorResponse(`Failed to fetch calls: ${listError.message}`, 500);
  }

  type EntryRow = {
    recording_id: string;
    workspace_id: string;
    recordings: RecordingData | null;
  };

  const validEntries = ((entries ?? []) as unknown as EntryRow[]).filter(
    (e) =>
      e.recordings &&
      e.recordings.recording_start_time &&
      new Date(e.recordings.recording_start_time) > new Date(since),
  );

  if (validEntries.length === 0) {
    return errorResponse('No calls found for the given parameters', 404);
  }

  const syncedAt = new Date().toISOString();
  const zip = new JSZip();

  const allRecordingIds = validEntries.map((e) => e.recordings!.id);
  const participantMap = await fetchParticipants(supabase, allRecordingIds);

  const usedFilenames = new Set<string>();

  for (const entry of validEntries) {
    const rec = entry.recordings!;
    const workspaceName = workspaceNameMap.get(entry.workspace_id) ?? 'Unknown workspace';
    const dateISO = rec.recording_start_time
      ? new Date(rec.recording_start_time).toISOString().split('T')[0]
      : 'undated';

    const baseSlug = `${dateISO}-${slugifyTitle(rec.title ?? 'untitled')}`;
    let filename = `${baseSlug}.md`;

    let suffix = 1;
    while (usedFilenames.has(filename)) {
      filename = `${baseSlug}-${suffix}.md`;
      suffix++;
    }
    usedFilenames.add(filename);

    const participants = participantMap.get(rec.id) ?? [];
    const markdown = buildObsidianNote(rec, workspaceName, syncedAt, participants, orgName);
    zip.file(
      `CallVault/${sanitizePath(orgName)}/${sanitizePath(workspaceName)}/${filename}`,
      markdown,
    );
  }

  const zipBuffer = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  const exportDate = new Date().toISOString().split('T')[0];
  const zipFilename = `callvault-export-${exportDate}.zip`;

  return new Response(zipBuffer, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${zipFilename}"`,
      'X-Export-Count': String(validEntries.length),
    },
  });
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authResult = await authenticateObsidianToken(req, supabase);
    if (authResult instanceof Response) return authResult;
    const { tokenRow } = authResult;

    const url = new URL(req.url);
    const pathname = url.pathname;
    const stripped = pathname.replace(/^\/(functions\/v1\/)?obsidian-sync/, '');

    if (stripped === '/calls' || stripped === '/calls/') {
      return await handleListCalls(req, supabase, tokenRow.org_id);
    }

    const transcriptMatch = stripped.match(
      /^\/calls\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/transcript$/i,
    );
    if (transcriptMatch) {
      return await handleGetTranscript(transcriptMatch[1], supabase, tokenRow.org_id);
    }

    if (stripped === '/export' || stripped === '/export.zip' || stripped === '/export/') {
      return await handleExportZip(req, supabase, tokenRow.org_id);
    }

    return errorResponse('Not found', 404);
  } catch (error) {
    console.error('obsidian-sync: unhandled error', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return errorResponse(message, 500);
  }
});
