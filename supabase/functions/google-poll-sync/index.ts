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
 * Our conservative limit: 50 requests/minute per user
 */
const RATE_WINDOW_MS = 60000;
const RATE_MAX_REQUESTS = 50;
const RATE_JITTER_MS = 200;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

type RateWindow = { windowStart: number; count: number };
type RateLimiterState = { windows: Map<string, RateWindow> };

const globalRateLimiterState = (globalThis as unknown as { __googlePollRateLimiter?: RateLimiterState }).__googlePollRateLimiter
  ?? { windows: new Map<string, RateWindow>() };
(globalThis as unknown as { __googlePollRateLimiter?: RateLimiterState }).__googlePollRateLimiter = globalRateLimiterState;

async function throttleShared(scope: string, maxRequests: number = RATE_MAX_REQUESTS, windowMs: number = RATE_WINDOW_MS): Promise<void> {
  const now = Date.now();
  const existing = globalRateLimiterState.windows.get(scope) ?? { windowStart: now, count: 0 };
  const elapsed = now - existing.windowStart;

  if (elapsed > windowMs * 2) {
    globalRateLimiterState.windows.delete(scope);
    return throttleShared(scope, maxRequests, windowMs);
  }

  if (elapsed >= windowMs) {
    existing.windowStart = now;
    existing.count = 0;
  }

  if (existing.count >= maxRequests) {
    const waitTime = windowMs - elapsed + Math.floor(Math.random() * RATE_JITTER_MS);
    console.log(`Rate limit prevention for ${scope}: waiting ${waitTime}ms...`);
    await sleep(waitTime);
    return throttleShared(scope, maxRequests, windowMs);
  }

  existing.count += 1;
  globalRateLimiterState.windows.set(scope, existing);
}

interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  conferenceData?: {
    conferenceSolution?: { name?: string };
    entryPoints?: Array<{ entryPointType?: string; uri?: string }>;
  };
  hangoutLink?: string;
  status?: string;
}

interface GoogleCalendarListResponse {
  items?: GoogleCalendarEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
}

interface UserSettings {
  user_id: string;
  google_oauth_access_token: string;
  google_oauth_refresh_token: string | null;
  google_oauth_token_expires: number | null;
  google_sync_token: string | null;
  google_last_poll_at: string | null;
}

/**
 * Poll a single user's Google Calendar for new Meet events with recordings.
 * Uses syncToken for incremental sync to minimize API calls.
 */
