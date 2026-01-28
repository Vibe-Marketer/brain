import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ZoomClient } from '../_shared/zoom-client.ts';
import { refreshZoomOAuthTokens } from '../zoom-oauth-refresh/index.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

/**
 * RATE LIMITING CONFIGURATION
 *
 * Zoom API limits: 100 requests/second per app
 * Our conservative limit: 90 requests/second (provides safety buffer)
 * Window: 1 second (1000ms)
 * Jitter: 0-100ms random delay to prevent thundering herd
 */
const RATE_WINDOW_MS = 1000;
const RATE_MAX_REQUESTS = 90;
const RATE_JITTER_MS = 100;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

type RateWindow = { windowStart: number; count: number };
type RateLimiterState = { windows: Map<string, RateWindow> };

/**
 * GLOBAL RATE LIMITER STATE
 * Per-isolate rate limiting for Zoom API calls.
 */
const globalRateLimiterState = (globalThis as unknown as { __zoomRateLimiter?: RateLimiterState }).__zoomRateLimiter
  ?? { windows: new Map<string, RateWindow>() };
(globalThis as unknown as { __zoomRateLimiter?: RateLimiterState }).__zoomRateLimiter = globalRateLimiterState;

/**
 * Sliding window rate limiter with automatic cleanup
 */
