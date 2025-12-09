import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
};

/**
 * RATE LIMITING CONFIGURATION
 *
 * Fathom API limits: 60 requests/minute per API key
 * Our conservative limit: 55 requests/minute (provides safety buffer)
 * Window: 60 seconds (60000ms)
 * Jitter: 0-200ms random delay to prevent thundering herd
 */
const RATE_WINDOW_MS = 60000;
const RATE_MAX_REQUESTS = 55; // Leave some buffer under 60/min
const RATE_JITTER_MS = 200;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

type RateWindow = { windowStart: number; count: number };
type RateLimiterState = { windows: Map<string, RateWindow> };

/**
 * GLOBAL RATE LIMITER STATE
 *
 * DEPLOYMENT MODEL ASSUMPTIONS:
 * - Supabase Edge Functions use Deno Deploy architecture
 * - Each deployment runs in its own V8 isolate within a runner process
 * - Isolates can be reused for subsequent requests (warm starts)
 * - globalThis persists within a single isolate instance
 * - Multiple isolates may run concurrently across edge locations
 *
 * SCALABILITY CONSIDERATIONS:
 * - This in-memory rate limiter is per-isolate, NOT globally shared
 * - In multi-instance deployments, each isolate has independent state
 * - For true global rate limiting, a database-backed solution is required
 * - Current implementation prevents rate limit violations from a single isolate
 * - For production with high concurrency, consider Redis-backed rate limiting
 *
 * MEMORY LEAK PREVENTION:
 * - Cleanup logic runs in throttleShared() to remove expired entries
 * - Windows older than 2x the rate window are automatically deleted
 */
const globalRateLimiterState = (globalThis as unknown as { __fathomRateLimiter?: RateLimiterState }).__fathomRateLimiter
  ?? { windows: new Map<string, RateWindow>() };
(globalThis as unknown as { __fathomRateLimiter?: RateLimiterState }).__fathomRateLimiter = globalRateLimiterState;

/**
 * Sliding window rate limiter with automatic cleanup
 *
 * ALGORITHM:
 * 1. Check if current window has expired (elapsed >= windowMs)
 * 2. If expired, reset window start time and request count
 * 3. If at rate limit, calculate wait time with jitter and recursively retry
 * 4. Otherwise, increment count and allow request through
 * 5. Periodically clean up stale entries to prevent memory leak
 *
 * MEMORY CLEANUP:
 * - Every request checks if its window is stale (> 2x windowMs old)
 * - Stale windows are deleted from the Map to prevent unbounded growth
 * - This prevents memory accumulation over time
 *
 * @param scope - Rate limit scope (e.g., 'global', 'user:123')
 * @param maxRequests - Maximum requests allowed per window
 * @param windowMs - Time window in milliseconds
 */
async function throttleShared(scope: string, maxRequests: number = RATE_MAX_REQUESTS, windowMs: number = RATE_WINDOW_MS): Promise<void> {
  const now = Date.now();
  const existing = globalRateLimiterState.windows.get(scope) ?? { windowStart: now, count: 0 };
  const elapsed = now - existing.windowStart;

  // MEMORY LEAK FIX: Clean up expired window entries
  // If window is more than 2x the window duration old, it's stale - delete and restart
  if (elapsed > windowMs * 2) {
    globalRateLimiterState.windows.delete(scope);
    // Recursively call with fresh state
    return throttleShared(scope, maxRequests, windowMs);
  }

  // Reset window if current window has expired
  if (elapsed >= windowMs) {
    existing.windowStart = now;
    existing.count = 0;
  }

  // Rate limit reached - wait with jittered backoff
  if (existing.count >= maxRequests) {
    // Calculate wait time: time remaining in window + random jitter
    const waitTime = windowMs - elapsed + Math.floor(Math.random() * RATE_JITTER_MS);
    console.log(`Rate limit prevention for ${scope}: waiting ${waitTime}ms...`);
    await sleep(waitTime);
    // Recursively retry after waiting
    return throttleShared(scope, maxRequests, windowMs);
  }

  // Allow request through and increment counter
  existing.count += 1;
  globalRateLimiterState.windows.set(scope, existing);
}

interface FathomMeeting {
  recording_id: number;
  title: string;
  created_at: string;
  recording_start_time: string;
  recording_end_time: string;
  url: string;
  share_url: string;
  calendar_invitees?: Array<{
    name: string;
    email: string;
    email_domain: string;
    is_external: boolean;
    matched_speaker_display_name?: string;
  }>;
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

    // Get user's Fathom credentials (OAuth or API key)
    const { data: settings, error: configError } = await supabase
      .from('user_settings')
      .select('fathom_api_key, oauth_access_token, oauth_token_expires, oauth_refresh_token')
      .eq('user_id', user.id)
      .maybeSingle();

    if (configError) throw configError;

    if (!settings?.fathom_api_key && !settings?.oauth_access_token) {
      throw new Error('Fathom credentials not configured. Please add them in Settings.');
    }

