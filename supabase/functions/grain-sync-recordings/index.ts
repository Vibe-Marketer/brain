import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateRequest } from '../_shared/auth.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { getDecryptedOAuthTokens } from '../_shared/oauth-encrypt.ts';
import { getRecording, getRecordingTranscript, listRecordings, GrainClient } from '../_shared/grain-client.ts';
import { grainRecordingToCanonical, type GrainRecording, type GrainTranscriptSegment } from '../_shared/grain-connector.ts';
import { runCanonicalConnectorPipeline } from '../_shared/recording-connectors.ts';
import { resolveGrainSource } from '../_shared/grain-source.ts';

interface GrainSyncRequest {
  sourceId?: string | null;
  meetingIds?: string[];
  recordingIds?: string[];
  singleCallId?: string;
  createdAfter?: string | null;
  createdBefore?: string | null;
  workspace_id?: string | null;
  workspaceId?: string | null;
  waitForCompletion?: boolean;
}

const MAX_BATCH_SIZE = 50;
const GRAIN_DETAIL_INCLUDE = { participants: true, ai_summary: true, ai_action_items: true, calendar_event: true };

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const authResult = await authenticateRequest(req, supabase as any, corsHeaders);
    if (authResult instanceof Response) return authResult;
    const userId = authResult.userId;

    const body = await req.json().catch(() => ({})) as GrainSyncRequest;
    const source = await resolveSource(supabase, userId, body.sourceId ?? null);
    if (!source) return json({ error: 'Grain is not connected. Connect Grain first.' }, 400, corsHeaders);

    const accessToken = await resolveAccessToken(supabase, source.id, userId);
    const explicitIds = body.singleCallId
      ? [body.singleCallId]
      : (body.meetingIds ?? body.recordingIds ?? []).map(String).filter(Boolean);
    const recordingIds = explicitIds.length > 0
      ? explicitIds
      : await fetchRecentRecordingIds(accessToken, body);

    if (recordingIds.length === 0) {
      return json({ error: 'recordingIds must be provided or a date-window must return recordings.' }, 400, corsHeaders);
    }
    if (recordingIds.length > MAX_BATCH_SIZE) {
      return json({ error: `Too many Grain recordings: max ${MAX_BATCH_SIZE} per request.` }, 400, corsHeaders);
    }

    const workspaceId = body.workspace_id ?? body.workspaceId ?? null;
    const validatedWorkspaceId = workspaceId ? await validateWorkspace(supabase, userId, workspaceId, corsHeaders) : null;
    if (validatedWorkspaceId instanceof Response) return validatedWorkspaceId;

    const { data: syncJob, error: jobError } = await supabase
      .from('sync_jobs')
      .insert({
        user_id: userId,
        recording_ids: recordingIds,
        status: 'processing',
        progress_current: 0,
        progress_total: recordingIds.length,
        type: 'grain',
      })
      .select()
      .single();
    if (jobError) throw jobError;
    const jobId = syncJob.id;

    const processSyncJob = async () => {
      const synced: string[] = [];
      const failed: string[] = [];
      let skippedCount = 0;

      try {
        for (const recordingId of recordingIds) {
          try {
            const recording = await getRecording<GrainRecording>(accessToken, recordingId, GRAIN_DETAIL_INCLUDE);
            if (!recording.end_datetime) {
              skippedCount++;
            } else {
              const transcript = await getRecordingTranscript(accessToken, recordingId) as GrainTranscriptSegment[];
              const canonical = grainRecordingToCanonical({ ...recording, transcript });
              const result = await runCanonicalConnectorPipeline(supabase, userId, canonical, {
                importSource: 'grain-sync-recordings',
                workspaceId: validatedWorkspaceId,
                includeRawPayload: true,
              });

              if (result.success) {
                synced.push(recordingId);
              } else if (result.skipped) {
                skippedCount++;
              } else {
                failed.push(recordingId);
                console.error(`Grain sync failed for ${recordingId}:`, result.error);
              }
            }
          } catch (error) {
            failed.push(recordingId);
            console.error(`Grain sync failed for ${recordingId}:`, error);
          }

          await supabase.from('sync_jobs').update({
            progress_current: synced.length + failed.length + skippedCount,
            synced_ids: synced,
            failed_ids: failed,
            skipped_count: skippedCount,
          }).eq('id', jobId);
        }

        const finalStatus = failed.length === 0 ? 'completed' : synced.length === 0 && skippedCount === 0 ? 'failed' : 'completed_with_errors';
        await supabase.from('sync_jobs').update({
          status: finalStatus,
          completed_at: new Date().toISOString(),
          skipped_count: skippedCount,
        }).eq('id', jobId);
        await supabase.from('import_sources').update({
          last_sync_at: new Date().toISOString(),
          error_message: failed.length ? `${failed.length} Grain recording${failed.length === 1 ? '' : 's'} failed to sync` : null,
          updated_at: new Date().toISOString(),
        }).eq('id', source.id).eq('user_id', userId);

        return { finalStatus, synced, failed, skippedCount };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Grain sync job crashed';
        await supabase.from('sync_jobs').update({
          status: 'failed',
          error: message,
          completed_at: new Date().toISOString(),
          synced_ids: synced,
          failed_ids: failed,
          skipped_count: skippedCount,
        }).eq('id', jobId);
        await supabase.from('import_sources').update({
          error_message: message,
          updated_at: new Date().toISOString(),
        }).eq('id', source.id).eq('user_id', userId);
        return { finalStatus: 'failed', synced, failed, skippedCount, error: message };
      }
    };

    if (body.waitForCompletion) {
      const result = await processSyncJob();
      return json({ success: true, jobId, result }, 200, corsHeaders);
    }

    // @ts-expect-error EdgeRuntime is available in Supabase Edge Functions.
    EdgeRuntime.waitUntil(processSyncJob());

    return json({ success: true, jobId, message: `Grain sync job started for ${recordingIds.length} recordings` }, 200, corsHeaders);
  } catch (error) {
    console.error('Error syncing Grain meetings:', error);
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500, corsHeaders);
  }
});

