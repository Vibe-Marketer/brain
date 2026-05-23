import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateRequest } from '../_shared/auth.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import {
  parseJsonResponse,
  parsePlaudOAuthState,
  PlaudClient,
  type PlaudCurrentUser,
  type PlaudTokenResponse,
} from '../_shared/plaud-client.ts';

interface PlaudOAuthCallbackRequest {
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authResult = await authenticateRequest(req, supabase as any, corsHeaders);
    if (authResult instanceof Response) return authResult;
    const userId = authResult.userId;

    const { code, state } = await req.json() as PlaudOAuthCallbackRequest;
    if (!code || !state) {
      return new Response(
        JSON.stringify({ error: 'Missing code or state' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: settings } = await supabase
      .from('user_settings')
      .select('oauth_state, pending_import_source_id')
      .eq('user_id', userId)
      .maybeSingle();

    const plaudState = parsePlaudOAuthState(settings?.oauth_state);
    if (!settings || !plaudState || plaudState.state !== state) {
      return new Response(
        JSON.stringify({ error: 'Invalid state parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const sourceId = settings.pending_import_source_id;
    if (!sourceId) {
      return new Response(
        JSON.stringify({ error: 'No pending import source found. Please try connecting again.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const clientId = Deno.env.get('PLAUD_OAUTH_CLIENT_ID');
    const clientSecret = Deno.env.get('PLAUD_OAUTH_CLIENT_SECRET') ?? '';
    const redirectUri = Deno.env.get('PLAUD_OAUTH_REDIRECT_URI')
      || `${Deno.env.get('SITE_URL') || 'https://app.callvaultai.com'}/oauth/callback/plaud`;

    if (!clientId) {
      return new Response(
        JSON.stringify({ error: 'Plaud OAuth is not configured. Set PLAUD_OAUTH_CLIENT_ID.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const tokenResponse = await PlaudClient.exchangeCodeForTokens({
      clientId,
      clientSecret,
      code,
      redirectUri,
      codeVerifier: plaudState.codeVerifier,
      state,
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Plaud token exchange failed:', tokenResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to exchange Plaud authorization code' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const tokens = await parseJsonResponse<PlaudTokenResponse>(tokenResponse, 'Plaud token exchange failed');
    const expiresAt = tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null;
    const encryptionKey = Deno.env.get('OAUTH_ENCRYPTION_KEY');

    if (encryptionKey) {
      const { error: encError } = await supabase.rpc('store_encrypted_oauth_tokens', {
        p_source_id: sourceId,
        p_user_id: userId,
        p_access_token: tokens.access_token,
        p_refresh_token: tokens.refresh_token ?? null,
        p_token_expires: expiresAt,
        p_encryption_key: encryptionKey,
        p_is_active: true,
      });
      if (encError) throw encError;
    } else {
      console.warn('OAUTH_ENCRYPTION_KEY not set — storing Plaud OAuth tokens in PLAINTEXT.');
      const { error: updateError } = await supabase
        .from('import_sources')
        .update({
          oauth_access_token: tokens.access_token,
          oauth_refresh_token: tokens.refresh_token ?? null,
          oauth_token_expires: expiresAt,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sourceId)
        .eq('user_id', userId);
      if (updateError) throw updateError;
    }

    await supabase
      .from('user_settings')
      .update({ oauth_state: null, pending_import_source_id: null })
      .eq('user_id', userId);

    let accountEmail: string | null = null;
    try {
      const currentUser = await PlaudClient.getCurrentUser(tokens.access_token);
      accountEmail = extractPlaudAccountEmail(currentUser);
      if (accountEmail) {
        await supabase
          .from('import_sources')
          .update({ account_email: accountEmail })
          .eq('id', sourceId)
          .eq('user_id', userId);
      }
    } catch (error) {
      console.warn('Could not detect Plaud account email:', error);
    }

    const authHeaderForward = req.headers.get('Authorization') || '';
    const syncTask = supabase.functions.invoke('plaud-sync-recordings', {
      body: { sourceId },
      headers: { Authorization: authHeaderForward, 'Content-Type': 'application/json' },
    }).then((result: { error?: unknown }) => {
      if (result.error) console.error('[plaud-oauth-callback] initial sync invoke error:', result.error);
    }).catch((error: unknown) => console.error('[plaud-oauth-callback] initial sync invoke threw:', error));

    // @ts-expect-error EdgeRuntime is available in Supabase Edge Functions.
    EdgeRuntime.waitUntil(syncTask);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Successfully connected to Plaud. Your recordings are syncing in the background.',
        sourceId,
        accountEmail,
        backfillTriggered: true,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Plaud OAuth callback error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

function extractPlaudAccountEmail(user: PlaudCurrentUser): string | null {
  const direct = user.email;
  if (typeof direct === 'string' && direct.includes('@')) return direct;
  for (const value of Object.values(user)) {
    if (typeof value === 'string' && value.includes('@')) return value;
  }
  return null;
}
