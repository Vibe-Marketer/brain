import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateRequest } from '../_shared/auth.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { getDecryptedOAuthTokens } from '../_shared/oauth-encrypt.ts';
import {
  DEFAULT_PLAUD_API_BASE,
  parsePlaudConnectionMetadata,
  PlaudClient,
  serverKeyFromApiBase,
  type PlaudConnectionMetadata,
  type PlaudFile,
} from '../_shared/plaud-client.ts';
import { plaudFileToCanonical } from '../_shared/plaud-connector.ts';
import { runCanonicalConnectorPipeline } from '../_shared/recording-connectors.ts';

interface PlaudSyncRequest {
  sourceId?: string | null;
  workspace_id?: string | null;
  fileIds?: string[];
  singleCallId?: string;
  page?: number;
  pageSize?: number;
  maxPages?: number;
  debug?: boolean;
  waitForCompletion?: boolean;
}

interface PlaudSourceRecord {
  id: string;
  connection_metadata: PlaudConnectionMetadata | null;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authResult = await authenticateRequest(req, supabase as any, corsHeaders);
    if (authResult instanceof Response) return authResult;
    const userId = authResult.userId;

    const body = await req.json().catch(() => ({})) as PlaudSyncRequest;
    const source = await resolvePlaudSource(supabase, userId, body.sourceId ?? null);
    if (!source) {
      return json({ error: 'Plaud is not connected. Connect Plaud first.' }, 400, corsHeaders);
    }

    const accessToken = await resolveAccessToken(supabase, source.id, userId);
    if (!accessToken) {
      return json({ error: 'Plaud access token is missing. Reconnect Plaud.' }, 400, corsHeaders);
    }

    const metadata = parsePlaudConnectionMetadata(source.connection_metadata);
    const plaudClient = new PlaudClient(accessToken, {
      apiBase: metadata.api_base ?? DEFAULT_PLAUD_API_BASE,
      workspaceId: metadata.workspace_id ?? null,
    });

    let validatedWorkspaceId: string | null = null;
    if (body.workspace_id) {
      const { data: membership, error: membershipError } = await supabase
        .from('workspace_memberships')
        .select('id')
        .eq('workspace_id', body.workspace_id)
        .eq('user_id', userId)
        .maybeSingle();
      if (membershipError) console.error('Error checking Plaud workspace membership:', membershipError);
      else if (membership) validatedWorkspaceId = body.workspace_id;
    }

    const explicitFileIds = body.singleCallId ? [body.singleCallId] : body.fileIds ?? [];
    const progressTotal = explicitFileIds.length > 0 ? explicitFileIds.length : null;
    const { data: syncJob, error: jobError } = await supabase
      .from('sync_jobs')
      .insert({
        user_id: userId,
        recording_ids: explicitFileIds,
        status: 'processing',
        progress_current: 0,
        progress_total: progressTotal,
        type: 'plaud',
      })
      .select()
      .single();

    if (jobError) throw jobError;
    const jobId = syncJob.id;

