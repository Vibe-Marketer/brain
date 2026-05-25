import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateRequest } from '../_shared/auth.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { getDecryptedOAuthTokens } from '../_shared/oauth-encrypt.ts';
import { GrainClient } from '../_shared/grain-client.ts';

interface GrainRefreshRequest {
  sourceId?: string | null;
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
    const body = await req.json().catch(() => ({})) as GrainRefreshRequest;

    const source = await resolveSource(supabase, userId, body.sourceId ?? null);
    if (!source) return json({ error: 'Grain is not connected.' }, 400, corsHeaders);

    const tokens = await getDecryptedOAuthTokens(supabase as any, source.id, userId);
    if (!tokens.refresh_token) {
      await markSourceError(supabase, source.id, userId, 'Grain refresh token is missing. Reconnect Grain.');
      return json({ error: 'Grain refresh token is missing. Reconnect Grain.' }, 400, corsHeaders);
    }

    const clientId = Deno.env.get('GRAIN_OAUTH_CLIENT_ID');
    const clientSecret = Deno.env.get('GRAIN_OAUTH_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      return json({ error: 'Grain OAuth is not configured.' }, 500, corsHeaders);
    }

    const refreshed = await GrainClient.refreshTokens({ clientId, clientSecret, refreshToken: tokens.refresh_token });
    const expiresAt = refreshed.expires_in ? Date.now() + refreshed.expires_in * 1000 : null;
    await storeTokens(supabase, source.id, userId, refreshed.access_token, refreshed.refresh_token ?? tokens.refresh_token, expiresAt);
    await markSourceError(supabase, source.id, userId, null);

    return json({ success: true, sourceId: source.id, accessTokenExpires: expiresAt }, 200, corsHeaders);
  } catch (error) {
    console.error('Grain token refresh error:', error);
    return json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500, corsHeaders);
  }
});

async function resolveSource(supabase: any, userId: string, sourceId: string | null) {
  let query = supabase.from('import_sources').select('id').eq('user_id', userId).eq('source_app', 'grain');
  query = sourceId ? query.eq('id', sourceId) : query.eq('is_active', true).order('updated_at', { ascending: false }).limit(1);
  const { data } = await query.maybeSingle();
  return data as { id: string } | null;
}

async function storeTokens(supabase: any, sourceId: string, userId: string, accessToken: string, refreshToken: string, tokenExpires: number | null) {
  const encryptionKey = Deno.env.get('OAUTH_ENCRYPTION_KEY');
  if (encryptionKey) {
    const { error } = await supabase.rpc('store_encrypted_oauth_tokens', {
      p_source_id: sourceId,
      p_user_id: userId,
      p_access_token: accessToken,
      p_refresh_token: refreshToken,
      p_token_expires: tokenExpires,
      p_encryption_key: encryptionKey,
      p_is_active: true,
    });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('import_sources')
      .update({ oauth_access_token: accessToken, oauth_refresh_token: refreshToken, oauth_token_expires: tokenExpires, is_active: true, updated_at: new Date().toISOString() })
      .eq('id', sourceId)
      .eq('user_id', userId);
    if (error) throw error;
  }
}

async function markSourceError(supabase: any, sourceId: string, userId: string, errorMessage: string | null) {
  await supabase.from('import_sources').update({ error_message: errorMessage, updated_at: new Date().toISOString() }).eq('id', sourceId).eq('user_id', userId);
}

function json(payload: unknown, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
