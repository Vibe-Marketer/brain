import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateRequest } from '../_shared/auth.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { ReadAiClient } from '../_shared/read-ai-client.ts';

interface ReadAiConnectTokenRequest {
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

    const body = await req.json().catch(() => ({})) as ReadAiConnectTokenRequest;
    const accessToken = body.accessToken?.trim().replace(/^Bearer\s+/i, '') ?? '';
    if (!accessToken) return json({ error: 'Read.ai bearer token is required.' }, 400, corsHeaders);

    const sourceId = await resolveSourceId(supabase, userId, body.sourceId ?? null);
    await new ReadAiClient({ accessToken }).testToken();

    await storeAccessToken(supabase, sourceId, userId, accessToken);
    const { error } = await supabase
      .from('import_sources')
      .update({
        account_email: null,
        connection_metadata: {
          auth_type: 'token_paste',
          note: 'Manual Read.ai bearer tokens are short-lived unless paired with a refresh token.',
        },
        error_message: null,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sourceId)
      .eq('user_id', userId);
    if (error) throw error;

    return json({ success: true, sourceId, warning: 'Read.ai pasted access tokens expire quickly. OAuth is recommended.' }, 200, corsHeaders);
  } catch (error) {
    console.error('Read.ai connect-token error:', error);
    return json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500, corsHeaders);
  }
});

async function resolveSourceId(supabase: any, userId: string, sourceId: string | null): Promise<string> {
  if (sourceId) return sourceId;
  const { data: existing } = await supabase.from('import_sources').select('id').eq('user_id', userId).eq('source_app', 'read-ai').limit(1).maybeSingle();
  if (existing?.id) return existing.id;
  const { data, error } = await supabase.from('import_sources').insert({ user_id: userId, source_app: 'read-ai', is_active: false }).select('id').single();
  if (error || !data?.id) throw new Error(error?.message ?? 'Failed to create Read.ai import source');
  return data.id;
}

async function storeAccessToken(supabase: any, sourceId: string, userId: string, accessToken: string) {
  const encryptionKey = Deno.env.get('OAUTH_ENCRYPTION_KEY');
  const expiresAt = Date.now() + 10 * 60 * 1000;
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
