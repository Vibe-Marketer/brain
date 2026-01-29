import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts';

// Dynamic CORS headers - set per-request from origin
let corsHeaders: Record<string, string> = {};

/**
 * Teams Edge Function
 *
 * Handles team management operations:
 * - POST /teams - Create a new team
 * - GET /teams?id=xxx - Get team details
 * - GET /teams?user_id=xxx - List teams for a user
 * - PATCH /teams?id=xxx - Update team settings (admin only)
 * - DELETE /teams?id=xxx - Delete team (owner only)
 */

interface CreateTeamInput {
  name: string;
  user_id: string;
  admin_sees_all?: boolean;
  domain_auto_join?: string;
}

interface UpdateTeamInput {
  team_id: string;
  user_id: string;
  name?: string;
  admin_sees_all?: boolean;
  domain_auto_join?: string | null;
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

    // Route by HTTP method
    switch (req.method) {
      case 'POST':
        return handleCreateTeam(req, supabaseClient);
      case 'GET':
        return handleGetTeam(req, supabaseClient, url);
      case 'PATCH':
        return handleUpdateTeam(req, supabaseClient, url);
      case 'DELETE':
        return handleDeleteTeam(req, supabaseClient, url);
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
 * POST /teams - Create a new team
 *
 * Creates a team and automatically adds the creator as an admin member
 */
async function handleCreateTeam(
  req: Request,
  supabaseClient: ReturnType<typeof createClient>
): Promise<Response> {
  const body = await req.json() as CreateTeamInput;

  const { name, user_id, admin_sees_all, domain_auto_join } = body;

  if (!name || !name.trim()) {
    return new Response(
      JSON.stringify({ error: 'Team name is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!user_id) {
    return new Response(
      JSON.stringify({ error: 'user_id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Per CONTEXT.md: Users can belong to multiple teams (no single-team restriction)

  // Create the team
  const { data: team, error: teamError } = await supabaseClient
    .from('teams')
    .insert({
      name: name.trim(),
      owner_user_id: user_id,
      admin_sees_all: admin_sees_all ?? false,
      domain_auto_join: domain_auto_join?.trim() || null,
    })
    .select()
    .single();

  if (teamError) {
    return new Response(
      JSON.stringify({ error: 'Error creating team', details: teamError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Create admin membership for the owner
  const { data: membership, error: membershipCreateError } = await supabaseClient
    .from('team_memberships')
    .insert({
      team_id: team.id,
      user_id: user_id,
      role: 'admin',
      status: 'active',
      joined_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (membershipCreateError) {
    // Rollback team creation if membership fails
    await supabaseClient
      .from('teams')
      .delete()
      .eq('id', team.id);

    return new Response(
      JSON.stringify({ error: 'Error creating team membership', details: membershipCreateError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({
      team,
      membership,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * GET /teams - Get team details or list user's teams
 *
 * Query params:
 * - id: Get specific team by ID
 * - user_id: List teams for a user
 */
async function handleGetTeam(
  req: Request,
  supabaseClient: ReturnType<typeof createClient>,
  url: URL
): Promise<Response> {
  const teamId = url.searchParams.get('id');
  const userId = url.searchParams.get('user_id');

  // Get specific team by ID
  if (teamId) {
    const { data: team, error: teamError } = await supabaseClient
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single();

    if (teamError || !team) {
      return new Response(
        JSON.stringify({ error: 'Team not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get member count
    const { count: memberCount } = await supabaseClient
      .from('team_memberships')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .eq('status', 'active');

    // Get pending invite count
    const { count: pendingCount } = await supabaseClient
      .from('team_memberships')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .eq('status', 'pending');

    // If user_id provided, get their role
    let userRole = null;
    let userMembership = null;
    if (userId) {
      const { data: membership } = await supabaseClient
        .from('team_memberships')
        .select('*')
        .eq('team_id', teamId)
        .eq('user_id', userId)
        .maybeSingle();

      if (membership) {
        userRole = membership.role;
        userMembership = membership;
      }
    }

    return new Response(
      JSON.stringify({
        team,
        member_count: memberCount || 0,
        pending_count: pendingCount || 0,
        user_role: userRole,
        user_membership: userMembership,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // List teams for a user
  if (userId) {
    // Get user's team memberships
    const { data: memberships, error: membershipError } = await supabaseClient
      .from('team_memberships')
      .select(`
        *,
        team:teams(*)
      `)
      .eq('user_id', userId)
      .in('status', ['active', 'pending']);

    if (membershipError) {
      return new Response(
        JSON.stringify({ error: 'Error fetching memberships' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const teams = (memberships || []).map(m => ({
      ...m.team,
      membership: {
        id: m.id,
        role: m.role,
        status: m.status,
        joined_at: m.joined_at,
      },
    }));

    return new Response(
      JSON.stringify({ teams }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ error: 'Either id or user_id query parameter is required' }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * PATCH /teams?id=xxx - Update team settings
 *
 * Only team admins (owner or admin role) can update team settings
 */
async function handleUpdateTeam(
  req: Request,
  supabaseClient: ReturnType<typeof createClient>,
  url: URL
): Promise<Response> {
  const teamId = url.searchParams.get('id');
  const body = await req.json() as UpdateTeamInput;

  const { user_id, name, admin_sees_all, domain_auto_join } = body;

  if (!teamId) {
    return new Response(
      JSON.stringify({ error: 'Team id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!user_id) {
    return new Response(
      JSON.stringify({ error: 'user_id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check if team exists
  const { data: team, error: teamError } = await supabaseClient
    .from('teams')
    .select('*')
    .eq('id', teamId)
    .single();

  if (teamError || !team) {
    return new Response(
      JSON.stringify({ error: 'Team not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check if user is admin (owner or admin role)
  const isOwner = team.owner_user_id === user_id;
  let isAdmin = isOwner;

  if (!isOwner) {
    const { data: membership } = await supabaseClient
      .from('team_memberships')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user_id)
      .eq('status', 'active')
      .maybeSingle();

    isAdmin = membership?.role === 'admin';
  }

  if (!isAdmin) {
    return new Response(
      JSON.stringify({ error: 'Only team admins can update team settings' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Build update object
  const updates: Record<string, unknown> = {};
  if (name !== undefined && name.trim()) {
    updates.name = name.trim();
  }
  if (admin_sees_all !== undefined) {
    updates.admin_sees_all = admin_sees_all;
  }
  if (domain_auto_join !== undefined) {
    updates.domain_auto_join = domain_auto_join?.trim() || null;
  }

  if (Object.keys(updates).length === 0) {
    return new Response(
      JSON.stringify({ error: 'No valid updates provided' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Update team
  const { data: updatedTeam, error: updateError } = await supabaseClient
    .from('teams')
    .update(updates)
    .eq('id', teamId)
    .select()
    .single();

  if (updateError) {
    return new Response(
      JSON.stringify({ error: 'Error updating team', details: updateError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ team: updatedTeam }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * DELETE /teams?id=xxx - Delete a team
 *
 * Only the team owner can delete the team
 * All memberships and related data will be cascade deleted
 */
async function handleDeleteTeam(
  req: Request,
  supabaseClient: ReturnType<typeof createClient>,
  url: URL
): Promise<Response> {
  const teamId = url.searchParams.get('id');

  // Also try to get from body for flexibility
  let userId: string | null = null;
  try {
    const body = await req.json();
    userId = body.user_id;
  } catch {
    // Body might be empty, which is fine
  }

  if (!teamId) {
    return new Response(
      JSON.stringify({ error: 'Team id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get team to verify ownership
  const { data: team, error: teamError } = await supabaseClient
    .from('teams')
    .select('owner_user_id')
    .eq('id', teamId)
    .single();

  if (teamError || !team) {
    return new Response(
      JSON.stringify({ error: 'Team not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Verify ownership if user_id provided
  if (userId && team.owner_user_id !== userId) {
    return new Response(
      JSON.stringify({ error: 'Only the team owner can delete the team' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Delete the team (cascade will handle memberships, shares, etc.)
  const { error: deleteError } = await supabaseClient
    .from('teams')
    .delete()
    .eq('id', teamId);

  if (deleteError) {
    return new Response(
      JSON.stringify({ error: 'Error deleting team', details: deleteError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, message: 'Team deleted successfully' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
