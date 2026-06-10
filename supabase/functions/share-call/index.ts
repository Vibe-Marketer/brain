import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from 'https://esm.sh/zod@3.23.8';
import { getCorsHeaders } from '../_shared/cors.ts';
import { authenticateRequest } from '../_shared/auth.ts';
import { maskEmail } from '../_shared/email-mask.ts';

/**
 * Share Call Edge Function
 *
 * Handles single call share link management:
 * - POST /share-call - Create a new share link (auth required)
 * - GET /share-call?token=xxx - Fetch shared call by token (no auth — token is the credential)
 * - GET /share-call?id=xxx - Get share link details (auth required)
 * - DELETE /share-call?id=xxx - Revoke a share link (auth required)
 * - GET /share-call/access-log?id=xxx - Get access log (auth required)
 * - POST /share-call/access-log - Log an access event (auth required)
 *
 * Security: user_id is derived from JWT for authenticated operations.
 * Token-based access (GET ?token=xxx) is intentionally unauthenticated — the
 * share token itself serves as the access credential.
 */

const shareLinkCreateSchema = z.object({
  call_recording_id: z.number().int().positive('call_recording_id must be a positive integer'),
  recipient_email: z.string().email().max(254).optional(),
});

const accessLogSchema = z.object({
  share_link_id: z.string().uuid('share_link_id must be a valid UUID'),
});

/**
 * Generates a cryptographically secure 32-character URL-safe token
 */
