/**
 * fathom-reconcile — Phase 39 Fathom Mirror reconciliation edge function.
 *
 * Two modes:
 *   - backfill (default): JWT-authenticated. Caller passes sourceId; paginates
 *     full Fathom history for that source; upserts to fathom_raw_calls +
 *     recordings (via runPipeline).
 *   - reconcile: invoked by daily pg_cron via pg_net. Auth = shared
 *     RECONCILE_SECRET header. Iterates ALL active fathom import_sources,
 *     runs incremental 30-day diff per source.
 *
 * Deploy: `supabase functions deploy fathom-reconcile --use-api --no-verify-jwt`
 *   (cron path needs verify_jwt=false; backfill path enforces JWT in code).
 *
 * Env vars required:
 *   - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (standard)
 *   - FATHOM_OAUTH_CLIENT_ID, FATHOM_OAUTH_CLIENT_SECRET (token refresh)
 *   - RECONCILE_SECRET (32-byte hex; must match app.reconcile_secret DB setting)
 *   - OAUTH_ENCRYPTION_KEY (optional; if set, reads tokens via decrypt RPC)
 */

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { FathomClient } from '../_shared/fathom-client.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { runPipeline } from '../_shared/connector-pipeline.ts';
import { authenticateRequest } from '../_shared/auth.ts';

interface ReconcileResult {
  synced: number;
  skipped: number;
  errored: number;
  pages: number;
}

async function throttle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 200));
}

interface ResolvedCreds {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
  apiKey: string | null;
}

async function resolveCredentials(
  supabase: SupabaseClient,
  sourceId: string,
  userId: string,
): Promise<ResolvedCreds> {
  const encryptionKey = Deno.env.get('OAUTH_ENCRYPTION_KEY');

  if (encryptionKey) {
    const { data, error } = await supabase.rpc('decrypt_oauth_tokens', {
      p_source_id: sourceId,
      p_user_id: userId,
      p_encryption_key: encryptionKey,
    });
    if (!error && data) {
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.token_expires,
        apiKey: data.fathom_api_key,
      };
    }
  }

  const { data: src, error } = await supabase
    .from('import_sources')
    .select('oauth_access_token, oauth_refresh_token, oauth_token_expires, fathom_api_key')
    .eq('id', sourceId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !src) throw new Error('Source not found or credentials missing');

  return {
    accessToken: src.oauth_access_token,
    refreshToken: src.oauth_refresh_token,
    expiresAt: src.oauth_token_expires,
    apiKey: src.fathom_api_key,
  };
}

async function refreshIfExpired(
  supabase: SupabaseClient,
  sourceId: string,
  creds: ResolvedCreds,
): Promise<string> {
  const now = Date.now();
  const buffer = 5 * 60_000;
  if (creds.expiresAt && creds.expiresAt - buffer > now && creds.accessToken) {
    return creds.accessToken;
  }
  if (!creds.refreshToken) {
    if (creds.apiKey) return '';
    throw new Error('Token expired and no refresh token; reconnect required');
  }

  const clientId = Deno.env.get('FATHOM_OAUTH_CLIENT_ID')!;
  const clientSecret = Deno.env.get('FATHOM_OAUTH_CLIENT_SECRET')!;
  const tokenResponse = await fetch('https://fathom.video/external/v1/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: creds.refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!tokenResponse.ok) {
    throw new Error(`Token refresh failed: ${tokenResponse.status}`);
  }
  const tokens = await tokenResponse.json();
  const expiresAt = Date.now() + tokens.expires_in * 1000;

  await supabase
    .from('import_sources')
    .update({
      oauth_access_token: tokens.access_token,
      oauth_refresh_token: tokens.refresh_token,
      oauth_token_expires: expiresAt,
    })
    .eq('id', sourceId);

  return tokens.access_token;
}

interface FathomTranscriptSegment {
  speaker?: { display_name?: string };
  text?: string;
  timestamp?: string;
}

