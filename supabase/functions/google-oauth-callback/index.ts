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
      .select('google_oauth_state')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!settings || settings.google_oauth_state !== state) {
      return new Response(
        JSON.stringify({ error: 'Invalid state parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get production OAuth credentials
    const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET');
    const redirectUri = 'https://app.callvaultai.com/oauth/callback/google';

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: 'OAuth not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
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
      console.error('Google token exchange failed:', tokenResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to exchange authorization code' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokens = await tokenResponse.json();

    // Calculate token expiry (expires_in is in seconds)
    const expiresAt = tokens.expires_in
      ? Date.now() + (tokens.expires_in * 1000)
      : Date.now() + (3600 * 1000); // Default to 1 hour if not provided

    // Get user's Google email for display
    let googleEmail: string | null = null;
    try {
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
        },
      });
      if (userInfoResponse.ok) {
        const userInfo = await userInfoResponse.json();
        googleEmail = userInfo.email;
      }
    } catch (error) {
      // Non-fatal: continue without email
      console.warn('Failed to get Google user info:', error);
    }

    // Store tokens in database
    const { error: updateError } = await supabase
      .from('user_settings')
      .update({
        google_oauth_access_token: tokens.access_token,
        google_oauth_refresh_token: tokens.refresh_token,
        google_oauth_token_expires: expiresAt,
        google_oauth_state: null, // Clear the state
        google_oauth_email: googleEmail,
        // Clear any previous sync token to trigger full 30-day initial sync
        google_sync_token: null,
        google_last_poll_at: null,
      })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error storing Google OAuth tokens:', updateError);
      throw updateError;
    }

    // Trigger initial 30-day sync in the background
    // This fetches all Google Meet events from the last 30 days and creates sync jobs
    const triggerInitialSync = async () => {
      try {
        console.log(`Triggering initial Google Meet sync for user ${user.id}`);

        // Calculate 30-day time range
        const timeMin = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const timeMax = new Date().toISOString();

        // Fetch Google Meet events from calendar
        const { data: fetchResult, error: fetchError } = await supabase.functions.invoke(
          'google-meet-fetch-meetings',
          {
            body: { timeMin, timeMax },
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (fetchError) {
          console.error('Initial fetch failed:', fetchError);
          return;
        }

        const meetings = fetchResult?.meetings || [];
        const unsyncedMeetings = meetings.filter((m: { synced: boolean }) => !m.synced);

        if (unsyncedMeetings.length === 0) {
          console.log('No unsynced Google Meet meetings found for initial sync');
          return;
        }

        console.log(`Found ${unsyncedMeetings.length} unsynced meetings, triggering sync...`);

        // Trigger sync for unsynced meetings
        const eventIds = unsyncedMeetings.map((m: { google_calendar_event_id: string }) => m.google_calendar_event_id);

        const { error: syncError } = await supabase.functions.invoke(
          'google-meet-sync-meetings',
          {
            body: { eventIds },
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (syncError) {
          console.error('Initial sync failed:', syncError);
        } else {
          console.log(`Initial sync triggered for ${eventIds.length} Google Meet meetings`);
        }
      } catch (error) {
        console.error('Error in initial sync:', error);
      }
    };

    // Start background sync (don't wait for it)
    // @ts-expect-error - EdgeRuntime is available in Deno Deploy
    EdgeRuntime.waitUntil(triggerInitialSync());

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Successfully connected to Google Meet',
        email: googleEmail,
        initialSyncTriggered: true,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Google OAuth callback error:', error);
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
