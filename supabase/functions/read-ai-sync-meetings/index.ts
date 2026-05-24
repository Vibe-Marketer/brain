import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateRequest } from '../_shared/auth.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { getDecryptedOAuthTokens } from '../_shared/oauth-encrypt.ts';
import { getMeeting, listMeetings, ReadAiClient } from '../_shared/read-ai-client.ts';
import { readAiMeetingToCanonical, type ReadAiMeeting } from '../_shared/read-ai-connector.ts';
import { runCanonicalConnectorPipeline } from '../_shared/recording-connectors.ts';

interface ReadAiSyncRequest {
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
const READ_AI_DETAIL_EXPAND = ['summary', 'action_items', 'topics', 'transcript', 'metrics'];

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const authResult = await authenticateRequest(req, supabase as any, corsHeaders);
    if (authResult instanceof Response) return authResult;
    const userId = authResult.userId;

    const body = await req.json().catch(() => ({})) as ReadAiSyncRequest;
    const source = await resolveSource(supabase, userId, body.sourceId ?? null);
    if (!source) return json({ error: 'Read.ai is not connected. Connect Read.ai first.' }, 400, corsHeaders);

    const accessToken = await resolveAccessToken(supabase, source.id, userId);
    const explicitIds = body.singleCallId
      ? [body.singleCallId]
      : (body.meetingIds ?? body.recordingIds ?? []).map(String).filter(Boolean);
    const meetingIds = explicitIds.length > 0
      ? explicitIds
      : await fetchRecentMeetingIds(accessToken, body);

    if (meetingIds.length === 0) {
      return json({ error: 'meetingIds must be provided or a date-window must return meetings.' }, 400, corsHeaders);
    }
    if (meetingIds.length > MAX_BATCH_SIZE) {
      return json({ error: `Too many Read.ai meetings: max ${MAX_BATCH_SIZE} per request.` }, 400, corsHeaders);
    }

    const workspaceId = body.workspace_id ?? body.workspaceId ?? null;
    const validatedWorkspaceId = workspaceId ? await validateWorkspace(supabase, userId, workspaceId, corsHeaders) : null;
    if (validatedWorkspaceId instanceof Response) return validatedWorkspaceId;

    const { data: syncJob, error: jobError } = await supabase
      .from('sync_jobs')
      .insert({
        user_id: userId,
        recording_ids: meetingIds,
        status: 'processing',
        progress_current: 0,
        progress_total: meetingIds.length,
        type: 'read-ai',
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
        for (const meetingId of meetingIds) {
          try {
            const meeting = await getMeeting<ReadAiMeeting>(accessToken, meetingId, READ_AI_DETAIL_EXPAND);
            if (!meeting.end_time_ms) {
              skippedCount++;
            } else {
              const canonical = readAiMeetingToCanonical(meeting);
              const result = await runCanonicalConnectorPipeline(supabase, userId, canonical, {
                importSource: 'read-ai-sync-meetings',
                workspaceId: validatedWorkspaceId,
                includeRawPayload: true,
              });

              if (result.success) {
                synced.push(meetingId);
              } else if (result.skipped) {
                skippedCount++;
              } else {
                failed.push(meetingId);
                console.error(`Read.ai sync failed for ${meetingId}:`, result.error);
              }
            }
          } catch (error) {
            failed.push(meetingId);
            console.error(`Read.ai sync failed for ${meetingId}:`, error);
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
          error_message: failed.length ? `${failed.length} Read.ai meeting${failed.length === 1 ? '' : 's'} failed to sync` : null,
          updated_at: new Date().toISOString(),
        }).eq('id', source.id).eq('user_id', userId);

        return { finalStatus, synced, failed, skippedCount };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Read.ai sync job crashed';
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

    return json({ success: true, jobId, message: `Read.ai sync job started for ${meetingIds.length} meetings` }, 200, corsHeaders);
  } catch (error) {
    console.error('Error syncing Read.ai meetings:', error);
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500, corsHeaders);
  }
});

async function resolveSource(supabase: any, userId: string, sourceId: string | null): Promise<{ id: string } | null> {
  let query = supabase.from('import_sources').select('id').eq('user_id', userId).eq('source_app', 'read-ai');
  query = sourceId ? query.eq('id', sourceId) : query.eq('is_active', true).order('updated_at', { ascending: false }).limit(1);
  const { data } = await query.maybeSingle();
  return data;
}

async function resolveAccessToken(supabase: any, sourceId: string, userId: string): Promise<string> {
  const tokens = await getDecryptedOAuthTokens(supabase, sourceId, userId);
  if (!tokens.access_token) throw new Error('Read.ai access token is missing. Reconnect Read.ai.');
  if (tokens.token_expires && tokens.token_expires < Date.now() + 30_000) {
    if (!tokens.refresh_token) throw new Error('Read.ai token expired. Reconnect Read.ai with OAuth.');
    const clientId = Deno.env.get('READAI_OAUTH_CLIENT_ID');
    const clientSecret = Deno.env.get('READAI_OAUTH_CLIENT_SECRET');
    if (!clientId || !clientSecret) throw new Error('Read.ai OAuth is not configured.');
    const refreshed = await ReadAiClient.refreshTokens({ clientId, clientSecret, refreshToken: tokens.refresh_token });
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

async function fetchRecentMeetingIds(accessToken: string, body: ReadAiSyncRequest): Promise<string[]> {
  const response = await listMeetings<ReadAiMeeting>({
    token: accessToken,
    limit: 10,
    startTimeMsGte: body.createdAfter ? Date.parse(body.createdAfter) : null,
    startTimeMsLte: body.createdBefore ? Date.parse(body.createdBefore) : null,
  });
  return (response.data ?? []).filter((meeting) => Boolean(meeting.end_time_ms)).map((meeting) => meeting.id);
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
