/**
 * routes/calls.ts — GET /v1/calls and GET /v1/calls/{id} handlers
 *
 * Uses workspace_entries join for workspace scoping (canonical pattern from obsidian-sync).
 * Workspace tokens are locked to their workspace; org tokens can filter by workspace_id.
 *
 * Response envelope: { data: Call[], pagination: PaginationMeta }
 *
 * Security (T-06.2-05): all calls are scoped through token org/workspace context —
 * never cross organization or workspace boundaries.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { ApiTokenContext } from '../auth.ts';
import { jsonOk, jsonItem, jsonError, type PaginationMeta } from '../responses.ts';

export interface CallItem {
  id: string;
  title: string;
  date: string | null;
  duration_seconds: number | null;
  source: string;
  summary: string | null;
  has_transcript: boolean;
  workspace_id: string;
}

export interface CallDetailItem extends CallItem {
  transcript: string | null;
  transcript_segments: unknown;
  participants: Array<{
    name: string | null;
    email: string | null;
    participant_type: string;
  }>;
}

function formatTranscriptSegments(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const lines = value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const text = typeof row.text === 'string' ? row.text.trim() : '';
      if (!text) return null;
      const timestamp = typeof row.timestamp === 'string' && row.timestamp.trim()
        ? `[${row.timestamp.trim()}] `
        : '';
      const speakerName = typeof row.speaker_name === 'string' ? row.speaker_name.trim() : '';
      const speakerEmail = typeof row.speaker_email === 'string' ? row.speaker_email.trim() : '';
      if (!speakerName) return `${timestamp}${text}`;
      const speaker = speakerEmail ? `${speakerName} (${speakerEmail})` : speakerName;
      return `${timestamp}${speaker}: ${text}`;
    })
    .filter((line): line is string => Boolean(line));

  return lines.length > 0 ? lines.join('\n\n') : null;
}

/**
 * Resolve the workspace IDs the token is authorized to access.
 * Returns null Response on error, or string[] on success.
 */
async function resolveAuthorizedWorkspaceIds(
  supabase: ReturnType<typeof createClient>,
  tokenCtx: ApiTokenContext,
  requestedWorkspaceId?: string | null,
): Promise<string[] | Response> {
  if (tokenCtx.scope === 'workspace') {
    // Workspace token: locked to token's workspace only
    const wsId = tokenCtx.workspace_id!;
    if (requestedWorkspaceId && requestedWorkspaceId !== wsId) {
      return jsonError(403, 'WORKSPACE_MISMATCH', 'This token is scoped to a different workspace');
    }
    return [wsId];
  }

  // Organization token
  if (requestedWorkspaceId) {
    // Validate the requested workspace belongs to the token's org
    const { data: wsCheck } = await supabase
      .from('workspaces')
      .select('id')
      .eq('id', requestedWorkspaceId)
      .eq('organization_id', tokenCtx.org_id)
      .maybeSingle();

    if (!wsCheck) {
      return jsonError(403, 'WORKSPACE_NOT_FOUND', 'workspace_id not found in this organization');
    }
    return [requestedWorkspaceId];
  }

  // Return all org workspaces
  const { data: orgWs, error: wsError } = await supabase
    .from('workspaces')
    .select('id')
    .eq('organization_id', tokenCtx.org_id);

  if (wsError) {
    console.error('callvault-api: failed to resolve org workspaces', wsError);
    return jsonError(500, 'INTERNAL_ERROR', 'Failed to resolve organization workspaces');
  }

  return (orgWs ?? []).map((w: { id: string }) => w.id);
}

