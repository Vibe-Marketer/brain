import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
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
      .select('oauth_state')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!settings || settings.oauth_state !== state) {
      return new Response(
        JSON.stringify({ error: 'Invalid state parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get production OAuth credentials
    const clientId = Deno.env.get('FATHOM_OAUTH_CLIENT_ID');
    const clientSecret = Deno.env.get('FATHOM_OAUTH_CLIENT_SECRET');
    const redirectUri = 'https://app.callvaultai.com/oauth/callback';

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: 'OAuth not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fathom OAuth callback - Production mode');
    console.log('Redirect URI:', redirectUri);

    // Exchange code for tokens
    const tokenResponse = await fetch('https://fathom.video/external/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', tokenResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to exchange authorization code' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokens = await tokenResponse.json();

    // Calculate token expiry (usually 1 hour from now)
    const expiresAt = Date.now() + (tokens.expires_in * 1000);

    // Store tokens in database
    const { error: updateError } = await supabase
      .from('user_settings')
      .update({
        oauth_access_token: tokens.access_token,
        oauth_refresh_token: tokens.refresh_token,
        oauth_token_expires: expiresAt,
        oauth_state: null, // Clear the state
      })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error storing tokens:', updateError);
      throw updateError;
    }

    console.log('OAuth tokens stored successfully for user:', user.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Successfully connected to Fathom',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('OAuth callback error:', error);
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
