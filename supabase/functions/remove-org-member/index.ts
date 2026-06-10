/**
 * remove-org-member — ISC-31 compliant membership removal.
 *
 * Removes a user from an organization and immediately invalidates all their
 * Supabase Auth sessions via auth.admin.signOut(userId, 'global').
 *
 * The DB triggers from migration 20260609000001_revocation_triggers.sql handle
 * cascading revocation of mcp_tokens and mcp_oauth_client_grants (ISC-27–30).
 * This Edge Function handles the Supabase Auth JWT session layer (ISC-31).
 *
 * auth.admin.signOut failure is non-fatal: DB revocation is the primary gate.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';
import { authenticateRequest } from '../_shared/auth.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

const bodySchema = z.object({
  membershipId: z.string().uuid('membershipId must be a UUID'),
});

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Use anon client for caller authentication (verifies the caller's JWT)
    const anonClient = createClient(supabaseUrl, supabaseAnonKey);
    const authResult = await authenticateRequest(req, anonClient, corsHeaders);
    if (authResult instanceof Response) return authResult;
    const { userId: callerId } = authResult;

    // Parse and validate request body
    const rawBody = await req.json();
    const validation = bodySchema.safeParse(rawBody);
    if (!validation.success) {
      const firstIssue = validation.error.issues[0]?.message ?? 'Invalid input';
      return new Response(JSON.stringify({ error: firstIssue }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { membershipId } = validation.data;

    // Use service-role client for privileged operations (bypasses RLS for admin checks)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the membership row to verify it exists and get the target user_id
    const { data: membership, error: fetchError } = await adminClient
      .from('organization_memberships')
      .select('id, user_id, organization_id, role')
      .eq('id', membershipId)
      .maybeSingle();

    if (fetchError) {
      console.error('remove-org-member: fetch error', fetchError);
      return new Response(JSON.stringify({ error: 'Failed to fetch membership' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!membership) {
      return new Response(JSON.stringify({ error: 'Membership not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify caller is an org admin or owner
    const { data: callerMembership, error: callerError } = await adminClient
      .from('organization_memberships')
      .select('role')
      .eq('organization_id', membership.organization_id)
      .eq('user_id', callerId)
      .maybeSingle();

    if (callerError || !callerMembership) {
      return new Response(JSON.stringify({ error: 'Forbidden: you are not a member of this organization' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const callerRole = callerMembership.role;
    if (callerRole !== 'organization_owner' && callerRole !== 'organization_admin') {
      return new Response(JSON.stringify({ error: 'Forbidden: only org owners and admins can remove members' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Prevent removing the org owner
    if (membership.role === 'organization_owner') {
      return new Response(JSON.stringify({ error: 'Cannot remove the organization owner' }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const targetUserId = membership.user_id;

    // Delete the membership row — DB trigger cascades revocation to mcp_tokens + mcp_oauth_client_grants
    const { error: deleteError } = await adminClient
      .from('organization_memberships')
      .delete()
      .eq('id', membershipId);

    if (deleteError) {
      console.error('remove-org-member: delete error', deleteError);
      return new Response(JSON.stringify({ error: `Failed to remove member: ${deleteError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ISC-31: Invalidate all Supabase Auth sessions for the removed user globally.
    // This kills refresh tokens immediately; access tokens expire within their TTL (15 min).
    // Non-fatal: DB trigger revocation already applied above as the primary gate.
    try {
      await adminClient.auth.admin.signOut(targetUserId, 'global');
      console.log('ISC-31: signed out user', targetUserId, 'globally after org membership removal');
    } catch (signOutError) {
      console.warn(
        'ISC-31: signOut failed for user', targetUserId,
        '— DB revocation still applied:', signOutError
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('remove-org-member: unexpected error', error);
    const message = error instanceof Error ? error.message : 'Internal error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
