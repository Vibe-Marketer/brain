import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { authenticateRequest } from '../_shared/auth.ts';
import { getDecryptedUserSettingsFathomTokens } from '../_shared/user-settings-encrypt.ts';

/**
 * Helper function to refresh OAuth tokens
 * Called internally by other edge functions when tokens expire
 */
export async function refreshOAuthTokens(userId: string, refreshToken: string) {
  const clientId = Deno.env.get('FATHOM_OAUTH_CLIENT_ID');
  const clientSecret = Deno.env.get('FATHOM_OAUTH_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error('OAuth not configured');
  }

  const tokenResponse = await fetch('https://fathom.video/external/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error('Token refresh failed:', tokenResponse.status, errorText);

    if (tokenResponse.status >= 400 && tokenResponse.status < 500) {
      // service-role required: server-to-server token refresh against Fathom; updates user_settings.oauth_access_token without the user actively present.
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      await supabase
        .from('user_settings')
        .update({
          oauth_access_token: null,
          oauth_refresh_token: null,
          oauth_token_expires: null,
        })
        .eq('user_id', userId);
    }

    throw new Error('Failed to refresh access token');
  }

  const tokens = await tokenResponse.json();
  const expiresAt = Date.now() + (tokens.expires_in * 1000);

   const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
   const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
   const supabase = createClient(supabaseUrl, supabaseServiceKey);

   // Store new tokens in both user_settings (backward compatibility) and import_sources (new canonical location)
   await supabase
     .from('user_settings')
     .update({
       oauth_access_token: tokens.access_token,
       oauth_refresh_token: tokens.refresh_token,
       oauth_token_expires: expiresAt,
     })
     .eq('user_id', userId);

   // Also update import_sources for Fathom connections (multi-account support)
   try {
     await supabase
       .from('import_sources')
       .update({
         oauth_access_token: tokens.access_token,
         oauth_refresh_token: tokens.refresh_token,
         oauth_token_expires: expiresAt,
         updated_at: new Date().toISOString(),
       })
       .eq('user_id', userId)
       .eq('source_app', 'fathom');
   } catch (importSourceError) {
     // Non-critical if import_sources update fails - tokens are still in user_settings
     console.warn('Could not update import_sources with refreshed tokens:', importSourceError.message);
   }

  return tokens.access_token;
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

        // SEC-02A: Authenticate via shared helper (Phase 37 shared-auth migration)
    const authResult = await authenticateRequest(req, supabase, corsHeaders);
    if (authResult instanceof Response) return authResult;
    const userId = authResult.userId;

    // Get decrypted OAuth tokens (falls back to plaintext if needed)
    const oauthTokens = await getDecryptedUserSettingsFathomTokens(supabase, userId);

    if (!oauthTokens.refresh_token) {
      return new Response(
        JSON.stringify({ error: 'No refresh token found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const newAccessToken = await refreshOAuthTokens(userId, oauthTokens.refresh_token);

    return new Response(
      JSON.stringify({
        success: true,
        accessToken: newAccessToken,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Token refresh error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