export async function handleListCalls(
  req: Request,
  supabase: ReturnType<typeof createClient>,
  tokenCtx: ApiTokenContext,
): Promise<Response> {
  const url = new URL(req.url);
  const limitParam = url.searchParams.get('limit');
  const limit = limitParam ? Math.min(100, Math.max(1, parseInt(limitParam, 10))) : 20;
  const cursor = url.searchParams.get('cursor') ?? undefined;
  const workspaceId = url.searchParams.get('workspace_id') ?? undefined;

  const wsIds = await resolveAuthorizedWorkspaceIds(supabase, tokenCtx, workspaceId);
  if (wsIds instanceof Response) return wsIds;

  if (wsIds.length === 0) {
    return jsonOk<CallItem>([], { count: 0, has_more: false, next_cursor: null, limit });
  }

  let query = supabase
    .from('workspace_entries')
    .select(
      `
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
    .in('workspace_id', wsIds)
    .order('created_at', { ascending: false })
    .limit(limit + 1); // extra row for has_more detection

  if (cursor) {
    // Cursor is the recording_id of the last item (used for keyset pagination)
    // Since we order by created_at DESC, we use a timestamp cursor approach.
    // Encode as ISO timestamp of the last item's recording_start_time.
    query = query.lt('created_at', cursor);
  }

  const { data: entries, error: listError } = await query;

  if (listError) {
    console.error('callvault-api list calls error:', listError);
    return jsonError(500, 'INTERNAL_ERROR', `Failed to list calls: ${listError.message}`);
  }

  type EntryRow = {
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

  const all = ((entries ?? []) as unknown as EntryRow[]).filter((e) => e.recordings !== null);
  const has_more = all.length > limit;
  const page = has_more ? all.slice(0, limit) : all;

  const calls: CallItem[] = page.map((e) => {
    const r = e.recordings!;
    return {
      id: r.id,
      title: r.title ?? 'Untitled',
      date: r.recording_start_time,
      duration_seconds: r.duration ?? null,
      source: r.source_app ?? 'unknown',
      summary: r.summary ?? null,
      has_transcript: !!(r.full_transcript),
      workspace_id: e.workspace_id,
    };
  });

  // Next cursor is the created_at of the last entry (opaque to client)
  const next_cursor = has_more && page.length > 0
    ? (page[page.length - 1]?.recordings?.recording_start_time ?? null)
    : null;

  const pagination: PaginationMeta = {
    count: calls.length,
    has_more,
    next_cursor,
    limit,
  };

  return jsonOk<CallItem>(calls, pagination);
}

export async function handleGetCall(
  recordingId: string,
  req: Request,
  supabase: ReturnType<typeof createClient>,
  tokenCtx: ApiTokenContext,
): Promise<Response> {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(recordingId)) {
    return jsonError(400, 'INVALID_ID', 'recording_id must be a valid UUID');
  }

  // Resolve authorized workspace IDs for this token (T-06.2-05)
  const wsIds = await resolveAuthorizedWorkspaceIds(supabase, tokenCtx);
  if (wsIds instanceof Response) return wsIds;

  if (wsIds.length === 0) {
    return jsonError(404, 'NOT_FOUND', 'Recording not found or not accessible');
  }

  // Verify the recording belongs to an authorized workspace
  const { data: access } = await supabase
    .from('workspace_entries')
    .select('recording_id, workspace_id')
    .eq('recording_id', recordingId)
    .in('workspace_id', wsIds)
    .maybeSingle();

  if (!access) {
    return jsonError(404, 'NOT_FOUND', 'Recording not found or not accessible');
  }

  const { data: recording, error: recError } = await supabase
    .from('recordings')
    .select('id, title, recording_start_time, duration, source_app, summary, full_transcript, transcript_segments')
    .eq('id', recordingId)
    .maybeSingle();

  if (recError || !recording) {
    console.error('callvault-api get call error:', recError);
    return jsonError(500, 'INTERNAL_ERROR', 'Failed to fetch recording');
  }

  // Fetch participants
  const { data: participantRows } = await supabase
    .from('call_participants')
    .select('name, email, participant_type')
    .eq('recording_id', recordingId);

  type RecRow = {
    id: string;
    title: string | null;
    recording_start_time: string | null;
    duration: number | null;
    source_app: string | null;
    summary: string | null;
    full_transcript: string | null;
    transcript_segments: unknown;
  };

  type ParticipantRow = {
    name: string | null;
    email: string | null;
    participant_type: string;
  };

  const rec = recording as RecRow;
  const wsEntry = access as { recording_id: string; workspace_id: string };
  const formattedSegments = formatTranscriptSegments(rec.transcript_segments);

  const detail: CallDetailItem = {
    id: rec.id,
    title: rec.title ?? 'Untitled',
    date: rec.recording_start_time,
    duration_seconds: rec.duration ?? null,
    source: rec.source_app ?? 'unknown',
    summary: rec.summary ?? null,
    has_transcript: !!(rec.full_transcript || formattedSegments),
    workspace_id: wsEntry.workspace_id,
    transcript: rec.full_transcript ?? formattedSegments,
    transcript_segments: rec.transcript_segments ?? null,
    participants: ((participantRows ?? []) as ParticipantRow[]).map((p) => ({
      name: p.name,
      email: p.email,
      participant_type: p.participant_type,
    })),
  };

  return jsonItem<CallDetailItem>(detail);
}
