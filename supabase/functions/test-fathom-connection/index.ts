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

    // Retrieve the user's credentials (OAuth or API key)
    const { data: settings, error: configError } = await supabase
      .from('user_settings')
      .select('fathom_api_key, oauth_access_token, oauth_token_expires')
      .eq('user_id', user.id)
      .maybeSingle();

    if (configError) throw configError;

    if (!settings?.fathom_api_key && !settings?.oauth_access_token) {
      throw new Error('Fathom credentials not configured. Connect via OAuth or add an API key in Settings.');
    }

    // Determine which authentication method to use
    const authHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    let authMethod = '';

    // Check if OAuth token is available and not expired
    const oauthTokenExpires = settings.oauth_token_expires ? new Date(settings.oauth_token_expires) : null;
    const isOAuthValid = settings.oauth_access_token && oauthTokenExpires && oauthTokenExpires > new Date();

    if (isOAuthValid) {
      authHeaders['Authorization'] = `Bearer ${settings.oauth_access_token}`;
      authMethod = 'OAuth';
    } else if (settings.fathom_api_key) {
      authHeaders['X-Api-Key'] = settings.fathom_api_key;
      authMethod = 'API Key';
    } else {
      throw new Error('OAuth token has expired. Please reconnect your Fathom account in Settings.');
    }

    console.log(`Testing Fathom connection using ${authMethod} authentication`);

    // Test the connection with a simple API call
    const response = await fetch(
      'https://api.fathom.ai/external/v1/meetings?limit=1',
      { headers: authHeaders }
    );

    if (!response.ok) {
      console.error('Fathom API test failed:', response.status, await response.text());
      throw new Error(`Invalid API key or connection failed (${response.status})`);
    }

    const data = await response.json();
    console.log(`Fathom API test successful for user: ${user.id} using ${authMethod}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Connection successful via ${authMethod}`,
        authMethod,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error testing Fathom connection:', error);
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