async function syncOneMeeting(
  supabase: SupabaseClient,
  userId: string,
  sourceId: string,
  meeting: Record<string, unknown>,
): Promise<'synced' | 'skipped' | 'failed'> {
  try {
    const recordingId = Number(meeting.recording_id);
    const externalId = String(recordingId);
    const title = (meeting.title as string) || 'Untitled Call';

    const transcript = (meeting.transcript as FathomTranscriptSegment[]) || [];
    const consolidated: string[] = [];
    let curSpeaker: string | null = null;
    let curTs: string | null = null;
    let curTexts: string[] = [];
    transcript.forEach((seg, idx) => {
      const name = seg.speaker?.display_name || 'Unknown';
      if (name !== curSpeaker) {
        if (curSpeaker && curTexts.length) {
          consolidated.push(`[${curTs || '00:00:00'}] ${curSpeaker}: ${curTexts.join(' ')}`);
        }
        curSpeaker = name;
        curTs = seg.timestamp || '00:00:00';
        curTexts = [seg.text || ''];
      } else {
        curTexts.push(seg.text || '');
      }
      if (idx === transcript.length - 1 && curTexts.length) {
        consolidated.push(`[${curTs || '00:00:00'}] ${curSpeaker}: ${curTexts.join(' ')}`);
      }
    });
    const fullTranscript = consolidated.join('\n\n');

    const summaryText =
      (meeting.default_summary as { markdown_formatted?: string } | undefined)?.markdown_formatted || null;

    const start = new Date(meeting.recording_start_time as string);
    const end = meeting.recording_end_time ? new Date(meeting.recording_end_time as string) : null;
    const durationSec = end ? Math.floor((end.getTime() - start.getTime()) / 1000) : undefined;

    const recordedBy = meeting.recorded_by as { name?: string; email?: string } | undefined;

    const sourceMetadata = {
      fathom_call_id: recordingId,
      fathom_url: meeting.url || null,
      fathom_share_url: meeting.share_url || null,
      recorded_by_name: recordedBy?.name || null,
      recorded_by_email: recordedBy?.email || null,
      calendar_invitees: meeting.calendar_invitees || [],
      summary: summaryText,
      import_source: 'fathom-reconcile',
      synced_at: new Date().toISOString(),
    };

    const result = await runPipeline(supabase, userId, {
      external_id: externalId,
      source_app: 'fathom',
      title,
      full_transcript: fullTranscript,
      summary: summaryText,
      recording_start_time: meeting.recording_start_time as string,
      duration: durationSec,
      source_metadata: sourceMetadata,
    });

    if (!result.success) {
      if (result.skipped) return 'skipped';
      throw new Error(result.error || 'Pipeline failed');
    }

    const { error: rawErr } = await supabase
      .from('fathom_raw_calls')
      .upsert(
        {
          recording_id: recordingId,
          user_id: userId,
          import_source_id: sourceId,
          mirror_version: 1,
          canonical_recording_id: result.recordingId,
          title,
          created_at: (meeting.created_at as string) || new Date().toISOString(),
          recording_start_time: meeting.recording_start_time as string,
          recording_end_time: (meeting.recording_end_time as string) || null,
          url: (meeting.url as string) || null,
          share_url: (meeting.share_url as string) || null,
          full_transcript: fullTranscript,
          summary: summaryText,
          recorded_by_name: recordedBy?.name || null,
          recorded_by_email: recordedBy?.email || null,
          calendar_invitees: meeting.calendar_invitees || null,
          synced_at: new Date().toISOString(),
        },
        { onConflict: 'recording_id,user_id' },
      );
    if (rawErr) console.error('[fathom-reconcile] raw upsert error (non-blocking):', rawErr);

    return 'synced';
  } catch (err) {
    console.error('[fathom-reconcile] syncOneMeeting failed:', err);
    return 'failed';
  }
}

