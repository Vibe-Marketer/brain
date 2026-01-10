import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleClient } from '../_shared/google-client.ts';
import { refreshGoogleOAuthTokens } from '../google-oauth-refresh/index.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
};

/**
 * RATE LIMITING CONFIGURATION
 *
 * Google Calendar API limits: 1,000,000 queries/100s per project
 * Our conservative limit: 50 requests/minute per user (much lower to be safe)
 * Window: 60 seconds (60000ms)
 * Jitter: 0-200ms random delay to prevent thundering herd
 */
const RATE_WINDOW_MS = 60000;
const RATE_MAX_REQUESTS = 50;
const RATE_JITTER_MS = 200;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

type RateWindow = { windowStart: number; count: number };
type RateLimiterState = { windows: Map<string, RateWindow> };

/**
 * GLOBAL RATE LIMITER STATE
 * See fetch-meetings/index.ts for full documentation on rate limiting approach.
 */
const globalRateLimiterState = (globalThis as unknown as { __googleCalendarRateLimiter?: RateLimiterState }).__googleCalendarRateLimiter
  ?? { windows: new Map<string, RateWindow>() };
(globalThis as unknown as { __googleCalendarRateLimiter?: RateLimiterState }).__googleCalendarRateLimiter = globalRateLimiterState;

/**
 * Sliding window rate limiter with automatic cleanup
 */
async function throttleShared(scope: string, maxRequests: number = RATE_MAX_REQUESTS, windowMs: number = RATE_WINDOW_MS): Promise<void> {
  const now = Date.now();
  const existing = globalRateLimiterState.windows.get(scope) ?? { windowStart: now, count: 0 };
  const elapsed = now - existing.windowStart;

  // MEMORY LEAK FIX: Clean up expired window entries
  if (elapsed > windowMs * 2) {
    globalRateLimiterState.windows.delete(scope);
    return throttleShared(scope, maxRequests, windowMs);
  }

  // Reset window if current window has expired
  if (elapsed >= windowMs) {
    existing.windowStart = now;
    existing.count = 0;
  }

  // Rate limit reached - wait with jittered backoff
  if (existing.count >= maxRequests) {
    const waitTime = windowMs - elapsed + Math.floor(Math.random() * RATE_JITTER_MS);
    console.log(`Rate limit prevention for ${scope}: waiting ${waitTime}ms...`);
    await sleep(waitTime);
    return throttleShared(scope, maxRequests, windowMs);
  }

  // Allow request through and increment counter
  existing.count += 1;
  globalRateLimiterState.windows.set(scope, existing);
}

/**
 * Google Calendar Event type with conferenceData for Google Meet detection
 */
interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  start?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  organizer?: {
    email?: string;
    displayName?: string;
    self?: boolean;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
    self?: boolean;
    organizer?: boolean;
  }>;
  conferenceData?: {
    conferenceId?: string;
    conferenceSolution?: {
      key?: {
        type?: string;
      };
      name?: string;
      iconUri?: string;
    };
    entryPoints?: Array<{
      entryPointType?: string;
      uri?: string;
      label?: string;
    }>;
  };
  hangoutLink?: string;
  status?: string;
  created?: string;
  updated?: string;
}

interface GoogleCalendarListResponse {
  items?: GoogleCalendarEvent[];
  nextPageToken?: string;
}

/**
 * Transformed meeting format for frontend consumption
 */
