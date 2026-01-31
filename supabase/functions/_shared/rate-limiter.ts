/**
 * Database-backed Rate Limiter
 *
 * Provides persistent rate limiting that survives Edge Function cold starts.
 * Uses PostgreSQL for state storage with atomic increment operations.
 *
 * Features:
 * - Sliding window rate limiting
 * - Configurable thresholds per resource type
 * - Admin-configurable via rate_limit_configs table
 * - Fail-open on errors (allows request if rate limiter fails)
 * - Returns standard rate limit headers for HTTP responses
 *
 * Usage:
 * ```typescript
 * import { checkRateLimit, getRateLimitHeaders } from '../_shared/rate-limiter.ts';
 *
 * const rateLimit = await checkRateLimit(supabase, userId, { resourceType: 'webhook' });
 * if (!rateLimit.allowed) {
 *   return new Response('Rate limit exceeded', {
 *     status: 429,
 *     headers: getRateLimitHeaders(rateLimit)
 *   });
 * }
 * ```
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Result of a rate limit check
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Number of remaining requests in the current window */
  remaining: number;
  /** Unix timestamp (ms) when the rate limit window resets */
  resetAt: number;
  /** Maximum requests allowed per window */
  limit: number;
}

/**
 * Configuration for rate limit check
 */
export interface RateLimitConfig {
  /** Type of resource being rate limited (e.g., 'webhook', 'email', 'chat') */
  resourceType: string;
  /** Override max requests (uses database config if not provided) */
  maxRequests?: number;
  /** Override window duration in milliseconds (uses database config if not provided) */
  windowDurationMs?: number;
}

/**
 * Database config row from rate_limit_configs table
 */
interface DbConfig {
  max_requests: number;
  window_duration_ms: number;
  is_enabled: boolean;
}

/**
 * Response from check_and_increment_rate_limit RPC
 */
interface RpcResult {
  allowed: boolean;
  remaining: number;
  reset_at: number;
}

/**
 * Check and increment rate limit for a user/resource combination.
 *
 * This function:
 * 1. Fetches configuration from rate_limit_configs table (or uses defaults)
 * 2. Atomically checks and increments the rate limit via RPC
 * 3. Returns whether the request is allowed with remaining quota info
 *
 * @param supabase - Supabase client (should use service role key)
 * @param userId - User ID to rate limit
 * @param config - Rate limit configuration
 * @returns Rate limit result with allowed status and quota info
 *
 * @example
 * ```typescript
 * const result = await checkRateLimit(supabase, userId, {
 *   resourceType: 'webhook',
 *   maxRequests: 100,  // Optional override
 *   windowDurationMs: 60000  // Optional override
 * });
 *
 * if (!result.allowed) {
 *   return new Response(JSON.stringify({
 *     error: 'Rate limit exceeded',
 *     retry_after: Math.ceil((result.resetAt - Date.now()) / 1000)
 *   }), { status: 429 });
 * }
 * ```
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  userId: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const { resourceType, maxRequests, windowDurationMs } = config;
  const now = Date.now();

  // Default values in case config fetch fails
  const defaultLimit = 100;
  const defaultWindowMs = 60000;

  try {
    // 1. Get config from database (or use provided/defaults)
    let limit = maxRequests;
    let windowMs = windowDurationMs;
    let isEnabled = true;

    // Only fetch config if we need defaults
    if (limit === undefined || windowMs === undefined) {
      const { data: dbConfig, error: configError } = await supabase
        .from('rate_limit_configs')
        .select('max_requests, window_duration_ms, is_enabled')
        .eq('resource_type', resourceType)
        .maybeSingle();

      if (configError) {
        console.error(`Rate limit config fetch error for ${resourceType}:`, configError);
      }

      const typedConfig = dbConfig as DbConfig | null;
      limit = limit ?? typedConfig?.max_requests ?? defaultLimit;
      windowMs = windowMs ?? typedConfig?.window_duration_ms ?? defaultWindowMs;
      isEnabled = typedConfig?.is_enabled ?? true;
    }

    // 2. If rate limiting is disabled for this resource, allow all requests
    if (!isEnabled) {
      return {
        allowed: true,
        remaining: limit,
        resetAt: now + windowMs,
        limit,
      };
    }

    // 3. Call atomic rate limit check RPC
    const { data: rpcResult, error: rpcError } = await supabase.rpc('check_and_increment_rate_limit', {
      p_user_id: userId,
      p_resource_type: resourceType,
      p_max_requests: limit,
      p_window_duration_ms: windowMs,
      p_current_time: new Date(now).toISOString(),
    });

    if (rpcError) {
      console.error('Rate limit RPC error:', rpcError);
      // Fail open - allow request if rate limiter errors
      return {
        allowed: true,
        remaining: limit,
        resetAt: now + windowMs,
        limit,
      };
    }

    // Handle array result from RPC (PostgreSQL RETURNS TABLE returns array)
    const result: RpcResult = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;

    if (!result) {
      console.error('Rate limit RPC returned empty result');
      return {
        allowed: true,
        remaining: limit,
        resetAt: now + windowMs,
        limit,
      };
    }

    return {
      allowed: result.allowed,
      remaining: result.remaining,
      resetAt: result.reset_at,
      limit,
    };
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // Fail open - allow request if rate limiter errors
    return {
      allowed: true,
      remaining: defaultLimit,
      resetAt: now + defaultWindowMs,
      limit: defaultLimit,
    };
  }
}

/**
 * Generate standard rate limit HTTP headers from a rate limit result.
 *
 * Headers returned:
 * - X-RateLimit-Limit: Maximum requests per window
 * - X-RateLimit-Remaining: Remaining requests in current window
 * - X-RateLimit-Reset: Unix timestamp (seconds) when window resets
 * - Retry-After: Seconds until rate limit resets (only for 429 responses)
 *
 * @param result - Rate limit check result
 * @param includeRetryAfter - Whether to include Retry-After header (for 429 responses)
 * @returns Record of header name to value
 *
 * @example
 * ```typescript
 * const headers = getRateLimitHeaders(rateLimit, !rateLimit.allowed);
 * return new Response(body, { headers: { ...corsHeaders, ...headers } });
 * ```
 */
export function getRateLimitHeaders(
  result: RateLimitResult,
  includeRetryAfter = false
): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  };

  if (includeRetryAfter) {
    const retryAfterSeconds = Math.ceil((result.resetAt - Date.now()) / 1000);
    headers['Retry-After'] = String(Math.max(1, retryAfterSeconds));
  }

  return headers;
}

/**
 * Create a rate limit exceeded response with proper headers.
 *
 * @param result - Rate limit check result
 * @param requestId - Optional request ID for tracking
 * @param corsHeaders - CORS headers to include
 * @returns Response object with 429 status and proper headers
 *
 * @example
 * ```typescript
 * if (!rateLimit.allowed) {
 *   return createRateLimitResponse(rateLimit, requestId, corsHeaders);
 * }
 * ```
 */
export function createRateLimitResponse(
  result: RateLimitResult,
  requestId?: string,
  corsHeaders: Record<string, string> = {}
): Response {
  const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);

  return new Response(
    JSON.stringify({
      error: 'Rate limit exceeded',
      message: `Maximum ${result.limit} requests per window`,
      retry_after: Math.max(1, retryAfter),
      reset_at: new Date(result.resetAt).toISOString(),
      ...(requestId && { request_id: requestId }),
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        ...getRateLimitHeaders(result, true),
        'Content-Type': 'application/json',
      },
    }
  );
}
