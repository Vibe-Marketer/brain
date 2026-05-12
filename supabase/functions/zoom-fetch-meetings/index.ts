import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ZoomClient } from '../_shared/zoom-client.ts';
import { refreshZoomOAuthTokens } from '../_shared/zoom-token-refresh.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { authenticateRequest } from '../_shared/auth.ts';

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
  created_at: string;            // Frontend expects created_at
  recording_start_time: string;  // Frontend expects recording_start_time
  recording_end_time: string;    // Frontend expects recording_end_time
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
        // SEC-02A: Authenticate via shared helper (Phase 37 shared-auth migration)
    const authResult = await authenticateRequest(req, supabase, corsHeaders);
    if (authResult instanceof Response) return authResult;
    const userId = authResult.userId;
    console.log('[zoom-fetch-meetings] Auth success for user:', userId);

    // Get user's Zoom OAuth credentials
    const { data: settings, error: configError } = await supabase
      .from('user_settings')
      .select('zoom_oauth_access_token, zoom_oauth_token_expires, zoom_oauth_refresh_token')
      .eq('user_id', userId)
      .maybeSingle();

    if (configError) throw configError;

    if (!settings?.zoom_oauth_access_token) {
      throw new Error('Zoom not connected. Please connect your Zoom account in Settings.');
    }

    // Determine access token to use (refresh if expired)
    let accessToken: string;
    const now = Date.now();

    console.log('[zoom-fetch-meetings] Token check:', {
      hasAccessToken: !!settings.zoom_oauth_access_token,
      hasRefreshToken: !!settings.zoom_oauth_refresh_token,
      tokenExpires: settings.zoom_oauth_token_expires,
      now,
      expired: settings.zoom_oauth_token_expires ? settings.zoom_oauth_token_expires <= now : 'no expiry',
      userId: userId,
    });

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
        accessToken = await refreshZoomOAuthTokens(userId, settings.zoom_oauth_refresh_token);
        console.log('Zoom token refreshed successfully');
      } catch (refreshError) {
        console.error('Error refreshing Zoom token:', refreshError);
        throw new Error('Zoom token expired and refresh failed. Please reconnect in Settings.');
      }
    }

    // Parse request body for date filters
    // Frontend sends createdAfter/createdBefore (ISO strings) OR fromDate/toDate
    let fromDate: string | undefined;
    let toDate: string | undefined;

    try {
      const body = await req.json();
      // Support both naming conventions
      const rawFrom = body.createdAfter || body.fromDate;
      const rawTo = body.createdBefore || body.toDate;
      // Convert ISO datetime to YYYY-MM-DD (Zoom API requires date-only format)
      fromDate = rawFrom ? rawFrom.split('T')[0] : undefined;
      toDate = rawTo ? rawTo.split('T')[0] : undefined;
    } catch {
      // Empty body is OK - will use defaults
    }

    // Default to last 30 days if no date range specified
    // Zoom API hard limit: 'from' cannot be more than 30 days before 'to'
    if (!fromDate) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      fromDate = thirtyDaysAgo.toISOString().split('T')[0];
    }
    if (!toDate) {
      toDate = new Date().toISOString().split('T')[0];
    }

    // Zoom API enforces max 30-day window per request — paginate in 30-day chunks
    const fromDateObj = new Date(fromDate + 'T00:00:00Z');
    const toDateObj = new Date(toDate + 'T00:00:00Z');
    const diffDays = Math.ceil((toDateObj.getTime() - fromDateObj.getTime()) / (1000 * 60 * 60 * 24));

    // Build date windows (each max 30 days)
    const dateWindows: { from: string; to: string }[] = [];
    if (diffDays <= 30) {
      dateWindows.push({ from: fromDate, to: toDate });
    } else {
      let windowStart = new Date(fromDateObj);
      while (windowStart < toDateObj) {
        const windowEnd = new Date(windowStart);
        windowEnd.setDate(windowEnd.getDate() + 29); // 30-day window
        const actualEnd = windowEnd > toDateObj ? toDateObj : windowEnd;
        dateWindows.push({
          from: windowStart.toISOString().split('T')[0],
          to: actualEnd.toISOString().split('T')[0],
        });
        windowStart = new Date(actualEnd);
        windowStart.setDate(windowStart.getDate() + 1);
      }
    }

    console.log('Fetching Zoom recordings', { fromDate, toDate, windows: dateWindows.length });

    // Fetch all recordings with pagination, iterating over 30-day windows
    const allRecordings: ZoomRecording[] = [];
    const maxRetries = 3;

    for (const window of dateWindows) {
      console.log(`Fetching window: ${window.from} to ${window.to}`);
      let nextPageToken: string | undefined;

      do {
        // Build query parameters
        const params = new URLSearchParams({
          from: window.from,
          to: window.to,
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
            await throttleShared(`user:${userId}`);

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
                accessToken = await refreshZoomOAuthTokens(userId, settings.zoom_oauth_refresh_token);
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
            console.log(`[zoom-fetch-meetings] Zoom API response:`, {
              total_records: data.total_records,
              page_count: data.page_count,
              meetings_count: data.meetings?.length ?? 0,
              from: data.from,
              to: data.to,
              window_from: window.from,
              window_to: window.to,
            });

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
    }

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
        created_at: recording.start_time,
        recording_start_time: recording.start_time,
        recording_end_time: endTime.toISOString(),
        duration: recording.duration,
        has_transcript: hasTranscript,
        synced: false, // Will be updated below
      };
    });

    // Check which meetings are already synced via recordings table.
    if (meetings.length > 0) {
      const { data: syncedRecordings, error: syncCheckError } = await supabase
        .from('recordings')
        .select('source_metadata')
        .eq('owner_user_id', userId)
        .eq('source_app', 'zoom');

      if (syncCheckError) {
        console.error('Error checking sync status:', syncCheckError);
      }

      console.log(`Found ${syncedRecordings?.length || 0} Zoom recordings already synced`);

      // Build set of synced recording IDs (UUIDs) for fast lookup
      const syncedIds = new Set(
        (syncedRecordings || []).map((r: any) => {
          const extId = r.source_metadata?.external_id;
          return extId || null;
        }).filter((id: string | null): id is string => id !== null)
      );

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