    const processSyncJob = async () => {
      const synced: string[] = [];
      const failed: string[] = [];
      const failureDetails: Array<{ fileId: string; error: string }> = [];
      let skippedCount = 0;
      let processedCount = 0;

      try {
        const files = explicitFileIds.length > 0
          ? await fetchExplicitFiles(plaudClient, explicitFileIds)
          : await fetchPlaudBackfill(plaudClient, body.page ?? 0, body.pageSize ?? 50, body.maxPages ?? 5);

        for (const file of files) {
          try {
            const canonical = plaudFileToCanonical(file);

            if (!canonical.fullTranscript.trim()) {
              skippedCount++;
            } else {
              const result = await runCanonicalConnectorPipeline(supabase, userId, canonical, {
                importSource: 'plaud-sync-recordings',
                workspaceId: validatedWorkspaceId,
                includeRawPayload: true,
              });

              if (result.success) {
                synced.push(file.id);
              } else if (result.skipped) {
                skippedCount++;
              } else {
                const message = result.error || 'Connector pipeline returned failure';
                failed.push(file.id);
                failureDetails.push({ fileId: file.id, error: message });
                console.error(`Plaud sync failed for ${file.id}:`, message);
              }
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            failed.push(file.id);
            failureDetails.push({ fileId: file.id, error: message });
            console.error(`Plaud sync failed for ${file.id}:`, error);
          }

          processedCount++;
          await supabase
            .from('sync_jobs')
            .update({
              progress_current: processedCount,
              progress_total: progressTotal ?? files.length,
              synced_ids: synced,
              failed_ids: failed,
              skipped_count: skippedCount,
            })
            .eq('id', jobId);
        }

        const finalStatus = failed.length === 0
          ? 'completed'
          : synced.length === 0 && skippedCount === 0 ? 'failed' : 'completed_with_errors';

        await supabase
          .from('sync_jobs')
          .update({
            status: finalStatus,
            completed_at: new Date().toISOString(),
            skipped_count: skippedCount,
            error: body.debug && failureDetails.length > 0
              ? failureDetails.map((item) => `${item.fileId}: ${item.error}`).join('\n')
              : null,
          })
          .eq('id', jobId);

        await updatePlaudSourceState(supabase, source.id, userId, {
          ...metadata,
          auth_type: 'consumer_token',
          api_base: plaudClient.apiBase,
          workspace_id: plaudClient.workspaceId ?? metadata.workspace_id ?? null,
          server_key: serverKeyFromApiBase(plaudClient.apiBase),
          using_user_token_fallback: plaudClient.usingUserTokenFallback,
          workspace_error: plaudClient.lastWorkspaceResolutionError,
        }, failed.length ? `${failed.length} Plaud recordings failed to sync` : null);

        return { finalStatus, synced, failed, skippedCount, processedCount, failureDetails };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown Plaud sync error';
        await supabase
          .from('sync_jobs')
          .update({ status: 'failed', error: message, completed_at: new Date().toISOString() })
          .eq('id', jobId);
        await updatePlaudSourceState(supabase, source.id, userId, {
          ...metadata,
          auth_type: 'consumer_token',
          api_base: plaudClient.apiBase,
          workspace_id: plaudClient.workspaceId ?? metadata.workspace_id ?? null,
          server_key: serverKeyFromApiBase(plaudClient.apiBase),
          using_user_token_fallback: plaudClient.usingUserTokenFallback,
          workspace_error: plaudClient.lastWorkspaceResolutionError,
        }, message);
        return { finalStatus: 'failed', synced, failed, skippedCount, processedCount, failureDetails, error: message };
      }
    };

    if (body.waitForCompletion) {
      const result = await processSyncJob();
      return json({ success: true, jobId, result }, 200, corsHeaders);
    }

    // @ts-expect-error EdgeRuntime is available in Supabase Edge Functions.
    EdgeRuntime.waitUntil(processSyncJob());

    return json({ success: true, jobId, message: 'Plaud sync job started' }, 200, corsHeaders);
  } catch (error) {
    console.error('Error syncing Plaud recordings:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return json({ error: message }, 500, corsHeaders);
  }
});

async function resolvePlaudSource(supabase: any, userId: string, requestedSourceId: string | null): Promise<PlaudSourceRecord | null> {
  let query = supabase
    .from('import_sources')
    .select('id, connection_metadata')
    .eq('user_id', userId)
    .eq('source_app', 'plaud');

  if (requestedSourceId) {
    query = query.eq('id', requestedSourceId);
  } else {
    query = query.eq('is_active', true).order('updated_at', { ascending: false }).limit(1);
  }

  const { data } = await query.maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    connection_metadata: parsePlaudConnectionMetadata(data.connection_metadata),
  };
}

async function resolveAccessToken(supabase: any, sourceId: string, userId: string): Promise<string | null> {
  const tokens = await getDecryptedOAuthTokens(supabase, sourceId, userId);
  return tokens.access_token ?? null;
}

async function fetchExplicitFiles(client: PlaudClient, fileIds: string[]): Promise<PlaudFile[]> {
  const ids = fileIds.map((fileId) => fileId.trim()).filter(Boolean);
  return await client.getFiles(ids);
}

async function fetchPlaudBackfill(client: PlaudClient, firstPage: number, pageSize: number, maxPages: number): Promise<PlaudFile[]> {
  const files: PlaudFile[] = [];
  const safePageSize = Math.min(Math.max(Math.floor(pageSize), 10), 100);
  const safeMaxPages = Math.min(Math.max(Math.floor(maxPages), 1), 20);
  let skip = Math.max(Math.floor(firstPage), 0) * safePageSize;

  for (let offset = 0; offset < safeMaxPages; offset++) {
    const page = await client.listFilesByOffset(skip, safePageSize);
    const items = Array.isArray(page.data_file_list) ? page.data_file_list : [];
    if (items.length === 0) break;

    const details = await client.getFiles(items.map((item) => item.id));
    files.push(...details);

    if (items.length < safePageSize) break;
    skip += safePageSize;
  }

  return files;
}

async function updatePlaudSourceState(
  supabase: any,
  sourceId: string,
  userId: string,
  connectionMetadata: PlaudConnectionMetadata,
  errorMessage: string | null,
): Promise<void> {
  const update: Record<string, unknown> = {
    connection_metadata: connectionMetadata,
    error_message: errorMessage,
    updated_at: new Date().toISOString(),
  };

  if (!errorMessage) {
    update.last_sync_at = new Date().toISOString();
  }

  await supabase
    .from('import_sources')
    .update(update)
    .eq('id', sourceId)
    .eq('user_id', userId);
}

function json(payload: unknown, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
