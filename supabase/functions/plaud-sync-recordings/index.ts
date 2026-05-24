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
  mode?: 'search' | 'sync';
  sourceId?: string | null;
  workspace_id?: string | null;
  workspaceId?: string | null;
  fileIds?: string[];
  singleCallId?: string;
  page?: number;
  pageSize?: number;
  maxPages?: number;
  cursor?: string | null;
  limit?: number;
  dateStart?: string | null;
  dateEnd?: string | null;
  debug?: boolean;
  waitForCompletion?: boolean;
}

interface PlaudSourceRecord {
  id: string;
  connection_metadata: PlaudConnectionMetadata | null;
}

interface PlaudSearchRow {
  recording_id: string;
  title: string;
  created_at: string | null;
  recording_start_time: string | null;
  recording_end_time: string | null;
  duration: number | null;
  synced: boolean;
  source_url: string | null;
  metadata: Record<string, unknown>;
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

    if (body.mode === 'search') {
      const result = await searchPlaudRecordings(supabase, userId, plaudClient, body);
      await updatePlaudSourceState(supabase, source.id, userId, {
        ...metadata,
        auth_type: 'consumer_token',
        api_base: plaudClient.apiBase,
        workspace_id: plaudClient.workspaceId ?? metadata.workspace_id ?? null,
        server_key: serverKeyFromApiBase(plaudClient.apiBase),
        using_user_token_fallback: plaudClient.usingUserTokenFallback,
        workspace_error: plaudClient.lastWorkspaceResolutionError,
      }, null, false);
      return json(result, 200, corsHeaders);
    }

