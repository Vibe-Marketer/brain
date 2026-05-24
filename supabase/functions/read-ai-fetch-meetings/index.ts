import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateRequest } from '../_shared/auth.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { getDecryptedOAuthTokens } from '../_shared/oauth-encrypt.ts';
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

    const accessToken = await resolveAccessToken(supabase, source, userId);
    const start = body.createdAfter ?? body.dateStart ?? null;
    const end = body.createdBefore ?? body.dateEnd ?? null;
    const response = await listMeetings<ReadAiMeeting>({
      token: accessToken,
      limit: clampReadAiLimit(body.limit),
      cursor: body.cursor ?? null,
      startTimeMsGte: start ? Date.parse(start) : null,
      startTimeMsLte: end ? Date.parse(end) : null,
      fetchImpl: fetch,
    });
    const meetings = response.data ?? [];
    const ids = meetings.map((meeting) => meeting.id).filter(Boolean);
    const syncedIds = await fetchSyncedIds(supabase, userId, ids);

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

async function resolveAccessToken(supabase: any, source: SourceRecord, userId: string): Promise<string> {
  const tokens = await getDecryptedOAuthTokens(supabase, source.id, userId);
  if (!tokens.access_token) throw new Error('Read.ai access token is missing. Reconnect Read.ai.');
  if (tokens.token_expires && tokens.token_expires < Date.now() + 30_000) {
    if (!tokens.refresh_token) throw new Error('Read.ai token expired. Reconnect Read.ai with OAuth.');
    return await refreshReadAiTokens(supabase, source.id, userId, tokens.refresh_token);
  }
  return tokens.access_token;
}

async function refreshReadAiTokens(supabase: any, sourceId: string, userId: string, refreshToken: string): Promise<string> {
  const clientId = Deno.env.get('READAI_OAUTH_CLIENT_ID');
  const clientSecret = Deno.env.get('READAI_OAUTH_CLIENT_SECRET');
  if (!clientId || !clientSecret) throw new Error('Read.ai OAuth is not configured.');
  const refreshed = await ReadAiClient.refreshTokens({ clientId, clientSecret, refreshToken });
  const expiresAt = refreshed.expires_in ? Date.now() + refreshed.expires_in * 1000 : null;
  const encryptionKey = Deno.env.get('OAUTH_ENCRYPTION_KEY');
  if (encryptionKey) {
    const { error } = await supabase.rpc('store_encrypted_oauth_tokens', {
      p_source_id: sourceId,
      p_user_id: userId,
      p_access_token: refreshed.access_token,
      p_refresh_token: refreshed.refresh_token ?? refreshToken,
      p_token_expires: expiresAt,
      p_encryption_key: encryptionKey,
      p_is_active: true,
    });
    if (error) throw error;
  } else {
    const { error } = await supabase.from('import_sources').update({ oauth_access_token: refreshed.access_token, oauth_refresh_token: refreshed.refresh_token ?? refreshToken, oauth_token_expires: expiresAt, updated_at: new Date().toISOString() }).eq('id', sourceId).eq('user_id', userId);
    if (error) throw error;
  }
  return refreshed.access_token;
}

async function fetchSyncedIds(supabase: any, userId: string, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const { data, error } = await supabase.from('recordings').select('source_call_id').eq('owner_user_id', userId).eq('source_app', 'read-ai').in('source_call_id', ids);
  if (error) throw error;
  return new Set((data ?? []).map((row: { source_call_id?: string | null }) => row.source_call_id).filter(Boolean));
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

function json(payload: unknown, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
