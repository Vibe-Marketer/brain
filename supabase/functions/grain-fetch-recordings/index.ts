import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateRequest } from '../_shared/auth.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import {
  fetchSyncedSourceCallIds,
  getConnectorDateWindow,
  json,
  resolveOAuthAccessToken,
} from '../_shared/connector-function-utils.ts';
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

    const accessToken = await resolveAccessToken(supabase, source.id, userId);
    const { start, end } = getConnectorDateWindow(body);
    const response = await listRecordings<GrainRecording>({
      token: accessToken,
      cursor: body.cursor ?? null,
      afterDateTime: start,
      beforeDateTime: end,
      fetchImpl: fetch,
    });
    const recordings = response.recordings ?? [];
    const ids = recordings.map((recording) => recording.id).filter(Boolean);
    const syncedIds = await fetchSyncedSourceCallIds(supabase, userId, 'grain', ids);

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

async function resolveAccessToken(supabase: any, sourceId: string, userId: string): Promise<string> {
  return await resolveOAuthAccessToken({
    supabase,
    sourceId,
    userId,
    providerLabel: 'Grain',
    clientIdEnv: 'GRAIN_OAUTH_CLIENT_ID',
    clientSecretEnv: 'GRAIN_OAUTH_CLIENT_SECRET',
    refreshTokens: GrainClient.refreshTokens,
  });
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
