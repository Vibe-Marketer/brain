import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { refreshZoomOAuthTokens } from '../_shared/zoom-token-refresh.ts';
import { authenticateRequest } from '../_shared/auth.ts';

// Re-export so any remaining imports from this file still work
export { refreshZoomOAuthTokens };

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

    // Get Zoom refresh token
    const { data: settings } = await supabase
      .from('user_settings')
      .select('zoom_oauth_refresh_token')
      .eq('user_id', userId)
      .maybeSingle();

    if (!settings?.zoom_oauth_refresh_token) {
      return new Response(
        JSON.stringify({ error: 'No Zoom refresh token found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const newAccessToken = await refreshZoomOAuthTokens(userId, settings.zoom_oauth_refresh_token);

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
