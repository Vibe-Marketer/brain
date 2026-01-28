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

    // Get Zoom OAuth credentials
    const clientId = Deno.env.get('ZOOM_OAUTH_CLIENT_ID');
    const redirectUri = 'https://app.callvaultai.com/oauth/callback/zoom';

    if (!clientId) {
      return new Response(
        JSON.stringify({ error: 'Zoom OAuth not configured. Contact administrator.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Zoom OAuth - Generating authorization URL');
    console.log('Redirect URI:', redirectUri);

    // Generate random state for CSRF protection
    const state = crypto.randomUUID();

    // Store state in user_settings for validation
    await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        zoom_oauth_state: state,
      }, {
        onConflict: 'user_id'
      });

    // Build authorization URL using ZoomClient helper
    const authUrl = ZoomClient.generateAuthorizationUrl(clientId, redirectUri, state);

    console.log('Generated Zoom OAuth URL for user:', user.id);

    return new Response(
      JSON.stringify({
        success: true,
        authUrl,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating Zoom OAuth URL:', error);
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