function generateShareToken(): string {
  const array = new Uint8Array(24); // 24 bytes = 32 base64 chars
  crypto.getRandomValues(array);
  // Convert to base64url (URL-safe base64)
  const base64 = btoa(String.fromCharCode(...array));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('Origin'));

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // service-role required: validates org membership + writes share_links rows + invites recipients without RLS visibility (recipient may not be a member of the source org yet).
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);

    // Extract action from path: /share-call/access-log or /share-call
    const action = pathParts.length > 1 ? pathParts[pathParts.length - 1] : null;

    // Handle access-log endpoint
    if (action === 'access-log') {
      return handleAccessLog(req, supabaseClient, url, corsHeaders);
    }

    // Route by HTTP method
    switch (req.method) {
      case 'POST':
        return handleCreateShareLink(req, supabaseClient, corsHeaders);
      case 'GET':
        return handleGetShareCall(req, supabaseClient, url, corsHeaders);
      case 'DELETE':
        return handleRevokeShareLink(req, supabaseClient, url, corsHeaders);
      default:
        return new Response(
          JSON.stringify({ error: 'Method not allowed' }),
          { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * POST /share-call - Create a new share link
 *
 * Requires JWT auth. user_id derived from token.
 * Verifies organization membership via the recordings table.
 */
async function handleCreateShareLink(
  req: Request,
  supabaseClient: ReturnType<typeof createClient>,
  corsHeaders: Record<string, string>
): Promise<Response> {
  // Authenticate — user_id comes from JWT
  const authResult = await authenticateRequest(req, supabaseClient, corsHeaders);
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const rawBody = await req.json();
  const validation = shareLinkCreateSchema.safeParse(rawBody);

  if (!validation.success) {
    const errorMessage = validation.error.errors[0]?.message || 'Invalid input';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { call_recording_id, recipient_email } = validation.data;

  // Verify the user owns this call (legacy fathom_raw_calls check)
  const { data: call, error: callError } = await supabaseClient
    .from('fathom_raw_calls')
    .select('recording_id')
    .eq('recording_id', call_recording_id)
    .eq('user_id', userId)
    .maybeSingle();

  if (callError) {
    return new Response(
      JSON.stringify({ error: 'Error verifying call ownership' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!call) {
    return new Response(
      JSON.stringify({ error: 'Call not found or you do not have permission to share it' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Verify organization membership via the canonical recordings table.
  // This check is MANDATORY — if the recording doesn't exist in the canonical
  // table, we deny the request rather than silently skipping the org check
  // (security audit High #6).
  const { data: recording } = await supabaseClient
    .from('recordings')
    .select('organization_id')
    .eq('fathom_provider_id', call_recording_id)
    .single();

  if (!recording) {
    return new Response(
      JSON.stringify({ error: 'Recording not found in organization context. Cannot create share link.' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { data: membership } = await supabaseClient
    .from('organization_memberships')
    .select('role')
    .eq('organization_id', recording.organization_id)
    .eq('user_id', userId)
    .single();

  if (!membership) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Generate unique share token
  const share_token = generateShareToken();

  // Create the share link
  const { data: shareLink, error: insertError } = await supabaseClient
    .from('call_share_links')
    .insert({
      call_recording_id,
      user_id: userId,
      created_by_user_id: userId,
      share_token,
      recipient_email: recipient_email || null,
      status: 'active',
    })
    .select()
    .single();

  if (insertError) {
    return new Response(
      JSON.stringify({ error: 'Error creating share link', details: insertError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ share_link: shareLink }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * GET /share-call - Fetch share link/call by token or id
 *
 * Token-based access (for recipients) does NOT require auth — the share token
 * is the credential (like a signed URL). This is by design.
 * ID-based access (for owners viewing their own links) requires JWT auth.
 *
 * Query params:
 * - token: Share token for recipients to access shared call
 * - id: Share link ID for owners to view link details (requires auth)
 * - log_access: If true, logs the access (for token-based access).
 *   When set, accessed_by_user_id is derived from the optional Authorization
 *   header (JWT) and ip_address is derived from x-forwarded-for. The legacy
 *   accessor_user_id and ip_address query params are NO LONGER read — they
 *   were a forgery vector (security audit Critical #3, D-13).
 */
async function handleGetShareCall(
  req: Request,
  supabaseClient: ReturnType<typeof createClient>,
  url: URL,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const token = url.searchParams.get('token');
  const id = url.searchParams.get('id');
  const logAccess = url.searchParams.get('log_access') === 'true';

  // Token-based access (for share link recipients) — no auth required.
  // The 32-char cryptographic token serves as the access credential,
  // similar to a pre-signed URL pattern.
  if (token) {
    // Phase 32: Optional authentication probe — token branch is unauthenticated by
    // default, but if a Bearer token is present we resolve the current user to detect
    // recipient mismatch (QA-22 backend signal restoration).
    let currentUserEmail: string | null = null;
    let currentUserId: string | null = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const probeToken = authHeader.replace(/^Bearer\s+/i, '');
      const { data: probeData, error: probeError } = await supabaseClient.auth.getUser(probeToken);
      if (!probeError && probeData?.user) {
        currentUserEmail = probeData.user.email ?? null;
        currentUserId = probeData.user.id;
      }
    }

    // Phase 32: signup-prefill mode — Login.tsx pre-fills the share-recipient signup
    // form via this short-circuit endpoint. The token IS the credential (same security
    // model as the rest of the token branch).
    const mode = url.searchParams.get('mode');
    if (mode === 'signup-prefill') {
      const { data: prefillLink } = await supabaseClient
        .from('call_share_links')
        .select('recipient_email, status')
        .eq('share_token', token)
        .single();
      if (!prefillLink || prefillLink.status === 'revoked') {
        return new Response(
          JSON.stringify({ error: 'Share link not found or revoked', code: 'LINK_NOT_FOUND' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ recipient_email: prefillLink.recipient_email ?? null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find share link by token
    const { data: shareLink, error: linkError } = await supabaseClient
      .from('call_share_links')
      .select('*')
      .eq('share_token', token)
      .single();

    if (linkError || !shareLink) {
      return new Response(
        JSON.stringify({ error: 'Share link not found', code: 'LINK_NOT_FOUND' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if revoked
    if (shareLink.status === 'revoked') {
      return new Response(
        JSON.stringify({
          error: 'This share link has been revoked',
          code: 'LINK_REVOKED',
          share_link: {
            id: shareLink.id,
            status: shareLink.status,
            revoked_at: shareLink.revoked_at,
          }
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Phase 32: Sender-views-own-link bypass — the sender always sees their own call,
    // regardless of recipient_email mismatch.
    const isSender = currentUserId !== null && currentUserId === shareLink.user_id;

    // Phase 32: Wrong-recipient detection — authenticated user's email differs from
    // the share's recipient_email (case-insensitive). Only applies when both a current
    // user AND a recipient_email exist.
    if (
      !isSender &&
      currentUserEmail &&
      shareLink.recipient_email &&
      currentUserEmail.toLowerCase() !== shareLink.recipient_email.toLowerCase()
    ) {
      return new Response(
        JSON.stringify({
          error: 'This share is for a different account',
          code: 'WRONG_RECIPIENT',
          recipient_masked: maskEmail(shareLink.recipient_email),
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Phase 32: Public-view branch — unauthenticated request returns the safe-subset
    // payload (inviter name + call title + masked recipient) for the landing card.
    // No transcript, no recording_id, no internal IDs leaked.
    if (currentUserEmail === null) {
      // Resolve inviter name — prefer user_profiles.display_name, fall back to email-local.
      const { data: inviterProfile } = await supabaseClient
        .from('user_profiles')
        .select('display_name, email')
        .eq('user_id', shareLink.user_id)
        .maybeSingle();

      let inviterName = inviterProfile?.display_name ?? null;
      if (!inviterName) {
        // Fall back to auth.users email-local (capitalize first letter)
        const { data: authUser } = await supabaseClient.auth.admin.getUserById(shareLink.user_id);
        const email = authUser?.user?.email ?? '';
        const local = email.split('@')[0] ?? '';
        inviterName = local ? local.charAt(0).toUpperCase() + local.slice(1) : 'Someone';
      }

      // Resolve call title (must succeed — if call row doesn't exist, return 404 CALL_NOT_FOUND).
      // Note: fathom_raw_calls uses the `title` column (not `call_name`); the legacy
      // `call_name` alias below is preserved in the authenticated path for backward compat
      // with the frontend, but we read `title` here for the public-view payload.
      const { data: publicCall, error: publicCallError } = await supabaseClient
        .from('fathom_raw_calls')
        .select('title')
        .eq('recording_id', shareLink.call_recording_id)
        .eq('user_id', shareLink.user_id)
        .single();

      if (publicCallError || !publicCall) {
        return new Response(
          JSON.stringify({ error: 'Shared call not found', code: 'CALL_NOT_FOUND' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          inviter_name: inviterName,
          call_title: publicCall.title || 'An untitled call',
          recipient_email: shareLink.recipient_email ?? null,
          recipient_masked: shareLink.recipient_email ? maskEmail(shareLink.recipient_email) : null,
          is_public_view: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the call data (authenticated path — current user is the correct recipient or sender).
    // Note: fathom_raw_calls uses `title` column; we alias it to call_name in the SELECT for
    // frontend backward compat. `duration` doesn't exist on fathom_raw_calls — compute from
    // recording_start_time / recording_end_time at the frontend if needed.
    const { data: rawCall, error: callError } = await supabaseClient
      .from('fathom_raw_calls')
      .select(`
        recording_id,
        title,
        recorded_by_email,
        recording_start_time,
        recording_end_time,
        full_transcript
      `)
      .eq('recording_id', shareLink.call_recording_id)
      .eq('user_id', shareLink.user_id)
      .single();
    const call = rawCall
      ? {
          recording_id: rawCall.recording_id,
          call_name: rawCall.title,
          recorded_by_email: rawCall.recorded_by_email,
          recording_start_time: rawCall.recording_start_time,
          duration:
            rawCall.recording_start_time && rawCall.recording_end_time
              ? null // Duration computation deferred to frontend if needed
              : null,
          full_transcript: rawCall.full_transcript,
        }
      : null;

    if (callError || !call) {
      return new Response(
        JSON.stringify({ error: 'Shared call not found', code: 'CALL_NOT_FOUND' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log access if requested. Identity is derived from the request (JWT + headers),
    // NEVER from client-supplied query params (security audit Critical #3, D-13).
    if (logAccess) {
      let derivedUserId: string | null = null;
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const accessorToken = authHeader.replace(/^Bearer\s+/i, '');
        const { data } = await supabaseClient.auth.getUser(accessorToken);
        derivedUserId = data?.user?.id ?? null;
      }
      const derivedIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
      await supabaseClient
        .from('call_share_access_log')
        .insert({
          share_link_id: shareLink.id,
          accessed_by_user_id: derivedUserId,  // null for anonymous viewers
          ip_address: derivedIp,
        });
      // Don't fail if logging fails — it's not critical
    }

    return new Response(
      JSON.stringify({
        share_link: {
          id: shareLink.id,
          share_token: shareLink.share_token,
          recipient_email: shareLink.recipient_email,
          status: shareLink.status,
          created_at: shareLink.created_at,
        },
        call,
        is_valid: true,
        is_revoked: false,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // ID-based access (for share link owners) — requires auth + org membership
  if (id) {
    const authResult = await authenticateRequest(req, supabaseClient, corsHeaders);
    if (authResult instanceof Response) return authResult;
    const { userId } = authResult;

    const { data: shareLink, error: linkError } = await supabaseClient
      .from('call_share_links')
      .select('*')
      .eq('id', id)
      .single();

    if (linkError || !shareLink) {
      return new Response(
        JSON.stringify({ error: 'Share link not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify ownership
    if (shareLink.user_id !== userId) {
      return new Response(
        JSON.stringify({ error: 'You do not have permission to view this share link' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify organization membership via the canonical recordings table
    const { data: recording } = await supabaseClient
      .from('recordings')
      .select('organization_id')
      .eq('fathom_provider_id', shareLink.call_recording_id)
      .single();

    if (recording) {
      const { data: membership } = await supabaseClient
        .from('organization_memberships')
        .select('role')
        .eq('organization_id', recording.organization_id)
        .eq('user_id', userId)
        .single();

      if (!membership) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({ share_link: shareLink }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ error: 'Either token or id query parameter is required' }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * DELETE /share-call?id=xxx - Revoke a share link
 *
 * Requires JWT auth. Ownership verified via JWT user_id.
 * Organization membership verified via recordings table.
 */
async function handleRevokeShareLink(
  req: Request,
  supabaseClient: ReturnType<typeof createClient>,
  url: URL,
  corsHeaders: Record<string, string>
): Promise<Response> {
  // Authenticate — user_id comes from JWT
  const authResult = await authenticateRequest(req, supabaseClient, corsHeaders);
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const id = url.searchParams.get('id');

  if (!id) {
    return new Response(
      JSON.stringify({ error: 'Share link id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get the share link to verify ownership
  const { data: shareLink, error: fetchError } = await supabaseClient
    .from('call_share_links')
    .select('user_id, status, call_recording_id')
    .eq('id', id)
    .single();

  if (fetchError || !shareLink) {
    return new Response(
      JSON.stringify({ error: 'Share link not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Verify ownership via JWT
  if (shareLink.user_id !== userId) {
    return new Response(
      JSON.stringify({ error: 'You do not have permission to revoke this share link' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Verify organization membership via the canonical recordings table
  const { data: recording } = await supabaseClient
    .from('recordings')
    .select('organization_id')
    .eq('fathom_provider_id', shareLink.call_recording_id)
    .single();

  if (recording) {
    const { data: membership } = await supabaseClient
      .from('organization_memberships')
      .select('role')
      .eq('organization_id', recording.organization_id)
      .eq('user_id', userId)
      .single();

    if (!membership) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  // Already revoked
  if (shareLink.status === 'revoked') {
    return new Response(
      JSON.stringify({ message: 'Share link is already revoked' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Revoke the share link
  const { error: updateError } = await supabaseClient
    .from('call_share_links')
    .update({
      status: 'revoked',
      revoked_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (updateError) {
    return new Response(
      JSON.stringify({ error: 'Error revoking share link', details: updateError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, message: 'Share link revoked' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * GET /share-call/access-log?id=xxx - Get access log for a share link (auth required)
 * POST /share-call/access-log - Log an access event (auth required — user_id from JWT)
 */
async function handleAccessLog(
  req: Request,
  supabaseClient: ReturnType<typeof createClient>,
  url: URL,
  corsHeaders: Record<string, string>
): Promise<Response> {
  // POST - Log access (auth required — user_id derived from JWT)
  if (req.method === 'POST') {
    const authResult = await authenticateRequest(req, supabaseClient, corsHeaders);
    if (authResult instanceof Response) return authResult;
    const { userId } = authResult;

    const rawBody = await req.json();
    const validation = accessLogSchema.safeParse(rawBody);

    if (!validation.success) {
      const errorMessage = validation.error.errors[0]?.message || 'Invalid input';
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { share_link_id } = validation.data;

    // Derive IP address from request headers instead of trusting the body
    const ip_address = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown';

    // Verify share link exists and is active
    const { data: shareLink, error: linkError } = await supabaseClient
      .from('call_share_links')
      .select('id, status')
      .eq('id', share_link_id)
      .single();

    if (linkError || !shareLink) {
      return new Response(
        JSON.stringify({ error: 'Share link not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (shareLink.status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'Cannot log access to revoked share link' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log the access — user_id from JWT, IP from headers
    const { data: accessLog, error: insertError } = await supabaseClient
      .from('call_share_access_log')
      .insert({
        share_link_id,
        accessed_by_user_id: userId,
        ip_address,
      })
      .select()
      .single();

    if (insertError) {
      return new Response(
        JSON.stringify({ error: 'Error logging access', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ access_log: accessLog }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // GET - Fetch access log (requires auth + ownership)
  const authResult = await authenticateRequest(req, supabaseClient, corsHeaders);
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const id = url.searchParams.get('id');

  if (!id) {
    return new Response(
      JSON.stringify({ error: 'Share link id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get share link to verify ownership
  const { data: shareLink, error: linkError } = await supabaseClient
    .from('call_share_links')
    .select('user_id, call_recording_id')
    .eq('id', id)
    .single();

  if (linkError || !shareLink) {
    return new Response(
      JSON.stringify({ error: 'Share link not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Verify ownership via JWT
  if (shareLink.user_id !== userId) {
    return new Response(
      JSON.stringify({ error: 'You do not have permission to view this access log' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Verify organization membership via the canonical recordings table
  const { data: recording } = await supabaseClient
    .from('recordings')
    .select('organization_id')
    .eq('fathom_provider_id', shareLink.call_recording_id)
    .single();

  if (recording) {
    const { data: membership } = await supabaseClient
      .from('organization_memberships')
      .select('role')
      .eq('organization_id', recording.organization_id)
      .eq('user_id', userId)
      .single();

    if (!membership) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  // Fetch access logs
  const { data: accessLogs, error: logsError } = await supabaseClient
    .from('call_share_access_log')
    .select('*')
    .eq('share_link_id', id)
    .order('accessed_at', { ascending: false });

  if (logsError) {
    return new Response(
      JSON.stringify({ error: 'Error fetching access logs', details: logsError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Enhance logs with user info from user_settings
  const enhancedLogs = await Promise.all(
    (accessLogs || []).map(async (log) => {
      const { data: userSettings } = await supabaseClient
        .from('user_settings')
        .select('display_name')
        .eq('user_id', log.accessed_by_user_id)
        .maybeSingle();

      return {
        ...log,
        user_name: userSettings?.display_name || null,
      };
    })
  );

  return new Response(
    JSON.stringify({ access_logs: enhancedLogs }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
