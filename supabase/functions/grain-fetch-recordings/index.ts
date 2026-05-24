import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateRequest } from '../_shared/auth.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { getDecryptedOAuthTokens } from '../_shared/oauth-encrypt.ts';
import { listRecordings, GrainClient } from '../_shared/grain-client.ts';
import { coerceGrainStartTime, grainDurationSeconds, type GrainRecording } from '../_shared/grain-connector.ts';
import { resolveGrainSource } from '../_shared/grain-source.ts';

interface GrainFetchRecordingsRequest {
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

    const body = await req.json().catch(() => ({})) as GrainFetchRecordingsRequest;
    const source = await resolveSource(supabase, userId, body.sourceId ?? null);
    if (!source) return json({ error: 'Grain is not connected. Connect Grain first.' }, 400, corsHeaders);

    const accessToken = await resolveAccessToken(supabase, source, userId);
    const start = body.createdAfter ?? body.dateStart ?? null;
    const end = body.createdBefore ?? body.dateEnd ?? null;
    const response = await listRecordings<GrainRecording>({
      token: accessToken,
      cursor: body.cursor ?? null,
      startDateTimeGte: start,
      startDateTimeLte: end,
      fetchImpl: fetch,
    });
    const recordings = response.recordings ?? [];
    const ids = recordings.map((recording) => recording.id).filter(Boolean);
    const syncedIds = await fetchSyncedIds(supabase, userId, ids);

    return json({
      meetings: recordings.map((recording) => mapRecording(recording, syncedIds)),
      nextCursor: response.cursor ?? null,
      sourceId: source.id,
      accountEmail: source.account_email ?? null,
    }, 200, corsHeaders);
  } catch (error) {
    console.error('Error fetching Grain meetings:', error);
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500, corsHeaders);
  }
});

interface SourceRecord {
  id: string;
  account_email: string | null;
  oauth_token_expires: number | null;
}

async function resolveSource(supabase: any, userId: string, sourceId: string | null): Promise<SourceRecord | null> {
  return await resolveGrainSource<SourceRecord>(supabase, userId, sourceId, 'id, account_email, oauth_token_expires');
}

async function resolveAccessToken(supabase: any, source: SourceRecord, userId: string): Promise<string> {
  const tokens = await getDecryptedOAuthTokens(supabase, source.id, userId);
  if (!tokens.access_token) throw new Error('Grain access token is missing. Reconnect Grain.');
  if (tokens.token_expires && tokens.token_expires < Date.now() + 30_000) {
    if (!tokens.refresh_token) throw new Error('Grain token expired. Reconnect Grain with OAuth.');
    return await refreshGrainTokens(supabase, source.id, userId, tokens.refresh_token);
  }
  return tokens.access_token;
}

async function refreshGrainTokens(supabase: any, sourceId: string, userId: string, refreshToken: string): Promise<string> {
  const clientId = Deno.env.get('GRAIN_OAUTH_CLIENT_ID');
  const clientSecret = Deno.env.get('GRAIN_OAUTH_CLIENT_SECRET');
  if (!clientId || !clientSecret) throw new Error('Grain OAuth is not configured.');
  const refreshed = await GrainClient.refreshTokens({ clientId, clientSecret, refreshToken });
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
  const { data, error } = await supabase.from('recordings').select('source_call_id').eq('owner_user_id', userId).eq('source_app', 'grain').in('source_call_id', ids);
  if (error) throw error;
  return new Set((data ?? []).map((row: { source_call_id?: string | null }) => row.source_call_id).filter(Boolean));
}

function mapRecording(recording: GrainRecording, syncedIds: Set<string>) {
  let start: string | null = null;
  try {
    start = coerceGrainStartTime(recording);
  } catch {
    start = null;
  }
  return {
    recording_id: recording.id,
    title: recording.title?.trim() || `Grain recording ${recording.id}`,
    created_at: start,
    recording_start_time: start,
    recording_end_time: recording.end_datetime ? new Date(recording.end_datetime).toISOString() : null,
    duration: grainDurationSeconds(recording),
    synced: syncedIds.has(recording.id),
    importable: Boolean(recording.end_datetime),
    calendar_invitees: (recording.participants ?? []).map((participant) => ({ name: participant.name ?? null, email: participant.email ?? null })),
    source_url: recording.url ?? null,
    share_url: recording.url ?? null,
  };
}

function json(payload: unknown, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
