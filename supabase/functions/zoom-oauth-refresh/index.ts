import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { refreshZoomOAuthTokens } from '../_shared/zoom-token-refresh.ts';
import { authenticateRequest } from '../_shared/auth.ts';
import { getDecryptedUserSettingsZoomTokens } from '../_shared/user-settings-encrypt.ts';

// Re-export so any remaining imports from this file still work
export { refreshZoomOAuthTokens };

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // service-role required: server-to-server Zoom token refresh; updates user_settings.zoom_oauth_access_token without the user actively present.
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // SEC-02A: Authenticate via shared helper (Phase 37 shared-auth migration)
    const authResult = await authenticateRequest(req, supabase, corsHeaders);
    if (authResult instanceof Response) return authResult;
    const userId = authResult.userId;

    // Get decrypted Zoom OAuth tokens (falls back to plaintext if needed)
    const zoomTokens = await getDecryptedUserSettingsZoomTokens(supabase, userId);

    if (!zoomTokens.refresh_token) {
      return new Response(
        JSON.stringify({ error: 'No Zoom refresh token found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const newAccessToken = await refreshZoomOAuthTokens(userId, zoomTokens.refresh_token);

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
