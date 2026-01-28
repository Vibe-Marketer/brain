import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ZoomClient } from '../_shared/zoom-client.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

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

    // Get user ID from JWT
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

    const { code, state } = await req.json();

    if (!code || !state) {
      return new Response(
        JSON.stringify({ error: 'Missing code or state' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify state to prevent CSRF
    const { data: settings } = await supabase
      .from('user_settings')
      .select('zoom_oauth_state')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!settings || settings.zoom_oauth_state !== state) {
      return new Response(
        JSON.stringify({ error: 'Invalid state parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Zoom OAuth credentials
    const clientId = Deno.env.get('ZOOM_OAUTH_CLIENT_ID');
    const clientSecret = Deno.env.get('ZOOM_OAUTH_CLIENT_SECRET');
    const redirectUri = 'https://app.callvaultai.com/oauth/callback/';

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: 'Zoom OAuth not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Zoom OAuth callback - Production mode');
    console.log('Redirect URI:', redirectUri);

    // Exchange code for tokens using ZoomClient
    const tokenResponse = await ZoomClient.exchangeCodeForTokens(
      code,
      clientId,
      clientSecret,
      redirectUri
    );

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', tokenResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to exchange authorization code' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokens = await tokenResponse.json();

    // Calculate token expiry (Zoom tokens typically expire in 1 hour)
    const expiresAt = Date.now() + (tokens.expires_in * 1000);

    // Store tokens in database
    const { error: updateError } = await supabase
      .from('user_settings')
      .update({
        zoom_oauth_access_token: tokens.access_token,
        zoom_oauth_refresh_token: tokens.refresh_token,
        zoom_oauth_token_expires: expiresAt,
        zoom_oauth_state: null, // Clear the state
      })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error storing tokens:', updateError);
      throw updateError;
    }

    console.log('Zoom OAuth tokens stored successfully for user:', user.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Successfully connected to Zoom',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Zoom OAuth callback error:', error);
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