    // Determine which authentication method to use
    let authHeaders: Record<string, string>;
    if (settings.oauth_access_token) {
      // Check if OAuth token is expired
      const now = Date.now();
      if (settings.oauth_token_expires && settings.oauth_token_expires > now) {
        authHeaders = {
          'Authorization': `Bearer ${settings.oauth_access_token}`,
          'Content-Type': 'application/json',
        };
        console.log('Using OAuth authentication for fetch-meetings');
      } else {
        // Token is expired, attempt to refresh it
        console.log('OAuth token expired, attempting refresh...');
        if (!settings.oauth_refresh_token) {
          throw new Error('OAuth token expired and no refresh token available. Please reconnect in Settings.');
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
            throw new Error('Failed to refresh access token. Please reconnect in Settings.');
          }

          const tokens = await tokenResponse.json();
          const expiresAt = Date.now() + (tokens.expires_in * 1000);

          // Store new tokens
          await supabase
            .from('user_settings')
            .update({
              oauth_access_token: tokens.access_token,
              oauth_refresh_token: tokens.refresh_token,
              oauth_token_expires: expiresAt,
            })
            .eq('user_id', user.id);

          // Use the new token
          authHeaders = {
            'Authorization': `Bearer ${tokens.access_token}`,
            'Content-Type': 'application/json',
          };
          console.log('OAuth token refreshed successfully');
        } catch (refreshError) {
          console.error('Error refreshing OAuth token:', refreshError);
          throw new Error('OAuth token expired and refresh failed. Please reconnect in Settings.');
        }
      }
    } else if (settings.fathom_api_key) {
      authHeaders = {
        'X-Api-Key': settings.fathom_api_key,
        'Content-Type': 'application/json',
      };
      console.log('Using API key authentication for fetch-meetings');
    } else {
      throw new Error('No valid Fathom authentication found.');
    }

    const { createdAfter, createdBefore } = await req.json();

    console.log('Fetching meetings from Fathom API', { createdAfter, createdBefore });

    // Build query parameters - include calendar invitees for participant data
    const params = new URLSearchParams();
    if (createdAfter) params.append('created_after', createdAfter);
    if (createdBefore) params.append('created_before', createdBefore);
    params.append('include_calendar_invitees', 'true');

    // Fetch all meetings with pagination and rate limit handling
    const allMeetings: FathomMeeting[] = [];
    let cursor: string | null = null;
    let hasMore = true;
    const maxRetries = 3;

    while (hasMore) {
      if (cursor) {
        params.set('cursor', cursor);
      }

      let retryCount = 0;
      let success = false;

      while (!success && retryCount < maxRetries) {
        try {
          // Apply shared rate limiting (global + per-user)
          await throttleShared('global');
          await throttleShared(`user:${user.id}`);

          const response = await fetch(
            `https://api.fathom.ai/external/v1/meetings?${params.toString()}`,
            { headers: authHeaders }
          );

          if (response.status === 429) {
            // Rate limited - wait and retry with exponential backoff
            const waitTime = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
            console.log(`Rate limited (429). Waiting ${waitTime}ms before retry ${retryCount + 1}/${maxRetries}...`);
            await sleep(waitTime);
            retryCount++;
            continue;
          }

          if (!response.ok) {
            const errorText = await response.text();
            console.error('Fathom API error:', errorText);
            throw new Error(`Fathom API error: ${response.status} - ${errorText}`);
          }

          const data = await response.json();
          
          if (data.items && data.items.length > 0) {
            allMeetings.push(...data.items);
            console.log(`Fetched ${data.items.length} meetings (total: ${allMeetings.length})`);
          }

          cursor = data.next_cursor;
          hasMore = !!cursor;
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
    const { data: syncedCalls, error: syncCheckError } = await supabase
      .from('fathom_calls')
      .select('recording_id')
      .in('recording_id', allMeetings.map(m => m.recording_id));

    if (syncCheckError) {
      console.error('Error checking sync status:', syncCheckError);
    }

    console.log(`Found ${syncedCalls?.length || 0} synced calls in database`);
    console.log('Synced recording IDs:', syncedCalls?.map(c => c.recording_id));

    // Ensure both sides are numbers for comparison
    const syncedIds = new Set(syncedCalls?.map(c => Number(c.recording_id)) || []);

    const meetingsWithSyncStatus = allMeetings.map(meeting => ({
      ...meeting,
      synced: syncedIds.has(Number(meeting.recording_id)),
    }));

    const syncedCount = meetingsWithSyncStatus.filter(m => m.synced).length;
    console.log(`Returning ${meetingsWithSyncStatus.length} meetings (${syncedCount} synced, ${meetingsWithSyncStatus.length - syncedCount} not synced)`);

    return new Response(
      JSON.stringify({ meetings: meetingsWithSyncStatus }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching meetings:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