    let validatedWorkspaceId: string | null = null;
    const requestedWorkspaceId = body.workspace_id ?? body.workspaceId ?? null;
    if (requestedWorkspaceId) {
      const { data: membership, error: membershipError } = await supabase
        .from('workspace_memberships')
        .select('id')
        .eq('workspace_id', requestedWorkspaceId)
        .eq('user_id', userId)
        .maybeSingle();
      if (membershipError) {
        console.error('Error checking Plaud workspace membership:', membershipError);
        return json({ error: 'Failed to verify workspace membership. Try again.' }, 500, corsHeaders);
      }
      if (!membership) {
        return json({ error: 'You are not a member of the requested workspace.' }, 403, corsHeaders);
      }
      validatedWorkspaceId = requestedWorkspaceId;
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

async function searchPlaudRecordings(
  supabase: any,
  userId: string,
  client: PlaudClient,
  body: PlaudSyncRequest,
): Promise<{ recordings: PlaudSearchRow[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(Math.floor(body.limit ?? body.pageSize ?? 50), 1), 100);
  let skip = Math.max(Number(body.cursor ?? 0) || 0, 0);
  const maxPages = Math.min(Math.max(Math.floor(body.maxPages ?? 5), 1), 20);
  const dateStartMs = parseOptionalDateMs(body.dateStart);
  const dateEndMs = parseOptionalDateMs(body.dateEnd);
  const filtered: PlaudFile[] = [];
  let nextCursor: string | null = null;

  for (let pageIndex = 0; pageIndex < maxPages && filtered.length < limit; pageIndex++) {
    const page = await client.listFilesByOffset(skip, limit);
    const files = Array.isArray(page.data_file_list) ? page.data_file_list : [];
    filtered.push(...files.filter((file) => isWithinDateRange(file, dateStartMs, dateEndMs)));

    if (files.length < limit) {
      nextCursor = null;
      break;
    }
    skip += files.length;
    nextCursor = String(skip);
  }

  const pageItems = filtered.slice(0, limit);
  const syncedIds = await findActiveImportedPlaudIds(supabase, userId, pageItems.map((file) => file.id));

  return {
    recordings: pageItems.map((file) => plaudFileToSearchRow(file, syncedIds)),
    nextCursor,
  };
}

async function findActiveImportedPlaudIds(supabase: any, userId: string, fileIds: string[]): Promise<Set<string>> {
  const ids = fileIds.map((id) => id.trim()).filter(Boolean);
  if (ids.length === 0) return new Set();

  const { data: recordings, error: recordingsError } = await supabase
    .from('recordings')
    .select('id, source_call_id, source_metadata')
    .eq('owner_user_id', userId)
    .eq('source_app', 'plaud')
    .in('source_call_id', ids);
  if (recordingsError) throw recordingsError;

  const recordingIdToExternalId = new Map<string, string>();
  for (const row of recordings ?? []) {
    const externalId = row.source_call_id ?? row.source_metadata?.external_id;
    if (row.id && externalId) recordingIdToExternalId.set(row.id, String(externalId));
  }

  const matchedExternalIds = new Set(recordingIdToExternalId.values());
  const unmatchedIds = ids.filter((id) => !matchedExternalIds.has(id));
  if (unmatchedIds.length > 0) {
    const { data: metadataMatches, error: metadataError } = await supabase
      .from('recordings')
      .select('id, source_metadata')
      .eq('owner_user_id', userId)
      .eq('source_app', 'plaud')
      .filter('source_metadata->>external_id', 'in', `(${unmatchedIds.map(quotePostgrestInValue).join(',')})`);
    if (metadataError) throw metadataError;

    for (const row of metadataMatches ?? []) {
      const externalId = row.source_metadata?.external_id;
      if (row.id && externalId) recordingIdToExternalId.set(row.id, String(externalId));
    }
  }

  if (recordingIdToExternalId.size === 0) return new Set();

  const { data: entries, error: entriesError } = await supabase
    .from('workspace_entries')
    .select('recording_id')
    .in('recording_id', Array.from(recordingIdToExternalId.keys()));
  if (entriesError) throw entriesError;

  const syncedIds = new Set<string>();
  for (const entry of entries ?? []) {
    const externalId = recordingIdToExternalId.get(entry.recording_id);
    if (externalId) syncedIds.add(externalId);
  }
  return syncedIds;
}

function plaudFileToSearchRow(file: PlaudFile, syncedIds: Set<string>): PlaudSearchRow {
  const startTime = coerceOptionalPlaudDate(file);
  const duration = normalizePlaudDurationSeconds(file.duration);
  const endTime = coerceOptionalPlaudEndTime(file, startTime, duration);

  return {
    recording_id: file.id,
    title: file.name?.trim() || file.filename?.trim() || `Plaud recording ${file.id}`,
    created_at: startTime,
    recording_start_time: startTime,
    recording_end_time: endTime,
    duration,
    synced: syncedIds.has(file.id),
    source_url: null,
    metadata: {
      plaud_file_id: file.id,
      plaud_serial_number: file.serial_number ?? null,
      plaud_is_trans: file.is_trans ?? null,
      plaud_is_summary: file.is_summary ?? null,
      plaud_filetype: file.filetype ?? null,
      plaud_filesize: file.filesize ?? null,
    },
  };
}

function isWithinDateRange(file: PlaudFile, dateStartMs: number | null, dateEndMs: number | null): boolean {
  const startTime = coerceOptionalPlaudDate(file);
  if (!startTime) return false;
  const startMs = Date.parse(startTime);
  if (!Number.isFinite(startMs)) return false;
  if (dateStartMs != null && startMs < dateStartMs) return false;
  if (dateEndMs != null && startMs > dateEndMs) return false;
  return true;
}

function coerceOptionalPlaudDate(file: PlaudFile): string | null {
  const stringCandidates = [file.start_at, typeof file.created_at === 'string' ? file.created_at : null];
  for (const candidate of stringCandidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      const parsed = Date.parse(candidate);
      if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
    }
  }

  const numericCandidates = [file.start_time, typeof file.created_at === 'number' ? file.created_at : null];
  for (const candidate of numericCandidates) {
    if (candidate != null && Number.isFinite(candidate) && candidate > 0) {
      return new Date(candidate).toISOString();
    }
  }

  return null;
}

function coerceOptionalPlaudEndTime(file: PlaudFile, startTime: string | null, durationSeconds: number | null): string | null {
  if (file.end_time != null && Number.isFinite(file.end_time) && file.end_time > 0) {
    return new Date(file.end_time).toISOString();
  }
  if (!startTime || durationSeconds == null) return null;
  return new Date(new Date(startTime).getTime() + durationSeconds * 1000).toISOString();
}

function normalizePlaudDurationSeconds(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value < 0) return null;
  return Math.round(value / 1000);
}

function parseOptionalDateMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function quotePostgrestInValue(value: string): string {
  return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

async function updatePlaudSourceState(
  supabase: any,
  sourceId: string,
  userId: string,
  connectionMetadata: PlaudConnectionMetadata,
  errorMessage: string | null,
  updateLastSyncAt = true,
): Promise<void> {
  const update: Record<string, unknown> = {
    connection_metadata: connectionMetadata,
    error_message: errorMessage,
    updated_at: new Date().toISOString(),
  };

  if (!errorMessage && updateLastSyncAt) {
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
