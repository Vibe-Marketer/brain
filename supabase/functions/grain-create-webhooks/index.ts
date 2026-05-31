import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateRequest } from '../_shared/auth.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { json, resolveOAuthAccessToken } from '../_shared/connector-function-utils.ts';
import { createHook, GrainClient, listHooks, type GrainHook, type GrainHookType } from '../_shared/grain-client.ts';
import { buildPublicWebhookUrl } from '../_shared/public-webhook-url.ts';
import { resolveGrainSource } from '../_shared/grain-source.ts';

interface GrainCreateWebhooksRequest {
  sourceId?: string | null;
}

interface GrainWebhookSource {
  id: string;
  webhook_path_token: string | null;
  connection_metadata: Record<string, unknown> | null;
}

const GRAIN_WEBHOOK_TYPES: GrainHookType[] = ['recording_added', 'recording_updated'];
const GRAIN_WEBHOOK_INCLUDE = { participants: true, ai_summary: true, ai_action_items: true, calendar_event: true };

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const authResult = await authenticateRequest(req, supabase as any, corsHeaders);
    if (authResult instanceof Response) return authResult;
    const userId = authResult.userId;

    const body = await req.json().catch(() => ({})) as GrainCreateWebhooksRequest;
    const source = await resolveGrainSource<GrainWebhookSource>(
      supabase,
      userId,
      body.sourceId ?? null,
      'id, webhook_path_token, connection_metadata',
    );
    if (!source) return json({ error: 'Grain is not connected. Connect Grain first.' }, 400, corsHeaders);

    const accessToken = await resolveOAuthAccessToken({
      supabase,
      sourceId: source.id,
      userId,
      providerLabel: 'Grain',
      clientIdEnv: 'GRAIN_OAUTH_CLIENT_ID',
      clientSecretEnv: 'GRAIN_OAUTH_CLIENT_SECRET',
      refreshTokens: GrainClient.refreshTokens,
    });

    const pathToken = source.webhook_path_token ?? generateWebhookPathToken();
    const hookUrl = buildHookUrl(pathToken);
    if (!source.webhook_path_token) {
      const { error: tokenUpdateError } = await supabase
        .from('import_sources')
        .update({
          webhook_path_token: pathToken,
          updated_at: new Date().toISOString(),
        })
        .eq('id', source.id)
        .eq('user_id', userId);
      if (tokenUpdateError) throw tokenUpdateError;
    }

    const existingHooks = await listAllHooks(accessToken);
    const hooks: GrainHook[] = [];

    for (const hookType of GRAIN_WEBHOOK_TYPES) {
      const existing = existingHooks.find(
        (hook) => hook.enabled !== false && hook.hook_url === hookUrl && hook.hook_type === hookType,
      );
      hooks.push(existing ?? await createHook(accessToken, {
        hookUrl,
        hookType,
        include: GRAIN_WEBHOOK_INCLUDE,
      }));
    }

    const metadata = {
      ...(source.connection_metadata ?? {}),
      grain_webhooks: hooks.map((hook) => ({
        id: hook.id,
        hook_type: hook.hook_type,
        hook_url: hook.hook_url ?? hookUrl,
      })),
    };
    const { error: updateError } = await supabase
      .from('import_sources')
      .update({
        webhook_path_token: pathToken,
        connection_metadata: metadata,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', source.id)
      .eq('user_id', userId);
    if (updateError) throw updateError;

    return json({ success: true, sourceId: source.id, hookUrl, hooks }, 200, corsHeaders);
  } catch (error) {
    console.error('Grain webhook registration error:', error);
    return json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500, corsHeaders);
  }
});

async function listAllHooks(accessToken: string): Promise<GrainHook[]> {
  const byType = await Promise.all(
    GRAIN_WEBHOOK_TYPES.map((hookType) => listHooks(accessToken, { hookType, state: 'enabled' })),
  );
  return byType.flatMap((response) => response.hooks ?? []);
}

function buildHookUrl(pathToken: string): string {
  const configured = Deno.env.get('GRAIN_WEBHOOK_URL')?.replace(/\/+$/, '');
  if (configured) return `${configured}/${encodeURIComponent(pathToken)}`;
  return buildPublicWebhookUrl('grain-webhook', encodeURIComponent(pathToken));
}

function generateWebhookPathToken(): string {
  return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
}
