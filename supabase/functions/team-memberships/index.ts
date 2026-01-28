import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts';

// Dynamic CORS headers - set per-request from origin
let corsHeaders: Record<string, string> = {};

/**
 * Team Memberships Edge Function
 *
 * Handles team membership operations:
 * - POST /team-memberships - Invite a new member
 * - POST /team-memberships?action=accept - Accept invite via token
 * - GET /team-memberships?team_id=xxx - List team members
 * - PATCH /team-memberships?id=xxx - Update member (role, manager)
 * - DELETE /team-memberships?id=xxx - Remove member
 *
 * Special constraints:
 * - Blocks circular hierarchy when setting managers
 * - Blocks last admin from leaving the team
 */

interface InviteMemberInput {
  team_id: string;
  user_id: string; // Requesting user
  email: string; // Invited user's email
  role?: 'admin' | 'manager' | 'member';
  manager_membership_id?: string | null; // Reports to this member
}

interface AcceptInviteInput {
  token: string;
  user_id: string; // Accepting user
}

interface UpdateMemberInput {
  membership_id: string;
  user_id: string; // Requesting user
  role?: 'admin' | 'manager' | 'member';
  manager_membership_id?: string | null;
}

/**
 * Generates a cryptographically secure 32-character URL-safe token
 */
