import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { FathomClient } from '../_shared/fathom-client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { recording_id, user_id } = await req.json();

    if (!recording_id) {
      return new Response(
        JSON.stringify({ error: 'Recording ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Fathom credentials from user_settings (including OAuth expiry and refresh token)
    const { data: settings, error: settingsError } = await supabaseClient
      .from('user_settings')
      .select('fathom_api_key, oauth_access_token, oauth_token_expires, oauth_refresh_token')
      .eq('user_id', user_id)
      .maybeSingle();

    if (settingsError) throw settingsError;

    if (!settings?.fathom_api_key && !settings?.oauth_access_token) {
      return new Response(
        JSON.stringify({ error: 'Fathom credentials not configured. Please add them in Settings.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine which authentication method to use (with OAuth token refresh)
    let authHeaders: Record<string, string>;

    if (settings.oauth_access_token) {
      // Check if OAuth token is expired
      const now = Date.now();
      if (settings.oauth_token_expires && settings.oauth_token_expires > now) {
        authHeaders = {
          'Authorization': `Bearer ${settings.oauth_access_token}`,
          'Content-Type': 'application/json',
        };
        console.log('Using OAuth authentication for fetch-single-meeting');
      } else {
        // Token is expired, attempt to refresh it
        console.log('OAuth token expired, attempting refresh...');
        if (!settings.oauth_refresh_token) {
          return new Response(
            JSON.stringify({ error: 'OAuth token expired and no refresh token available. Please reconnect Fathom in Settings.' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        try {
          // Refresh the token
          const clientId = Deno.env.get('FATHOM_OAUTH_CLIENT_ID');
          const clientSecret = Deno.env.get('FATHOM_OAUTH_CLIENT_SECRET');

          if (!clientId || !clientSecret) {
            throw new Error('OAuth not configured on server');
          }

          const tokenResponse = await fetch('https://fathom.video/external/v1/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              grant_type: 'refresh_token',
              refresh_token: settings.oauth_refresh_token,
              client_id: clientId,
              client_secret: clientSecret,
            }),
          });

          if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error('Token refresh failed:', tokenResponse.status, errorText);
            return new Response(
              JSON.stringify({ error: 'Failed to refresh access token. Please reconnect Fathom in Settings.' }),
              { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const tokens = await tokenResponse.json();
          const expiresAt = Date.now() + (tokens.expires_in * 1000);

          // Store new tokens
          await supabaseClient
            .from('user_settings')
            .update({
              oauth_access_token: tokens.access_token,
              oauth_refresh_token: tokens.refresh_token,
              oauth_token_expires: expiresAt,
            })
            .eq('user_id', user_id);

          // Use the new token
          authHeaders = {
            'Authorization': `Bearer ${tokens.access_token}`,
            'Content-Type': 'application/json',
          };
          console.log('OAuth token refreshed successfully');
        } catch (refreshError) {
          console.error('Error refreshing OAuth token:', refreshError);
          return new Response(
            JSON.stringify({ error: 'OAuth token expired and refresh failed. Please reconnect Fathom in Settings.' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    } else if (settings.fathom_api_key) {
      authHeaders = {
        'X-Api-Key': settings.fathom_api_key,
        'Content-Type': 'application/json',
      };
      console.log('Using API key authentication for fetch-single-meeting');
    } else {
      return new Response(
        JSON.stringify({ error: 'No valid Fathom authentication found.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching meeting with recording_id:', recording_id);

    // First, check if we have the meeting date in our database for optimized search
    // Use composite key (recording_id, user_id) for the lookup
    const { data: existingCall } = await supabaseClient
      .from('fathom_calls')
      .select('created_at')
      .eq('recording_id', recording_id)
      .eq('user_id', user_id)
      .maybeSingle();

    // Use the specific recordings endpoint to get summary and transcript directly
    const [summaryResponse, transcriptResponse] = await Promise.all([
      FathomClient.fetchWithRetry(`https://api.fathom.ai/external/v1/recordings/${recording_id}/summary`, {
        headers: authHeaders,
      }),
      FathomClient.fetchWithRetry(`https://api.fathom.ai/external/v1/recordings/${recording_id}/transcript`, {
        headers: authHeaders,
      })
    ]);

    if (!summaryResponse.ok) {
      const errorText = await summaryResponse.text();
      console.error('Fathom API summary error:', summaryResponse.status, errorText);

      // Handle specific error codes
      if (summaryResponse.status === 401) {
        return new Response(
          JSON.stringify({ error: 'Fathom authentication failed. Please reconnect in Settings.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (summaryResponse.status === 404) {
        return new Response(
          JSON.stringify({ error: 'Meeting not found in Fathom. It may have been deleted.' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`Fathom API error: ${summaryResponse.status} ${errorText}`);
    }

    const summaryData = await summaryResponse.json();
    const transcriptData = transcriptResponse.ok ? await transcriptResponse.json() : { transcript: [] };

    // Search for meeting metadata using date filtering if we have the date
    let meetingInfo: {recording_id: number} | null = null;
    const targetRecordingId = parseInt(recording_id);

    // Helper function to search with date range
    const searchWithDateRange = async (createdAfter?: string, createdBefore?: string, maxPages = 20) => {
      let cursor: string | undefined = undefined;

      for (let page = 0; page < maxPages; page++) {
        const listUrl = new URL('https://api.fathom.ai/external/v1/meetings');
        listUrl.searchParams.append('include_calendar_invitees', 'true');

        if (createdAfter) {
          listUrl.searchParams.append('created_after', createdAfter);
        }
        if (createdBefore) {
          listUrl.searchParams.append('created_before', createdBefore);
        }
        if (cursor) {
          listUrl.searchParams.append('cursor', cursor);
        }

        const listResponse = await FathomClient.fetchWithRetry(listUrl.toString(), { 
          headers: authHeaders,
          maxRetries: 3 
        });

        if (!listResponse.ok) {
          console.error(`Failed to fetch meeting list: ${listResponse.status}`);
          break;
        }

        const listData = await listResponse.json();
        const found = listData.items?.find((m: {recording_id: number}) => m.recording_id === targetRecordingId);

        if (found) {
          console.log(`Found meeting ${recording_id} on page ${page + 1}`);
          return found;
        }

        if (!listData.next_cursor) break;
        cursor = listData.next_cursor;

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      return null;
    };

    // Strategy 1: If we have the date from database, search within a 14-day window
    if (existingCall?.created_at) {
      const meetingDate = new Date(existingCall.created_at);
      const searchStart = new Date(meetingDate);
      searchStart.setDate(searchStart.getDate() - 7);
      const searchEnd = new Date(meetingDate);
      searchEnd.setDate(searchEnd.getDate() + 7);

      console.log(`Using date-filtered search: ${searchStart.toISOString()} to ${searchEnd.toISOString()}`);
      meetingInfo = await searchWithDateRange(searchStart.toISOString(), searchEnd.toISOString(), 30);
    }

    // Strategy 2: Broad search without date filter (fallback)
    if (!meetingInfo) {
      console.log('Date-filtered search failed, trying broader search...');
      meetingInfo = await searchWithDateRange(undefined, undefined, 50);
    }

    if (!meetingInfo) {
      console.error(`Meeting with recording_id ${recording_id} not found in Fathom meetings list`);
      return new Response(
        JSON.stringify({
          error: 'Meeting metadata not found',
          details: 'The meeting transcript/summary exists but metadata could not be retrieved. Try refreshing.',
          // Still return partial data so UI can show something
          partial_meeting: {
            recording_id: targetRecordingId,
            transcript: transcriptData.transcript || [],
            default_summary: summaryData.summary || null,
          }
        }),
        { status: 206, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Combine all the data
    const meeting = {
      ...meetingInfo,
      transcript: transcriptData.transcript || [],
      default_summary: summaryData.summary || null,
    };

    console.log('Meeting data:', {
      recording_id: meeting.recording_id,
      has_url: !!meeting.url,
      has_share_url: !!meeting.share_url,
    });

    return new Response(
      JSON.stringify({ meeting }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
