import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * AUTOMATION WEBHOOK - External System Integration Endpoint
 *
 * This Edge Function receives webhook events from external systems and triggers
 * automation rules. It implements HMAC-SHA256 signature verification to ensure
 * only authenticated requests are processed.
 *
 * Security Features:
 * - HMAC-SHA256 signature verification using Web Crypto API
 * - Timestamp validation to prevent replay attacks (5 minute window)
 * - Rate limiting support via headers
 * - User-specific webhook secrets stored securely in database
 *
 * Expected Headers:
 * - x-webhook-signature: HMAC-SHA256 signature of the payload
 * - x-webhook-timestamp: Unix timestamp when the request was signed
 * - x-webhook-user-id: User ID to identify which user's rules to trigger (optional)
 *
 * Alternative Header Format (Svix-compatible):
 * - webhook-signature: v1,{signature}
 * - webhook-id: Unique webhook ID for idempotency
 * - webhook-timestamp: Unix timestamp
 */

import { getCorsHeaders } from '../_shared/cors.ts';

// Maximum age of webhook in milliseconds (5 minutes per spec)
const MAX_WEBHOOK_AGE_MS = 5 * 60 * 1000;

// Rate limiting: Track requests per user (in-memory, resets on function cold start)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window
const RATE_LIMIT_MAX_REQUESTS = 100; // 100 requests per minute per user

/**
 * Check rate limit for a user
 */
function checkRateLimit(userId: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || entry.resetAt < now) {
    // Reset or initialize
    const resetAt = now + RATE_LIMIT_WINDOW_MS;
    rateLimitMap.set(userId, { count: 1, resetAt });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1, resetAt };
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - entry.count, resetAt: entry.resetAt };
}

/**
 * Verify HMAC-SHA256 signature using Web Crypto API
 *
 * The signature is computed as: HMAC-SHA256(secret, timestamp.payload)
 * This includes the timestamp to prevent replay attacks.
 */
async function verifySignature(
  secret: string,
  payload: string,
  signature: string,
  timestamp: string
): Promise<boolean> {
  // Build the signed content: timestamp.payload
  const signedContent = `${timestamp}.${payload}`;

  const encoder = new TextEncoder();
  const secretBytes = encoder.encode(secret);
  const messageData = encoder.encode(signedContent);

  try {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      secretBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const expectedSignature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);

    // Convert to hex string for comparison
    const expectedHex = Array.from(new Uint8Array(expectedSignature))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // Also compute base64 for compatibility with different clients
    const expectedBase64 = btoa(String.fromCharCode(...new Uint8Array(expectedSignature)));

    // Constant-time comparison to prevent timing attacks
    // Check both hex and base64 formats
    return constantTimeCompare(signature, expectedHex) || constantTimeCompare(signature, expectedBase64);
  } catch {
    return false;
  }
}

/**
 * Verify Svix-compatible signature format (v1,{signature})
 * Used by some webhook providers including Fathom
 */
async function verifySvixSignature(
  secret: string,
  payload: string,
  signatureHeader: string,
  webhookId: string,
  timestamp: string
): Promise<boolean> {
  // Parse signature header (format: "v1,{signature}" or "v1,{sig1} v1,{sig2}")
  const signatures = signatureHeader.split(' ').map((s) => {
    if (s.startsWith('v1,')) return s.substring(3);
    return s;
  });

  // Svix signs: webhook-id.webhook-timestamp.payload
  const signedContent = `${webhookId}.${timestamp}.${payload}`;

  // Handle whsec_ prefixed secrets (base64 encoded)
  let secretBytes: Uint8Array;
  if (secret.startsWith('whsec_')) {
    try {
      const secretPart = secret.substring(6);
      secretBytes = Uint8Array.from(atob(secretPart), (c) => c.charCodeAt(0));
    } catch {
      // If base64 decode fails, use as-is
      secretBytes = new TextEncoder().encode(secret.substring(6));
    }
  } else {
    secretBytes = new TextEncoder().encode(secret);
  }

  try {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      secretBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const expectedSignature = await crypto.subtle.sign(
      'HMAC',
      cryptoKey,
      new TextEncoder().encode(signedContent)
    );

    const expectedBase64 = btoa(String.fromCharCode(...new Uint8Array(expectedSignature)));

    // Check if any provided signature matches
    return signatures.some((sig) => constantTimeCompare(sig, expectedBase64));
  } catch {
    return false;
  }
}

