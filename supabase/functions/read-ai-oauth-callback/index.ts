import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateRequest } from '../_shared/auth.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { ReadAiClient } from '../_shared/read-ai-client.ts';
import { resolveReadAiSource } from '../_shared/read-ai-source.ts';

interface ReadAiOAuthCallbackRequest {
  code?: string;
  state?: string;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const authResult = await authenticateRequest(req, supabase as any, corsHeaders);
    if (authResult instanceof Response) return authResult;
    const userId = authResult.userId;

    const { code, state } = await req.json() as ReadAiOAuthCallbackRequest;
    if (!code || !state) return json({ error: 'Missing code or state' }, 400, corsHeaders);

    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('oauth_state, pending_import_source_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (settingsError) throw settingsError;

    if (!settings?.oauth_state || settings.oauth_state !== `read-ai:${state}`) {
      return json({ error: 'Invalid state parameter' }, 400, corsHeaders);
    }
    const sourceId = settings.pending_import_source_id;
    if (!sourceId) return json({ error: 'No pending import source found. Please connect Read.ai again.' }, 400, corsHeaders);
    const source = await resolveReadAiSource(supabase, userId, sourceId);
    if (!source) return json({ error: 'Pending Read.ai source was not found. Please connect Read.ai again.' }, 400, corsHeaders);

    const clientId = Deno.env.get('READAI_OAUTH_CLIENT_ID');
    const clientSecret = Deno.env.get('READAI_OAUTH_CLIENT_SECRET');
    const redirectUri = Deno.env.get('READAI_OAUTH_REDIRECT_URI')
      || `${Deno.env.get('SITE_URL') || 'https://app.callvaultai.com'}/oauth/callback/read-ai`;
    if (!clientId || !clientSecret) {
      return json({ error: 'Read.ai OAuth is not configured. Set READAI_OAUTH_CLIENT_ID and READAI_OAUTH_CLIENT_SECRET.' }, 500, corsHeaders);
    }

    const tokens = await ReadAiClient.exchangeCodeForTokens({ clientId, clientSecret, code, redirectUri });
    const expiresAt = tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null;
    await storeTokens(supabase, sourceId, userId, tokens.access_token, tokens.refresh_token ?? null, expiresAt, true);

    const { error: settingsClearError } = await supabase
      .from('user_settings')
      .update({ oauth_state: null, pending_import_source_id: null })
      .eq('user_id', userId);
    if (settingsClearError) throw settingsClearError;

    let accountEmail: string | null = extractEmailFromJwt(tokens.id_token);
    try {
      await new ReadAiClient({ accessToken: tokens.access_token }).testToken();
    } catch (error) {
      console.warn('Read.ai token test failed after OAuth callback:', error);
    }

    const { error: sourceUpdateError } = await supabase
      .from('import_sources')
      .update({
        account_email: accountEmail,
        connection_metadata: { auth_type: 'oauth', scope: tokens.scope ?? null },
        error_message: null,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sourceId)
      .eq('user_id', userId);
    if (sourceUpdateError) {
      console.error('Failed to activate Read.ai source after OAuth:', { userId, sourceId, error: sourceUpdateError });
      throw new Error('Read.ai connected, but activating the source failed. Try reconnecting.');
    }

    const authHeaderForward = req.headers.get('Authorization') || '';
    const syncTask = supabase.functions.invoke('read-ai-sync-meetings', {
      body: { sourceId },
      headers: { Authorization: authHeaderForward, 'Content-Type': 'application/json' },
    }).then((result: { error?: unknown }) => {
      if (result.error) console.error('[read-ai-oauth-callback] initial sync invoke error:', result.error);
    }).catch((error: unknown) => console.error('[read-ai-oauth-callback] initial sync invoke threw:', error));

    // @ts-expect-error EdgeRuntime is available in Supabase Edge Functions.
    EdgeRuntime.waitUntil(syncTask);

    return json({
      success: true,
      message: 'Successfully connected to Read.ai. Your meetings are syncing in the background.',
      sourceId,
      accountEmail,
      backfillTriggered: true,
    }, 200, corsHeaders);
  } catch (error) {
    console.error('Read.ai OAuth callback error:', error);
    return json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500, corsHeaders);
  }
});

async function storeTokens(
  supabase: any,
  sourceId: string,
  userId: string,
  accessToken: string,
  refreshToken: string | null,
  tokenExpires: number | null,
  isActive: boolean,
) {
  const encryptionKey = Deno.env.get('OAUTH_ENCRYPTION_KEY');
  if (encryptionKey) {
    const { error } = await supabase.rpc('store_encrypted_oauth_tokens', {
      p_source_id: sourceId,
      p_user_id: userId,
      p_access_token: accessToken,
      p_refresh_token: refreshToken,
      p_token_expires: tokenExpires,
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
      oauth_token_expires: tokenExpires,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sourceId)
    .eq('user_id', userId);
  if (error) throw error;
}

function extractEmailFromJwt(jwt: string | null | undefined): string | null {
  if (!jwt) return null;
  try {
    const payload = JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, unknown>;
    return typeof payload.email === 'string' && payload.email.includes('@') ? payload.email : null;
  } catch {
    return null;
  }
}

function json(payload: unknown, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
