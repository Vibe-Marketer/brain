import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateRequest } from '../_shared/auth.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { GrainClient, parseGrainOAuthState } from '../_shared/grain-client.ts';
import { resolveGrainSource } from '../_shared/grain-source.ts';

interface GrainOAuthCallbackRequest {
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

    const { code, state } = await req.json() as GrainOAuthCallbackRequest;
    if (!code || !state) return json({ error: 'Missing code or state' }, 400, corsHeaders);

    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('oauth_state, pending_import_source_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (settingsError) throw settingsError;

    const grainState = parseGrainOAuthState(settings?.oauth_state);
    if (!grainState || grainState.state !== state) {
      return json({ error: 'Invalid state parameter' }, 400, corsHeaders);
    }
    const sourceId = settings.pending_import_source_id;
    if (!sourceId) return json({ error: 'No pending import source found. Please connect Grain again.' }, 400, corsHeaders);
    const source = await resolveGrainSource(supabase, userId, sourceId);
    if (!source) return json({ error: 'Pending Grain source was not found. Please connect Grain again.' }, 400, corsHeaders);

    const clientId = Deno.env.get('GRAIN_OAUTH_CLIENT_ID');
    const clientSecret = Deno.env.get('GRAIN_OAUTH_CLIENT_SECRET');
    const redirectUri = Deno.env.get('GRAIN_OAUTH_REDIRECT_URI')
      || `${Deno.env.get('SITE_URL') || 'https://app.callvaultai.com'}/oauth/callback/grain`;
    if (!clientId || !clientSecret) {
      return json({ error: 'Grain OAuth is not configured. Set GRAIN_OAUTH_CLIENT_ID and GRAIN_OAUTH_CLIENT_SECRET.' }, 500, corsHeaders);
    }

    const tokens = await GrainClient.exchangeCodeForTokens({
      clientId,
      clientSecret,
      code,
      redirectUri,
      codeVerifier: grainState.codeVerifier,
    });
    const expiresAt = tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null;
    await storeTokens(supabase, sourceId, userId, tokens.access_token, tokens.refresh_token ?? null, expiresAt, true);

    const { error: settingsClearError } = await supabase
      .from('user_settings')
      .update({ oauth_state: null, pending_import_source_id: null })
      .eq('user_id', userId);
    if (settingsClearError) throw settingsClearError;

    try {
      await new GrainClient({ accessToken: tokens.access_token }).testToken();
    } catch (error) {
      console.warn('Grain token test failed after OAuth callback:', error);
    }

    const { error: sourceUpdateError } = await supabase
      .from('import_sources')
      .update({
        account_email: null,
        connection_metadata: { auth_type: 'oauth' },
        error_message: null,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sourceId)
      .eq('user_id', userId);
    if (sourceUpdateError) {
      console.error('Failed to activate Grain source after OAuth:', { userId, sourceId, error: sourceUpdateError });
      throw new Error('Grain connected, but activating the source failed. Try reconnecting.');
    }

    const authHeaderForward = req.headers.get('Authorization') || '';
    const syncTask = supabase.functions.invoke('grain-sync-recordings', {
      body: { sourceId },
      headers: { Authorization: authHeaderForward, 'Content-Type': 'application/json' },
    }).then((result: { error?: unknown }) => {
      if (result.error) console.error('[grain-oauth-callback] initial sync invoke error:', result.error);
    }).catch((error: unknown) => console.error('[grain-oauth-callback] initial sync invoke threw:', error));

    // @ts-expect-error EdgeRuntime is available in Supabase Edge Functions.
    EdgeRuntime.waitUntil(syncTask);

    return json({
      success: true,
      message: 'Successfully connected to Grain. Your meetings are syncing in the background.',
      sourceId,
      accountEmail: null,
      backfillTriggered: true,
    }, 200, corsHeaders);
  } catch (error) {
    console.error('Grain OAuth callback error:', error);
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

function json(payload: unknown, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
