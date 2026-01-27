import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts';

// Dynamic CORS headers - set per-request from origin
let corsHeaders: Record<string, string> = {};

/**
 * Share Call Edge Function
 *
 * Handles single call share link management:
 * - POST /share-call - Create a new share link
 * - GET /share-call?token=xxx - Fetch shared call by token (for recipients)
 * - GET /share-call?id=xxx - Get share link details (for owner)
 * - DELETE /share-call?id=xxx - Revoke a share link
 * - GET /share-call/access-log?id=xxx - Get access log for a share link
 */

interface ShareLinkInput {
  call_recording_id: number;
  user_id: string;
  recipient_email?: string;
}

interface LogAccessInput {
  share_link_id: string;
  user_id: string;
  ip_address?: string;
}

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
  const origin = req.headers.get('Origin');
  corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
      return handleAccessLog(req, supabaseClient, url);
    }

    // Route by HTTP method
    switch (req.method) {
      case 'POST':
        return handleCreateShareLink(req, supabaseClient);
      case 'GET':
        return handleGetShareCall(req, supabaseClient, url);
      case 'DELETE':
        return handleRevokeShareLink(req, supabaseClient, url);
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
 */
async function handleCreateShareLink(
  req: Request,
  supabaseClient: ReturnType<typeof createClient>
): Promise<Response> {
  const body = await req.json() as ShareLinkInput;

  const { call_recording_id, user_id, recipient_email } = body;

  if (!call_recording_id) {
    return new Response(
      JSON.stringify({ error: 'call_recording_id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!user_id) {
    return new Response(
      JSON.stringify({ error: 'user_id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Verify the user owns this call
  const { data: call, error: callError } = await supabaseClient
    .from('fathom_calls')
    .select('recording_id')
    .eq('recording_id', call_recording_id)
    .eq('user_id', user_id)
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

  // Generate unique share token
  const share_token = generateShareToken();

  // Create the share link
  const { data: shareLink, error: insertError } = await supabaseClient
    .from('call_share_links')
    .insert({
      call_recording_id,
      user_id,
      created_by_user_id: user_id,
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
 * Query params:
 * - token: Share token for recipients to access shared call
 * - id: Share link ID for owners to view link details
 * - log_access: If true, logs the access (for token-based access)
 * - accessor_user_id: User ID of the person accessing (for logging)
 * - ip_address: IP address (for logging)
 */
async function handleGetShareCall(
  req: Request,
  supabaseClient: ReturnType<typeof createClient>,
  url: URL
): Promise<Response> {
  const token = url.searchParams.get('token');
  const id = url.searchParams.get('id');
  const logAccess = url.searchParams.get('log_access') === 'true';
  const accessorUserId = url.searchParams.get('accessor_user_id');
  const ipAddress = url.searchParams.get('ip_address');

  // Token-based access (for share link recipients)
  if (token) {
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

    // Fetch the call data
    const { data: call, error: callError } = await supabaseClient
      .from('fathom_calls')
      .select(`
        recording_id,
        call_name,
        recorded_by_email,
        recording_start_time,
        duration,
        full_transcript
      `)
      .eq('recording_id', shareLink.call_recording_id)
      .eq('user_id', shareLink.user_id)
      .single();

    if (callError || !call) {
      return new Response(
        JSON.stringify({ error: 'Shared call not found', code: 'CALL_NOT_FOUND' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log access if requested and user ID provided
    if (logAccess && accessorUserId) {
      await supabaseClient
        .from('call_share_access_log')
        .insert({
          share_link_id: shareLink.id,
          accessed_by_user_id: accessorUserId,
          ip_address: ipAddress || null,
        });
      // Don't fail if logging fails - it's not critical
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

  // ID-based access (for share link owners)
  if (id) {
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
 */
async function handleRevokeShareLink(
  req: Request,
  supabaseClient: ReturnType<typeof createClient>,
  url: URL
): Promise<Response> {
  const id = url.searchParams.get('id');

  // Also try to get from body for flexibility
  let userId: string | null = null;
  try {
    const body = await req.json();
    userId = body.user_id;
  } catch {
    // Body might be empty, which is fine
  }

  if (!id) {
    return new Response(
      JSON.stringify({ error: 'Share link id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get the share link to verify ownership
  const { data: shareLink, error: fetchError } = await supabaseClient
    .from('call_share_links')
    .select('user_id, status')
    .eq('id', id)
    .single();

  if (fetchError || !shareLink) {
    return new Response(
      JSON.stringify({ error: 'Share link not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // If user_id provided, verify ownership
  if (userId && shareLink.user_id !== userId) {
    return new Response(
      JSON.stringify({ error: 'You do not have permission to revoke this share link' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
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
 * GET /share-call/access-log?id=xxx - Get access log for a share link
 * POST /share-call/access-log - Log an access event
 */
async function handleAccessLog(
  req: Request,
  supabaseClient: ReturnType<typeof createClient>,
  url: URL
): Promise<Response> {
  // POST - Log access
  if (req.method === 'POST') {
    const body = await req.json() as LogAccessInput;
    const { share_link_id, user_id, ip_address } = body;

    if (!share_link_id || !user_id) {
      return new Response(
        JSON.stringify({ error: 'share_link_id and user_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Log the access
    const { data: accessLog, error: insertError } = await supabaseClient
      .from('call_share_access_log')
      .insert({
        share_link_id,
        accessed_by_user_id: user_id,
        ip_address: ip_address || null,
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

  // GET - Fetch access log
  const id = url.searchParams.get('id');
  const userId = url.searchParams.get('user_id');

  if (!id) {
    return new Response(
      JSON.stringify({ error: 'Share link id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get share link to verify ownership
  const { data: shareLink, error: linkError } = await supabaseClient
    .from('call_share_links')
    .select('user_id')
    .eq('id', id)
    .single();

  if (linkError || !shareLink) {
    return new Response(
      JSON.stringify({ error: 'Share link not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Verify ownership if user_id provided
  if (userId && shareLink.user_id !== userId) {
    return new Response(
      JSON.stringify({ error: 'You do not have permission to view this access log' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
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

  // Enhance logs with user info
  const enhancedLogs = await Promise.all(
    (accessLogs || []).map(async (log) => {
      // Get user email using auth.users table via service role
      const { data: userData } = await supabaseClient
        .from('auth.users')
        .select('email, raw_user_meta_data')
        .eq('id', log.accessed_by_user_id)
        .single();

      return {
        ...log,
        user_email: userData?.email || null,
        user_name: userData?.raw_user_meta_data?.name || null,
      };
    })
  );

  return new Response(
    JSON.stringify({ access_logs: enhancedLogs }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