// deno-lint-ignore no-explicit-any
async function pollUserMeetings(supabase: any, user: UserSettings): Promise<{
  userId: string;
  newMeetings: number;
  error?: string;
}> {
  const userId = user.user_id;
  console.log(`Polling Google Meet for user ${userId}`);

  try {
    // 1. Check if token needs refresh
    let accessToken = user.google_oauth_access_token;
    const now = Date.now();

    if (user.google_oauth_token_expires && user.google_oauth_token_expires <= now) {
      console.log(`Token expired for user ${userId}, refreshing...`);
      if (!user.google_oauth_refresh_token) {
        throw new Error('Token expired and no refresh token available');
      }
      accessToken = await refreshGoogleOAuthTokens(userId, user.google_oauth_refresh_token);
      console.log(`Token refreshed for user ${userId}`);
    }

    // 2. Fetch calendar events using syncToken for incremental sync
    const params = new URLSearchParams();
    params.append('singleEvents', 'true');
    params.append('maxResults', '250');
    params.append('orderBy', 'startTime');

    // Use syncToken if available for incremental sync
    if (user.google_sync_token) {
      params.append('syncToken', user.google_sync_token);
      console.log(`Using syncToken for incremental sync for user ${userId}`);
    } else {
      // First sync - get last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      params.append('timeMin', thirtyDaysAgo.toISOString());
      console.log(`No syncToken - doing initial 30-day fetch for user ${userId}`);
    }

    const newMeetEvents: GoogleCalendarEvent[] = [];
    let pageToken: string | null = null;
    let hasMore = true;
    let newSyncToken: string | null = null;

    while (hasMore) {
      if (pageToken) {
        params.set('pageToken', pageToken);
      }

      await throttleShared(`google-calendar:${userId}`);

      const calendarUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`;
      const response = await GoogleClient.fetchWithAuth(calendarUrl, accessToken);

      // Handle syncToken expiration (410 Gone)
      if (response.status === 410) {
        console.log(`SyncToken expired for user ${userId}, clearing and doing full sync`);
        // Clear the syncToken and retry with full sync
        await supabase
          .from('user_settings')
          .update({ google_sync_token: null })
          .eq('user_id', userId);

        // Recursively call with cleared syncToken
        return pollUserMeetings(supabase, { ...user, google_sync_token: null });
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Calendar API error: ${response.status} - ${errorText}`);
      }

      const data: GoogleCalendarListResponse = await response.json();

      if (data.items && data.items.length > 0) {
        // Filter for events with Google Meet conference
        const meetEvents = data.items.filter(event => {
          const hasMeet = event.conferenceData?.conferenceSolution?.name === 'Google Meet';
          const hasHangout = !!event.hangoutLink;
          const isActive = event.status !== 'cancelled';
          return (hasMeet || hasHangout) && isActive;
        });
        newMeetEvents.push(...meetEvents);
      }

      pageToken = data.nextPageToken || null;
      hasMore = !!pageToken;

      // Save the new syncToken when we finish pagination
      if (!hasMore && data.nextSyncToken) {
        newSyncToken = data.nextSyncToken;
      }
    }

    console.log(`Found ${newMeetEvents.length} Google Meet events for user ${userId}`);

    // 3. Check which events are already synced
    let unsyncedEventIds: string[] = [];

    if (newMeetEvents.length > 0) {
      const eventIds = newMeetEvents.map(e => e.id);

      const { data: syncedCalls, error: syncCheckError } = await supabase
        .from('fathom_calls')
        .select('google_calendar_event_id')
        .eq('user_id', userId)
        .in('google_calendar_event_id', eventIds);

      if (syncCheckError) {
        console.error(`Error checking sync status for user ${userId}:`, syncCheckError);
      }

      const syncedIds = new Set(syncedCalls?.map((c: { google_calendar_event_id: string }) => c.google_calendar_event_id) || []);
      unsyncedEventIds = eventIds.filter(id => !syncedIds.has(id));

      console.log(`User ${userId}: ${unsyncedEventIds.length} unsynced events out of ${eventIds.length} total`);
    }

    // 4. Create sync job if there are new meetings
    if (unsyncedEventIds.length > 0) {
      // Create a sync job that will process these events
      const { data: syncJob, error: jobError } = await supabase
        .from('sync_jobs')
        .insert({
          user_id: userId,
          recording_ids: [], // Will be populated during sync
          status: 'pending',
          progress_current: 0,
          progress_total: unsyncedEventIds.length,
          // Store event IDs in a separate field for Google Meet sync
          error_message: JSON.stringify({ google_event_ids: unsyncedEventIds }),
        })
        .select()
        .single();

      if (jobError) {
        console.error(`Error creating sync job for user ${userId}:`, jobError);
      } else {
        console.log(`Created sync job ${syncJob.id} for ${unsyncedEventIds.length} events for user ${userId}`);

        // Invoke google-meet-sync-meetings in background
        // Use service role to call the function without user JWT
        supabase.functions.invoke('google-meet-sync-meetings', {
          body: { eventIds: unsyncedEventIds },
          headers: {
            // Create a service-level request that bypasses user auth
            'x-poll-sync-user-id': userId,
          },
        }).catch((err: Error) => {
          console.error(`Failed to invoke sync for user ${userId}:`, err);
        });
      }
    }

    // 5. Update syncToken and last poll time
    const updateData: Record<string, unknown> = {
      google_last_poll_at: new Date().toISOString(),
    };

    if (newSyncToken) {
      updateData.google_sync_token = newSyncToken;
      console.log(`Updated syncToken for user ${userId}`);
    }

    await supabase
      .from('user_settings')
      .update(updateData)
      .eq('user_id', userId);

    return {
      userId,
      newMeetings: unsyncedEventIds.length,
    };
  } catch (error) {
    console.error(`Error polling user ${userId}:`, error);
    return {
      userId,
      newMeetings: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Google Poll Sync Edge Function
 *
 * Called by pg_cron every 15 minutes to poll all users with Google OAuth
 * for new Meet recordings. Uses syncToken for efficient incremental sync.
 *
 * Flow:
 * 1. Get all users with Google OAuth connected
 * 2. For each user, check for new calendar events with Meet links
 * 3. For unsynced events, create sync jobs
 * 4. Invoke google-meet-sync-meetings to process
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('Google Poll Sync started');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify this is called by pg_cron or with service key
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      // Only allow service role key
      if (token !== supabaseServiceKey) {
        // Not service key - check if it's a valid user (for testing)
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
          return new Response(
            JSON.stringify({ error: 'Unauthorized - service key required' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        // Allow admin users to trigger manually for testing
        console.log(`Manual poll triggered by user ${user.id}`);
      }
    }

    // Get all users with Google OAuth connected
    const { data: users, error: usersError } = await supabase
      .from('user_settings')
      .select('user_id, google_oauth_access_token, google_oauth_refresh_token, google_oauth_token_expires, google_sync_token, google_last_poll_at')
      .not('google_oauth_access_token', 'is', null);

    if (usersError) {
      throw usersError;
    }

    if (!users || users.length === 0) {
      console.log('No users with Google OAuth connected');
      return new Response(
        JSON.stringify({
          message: 'No users to poll',
          processed: 0,
          duration: Date.now() - startTime
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${users.length} users with Google OAuth`);

    // Process users in batches to avoid timeout
    // pg_cron has a 10-minute timeout, so we process in batches
    const BATCH_SIZE = 10;
    const results: Array<{ userId: string; newMeetings: number; error?: string }> = [];

    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(users.length / BATCH_SIZE)}`);

      const batchResults = await Promise.allSettled(
        batch.map(user => pollUserMeetings(supabase, user as UserSettings))
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.error('Batch item failed:', result.reason);
        }
      }

      // Small delay between batches to be nice to the API
      if (i + BATCH_SIZE < users.length) {
        await sleep(1000);
      }
    }

    const successCount = results.filter(r => !r.error).length;
    const totalNewMeetings = results.reduce((sum, r) => sum + r.newMeetings, 0);
    const duration = Date.now() - startTime;

    console.log(`Google Poll Sync completed: ${successCount}/${results.length} users processed, ${totalNewMeetings} new meetings found in ${duration}ms`);

    return new Response(
      JSON.stringify({
        processed: results.length,
        success: successCount,
        failed: results.length - successCount,
        totalNewMeetings,
        duration,
        results: results.map(r => ({
          userId: r.userId,
          newMeetings: r.newMeetings,
          error: r.error,
        })),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Google Poll Sync error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