interface GoogleMeetMeeting {
  google_calendar_event_id: string;
  title: string;
  description?: string;
  meeting_start_time: string;
  meeting_end_time: string;
  organizer_email?: string;
  attendees: Array<{
    email: string;
    name?: string;
    is_organizer: boolean;
    response_status?: string;
  }>;
  meet_link?: string;
  meet_conference_id?: string;
  synced: boolean;
}

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

    // Get user's Google OAuth credentials
    const { data: settings, error: configError } = await supabase
      .from('user_settings')
      .select('google_oauth_access_token, google_oauth_token_expires, google_oauth_refresh_token')
      .eq('user_id', user.id)
      .maybeSingle();

    if (configError) throw configError;

    if (!settings?.google_oauth_access_token) {
      throw new Error('Google account not connected. Please connect your Google account in Settings.');
    }

    // Check if token is expired and refresh if needed
    let accessToken = settings.google_oauth_access_token;
    const now = Date.now();

    if (settings.google_oauth_token_expires && settings.google_oauth_token_expires <= now) {
      console.log('Google OAuth token expired, attempting refresh...');
      if (!settings.google_oauth_refresh_token) {
        throw new Error('Google OAuth token expired and no refresh token available. Please reconnect in Settings.');
      }

      try {
        accessToken = await refreshGoogleOAuthTokens(user.id, settings.google_oauth_refresh_token);
        console.log('Google OAuth token refreshed successfully');
      } catch (refreshError) {
        console.error('Error refreshing Google OAuth token:', refreshError);
        throw new Error('Google OAuth token expired and refresh failed. Please reconnect in Settings.');
      }
    }

    const { timeMin, timeMax } = await req.json();

    console.log('Fetching meetings from Google Calendar API', { timeMin, timeMax });

    // Build query parameters for Google Calendar API
    // https://www.googleapis.com/calendar/v3/calendars/primary/events
    const params = new URLSearchParams();
    if (timeMin) params.append('timeMin', timeMin); // RFC3339 format
    if (timeMax) params.append('timeMax', timeMax); // RFC3339 format
    params.append('singleEvents', 'true'); // Expand recurring events
    params.append('maxResults', '250'); // Max per page
    params.append('orderBy', 'startTime');

    // Fetch all events with pagination
    const allMeetings: GoogleMeetMeeting[] = [];
    let pageToken: string | null = null;
    let hasMore = true;
    const maxRetries = 3;

    while (hasMore) {
      if (pageToken) {
        params.set('pageToken', pageToken);
      }

      let retryCount = 0;
      let success = false;

      while (!success && retryCount < maxRetries) {
        try {
          // Apply rate limiting per user
          await throttleShared(`google-calendar:${user.id}`);

          const calendarUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`;
          const response = await GoogleClient.fetchWithAuth(calendarUrl, accessToken);

          if (response.status === 429) {
            // Rate limited - wait and retry with exponential backoff
            const waitTime = Math.pow(2, retryCount) * 1000;
            console.log(`Rate limited (429). Waiting ${waitTime}ms before retry ${retryCount + 1}/${maxRetries}...`);
            await sleep(waitTime);
            retryCount++;
            continue;
          }

          if (!response.ok) {
            const errorText = await response.text();
            console.error('Google Calendar API error:', errorText);
            throw new Error(`Google Calendar API error: ${response.status} - ${errorText}`);
          }

          const data: GoogleCalendarListResponse = await response.json();

          if (data.items && data.items.length > 0) {
            // Filter for events with Google Meet conferenceData
            const meetEvents = data.items.filter(event => {
              // Check if event has Google Meet conference data
              const hasMeet = event.conferenceData?.conferenceSolution?.name === 'Google Meet';
              // Also check for hangoutLink as a fallback (older Meet format)
              const hasHangout = !!event.hangoutLink;
              // Exclude cancelled events
              const isActive = event.status !== 'cancelled';

              return (hasMeet || hasHangout) && isActive;
            });

            // Transform to our meeting format
            const transformedMeetings: GoogleMeetMeeting[] = meetEvents.map(event => {
              // Get the Meet link from entry points or hangoutLink
              let meetLink = event.hangoutLink;
              if (event.conferenceData?.entryPoints) {
                const videoEntry = event.conferenceData.entryPoints.find(
                  ep => ep.entryPointType === 'video'
                );
                if (videoEntry?.uri) {
                  meetLink = videoEntry.uri;
                }
              }

              return {
                google_calendar_event_id: event.id,
                title: event.summary || 'Untitled Meeting',
                description: event.description,
                meeting_start_time: event.start?.dateTime || event.start?.date || '',
                meeting_end_time: event.end?.dateTime || event.end?.date || '',
                organizer_email: event.organizer?.email,
                attendees: (event.attendees || []).map(att => ({
                  email: att.email,
                  name: att.displayName,
                  is_organizer: att.organizer || false,
                  response_status: att.responseStatus,
                })),
                meet_link: meetLink,
                meet_conference_id: event.conferenceData?.conferenceId,
                synced: false, // Will be updated after checking database
              };
            });

            allMeetings.push(...transformedMeetings);
            console.log(`Fetched ${meetEvents.length} Google Meet events (total: ${allMeetings.length})`);
          }

          pageToken = data.nextPageToken || null;
          hasMore = !!pageToken;
          success = true;

        } catch (error) {
          if (retryCount >= maxRetries - 1) {
            throw error;
          }
          retryCount++;
        }
      }
    }

    // Check which meetings are already synced
    if (allMeetings.length > 0) {
      const { data: syncedCalls, error: syncCheckError } = await supabase
        .from('fathom_calls')
        .select('google_calendar_event_id')
        .in('google_calendar_event_id', allMeetings.map(m => m.google_calendar_event_id));

      if (syncCheckError) {
        console.error('Error checking sync status:', syncCheckError);
      }

      console.log(`Found ${syncedCalls?.length || 0} synced Google Meet calls in database`);

      const syncedIds = new Set(syncedCalls?.map(c => c.google_calendar_event_id) || []);

      // Update synced status
      for (const meeting of allMeetings) {
        meeting.synced = syncedIds.has(meeting.google_calendar_event_id);
      }
    }

    const syncedCount = allMeetings.filter(m => m.synced).length;
    console.log(`Returning ${allMeetings.length} Google Meet meetings (${syncedCount} synced, ${allMeetings.length - syncedCount} not synced)`);

    return new Response(
      JSON.stringify({
        meetings: allMeetings,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching Google Meet meetings:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
