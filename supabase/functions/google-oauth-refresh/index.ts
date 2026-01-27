import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

/**
 * Helper function to refresh Google OAuth tokens.
 * Called internally by other edge functions when tokens expire.
 */
export async function refreshGoogleOAuthTokens(userId: string, refreshToken: string) {
  const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error('OAuth not configured');
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
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
    throw new Error('Failed to refresh access token');
  }

  const tokens = await tokenResponse.json();
  const expiresAt = Date.now() + (tokens.expires_in * 1000);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Store new tokens (Google may not return a new refresh_token on refresh)
  const updateData: Record<string, unknown> = {
    google_oauth_access_token: tokens.access_token,
    google_oauth_token_expires: expiresAt,
  };

  // Only update refresh token if Google returns a new one
  if (tokens.refresh_token) {
    updateData.google_oauth_refresh_token = tokens.refresh_token;
  }

  await supabase
    .from('user_settings')
    .update(updateData)
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

    // Get refresh token
    const { data: settings } = await supabase
      .from('user_settings')
      .select('google_oauth_refresh_token')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!settings?.google_oauth_refresh_token) {
      return new Response(
        JSON.stringify({ error: 'No refresh token found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const newAccessToken = await refreshGoogleOAuthTokens(user.id, settings.google_oauth_refresh_token);

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
