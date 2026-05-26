import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateRequest } from '../_shared/auth.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import {
  fetchSyncedSourceCallIds,
  getConnectorDateWindowMs,
  json,
  resolveOAuthAccessToken,
} from '../_shared/connector-function-utils.ts';
import { clampReadAiLimit, listMeetings, ReadAiClient } from '../_shared/read-ai-client.ts';
import { coerceReadAiStartTime, readAiDurationSeconds, type ReadAiMeeting } from '../_shared/read-ai-connector.ts';
import { resolveReadAiSource } from '../_shared/read-ai-source.ts';

interface ReadAiFetchMeetingsRequest {
  sourceId?: string | null;
  createdAfter?: string | null;
  createdBefore?: string | null;
  dateStart?: string | null;
  dateEnd?: string | null;
  cursor?: string | null;
  limit?: number;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const authResult = await authenticateRequest(req, supabase as any, corsHeaders);
    if (authResult instanceof Response) return authResult;
    const userId = authResult.userId;

    const body = await req.json().catch(() => ({})) as ReadAiFetchMeetingsRequest;
    const source = await resolveSource(supabase, userId, body.sourceId ?? null);
    if (!source) return json({ error: 'Read.ai is not connected. Connect Read.ai first.' }, 400, corsHeaders);

    const accessToken = await resolveAccessToken(supabase, source.id, userId);
    const { startMs, endMs } = getConnectorDateWindowMs(body);
    const response = await listMeetings<ReadAiMeeting>({
      token: accessToken,
      limit: clampReadAiLimit(body.limit),
      cursor: body.cursor ?? null,
      startTimeMsGte: startMs,
      startTimeMsLte: endMs,
      fetchImpl: fetch,
    });
    const meetings = response.data ?? [];
    const ids = meetings.map((meeting) => meeting.id).filter(Boolean);
    const syncedIds = await fetchSyncedSourceCallIds(supabase, userId, 'read-ai', ids);

    return json({
      meetings: meetings.map((meeting) => mapMeeting(meeting, syncedIds)),
      nextCursor: response.has_more && meetings.length > 0 ? meetings[meetings.length - 1].id : null,
      sourceId: source.id,
      accountEmail: source.account_email ?? null,
    }, 200, corsHeaders);
  } catch (error) {
    console.error('Error fetching Read.ai meetings:', error);
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500, corsHeaders);
  }
});

interface SourceRecord {
  id: string;
  account_email: string | null;
  oauth_token_expires: number | null;
}

async function resolveSource(supabase: any, userId: string, sourceId: string | null): Promise<SourceRecord | null> {
  return await resolveReadAiSource<SourceRecord>(supabase, userId, sourceId, 'id, account_email, oauth_token_expires');
}

async function resolveAccessToken(supabase: any, sourceId: string, userId: string): Promise<string> {
  return await resolveOAuthAccessToken({
    supabase,
    sourceId,
    userId,
    providerLabel: 'Read.ai',
    clientIdEnv: 'READAI_OAUTH_CLIENT_ID',
    clientSecretEnv: 'READAI_OAUTH_CLIENT_SECRET',
    refreshTokens: ReadAiClient.refreshTokens,
  });
}

function mapMeeting(meeting: ReadAiMeeting, syncedIds: Set<string>) {
  let start: string | null = null;
  try {
    start = coerceReadAiStartTime(meeting);
  } catch {
    start = null;
  }
  return {
    recording_id: meeting.id,
    title: meeting.title?.trim() || `Read.ai meeting ${meeting.id}`,
    created_at: start,
    recording_start_time: start,
    recording_end_time: meeting.end_time_ms ? new Date(meeting.end_time_ms).toISOString() : null,
    duration: readAiDurationSeconds(meeting),
    synced: syncedIds.has(meeting.id),
    importable: Boolean(meeting.end_time_ms),
    calendar_invitees: (meeting.participants ?? []).map((participant) => ({ name: participant.name ?? null, email: participant.email ?? null })),
    source_url: meeting.report_url ?? null,
    share_url: meeting.report_url ?? null,
  };
}