async function throttleShared(scope: string, maxRequests: number = RATE_MAX_REQUESTS, windowMs: number = RATE_WINDOW_MS): Promise<void> {
  const now = Date.now();
  const existing = globalRateLimiterState.windows.get(scope) ?? { windowStart: now, count: 0 };
  const elapsed = now - existing.windowStart;

  // Clean up expired window entries
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

interface ZoomRecording {
  uuid: string;
  id: number;
  account_id: string;
  host_id: string;
  host_email: string;
  topic: string;
  type: number;
  start_time: string;
  timezone: string;
  duration: number;
  total_size: number;
  recording_count: number;
  recording_files?: Array<{
    id: string;
    meeting_id: string;
    recording_start: string;
    recording_end: string;
    file_type: string;
    file_extension: string;
    file_size: number;
    play_url?: string;
    download_url?: string;
    status: string;
    recording_type: string;
  }>;
}

interface ZoomRecordingsResponse {
  from: string;
  to: string;
  page_count: number;
  page_size: number;
  total_records: number;
  next_page_token?: string;
  meetings: ZoomRecording[];
}

interface ZoomMeetingWithSyncStatus {
  recording_id: string; // Use UUID for uniqueness
  meeting_id: number;   // Original Zoom meeting ID (may be reused for PMI)
  title: string;
  host_email: string;
  start_time: string;
  end_time: string;
  duration: number;
  has_transcript: boolean;
  synced: boolean;
}

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

    // Get user's Zoom OAuth credentials
    const { data: settings, error: configError } = await supabase
      .from('user_settings')
      .select('zoom_oauth_access_token, zoom_oauth_token_expires, zoom_oauth_refresh_token')
      .eq('user_id', user.id)
      .maybeSingle();

    if (configError) throw configError;

    if (!settings?.zoom_oauth_access_token) {
      throw new Error('Zoom not connected. Please connect your Zoom account in Settings.');
    }

    // Determine access token to use (refresh if expired)
    let accessToken: string;
    const now = Date.now();

    if (settings.zoom_oauth_token_expires && settings.zoom_oauth_token_expires > now) {
      accessToken = settings.zoom_oauth_access_token;
      console.log('Using existing Zoom access token');
    } else {
      // Token is expired, attempt to refresh
      console.log('Zoom token expired, attempting refresh...');
      if (!settings.zoom_oauth_refresh_token) {
        throw new Error('Zoom token expired and no refresh token available. Please reconnect in Settings.');
      }

      try {
        accessToken = await refreshZoomOAuthTokens(user.id, settings.zoom_oauth_refresh_token);
        console.log('Zoom token refreshed successfully');
      } catch (refreshError) {
        console.error('Error refreshing Zoom token:', refreshError);
        throw new Error('Zoom token expired and refresh failed. Please reconnect in Settings.');
      }
    }

    // Parse request body for date filters
    let fromDate: string | undefined;
    let toDate: string | undefined;

    try {
      const body = await req.json();
      fromDate = body.fromDate;
      toDate = body.toDate;
    } catch {
      // Empty body is OK - will use defaults
    }

    // Default to last 30 days if no date range specified
    if (!fromDate) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      fromDate = thirtyDaysAgo.toISOString().split('T')[0];
    }
    if (!toDate) {
      toDate = new Date().toISOString().split('T')[0];
    }

    console.log('Fetching Zoom recordings', { fromDate, toDate });

    // Fetch all recordings with pagination
    const allRecordings: ZoomRecording[] = [];
    let nextPageToken: string | undefined;
    const maxRetries = 3;

    do {
      // Build query parameters
      const params = new URLSearchParams({
        from: fromDate,
        to: toDate,
        page_size: '300', // Max allowed by Zoom
      });
      if (nextPageToken) {
        params.set('next_page_token', nextPageToken);
      }

      let retryCount = 0;
      let success = false;

      while (!success && retryCount < maxRetries) {
        try {
          // Apply rate limiting
          await throttleShared('global');
          await throttleShared(`user:${user.id}`);

          const response = await ZoomClient.apiRequest(
            `/users/me/recordings?${params.toString()}`,
            accessToken
          );

          if (response.status === 429) {
            // Rate limited - wait and retry with exponential backoff
            const waitTime = Math.pow(2, retryCount) * 1000;
            console.log(`Rate limited (429). Waiting ${waitTime}ms before retry ${retryCount + 1}/${maxRetries}...`);
            await sleep(waitTime);
            retryCount++;
            continue;
          }

          if (response.status === 401) {
            // Token might have expired during pagination, try refresh once
            if (settings.zoom_oauth_refresh_token) {
              console.log('Got 401, attempting token refresh...');
              accessToken = await refreshZoomOAuthTokens(user.id, settings.zoom_oauth_refresh_token);
              retryCount++;
              continue;
            }
            throw new Error('Zoom authentication failed. Please reconnect in Settings.');
          }

          if (!response.ok) {
            const errorText = await response.text();
            console.error('Zoom API error:', errorText);
            throw new Error(`Zoom API error: ${response.status} - ${errorText}`);
          }

          const data: ZoomRecordingsResponse = await response.json();

          if (data.meetings && data.meetings.length > 0) {
            allRecordings.push(...data.meetings);
            console.log(`Fetched ${data.meetings.length} recordings (total: ${allRecordings.length})`);
          }

          nextPageToken = data.next_page_token;
          success = true;

        } catch (error) {
          if (retryCount >= maxRetries - 1) {
            throw error;
          }
          retryCount++;
        }
      }
    } while (nextPageToken);

    // Transform recordings into meeting format
    const meetings: ZoomMeetingWithSyncStatus[] = allRecordings.map(recording => {
      // Check if recording has transcript file
      const hasTranscript = recording.recording_files?.some(
        file => file.file_type === 'TRANSCRIPT' || file.recording_type === 'audio_transcript'
      ) ?? false;

      // Calculate end time from start time + duration
      const startTime = new Date(recording.start_time);
      const endTime = new Date(startTime.getTime() + (recording.duration * 60 * 1000));

      return {
        recording_id: recording.uuid, // Use UUID for uniqueness (not meeting_id which can be reused for PMI)
        meeting_id: recording.id,
        title: recording.topic,
        host_email: recording.host_email,
        start_time: recording.start_time,
        end_time: endTime.toISOString(),
        duration: recording.duration,
        has_transcript: hasTranscript,
        synced: false, // Will be updated below
      };
    });

    // Check which meetings are already synced (using UUID as recording_id with source_platform='zoom')
    if (meetings.length > 0) {
      const { data: syncedCalls, error: syncCheckError } = await supabase
        .from('fathom_calls')
        .select('recording_id')
        .eq('source_platform', 'zoom')
        .in('recording_id', meetings.map(m => m.recording_id));

      if (syncCheckError) {
        console.error('Error checking sync status:', syncCheckError);
      }

      console.log(`Found ${syncedCalls?.length || 0} synced Zoom calls in database`);

      const syncedIds = new Set(syncedCalls?.map(c => c.recording_id) || []);

      meetings.forEach(meeting => {
        meeting.synced = syncedIds.has(meeting.recording_id);
      });
    }

    const syncedCount = meetings.filter(m => m.synced).length;
    console.log(`Returning ${meetings.length} meetings (${syncedCount} synced, ${meetings.length - syncedCount} not synced)`);

    return new Response(
      JSON.stringify({
        meetings,
        fromDate,
        toDate,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching Zoom meetings:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