async function resolveSource(supabase: any, userId: string, sourceId: string | null): Promise<{ id: string } | null> {
  return await resolveGrainSource(supabase, userId, sourceId);
}

async function resolveAccessToken(supabase: any, sourceId: string, userId: string): Promise<string> {
  const tokens = await getDecryptedOAuthTokens(supabase, sourceId, userId);
  if (!tokens.access_token) throw new Error('Grain access token is missing. Reconnect Grain.');
  if (tokens.token_expires && tokens.token_expires < Date.now() + 30_000) {
    if (!tokens.refresh_token) throw new Error('Grain token expired. Reconnect Grain with OAuth.');
    const clientId = Deno.env.get('GRAIN_OAUTH_CLIENT_ID');
    const clientSecret = Deno.env.get('GRAIN_OAUTH_CLIENT_SECRET');
    if (!clientId || !clientSecret) throw new Error('Grain OAuth is not configured.');
    const refreshed = await GrainClient.refreshTokens({ clientId, clientSecret, refreshToken: tokens.refresh_token });
    const expiresAt = refreshed.expires_in ? Date.now() + refreshed.expires_in * 1000 : null;
    const encryptionKey = Deno.env.get('OAUTH_ENCRYPTION_KEY');
    if (encryptionKey) {
      const { error } = await supabase.rpc('store_encrypted_oauth_tokens', {
        p_source_id: sourceId,
        p_user_id: userId,
        p_access_token: refreshed.access_token,
        p_refresh_token: refreshed.refresh_token ?? tokens.refresh_token,
        p_token_expires: expiresAt,
        p_encryption_key: encryptionKey,
        p_is_active: true,
      });
      if (error) throw error;
    } else {
      const { error } = await supabase.from('import_sources').update({ oauth_access_token: refreshed.access_token, oauth_refresh_token: refreshed.refresh_token ?? tokens.refresh_token, oauth_token_expires: expiresAt, updated_at: new Date().toISOString() }).eq('id', sourceId).eq('user_id', userId);
      if (error) throw error;
    }
    return refreshed.access_token;
  }
  return tokens.access_token;
}

async function fetchRecentRecordingIds(accessToken: string, body: GrainSyncRequest): Promise<string[]> {
  const response = await listRecordings<GrainRecording>({
    token: accessToken,
    startDateTimeGte: body.createdAfter ?? null,
    startDateTimeLte: body.createdBefore ?? null,
  });
  return (response.recordings ?? []).filter((recording) => Boolean(recording.end_datetime)).map((recording) => recording.id);
}

async function validateWorkspace(supabase: any, userId: string, workspaceId: string, corsHeaders: Record<string, string>): Promise<string | Response> {
  const { data, error } = await supabase.from('workspace_memberships').select('id').eq('workspace_id', workspaceId).eq('user_id', userId).maybeSingle();
  if (error) return json({ error: 'Failed to verify workspace membership. Try again.' }, 500, corsHeaders);
  if (!data) return json({ error: 'You are not a member of the requested workspace.' }, 403, corsHeaders);
  return workspaceId;
}

function json(payload: unknown, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
