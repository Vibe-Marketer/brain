import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
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

    // Get production OAuth credentials
    const clientId = Deno.env.get('FATHOM_OAUTH_CLIENT_ID');
    const redirectUri = 'https://app.callvaultai.com/oauth/callback/';

    if (!clientId) {
      return new Response(
        JSON.stringify({ error: 'OAuth not configured. Contact administrator.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fathom OAuth - Production mode');
    console.log('Redirect URI:', redirectUri);

    // Generate random state for CSRF protection
    const state = crypto.randomUUID();
    
    // Store state in user_settings for validation
    await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        oauth_state: state,
      }, {
        onConflict: 'user_id'
      });

    // Build authorization URL (note: external/v1 path is required)
    const authUrl = new URL('https://fathom.video/external/v1/oauth2/authorize');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'public_api');
    authUrl.searchParams.set('state', state);

    console.log('Generated OAuth URL for user:', user.id);

    return new Response(
      JSON.stringify({
        success: true,
        authUrl: authUrl.toString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating OAuth URL:', error);
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