function generateInviteToken(): string {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  const base64 = btoa(String.fromCharCode(...array));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Check if setting a manager would create a circular hierarchy
 * Returns true if circular, false if safe
 */
async function wouldCreateCircularHierarchy(
  supabaseClient: ReturnType<typeof createClient>,
  membershipId: string,
  newManagerMembershipId: string | null
): Promise<boolean> {
  if (!newManagerMembershipId) {
    return false;
  }

  if (membershipId === newManagerMembershipId) {
    return true;
  }

  // Walk up the hierarchy from the proposed manager
  let currentId: string | null = newManagerMembershipId;
  const maxDepth = 10;
  let depth = 0;

  while (currentId && depth < maxDepth) {
    const { data: membership } = await supabaseClient
      .from('team_memberships')
      .select('manager_membership_id')
      .eq('id', currentId)
      .single();

    if (!membership) break;

    if (membership.manager_membership_id === membershipId) {
      return true; // Found a cycle
    }

    currentId = membership.manager_membership_id;
    depth++;
  }

  return false;
}

/**
 * Check if user is an admin of the team
 */
async function isTeamAdmin(
  supabaseClient: ReturnType<typeof createClient>,
  teamId: string,
  userId: string
): Promise<boolean> {
  // Check if user is team owner
  const { data: team } = await supabaseClient
    .from('teams')
    .select('owner_user_id')
    .eq('id', teamId)
    .single();

  if (team?.owner_user_id === userId) {
    return true;
  }

  // Check if user has admin role
  const { data: membership } = await supabaseClient
    .from('team_memberships')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  return membership?.role === 'admin';
}

/**
 * Count active admins in a team
 */
async function countActiveAdmins(
  supabaseClient: ReturnType<typeof createClient>,
  teamId: string
): Promise<number> {
  const { count } = await supabaseClient
    .from('team_memberships')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', teamId)
    .eq('role', 'admin')
    .eq('status', 'active');

  return count || 0;
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
    const action = url.searchParams.get('action');

    // Route by HTTP method
    switch (req.method) {
      case 'POST':
        if (action === 'accept') {
          return handleAcceptInvite(req, supabaseClient);
        }
        return handleInviteMember(req, supabaseClient);
      case 'GET':
        return handleGetMembers(req, supabaseClient, url);
      case 'PATCH':
        return handleUpdateMember(req, supabaseClient, url);
      case 'DELETE':
        return handleRemoveMember(req, supabaseClient, url);
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
 * POST /team-memberships - Invite a new member
 *
 * Creates a pending membership with an invite token.
 * Only team admins can invite new members.
 */
async function handleInviteMember(
  req: Request,
  supabaseClient: ReturnType<typeof createClient>
): Promise<Response> {
  const body = await req.json() as InviteMemberInput;
  const { team_id, user_id, email, role = 'member', manager_membership_id } = body;

  if (!team_id) {
    return new Response(
      JSON.stringify({ error: 'team_id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!user_id) {
    return new Response(
      JSON.stringify({ error: 'user_id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!email) {
    return new Response(
      JSON.stringify({ error: 'email is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Validate role
  if (!['admin', 'manager', 'member'].includes(role)) {
    return new Response(
      JSON.stringify({ error: 'Invalid role. Must be admin, manager, or member' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check if team exists
  const { data: team, error: teamError } = await supabaseClient
    .from('teams')
    .select('id, name')
    .eq('id', team_id)
    .single();

  if (teamError || !team) {
    return new Response(
      JSON.stringify({ error: 'Team not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check if user is admin
  const isAdmin = await isTeamAdmin(supabaseClient, team_id, user_id);
  if (!isAdmin) {
    return new Response(
      JSON.stringify({ error: 'Only team admins can invite members' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Find user by email (they may or may not exist yet)
  const { data: invitedUser } = await supabaseClient
    .from('user_settings')
    .select('user_id, email, display_name')
    .eq('email', email.toLowerCase())
    .maybeSingle();

  // If user exists, check if they're already in the team or another team
  if (invitedUser) {
    // Check if already in this team
    const { data: existingMembership } = await supabaseClient
      .from('team_memberships')
      .select('id, status')
      .eq('team_id', team_id)
      .eq('user_id', invitedUser.user_id)
      .maybeSingle();

    if (existingMembership) {
      if (existingMembership.status === 'active') {
        return new Response(
          JSON.stringify({ error: 'User is already an active member of this team' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (existingMembership.status === 'pending') {
        return new Response(
          JSON.stringify({ error: 'User already has a pending invitation to this team' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check if user is in another team (one team per user constraint)
    const { data: otherMembership } = await supabaseClient
      .from('team_memberships')
      .select('id, team_id')
      .eq('user_id', invitedUser.user_id)
      .eq('status', 'active')
      .neq('team_id', team_id)
      .maybeSingle();

    if (otherMembership) {
      return new Response(
        JSON.stringify({ error: 'User is already a member of another team. Users can only belong to one team.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  // Validate manager_membership_id if provided
  if (manager_membership_id) {
    const { data: managerMembership } = await supabaseClient
      .from('team_memberships')
      .select('id, team_id, status')
      .eq('id', manager_membership_id)
      .single();

    if (!managerMembership) {
      return new Response(
        JSON.stringify({ error: 'Manager membership not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (managerMembership.team_id !== team_id) {
      return new Response(
        JSON.stringify({ error: 'Manager must be in the same team' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (managerMembership.status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'Manager must be an active team member' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  // Generate invite token and expiry (30 days)
  const inviteToken = generateInviteToken();
  const inviteExpiresAt = new Date();
  inviteExpiresAt.setDate(inviteExpiresAt.getDate() + 30);

  // Create the membership record
  const membershipData: Record<string, unknown> = {
    team_id,
    user_id: invitedUser?.user_id || null, // null if user doesn't exist yet
    role,
    status: 'pending',
    invite_token: inviteToken,
    invite_expires_at: inviteExpiresAt.toISOString(),
    invited_by_user_id: user_id,
    manager_membership_id: manager_membership_id || null,
  };

  // For users who don't exist yet, we need to store the email separately
  // We'll create a placeholder that can be claimed when the user signs up
  // For now, we'll just create the membership for existing users only
  if (!invitedUser) {
    // Store the email in a way that can be claimed later
    // For MVP, we require the user to exist
    return new Response(
      JSON.stringify({
        error: 'User not found. Please ask them to create an account first.',
        invite_token: inviteToken, // Return token so it can be shared
        invite_url: `${Deno.env.get('APP_URL') || ''}/team/join/${inviteToken}`,
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { data: membership, error: membershipError } = await supabaseClient
    .from('team_memberships')
    .insert(membershipData)
    .select()
    .single();

  if (membershipError) {
    return new Response(
      JSON.stringify({ error: 'Error creating membership invitation', details: membershipError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({
      membership,
      invite_token: inviteToken,
      invite_url: `${Deno.env.get('APP_URL') || ''}/team/join/${inviteToken}`,
      invited_user: invitedUser ? {
        email: invitedUser.email,
        display_name: invitedUser.display_name,
      } : null,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * POST /team-memberships?action=accept - Accept an invite via token
 */
async function handleAcceptInvite(
  req: Request,
  supabaseClient: ReturnType<typeof createClient>
): Promise<Response> {
  const body = await req.json() as AcceptInviteInput;
  const { token, user_id } = body;

  if (!token) {
    return new Response(
      JSON.stringify({ error: 'token is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!user_id) {
    return new Response(
      JSON.stringify({ error: 'user_id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Find the pending membership
  const { data: membership, error: membershipError } = await supabaseClient
    .from('team_memberships')
    .select(`
      *,
      team:teams(id, name)
    `)
    .eq('invite_token', token)
    .eq('status', 'pending')
    .maybeSingle();

  if (membershipError || !membership) {
    return new Response(
      JSON.stringify({ error: 'Invalid or expired invitation' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check expiry
  if (membership.invite_expires_at && new Date(membership.invite_expires_at) < new Date()) {
    return new Response(
      JSON.stringify({ error: 'This invitation has expired' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Verify the user matches (if membership was created for a specific user)
  if (membership.user_id && membership.user_id !== user_id) {
    return new Response(
      JSON.stringify({ error: 'This invitation was sent to a different user' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check if user is already in another team
  const { data: existingMembership } = await supabaseClient
    .from('team_memberships')
    .select('id, team_id')
    .eq('user_id', user_id)
    .eq('status', 'active')
    .maybeSingle();

  if (existingMembership && existingMembership.id !== membership.id) {
    return new Response(
      JSON.stringify({ error: 'You are already a member of a team. Leave your current team first.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Accept the invitation
  const { data: updatedMembership, error: updateError } = await supabaseClient
    .from('team_memberships')
    .update({
      user_id, // Set/update the user_id
      status: 'active',
      joined_at: new Date().toISOString(),
      invite_token: null, // Clear the token
      invite_expires_at: null,
    })
    .eq('id', membership.id)
    .select(`
      *,
      team:teams(*)
    `)
    .single();

  if (updateError) {
    return new Response(
      JSON.stringify({ error: 'Error accepting invitation', details: updateError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({
      membership: updatedMembership,
      message: `Successfully joined ${membership.team?.name || 'the team'}`,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * GET /team-memberships - List team members
 *
 * Query params:
 * - team_id: List all members of a team
 * - user_id: Optional, to get the requesting user's context
 * - status: Filter by status (active, pending, removed)
 * - include_user_info: Include user display names and avatars
 */
async function handleGetMembers(
  req: Request,
  supabaseClient: ReturnType<typeof createClient>,
  url: URL
): Promise<Response> {
  const teamId = url.searchParams.get('team_id');
  const userId = url.searchParams.get('user_id');
  const status = url.searchParams.get('status');
  const includeUserInfo = url.searchParams.get('include_user_info') === 'true';

  if (!teamId) {
    return new Response(
      JSON.stringify({ error: 'team_id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Build query
  let query = supabaseClient
    .from('team_memberships')
    .select('*')
    .eq('team_id', teamId);

  if (status) {
    query = query.eq('status', status);
  } else {
    // Default to active and pending
    query = query.in('status', ['active', 'pending']);
  }

  const { data: memberships, error: membershipError } = await query;

  if (membershipError) {
    return new Response(
      JSON.stringify({ error: 'Error fetching memberships', details: membershipError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Optionally enrich with user info
  let enrichedMemberships = memberships || [];

  if (includeUserInfo && enrichedMemberships.length > 0) {
    const userIds = enrichedMemberships
      .map(m => m.user_id)
      .filter(Boolean);

    if (userIds.length > 0) {
      const { data: userSettings } = await supabaseClient
        .from('user_settings')
        .select('user_id, email, display_name, avatar_url')
        .in('user_id', userIds);

      const userMap = new Map(
        (userSettings || []).map(u => [u.user_id, u])
      );

      enrichedMemberships = enrichedMemberships.map(m => ({
        ...m,
        user_info: m.user_id ? userMap.get(m.user_id) || null : null,
      }));
    }
  }

  // Build hierarchy tree structure
  const hierarchy = buildHierarchyTree(enrichedMemberships);

  return new Response(
    JSON.stringify({
      memberships: enrichedMemberships,
      hierarchy,
      total: enrichedMemberships.length,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * Build a tree structure from flat membership list
 */
function buildHierarchyTree(memberships: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const membershipMap = new Map(memberships.map(m => [m.id, { ...m, children: [] as unknown[] }]));
  const roots: Array<Record<string, unknown>> = [];

  for (const membership of memberships) {
    const node = membershipMap.get(membership.id as string);
    if (!node) continue;

    if (membership.manager_membership_id) {
      const parent = membershipMap.get(membership.manager_membership_id as string);
      if (parent && Array.isArray(parent.children)) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  }

  return roots;
}

/**
 * PATCH /team-memberships?id=xxx - Update a member
 *
 * Can update role and manager.
 * Validates circular hierarchy prevention and last admin protection.
 */
async function handleUpdateMember(
  req: Request,
  supabaseClient: ReturnType<typeof createClient>,
  url: URL
): Promise<Response> {
  const membershipId = url.searchParams.get('id');
  const body = await req.json() as UpdateMemberInput;
  const { user_id, role, manager_membership_id } = body;

  if (!membershipId) {
    return new Response(
      JSON.stringify({ error: 'Membership id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!user_id) {
    return new Response(
      JSON.stringify({ error: 'user_id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get the membership to update
  const { data: membership, error: membershipError } = await supabaseClient
    .from('team_memberships')
    .select('*, team:teams(owner_user_id)')
    .eq('id', membershipId)
    .single();

  if (membershipError || !membership) {
    return new Response(
      JSON.stringify({ error: 'Membership not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check if requester is admin
  const isAdmin = await isTeamAdmin(supabaseClient, membership.team_id, user_id);
  if (!isAdmin) {
    return new Response(
      JSON.stringify({ error: 'Only team admins can update members' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Build update object
  const updates: Record<string, unknown> = {};

  // Validate and set role
  if (role !== undefined) {
    if (!['admin', 'manager', 'member'].includes(role)) {
      return new Response(
        JSON.stringify({ error: 'Invalid role. Must be admin, manager, or member' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if this is demoting the last admin
    if (membership.role === 'admin' && role !== 'admin') {
      const adminCount = await countActiveAdmins(supabaseClient, membership.team_id);
      if (adminCount <= 1) {
        return new Response(
          JSON.stringify({ error: 'Cannot demote the last admin. Promote another member to admin first.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    updates.role = role;
  }

  // Validate and set manager
  if (manager_membership_id !== undefined) {
    // Allow setting to null (no manager)
    if (manager_membership_id === null) {
      updates.manager_membership_id = null;
    } else {
      // Validate manager exists and is in same team
      const { data: managerMembership } = await supabaseClient
        .from('team_memberships')
        .select('id, team_id, status')
        .eq('id', manager_membership_id)
        .single();

      if (!managerMembership) {
        return new Response(
          JSON.stringify({ error: 'Manager membership not found' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (managerMembership.team_id !== membership.team_id) {
        return new Response(
          JSON.stringify({ error: 'Manager must be in the same team' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (managerMembership.status !== 'active') {
        return new Response(
          JSON.stringify({ error: 'Manager must be an active team member' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check for circular hierarchy
      const wouldBeCircular = await wouldCreateCircularHierarchy(
        supabaseClient,
        membershipId,
        manager_membership_id
      );

      if (wouldBeCircular) {
        return new Response(
          JSON.stringify({ error: 'Cannot create circular reporting structure' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      updates.manager_membership_id = manager_membership_id;
    }
  }

  if (Object.keys(updates).length === 0) {
    return new Response(
      JSON.stringify({ error: 'No valid updates provided' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Perform update
  const { data: updatedMembership, error: updateError } = await supabaseClient
    .from('team_memberships')
    .update(updates)
    .eq('id', membershipId)
    .select()
    .single();

  if (updateError) {
    return new Response(
      JSON.stringify({ error: 'Error updating membership', details: updateError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ membership: updatedMembership }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * DELETE /team-memberships?id=xxx - Remove a member
 *
 * Admins can remove anyone, members can remove themselves.
 * Protects against removing the last admin.
 */
async function handleRemoveMember(
  req: Request,
  supabaseClient: ReturnType<typeof createClient>,
  url: URL
): Promise<Response> {
  const membershipId = url.searchParams.get('id');

  // Get user_id from body
  let userId: string | null = null;
  try {
    const body = await req.json();
    userId = body.user_id;
  } catch {
    // Body might be empty
  }

  if (!membershipId) {
    return new Response(
      JSON.stringify({ error: 'Membership id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get the membership to remove
  const { data: membership, error: membershipError } = await supabaseClient
    .from('team_memberships')
    .select('*, team:teams(owner_user_id)')
    .eq('id', membershipId)
    .single();

  if (membershipError || !membership) {
    return new Response(
      JSON.stringify({ error: 'Membership not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check authorization
  const isSelf = membership.user_id === userId;
  const isAdmin = userId ? await isTeamAdmin(supabaseClient, membership.team_id, userId) : false;

  if (!isSelf && !isAdmin) {
    return new Response(
      JSON.stringify({ error: 'You can only remove yourself or be an admin to remove others' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Prevent removing the last admin
  if (membership.role === 'admin' && membership.status === 'active') {
    const adminCount = await countActiveAdmins(supabaseClient, membership.team_id);
    if (adminCount <= 1) {
      return new Response(
        JSON.stringify({ error: 'Cannot remove the last admin. Transfer admin role to another member first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  // Update any members who report to this person (set their manager to null)
  await supabaseClient
    .from('team_memberships')
    .update({ manager_membership_id: null })
    .eq('manager_membership_id', membershipId);

  // Remove the membership (set status to removed instead of deleting)
  const { error: updateError } = await supabaseClient
    .from('team_memberships')
    .update({
      status: 'removed',
      manager_membership_id: null, // Clear any manager reference
    })
    .eq('id', membershipId);

  if (updateError) {
    return new Response(
      JSON.stringify({ error: 'Error removing membership', details: updateError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Also remove any team_shares involving this user
  if (membership.user_id) {
    await supabaseClient
      .from('team_shares')
      .delete()
      .eq('team_id', membership.team_id)
      .or(`owner_user_id.eq.${membership.user_id},recipient_user_id.eq.${membership.user_id}`);
  }

  return new Response(
    JSON.stringify({ success: true, message: 'Member removed successfully' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