/**
 * Constant-time string comparison to prevent timing attacks
 *
 * This implementation ensures:
 * 1. Always iterates the same number of times (max of both lengths)
 * 2. Length mismatch is detected via XOR (constant time operation)
 * 3. Out-of-bounds access handled with || 0 to avoid early termination
 */
function constantTimeCompare(a: string, b: string): boolean {
  // XOR lengths to detect mismatch - this is a constant-time operation
  // Any non-zero value here will cause the final result to be non-zero
  let result = a.length ^ b.length;

  // Always iterate over the longer string to ensure constant time
  const maxLength = Math.max(a.length, b.length);

  for (let i = 0; i < maxLength; i++) {
    // Use || 0 for out-of-bounds access to maintain constant-time behavior
    // This ensures we don't short-circuit on undefined values
    result |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }

  return result === 0;
}

/**
 * Validate webhook timestamp to prevent replay attacks
 */
function validateTimestamp(timestamp: string): { valid: boolean; reason?: string } {
  const webhookTime = parseInt(timestamp, 10);

  if (isNaN(webhookTime)) {
    return { valid: false, reason: 'Invalid timestamp format' };
  }

  const now = Date.now();

  // Convert to milliseconds if timestamp is in seconds
  const webhookTimeMs = webhookTime < 10000000000 ? webhookTime * 1000 : webhookTime;

  const age = now - webhookTimeMs;

  if (age > MAX_WEBHOOK_AGE_MS) {
    return { valid: false, reason: `Webhook too old: ${Math.round(age / 1000)}s (max: ${MAX_WEBHOOK_AGE_MS / 1000}s)` };
  }

  if (age < -60000) {
    // Allow 1 minute clock skew into the future
    return { valid: false, reason: 'Webhook timestamp is in the future' };
  }

  return { valid: true };
}

