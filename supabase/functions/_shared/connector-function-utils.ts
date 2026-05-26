import { getDecryptedOAuthTokens } from './oauth-encrypt.ts';

type ConnectorSupabaseClient = any;

type ConnectorSyncIdField =
  | 'meetingIds'
  | 'recordingIds'
  | 'transcriptIds'
  | 'fileIds';

export interface ConnectorSyncIdRequest {
  singleCallId?: string | number | null;
  meetingIds?: Array<string | number | null | undefined> | null;
  recordingIds?: Array<string | number | null | undefined> | null;
  transcriptIds?: Array<string | number | null | undefined> | null;
  fileIds?: Array<string | number | null | undefined> | null;
}

export interface ConnectorDateWindowRequest {
  createdAfter?: string | null;
  createdBefore?: string | null;
  dateStart?: string | null;
  dateEnd?: string | null;
}

export interface ConnectorDateWindow {
  start: string | null;
  end: string | null;
}

export function getConnectorDateWindow(
  body: ConnectorDateWindowRequest,
): ConnectorDateWindow {
  return {
    start: firstConnectorDate(body.createdAfter, body.dateStart),
    end: firstConnectorDate(body.createdBefore, body.dateEnd),
  };
}

export function getConnectorDateWindowMs(
  body: ConnectorDateWindowRequest,
): { startMs: number | null; endMs: number | null } {
  const window = getConnectorDateWindow(body);
  return {
    startMs: window.start ? Date.parse(window.start) : null,
    endMs: window.end ? Date.parse(window.end) : null,
  };
}

export interface ResolveConnectorSyncIdsOptions<TBody extends ConnectorSyncIdRequest> {
  body: TBody;
  idFields: readonly ConnectorSyncIdField[];
  fetchFallbackIds: () => Promise<string[]>;
  maxBatchSize: number;
  emptyError: string;
  tooManyError: (count: number, maxBatchSize: number) => string;
}

export async function resolveConnectorSyncIds<TBody extends ConnectorSyncIdRequest>({
  body,
  idFields,
  fetchFallbackIds,
  maxBatchSize,
  emptyError,
  tooManyError,
}: ResolveConnectorSyncIdsOptions<TBody>): Promise<string[]> {
  const explicitIds = getExplicitConnectorSyncIds(body, idFields);
  const ids = explicitIds.length > 0 ? explicitIds : await fetchFallbackIds();

  if (ids.length === 0) {
    throw new ConnectorRequestValidationError(emptyError);
  }
  if (ids.length > maxBatchSize) {
    throw new ConnectorRequestValidationError(tooManyError(ids.length, maxBatchSize));
  }

  return ids;
}

function firstConnectorDate(
  primary: string | null | undefined,
  fallback: string | null | undefined,
): string | null {
  const primaryDate = normalizeConnectorDate(primary);
  if (primaryDate) return primaryDate;
  return normalizeConnectorDate(fallback);
}

function normalizeConnectorDate(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export class ConnectorRequestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConnectorRequestValidationError';
  }
}

function getExplicitConnectorSyncIds(
  body: ConnectorSyncIdRequest,
  idFields: readonly ConnectorSyncIdField[],
): string[] {
  if (body.singleCallId) return [String(body.singleCallId)];

  for (const field of idFields) {
    const ids = body[field];
    if (Array.isArray(ids) && ids.length > 0) {
      return ids.map(String).filter(Boolean);
    }
  }

  return [];
}

export interface OAuthRefreshResponse {
  access_token: string;
  refresh_token?: string | null;
  expires_in?: number | null;
}

export interface ResolveOAuthAccessTokenOptions<TRefresh extends OAuthRefreshResponse> {
  supabase: ConnectorSupabaseClient;
  sourceId: string;
  userId: string;
  providerLabel: string;
  clientIdEnv: string;
  clientSecretEnv: string;
  refreshTokens: (params: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
  }) => Promise<TRefresh>;
}

export async function resolveOAuthAccessToken<TRefresh extends OAuthRefreshResponse>({
  supabase,
  sourceId,
  userId,
  providerLabel,
  clientIdEnv,
  clientSecretEnv,
  refreshTokens,
}: ResolveOAuthAccessTokenOptions<TRefresh>): Promise<string> {
  const tokens = await getDecryptedOAuthTokens(supabase, sourceId, userId);
  if (!tokens.access_token) {
    throw new Error(`${providerLabel} access token is missing. Reconnect ${providerLabel}.`);
  }

  if (tokens.token_expires && tokens.token_expires < Date.now() + 30_000) {
    if (!tokens.refresh_token) {
      throw new Error(`${providerLabel} token expired. Reconnect ${providerLabel} with OAuth.`);
    }

    const clientId = Deno.env.get(clientIdEnv);
    const clientSecret = Deno.env.get(clientSecretEnv);
    if (!clientId || !clientSecret) {
      throw new Error(`${providerLabel} OAuth is not configured.`);
    }

    const refreshed = await refreshTokens({
      clientId,
      clientSecret,
      refreshToken: tokens.refresh_token,
    });
    const expiresAt = refreshed.expires_in
      ? Date.now() + refreshed.expires_in * 1000
      : null;
    await persistOAuthTokens({
      supabase,
      sourceId,
      userId,
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token ?? tokens.refresh_token,
      expiresAt,
    });
    return refreshed.access_token;
  }

  return tokens.access_token;
}

export async function fetchSyncedSourceCallIds(
  supabase: ConnectorSupabaseClient,
  userId: string,
  sourceApp: string,
  ids: string[],
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();

  const { data, error } = await supabase
    .from('recordings')
    .select('source_call_id')
    .eq('owner_user_id', userId)
    .eq('source_app', sourceApp)
    .in('source_call_id', ids);
  if (error) throw error;

  return new Set(
    (data ?? [])
      .map((row: { source_call_id?: string | null }) => row.source_call_id)
      .filter((id: string | null | undefined): id is string => Boolean(id)),
  );
}

