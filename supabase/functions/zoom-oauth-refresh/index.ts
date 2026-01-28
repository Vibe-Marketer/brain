import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ZoomClient } from '../_shared/zoom-client.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

/**
 * Helper function to refresh Zoom OAuth tokens
 * Called internally by other edge functions when tokens expire
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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Zoom refresh token
    const { data: settings } = await supabase
      .from('user_settings')
      .select('zoom_oauth_refresh_token')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!settings?.zoom_oauth_refresh_token) {
      return new Response(
        JSON.stringify({ error: 'No Zoom refresh token found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const newAccessToken = await refreshZoomOAuthTokens(user.id, settings.zoom_oauth_refresh_token);

    return new Response(
      JSON.stringify({
        success: true,
        accessToken: newAccessToken,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Zoom token refresh error:', error);
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
