import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateRequest } from '../_shared/auth.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { json, resolveOAuthAccessToken } from '../_shared/connector-function-utils.ts';
import { deleteHook, GrainClient, listHooks, type GrainHook } from '../_shared/grain-client.ts';
import { buildPublicWebhookUrl } from '../_shared/public-webhook-url.ts';
import { resolveGrainSource } from '../_shared/grain-source.ts';

interface GrainDisconnectRequest {
  sourceId?: string | null;
}

interface GrainDisconnectSource {
  id: string;
  webhook_path_token: string | null;
  connection_metadata: Record<string, unknown> | null;
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

    const body = await req.json().catch(() => ({})) as GrainDisconnectRequest;
    const source = await resolveGrainSource<GrainDisconnectSource>(
      supabase,
      userId,
      body.sourceId ?? null,
      'id, webhook_path_token, connection_metadata',
    );
    if (!source) return json({ error: 'Grain source not found.' }, 404, corsHeaders);

    const cleanup = await cleanupGrainHooks({ supabase, source, userId });
    const metadata = {
      ...(source.connection_metadata ?? {}),
      grain_webhooks: [],
      grain_webhook_disconnect: {
        attempted_at: new Date().toISOString(),
        deleted_hook_ids: cleanup.deletedHookIds,
        failed_hook_ids: cleanup.failedHookIds,
        error: cleanup.error,
      },
    };

    const { error: updateError } = await supabase
      .from('import_sources')
      .update({
        is_active: false,
        error_message: cleanup.error,
        connection_metadata: metadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', source.id)
      .eq('user_id', userId)
      .eq('source_app', 'grain');
    if (updateError) throw updateError;

    return json({
      success: true,
      disconnected: true,
      sourceId: source.id,
      webhookCleanup: cleanup,
    }, 200, corsHeaders);
  } catch (error) {
    console.error('Grain disconnect error:', error);
    return json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500, corsHeaders);
  }
});

async function cleanupGrainHooks({
  supabase,
  source,
  userId,
}: {
  supabase: any;
  source: GrainDisconnectSource;
  userId: string;
}): Promise<{ deletedHookIds: string[]; failedHookIds: string[]; error: string | null }> {
  try {
    const accessToken = await resolveOAuthAccessToken({
      supabase,
      sourceId: source.id,
      userId,
      providerLabel: 'Grain',
      clientIdEnv: 'GRAIN_OAUTH_CLIENT_ID',
      clientSecretEnv: 'GRAIN_OAUTH_CLIENT_SECRET',
      refreshTokens: GrainClient.refreshTokens,
    });
    const hookIds = await resolveHookIds(accessToken, source);
    const deletedHookIds: string[] = [];
    const failedHookIds: string[] = [];

    for (const hookId of hookIds) {
      try {
        await deleteHook(accessToken, hookId);
        deletedHookIds.push(hookId);
      } catch (error) {
        console.error('Failed to delete Grain hook:', hookId, error);
        failedHookIds.push(hookId);
      }
    }

    return {
      deletedHookIds,
      failedHookIds,
      error: failedHookIds.length ? `Failed to delete ${failedHookIds.length} Grain webhook(s)` : null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Grain webhook cleanup error';
    console.error('Grain webhook cleanup skipped:', message);
    return { deletedHookIds: [], failedHookIds: [], error: message };
  }
}

async function resolveHookIds(accessToken: string, source: GrainDisconnectSource): Promise<string[]> {
  const fromMetadata = getHookIdsFromMetadata(source.connection_metadata);
  const hookUrl = source.webhook_path_token ? buildHookUrl(source.webhook_path_token) : null;
  const byUrl = hookUrl ? await listMatchingHookIds(accessToken, hookUrl) : [];
  return [...new Set([...fromMetadata, ...byUrl])];
}

function getHookIdsFromMetadata(metadata: Record<string, unknown> | null): string[] {
  const hooks = metadata?.grain_webhooks;
  if (!Array.isArray(hooks)) return [];
  return hooks
    .map((hook) => hook && typeof hook === 'object' ? (hook as { id?: unknown }).id : null)
    .filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
}

async function listMatchingHookIds(accessToken: string, hookUrl: string): Promise<string[]> {
  const responses = await Promise.all([
    listHooks(accessToken, { hookType: 'recording_added', state: 'enabled' }),
    listHooks(accessToken, { hookType: 'recording_updated', state: 'enabled' }),
  ]);
  return responses
    .flatMap((response) => response.hooks ?? [])
    .filter((hook: GrainHook) => hook.enabled !== false && hook.hook_url === hookUrl)
    .map((hook) => hook.id)
    .filter((id) => id.trim().length > 0);
}

function buildHookUrl(pathToken: string): string {
  const configured = Deno.env.get('GRAIN_WEBHOOK_URL')?.replace(/\/+$/, '');
  if (configured) return `${configured}/${encodeURIComponent(pathToken)}`;
  return buildPublicWebhookUrl('grain-webhook', encodeURIComponent(pathToken));
}
