import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateRequest } from '../_shared/auth.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { GrainClient } from '../_shared/grain-client.ts';
import { resolveGrainSource } from '../_shared/grain-source.ts';

interface GrainConnectTokenRequest {
  sourceId?: string | null;
  accessToken?: string;
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

    const body = await req.json().catch(() => ({})) as GrainConnectTokenRequest;
    const accessToken = body.accessToken?.trim().replace(/^Bearer\s+/i, '') ?? '';
    if (!accessToken) return json({ error: 'Grain bearer token is required.' }, 400, corsHeaders);

    const sourceId = await resolveSourceId(supabase, userId, body.sourceId ?? null, corsHeaders);
    if (sourceId instanceof Response) return sourceId;
    await new GrainClient({ accessToken }).testToken();

    await storeAccessToken(supabase, sourceId, userId, accessToken);
    const { error } = await supabase
      .from('import_sources')
      .update({
        account_email: null,
        connection_metadata: {
          auth_type: 'api_token',
          note: 'Grain Personal Access Tokens and Workspace Access Tokens are accepted as bearer tokens.',
        },
        error_message: null,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sourceId)
      .eq('user_id', userId);
    if (error) throw error;

    const authHeaderForward = req.headers.get('Authorization') || '';
    const webhookTask = supabase.functions.invoke('grain-create-webhooks', {
      body: { sourceId },
      headers: { Authorization: authHeaderForward, 'Content-Type': 'application/json' },
    }).then((result: { error?: unknown }) => {
      if (result.error) console.error('[grain-connect-token] webhook registration invoke error:', result.error);
    }).catch((invokeError: unknown) => console.error('[grain-connect-token] webhook registration invoke threw:', invokeError));
    // @ts-expect-error EdgeRuntime is available in Supabase Edge Functions.
    EdgeRuntime.waitUntil(webhookTask);

    return json({ success: true, sourceId, webhookRegistration: 'triggered' }, 200, corsHeaders);
  } catch (error) {
    console.error('Grain connect-token error:', error);
    return json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500, corsHeaders);
  }
});

async function resolveSourceId(
  supabase: any,
  userId: string,
  sourceId: string | null,
  corsHeaders: Record<string, string>,
): Promise<string | Response> {
  const existing = await resolveGrainSource(supabase, userId, sourceId);
  if (sourceId && !existing) return json({ success: false, error: 'Grain source not found.' }, 404, corsHeaders);
  if (existing?.id) return existing.id;
  const { data, error } = await supabase.from('import_sources').insert({ user_id: userId, source_app: 'grain', is_active: false }).select('id').single();
  if (error || !data?.id) throw new Error(error?.message ?? 'Failed to create Grain import source');
  return data.id;
}

async function storeAccessToken(supabase: any, sourceId: string, userId: string, accessToken: string) {
  const encryptionKey = Deno.env.get('OAUTH_ENCRYPTION_KEY');
  const expiresAt = null;
  if (encryptionKey) {
    const { error } = await supabase.rpc('store_encrypted_oauth_tokens', {
      p_source_id: sourceId,
      p_user_id: userId,
      p_access_token: accessToken,
      p_refresh_token: null,
      p_token_expires: expiresAt,
      p_encryption_key: encryptionKey,
      p_is_active: true,
    });
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from('import_sources').update({
    oauth_access_token: accessToken,
    oauth_refresh_token: null,
    oauth_token_expires: expiresAt,
    is_active: true,
    updated_at: new Date().toISOString(),
  }).eq('id', sourceId).eq('user_id', userId);
  if (error) throw error;
}

function json(payload: unknown, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
