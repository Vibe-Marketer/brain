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

  console.log('[zoom-oauth-callback] Starting callback processing');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log('[zoom-oauth-callback] Step 1: Supabase client created');

    // Get user ID from JWT
        // SEC-02A: Authenticate via shared helper (Phase 37 shared-auth migration)
    const authResult = await authenticateRequest(req, supabase, corsHeaders);
    if (authResult instanceof Response) return authResult;
    const userId = authResult.userId;
    console.log('[zoom-oauth-callback] Step 2: User authenticated:', userId);

    const { code, state } = await req.json();
    console.log('[zoom-oauth-callback] Step 3: Received code (length):', code?.length, 'state:', state?.substring(0, 8) + '...');

    if (!code || !state) {
      console.error('[zoom-oauth-callback] Missing code or state');
      return new Response(
        JSON.stringify({ error: 'Missing code or state' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify state to prevent CSRF
    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('zoom_oauth_state')
      .eq('user_id', userId)
      .maybeSingle();

    console.log('[zoom-oauth-callback] Step 4: Settings lookup - found:', !!settings, 'error:', settingsError?.message);
    console.log('[zoom-oauth-callback] State comparison - stored:', settings?.zoom_oauth_state?.substring(0, 8) + '...', 'received:', state?.substring(0, 8) + '...');

    if (!settings || settings.zoom_oauth_state !== state) {
      console.error('[zoom-oauth-callback] State mismatch - stored:', settings?.zoom_oauth_state, 'received:', state);
      return new Response(
        JSON.stringify({ error: 'Invalid state parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log('[zoom-oauth-callback] Step 5: State verified');

    // Get Zoom OAuth credentials
    const clientId = Deno.env.get('ZOOM_OAUTH_CLIENT_ID');
    const clientSecret = Deno.env.get('ZOOM_OAUTH_CLIENT_SECRET');
    const siteUrl = Deno.env.get('SITE_URL') || 'https://app.callvaultai.com';
    const redirectUri = `${siteUrl}/oauth/callback/zoom`;

    console.log('[zoom-oauth-callback] Step 6: Credentials check - clientId exists:', !!clientId, 'clientSecret exists:', !!clientSecret);

    if (!clientId || !clientSecret) {
      console.error('[zoom-oauth-callback] Missing Zoom OAuth credentials');
      return new Response(
        JSON.stringify({ error: 'Zoom OAuth not configured - missing credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[zoom-oauth-callback] Step 7: Exchanging code for tokens...');
    console.log('[zoom-oauth-callback] Using redirect URI:', redirectUri);
    console.log('[zoom-oauth-callback] Using client ID:', clientId.substring(0, 8) + '...');

    // Exchange code for tokens using ZoomClient
    const tokenResponse = await ZoomClient.exchangeCodeForTokens(
      code,
      clientId,
      clientSecret,
      redirectUri
    );

    console.log('[zoom-oauth-callback] Step 8: Token response status:', tokenResponse.status);

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[zoom-oauth-callback] Token exchange failed:', tokenResponse.status, errorText);
      
      // Parse Zoom error for better messaging
      let zoomError = 'Failed to exchange authorization code';
      try {
        const errorJson = JSON.parse(errorText);
        zoomError = errorJson.reason || errorJson.error || errorJson.message || zoomError;
        console.error('[zoom-oauth-callback] Zoom error details:', JSON.stringify(errorJson));
      } catch {
        zoomError = errorText || zoomError;
      }
      
      return new Response(
        JSON.stringify({ error: `Zoom OAuth failed: ${zoomError}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokens = await tokenResponse.json();
    console.log('[zoom-oauth-callback] Step 9: Tokens received - has access_token:', !!tokens.access_token, 'has refresh_token:', !!tokens.refresh_token);

    // Calculate token expiry (Zoom tokens typically expire in 1 hour)
    const expiresAt = Date.now() + (tokens.expires_in * 1000);

    // Store tokens in database
    console.log('[zoom-oauth-callback] Step 10: Storing tokens in database...');
    const { error: updateError } = await supabase
      .from('user_settings')
      .update({
        zoom_oauth_access_token: tokens.access_token,
        zoom_oauth_refresh_token: tokens.refresh_token,
        zoom_oauth_token_expires: expiresAt,
        zoom_oauth_state: null, // Clear the state
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error('[zoom-oauth-callback] Error storing tokens:', updateError);
      throw updateError;
    }

    console.log('[zoom-oauth-callback] Step 11: SUCCESS - Zoom OAuth tokens stored for user:', userId);

    // Step 12: Auto-detect host_email from Zoom /me API
    // This is critical for webhook routing — zoom-webhook looks up users by host_email.
    // Without this, new recordings from Zoom will never route to this user.
    let detectedEmail: string | null = null;
    try {
      const meResponse = await fetch('https://api.zoom.us/v2/users/me', {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (meResponse.ok) {
        const meData = await meResponse.json();
        if (meData.email) {
          detectedEmail = meData.email.toLowerCase().trim();
          console.log('[zoom-oauth-callback] Step 12: Detected Zoom account email:', detectedEmail);

          // Only set host_email if not already configured (don't overwrite user's manual setting)
          const { data: currentSettings } = await supabase
            .from('user_settings')
            .select('host_email')
            .eq('user_id', userId)
            .maybeSingle();

          if (!currentSettings?.host_email) {
            const { error: hostEmailError } = await supabase
              .from('user_settings')
              .update({ host_email: detectedEmail })
              .eq('user_id', userId);

            if (hostEmailError) {
              console.warn('[zoom-oauth-callback] Could not auto-set host_email:', hostEmailError.message);
            } else {
              console.log('[zoom-oauth-callback] Auto-set host_email to:', detectedEmail);
            }
          } else {
            console.log('[zoom-oauth-callback] host_email already set, skipping auto-set. Existing:', currentSettings.host_email);
          }
        }
      } else {
        const errText = await meResponse.text();
        console.warn('[zoom-oauth-callback] Step 12: /users/me returned', meResponse.status, errText);
      }
    } catch (emailErr) {
      // Non-blocking — host_email detection is best-effort
      console.warn('[zoom-oauth-callback] Step 12: Could not detect Zoom account email:', emailErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Successfully connected to Zoom',
        accountEmail: detectedEmail,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[zoom-oauth-callback] CATCH ERROR:', error);
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
