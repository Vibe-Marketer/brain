import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ZoomClient } from '../_shared/zoom-client.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { authenticateRequest } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // service-role required: writes oauth_state into user_settings to bind the user to a CSRF-safe state value before redirect.
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user ID from JWT
        // SEC-02A: Authenticate via shared helper (Phase 37 shared-auth migration)
    const authResult = await authenticateRequest(req, supabase, corsHeaders);
    if (authResult instanceof Response) return authResult;
    const userId = authResult.userId;

    // Get Zoom OAuth credentials
    const clientId = Deno.env.get('ZOOM_OAUTH_CLIENT_ID');
    const siteUrl = Deno.env.get('SITE_URL') || 'https://app.callvaultai.com';
    const redirectUri = `${siteUrl}/oauth/callback/zoom`;

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
        user_id: userId,
        zoom_oauth_state: state,
      }, {
        onConflict: 'user_id'
      });

    // Build authorization URL using ZoomClient helper
    const authUrl = ZoomClient.generateAuthorizationUrl(clientId, redirectUri, state);

    console.log('Generated Zoom OAuth URL for user:', userId);

    return new Response(
      JSON.stringify({
        success: true,
        authUrl,
        state,
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
