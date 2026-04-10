import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ZoomClient } from './zoom-client.ts';

/**
 * Helper function to refresh Zoom OAuth tokens.
 * Lives in _shared/ so importing it doesn't bring along a Deno.serve() handler.
 */
export async function refreshZoomOAuthTokens(userId: string, refreshToken: string) {
  const clientId = Deno.env.get('ZOOM_OAUTH_CLIENT_ID');
  const clientSecret = Deno.env.get('ZOOM_OAUTH_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error('Zoom OAuth not configured');
  }

  const tokenResponse = await ZoomClient.refreshAccessToken(
    refreshToken,
    clientId,
    clientSecret
  );

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error('Zoom token refresh failed:', tokenResponse.status, errorText);

    // If it's a client error (like invalid grant), clear the tokens to force a reconnect
    if (tokenResponse.status >= 400 && tokenResponse.status < 500) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      await supabase
        .from('user_settings')
        .update({
          zoom_oauth_access_token: null,
          zoom_oauth_refresh_token: null,
          zoom_oauth_token_expires: null,
        })
        .eq('user_id', userId);
    }

    throw new Error('Failed to refresh Zoom access token');
  }

  const tokens = await tokenResponse.json();
  const expiresAt = Date.now() + (tokens.expires_in * 1000);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Store new tokens
  await supabase
    .from('user_settings')
    .update({
      zoom_oauth_access_token: tokens.access_token,
      zoom_oauth_refresh_token: tokens.refresh_token,
      zoom_oauth_token_expires: expiresAt,
    })
    .eq('user_id', userId);

  return tokens.access_token;
}