export async function validateWorkspaceMembership(
  supabase: ConnectorSupabaseClient,
  userId: string,
  workspaceId: string,
  corsHeaders: Record<string, string>,
): Promise<string | Response> {
  const { data, error } = await supabase
    .from('workspace_memberships')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    return json({ error: 'Failed to verify workspace membership. Try again.' }, 500, corsHeaders);
  }
  if (!data) {
    return json({ error: 'You are not a member of the requested workspace.' }, 403, corsHeaders);
  }

  return workspaceId;
}

export function json(
  payload: unknown,
  status: number,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export interface ConnectorSyncJobItemResult {
  status: 'synced' | 'skipped' | 'failed';
  error?: string | null;
}

export interface RunConnectorSyncJobOptions {
  supabase: ConnectorSupabaseClient;
  userId: string;
  sourceId: string;
  ids: string[];
  type: string;
  providerLabel: string;
  itemLabel: string;
  importSource: string;
  waitForCompletion?: boolean;
  corsHeaders: Record<string, string>;
  processItem: (id: string) => Promise<ConnectorSyncJobItemResult>;
}

export async function runConnectorSyncJob({
  supabase,
  userId,
  sourceId,
  ids,
  type,
  providerLabel,
  itemLabel,
  importSource,
  waitForCompletion,
  corsHeaders,
  processItem,
}: RunConnectorSyncJobOptions): Promise<Response> {
  const { data: syncJob, error: jobError } = await supabase
    .from('sync_jobs')
    .insert({
      user_id: userId,
      recording_ids: ids,
      status: 'processing',
      progress_current: 0,
      progress_total: ids.length,
      type,
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
      for (const id of ids) {
        try {
          const result = await processItem(id);
          if (result.status === 'synced') {
            synced.push(id);
          } else if (result.status === 'skipped') {
            skippedCount++;
          } else {
            failed.push(id);
            if (result.error) {
              console.error(`${providerLabel} sync failed for ${id}:`, result.error);
            }
          }
        } catch (error) {
          failed.push(id);
          console.error(`${providerLabel} sync failed for ${id}:`, error);
        }

        await supabase.from('sync_jobs').update({
          progress_current: synced.length + failed.length + skippedCount,
          synced_ids: synced,
          failed_ids: failed,
          skipped_count: skippedCount,
        }).eq('id', jobId);
      }

      const finalStatus = failed.length === 0
        ? 'completed'
        : synced.length === 0 && skippedCount === 0
          ? 'failed'
          : 'completed_with_errors';
      await supabase.from('sync_jobs').update({
        status: finalStatus,
        completed_at: new Date().toISOString(),
        skipped_count: skippedCount,
      }).eq('id', jobId);
      await supabase.from('import_sources').update({
        last_sync_at: new Date().toISOString(),
        error_message: failed.length
          ? `${failed.length} ${providerLabel} ${itemLabel}${failed.length === 1 ? '' : 's'} failed to sync`
          : null,
        updated_at: new Date().toISOString(),
      }).eq('id', sourceId).eq('user_id', userId);

      return { finalStatus, synced, failed, skippedCount };
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : `${providerLabel} sync job crashed`;
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
      }).eq('id', sourceId).eq('user_id', userId);
      return { finalStatus: 'failed', synced, failed, skippedCount, error: message };
    }
  };

  if (waitForCompletion) {
    const result = await processSyncJob();
    return json({ success: true, jobId, result }, 200, corsHeaders);
  }

  // @ts-expect-error EdgeRuntime is available in Supabase Edge Functions.
  EdgeRuntime.waitUntil(processSyncJob());

  return json({
    success: true,
    jobId,
    message: `${providerLabel} sync job started for ${ids.length} ${itemLabel}${ids.length === 1 ? '' : 's'}`,
    importSource,
  }, 200, corsHeaders);
}

/**
 * Encrypt-or-plaintext OAuth token writer.
 *
 * - When `OAUTH_ENCRYPTION_KEY` is set, calls the `store_encrypted_oauth_tokens`
 *   RPC which encrypts at rest. Always sets `is_active` (defaults to true).
 * - When unset (legacy/dev), writes plaintext columns and only flips `is_active`
 *   if the caller asked us to — keeps refresh-token writes from clobbering an
 *   already-active source's flag.
 *
 * Used by both OAuth callbacks (initial token storage, isActive=true) and by
 * `resolveOAuthAccessToken` during refresh (isActive defaults true; refresh
 * implies the source is still working).
 */
export async function persistOAuthTokens({
  supabase,
  sourceId,
  userId,
  accessToken,
  refreshToken,
  expiresAt,
  isActive = true,
}: {
  supabase: ConnectorSupabaseClient;
  sourceId: string;
  userId: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
  isActive?: boolean;
}): Promise<void> {
  const encryptionKey = Deno.env.get('OAUTH_ENCRYPTION_KEY');
  if (encryptionKey) {
    const { error } = await supabase.rpc('store_encrypted_oauth_tokens', {
      p_source_id: sourceId,
      p_user_id: userId,
      p_access_token: accessToken,
      p_refresh_token: refreshToken,
      p_token_expires: expiresAt,
      p_encryption_key: encryptionKey,
      p_is_active: isActive,
    });
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from('import_sources')
    .update({
      oauth_access_token: accessToken,
      oauth_refresh_token: refreshToken,
      oauth_token_expires: expiresAt,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sourceId)
    .eq('user_id', userId);
  if (error) throw error;
}