interface WebhookPayload {
  event_type?: string;
  source?: string;
  user_id?: string;
  recording_id?: number;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  const requestId = crypto.randomUUID();
  const requestTimestamp = new Date().toISOString();

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed', allowed: ['POST'] }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', Allow: 'POST' },
      }
    );
  }

  // Health check endpoint (GET would be blocked above, so check for specific header)
  const isHealthCheck = req.headers.get('x-health-check') === 'true';
  if (isHealthCheck) {
    return new Response(
      JSON.stringify({
        status: 'online',
        endpoint: 'automation-webhook',
        timestamp: requestTimestamp,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Read raw body for signature verification
    const rawBody = await req.text();

    // Extract headers - support multiple formats
    const signature =
      req.headers.get('x-webhook-signature') || req.headers.get('webhook-signature');
    const timestamp =
      req.headers.get('x-webhook-timestamp') || req.headers.get('webhook-timestamp');
    const webhookId = req.headers.get('webhook-id');
    const userIdHeader = req.headers.get('x-webhook-user-id');

    // Validate required headers
    if (!signature) {
      return new Response(
        JSON.stringify({
          error: 'Missing signature',
          message: 'Webhook requests must include x-webhook-signature or webhook-signature header',
          request_id: requestId,
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!timestamp) {
      return new Response(
        JSON.stringify({
          error: 'Missing timestamp',
          message: 'Webhook requests must include x-webhook-timestamp or webhook-timestamp header',
          request_id: requestId,
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate timestamp (replay attack prevention)
    const timestampValidation = validateTimestamp(timestamp);
    if (!timestampValidation.valid) {
      return new Response(
        JSON.stringify({
          error: 'Invalid timestamp',
          message: timestampValidation.reason,
          request_id: requestId,
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse payload
    let payload: WebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response(
        JSON.stringify({
          error: 'Invalid JSON payload',
          request_id: requestId,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine user ID from header or payload
    const userId = userIdHeader || payload.user_id;

    if (!userId) {
      return new Response(
        JSON.stringify({
          error: 'Missing user identifier',
          message:
            'Provide user ID via x-webhook-user-id header or user_id field in payload',
          request_id: requestId,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch user's webhook secret
    const { data: userSettings, error: settingsError } = await supabase
      .from('user_settings')
      .select('automation_webhook_secret')
      .eq('user_id', userId)
      .maybeSingle();

    if (settingsError) {
      return new Response(
        JSON.stringify({
          error: 'Failed to fetch user settings',
          request_id: requestId,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const webhookSecret = userSettings?.automation_webhook_secret;

    if (!webhookSecret) {
      return new Response(
        JSON.stringify({
          error: 'Webhook not configured',
          message: 'User has not configured automation webhook secret',
          request_id: requestId,
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify signature
    let isValid = false;

    // Try Svix format first if webhook-id is present
    if (webhookId && signature.includes('v1,')) {
      isValid = await verifySvixSignature(webhookSecret, rawBody, signature, webhookId, timestamp);
    }

    // Try standard format
    if (!isValid) {
      isValid = await verifySignature(webhookSecret, rawBody, signature, timestamp);
    }

    if (!isValid) {
      return new Response(
        JSON.stringify({
          error: 'Invalid signature',
          message: 'Webhook signature verification failed',
          request_id: requestId,
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check rate limit
    const rateLimit = checkRateLimit(userId);
    const rateLimitHeaders = {
      'X-RateLimit-Limit': String(RATE_LIMIT_MAX_REQUESTS),
      'X-RateLimit-Remaining': String(rateLimit.remaining),
      'X-RateLimit-Reset': String(Math.ceil(rateLimit.resetAt / 1000)),
    };

    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: `Maximum ${RATE_LIMIT_MAX_REQUESTS} requests per minute`,
          retry_after: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
          request_id: requestId,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            ...rateLimitHeaders,
            'Content-Type': 'application/json',
            'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
          },
        }
      );
    }

    // Check idempotency (prevent duplicate processing)
    if (webhookId) {
      const { data: existingWebhook } = await supabase
        .from('processed_webhooks')
        .select('webhook_id')
        .eq('webhook_id', `automation_${webhookId}`)
        .maybeSingle();

      if (existingWebhook) {
        return new Response(
          JSON.stringify({
            status: 'already_processed',
            webhook_id: webhookId,
            request_id: requestId,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, ...rateLimitHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Trigger automation engine with webhook trigger type
    const enginePayload = {
      trigger_type: 'webhook',
      trigger_source: {
        webhook_event_id: webhookId || requestId,
        event_type: payload.event_type,
        source: payload.source,
      },
      user_id: userId,
      // Pass webhook payload data for condition evaluation
      webhook_payload: payload,
    };

    // Call automation engine
    const { error: engineError } = await supabase.functions.invoke('automation-engine', {
      body: enginePayload,
    });

    // Mark webhook as processed (for idempotency)
    if (webhookId) {
      await supabase.from('processed_webhooks').insert({
        webhook_id: `automation_${webhookId}`,
        processed_at: new Date().toISOString(),
      });
    }

    if (engineError) {
      // Log the error but still return success to the webhook sender
      // This prevents retries for internal processing errors
      return new Response(
        JSON.stringify({
          status: 'received',
          message: 'Webhook received but automation engine reported an error',
          webhook_id: webhookId || requestId,
          request_id: requestId,
        }),
        {
          status: 202,
          headers: { ...corsHeaders, ...rateLimitHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        status: 'processed',
        message: 'Webhook processed successfully',
        webhook_id: webhookId || requestId,
        request_id: requestId,
        timestamp: requestTimestamp,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, ...rateLimitHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: errorMessage,
        request_id: requestId,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