async function paginateSource(
  supabase: SupabaseClient,
  userId: string,
  sourceId: string,
  options: { createdAfter?: string; maxPages?: number },
): Promise<ReconcileResult> {
  const result: ReconcileResult = { synced: 0, skipped: 0, errored: 0, pages: 0 };

  const creds = await resolveCredentials(supabase, sourceId, userId);
  const accessToken = await refreshIfExpired(supabase, sourceId, creds);
  const authHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) authHeaders['Authorization'] = `Bearer ${accessToken}`;
  else if (creds.apiKey) authHeaders['X-Api-Key'] = creds.apiKey;

  let cursor: string | undefined;
  const maxPages = options.maxPages ?? 100;

  for (let i = 0; i < maxPages; i++) {
    await throttle();
    const url = new URL('https://api.fathom.ai/external/v1/meetings');
    url.searchParams.append('limit', '50');
    url.searchParams.append('include_transcript', 'true');
    url.searchParams.append('include_summary', 'true');
    if (options.createdAfter) url.searchParams.append('created_after', options.createdAfter);
    if (cursor) url.searchParams.append('cursor', cursor);

    const response = await FathomClient.fetchWithRetry(url.toString(), {
      headers: authHeaders,
      maxRetries: 5,
    });
    if (!response.ok) {
      const text = await response.text();
      console.error(`[fathom-reconcile] page ${i} ${response.status}: ${text}`);
      result.errored++;
      break;
    }
    const data = await response.json();
    const items = (data.items as Array<Record<string, unknown>>) || [];
    if (items.length === 0) break;

    for (const meeting of items) {
      const status = await syncOneMeeting(supabase, userId, sourceId, meeting);
      result[status === 'failed' ? 'errored' : status]++;
    }

    result.pages++;
    cursor = data.next_cursor as string | undefined;
    if (!cursor) break;
  }

  return result;
}

async function runBackfill(
  supabase: SupabaseClient,
  userId: string,
  sourceId: string,
): Promise<ReconcileResult> {
  return paginateSource(supabase, userId, sourceId, { maxPages: 100 });
}

async function runDailyReconcile(
  supabase: SupabaseClient,
): Promise<{ sources: number; results: ReconcileResult[] }> {
  const createdAfter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: sources, error } = await supabase
    .from('import_sources')
    .select('id, user_id')
    .eq('source_app', 'fathom')
    .eq('is_active', true);
  if (error) throw error;

  const results: ReconcileResult[] = [];
  for (const src of sources ?? []) {
    try {
      const r = await paginateSource(supabase, src.user_id as string, src.id as string, {
        createdAfter,
        maxPages: 20,
      });
      results.push(r);
    } catch (err) {
      console.error(`[fathom-reconcile] reconcile source ${src.id} failed:`, err);
      results.push({ synced: 0, skipped: 0, errored: 1, pages: 0 });
    }
  }
  return { sources: (sources ?? []).length, results };
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body = await req.json().catch(() => ({}));
    const mode = body.mode || 'backfill';

    if (mode === 'reconcile') {
      const secret = req.headers.get('X-Reconcile-Secret') || body.secret;
      const expected = Deno.env.get('RECONCILE_SECRET');
      if (!expected || secret !== expected) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      const result = await runDailyReconcile(supabase);
      return new Response(
        JSON.stringify({ success: true, mode, ...result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Backfill mode — JWT auth required
    const authResult = await authenticateRequest(req, supabase, corsHeaders);
    if (authResult instanceof Response) return authResult;
    const userId = authResult.userId;

    const sourceId = body.sourceId as string;
    if (!sourceId) {
      return new Response(
        JSON.stringify({ error: 'sourceId required for backfill' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: src, error: srcErr } = await supabase
      .from('import_sources')
      .select('id, user_id')
      .eq('id', sourceId)
      .eq('user_id', userId)
      .maybeSingle();
    if (srcErr || !src) {
      return new Response(
        JSON.stringify({ error: 'Source not found or not owned by caller' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const result = await runBackfill(supabase, userId, sourceId);
    return new Response(
      JSON.stringify({ success: true, mode, sourceId, ...result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('[fathom-reconcile] handler error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
