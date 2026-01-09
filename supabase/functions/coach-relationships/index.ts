import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from '../_shared/cors.ts';

/**
 * Coach Relationships Edge Function
 *
 * Handles coach/coachee relationship management:
 * - POST /coach-relationships - Create a relationship (invite coach or coachee)
 * - GET /coach-relationships - List all relationships for current user
 * - GET /coach-relationships?token=xxx - Accept invite by token
 * - PATCH /coach-relationships?id=xxx - Update relationship status (pause, resume)
 * - DELETE /coach-relationships?id=xxx - End relationship
 */

type RelationshipStatus = 'pending' | 'active' | 'paused' | 'revoked';
type InvitedBy = 'coach' | 'coachee';

interface CreateRelationshipInput {
  user_id: string;
  invited_email?: string;
  invited_by: InvitedBy;
}

interface UpdateRelationshipInput {
  user_id: string;
  status: RelationshipStatus;
}

interface AcceptInviteInput {
  token: string;
  user_id: string;
}

/**
 * Generates a cryptographically secure 32-character URL-safe token
 */
function generateInviteToken(): string {
  const array = new Uint8Array(24); // 24 bytes = 32 base64 chars
  crypto.getRandomValues(array);
  // Convert to base64url (URL-safe base64)
  const base64 = btoa(String.fromCharCode(...array));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Calculate invite expiry (30 days from now)
 */
function getInviteExpiry(): string {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 30);
  return expiry.toISOString();
}

serve(async (req) => {
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
        return handleCreateOrAccept(req, supabaseClient, url);
      case 'GET':
        return handleGetRelationships(req, supabaseClient, url);
      case 'PATCH':
        return handleUpdateRelationship(req, supabaseClient, url);
      case 'DELETE':
        return handleEndRelationship(req, supabaseClient, url);
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
 * POST /coach-relationships
 * - Create invite: { user_id, invited_email, invited_by }
 * - Accept invite: { token, user_id }
 */
async function handleCreateOrAccept(
  req: Request,
  supabaseClient: ReturnType<typeof createClient>,
  _url: URL
): Promise<Response> {
  const body = await req.json();

  // Check if this is an accept invite request
  if (body.token) {
    return handleAcceptInvite(body as AcceptInviteInput, supabaseClient);
  }

  // Otherwise, create a new relationship/invite
  return handleCreateRelationship(body as CreateRelationshipInput, supabaseClient);
}

/**
 * Create a new coach relationship (pending until accepted)
 */
async function handleCreateRelationship(
  input: CreateRelationshipInput,
  supabaseClient: ReturnType<typeof createClient>
): Promise<Response> {
  const { user_id, invited_email, invited_by } = input;

  if (!user_id) {
    return new Response(
      JSON.stringify({ error: 'user_id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!invited_by || (invited_by !== 'coach' && invited_by !== 'coachee')) {
    return new Response(
      JSON.stringify({ error: 'invited_by must be "coach" or "coachee"' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Generate invite token
  const invite_token = generateInviteToken();
  const invite_expires_at = getInviteExpiry();

  // Determine coach_user_id and coachee_user_id based on who is inviting
  // - If coachee is inviting a coach: coachee_user_id = user_id, coach_user_id = null (set when accepted)
  // - If coach is inviting a coachee: coach_user_id = user_id, coachee_user_id = null (set when accepted)
  const relationshipData: Record<string, unknown> = {
    status: 'pending',
    invited_by,
    invite_token,
    invite_expires_at,
  };

  if (invited_by === 'coachee') {
    // Coachee is inviting a coach
    relationshipData.coachee_user_id = user_id;
    relationshipData.coach_user_id = null; // Will be set when coach accepts
  } else {
    // Coach is inviting a coachee
    relationshipData.coach_user_id = user_id;
    relationshipData.coachee_user_id = null; // Will be set when coachee accepts
  }

  // Check if invited_email is provided and if user exists
  if (invited_email) {
    // Try to find user by email
    const { data: userData } = await supabaseClient
      .rpc('get_user_id_by_email', { email_param: invited_email });

    if (userData) {
      // User exists - check for existing relationship
      const existingQuery = supabaseClient
        .from('coach_relationships')
        .select('id, status')
        .neq('status', 'revoked');

      if (invited_by === 'coachee') {
        existingQuery.eq('coachee_user_id', user_id).eq('coach_user_id', userData);
      } else {
        existingQuery.eq('coach_user_id', user_id).eq('coachee_user_id', userData);
      }

      const { data: existing } = await existingQuery.maybeSingle();

      if (existing) {
        return new Response(
          JSON.stringify({
            error: 'A relationship with this user already exists',
            existing_relationship_id: existing.id,
            existing_status: existing.status,
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Pre-populate the other user's ID
      if (invited_by === 'coachee') {
        relationshipData.coach_user_id = userData;
      } else {
        relationshipData.coachee_user_id = userData;
      }
    }
  }

  // Create the relationship
  const { data: relationship, error: insertError } = await supabaseClient
    .from('coach_relationships')
    .insert(relationshipData)
    .select()
    .single();

  if (insertError) {
    return new Response(
      JSON.stringify({ error: 'Error creating relationship', details: insertError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({
      relationship,
      invite_token,
      invite_url: `${Deno.env.get('APP_URL') || ''}/coach/accept?token=${invite_token}`,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * Accept an invite by token
 */
async function handleAcceptInvite(
  input: AcceptInviteInput,
  supabaseClient: ReturnType<typeof createClient>
): Promise<Response> {
  const { token, user_id } = input;

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

  // Find the pending relationship by token
  const { data: relationship, error: fetchError } = await supabaseClient
    .from('coach_relationships')
    .select('*')
    .eq('invite_token', token)
    .eq('status', 'pending')
    .single();

  if (fetchError || !relationship) {
    return new Response(
      JSON.stringify({ error: 'Invalid or expired invite token', code: 'INVALID_TOKEN' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check if token has expired
  if (new Date(relationship.invite_expires_at) < new Date()) {
    return new Response(
      JSON.stringify({ error: 'This invite has expired', code: 'TOKEN_EXPIRED' }),
      { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Prevent accepting your own invite
  if (relationship.coach_user_id === user_id || relationship.coachee_user_id === user_id) {
    return new Response(
      JSON.stringify({ error: 'You cannot accept your own invite' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Update the relationship based on who is accepting
  const updateData: Record<string, unknown> = {
    status: 'active',
    accepted_at: new Date().toISOString(),
    invite_token: null, // Clear the token after use
    invite_expires_at: null,
  };

  if (relationship.invited_by === 'coachee') {
    // Coachee invited a coach, so accepting user is the coach
    updateData.coach_user_id = user_id;
  } else {
    // Coach invited a coachee, so accepting user is the coachee
    updateData.coachee_user_id = user_id;
  }

  const { data: updatedRelationship, error: updateError } = await supabaseClient
    .from('coach_relationships')
    .update(updateData)
    .eq('id', relationship.id)
    .select()
    .single();

  if (updateError) {
    return new Response(
      JSON.stringify({ error: 'Error accepting invite', details: updateError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({
      relationship: updatedRelationship,
      message: 'Invite accepted successfully',
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * GET /coach-relationships
 * - List all relationships for current user
 * - Query params: user_id (required), role (optional: 'coach' | 'coachee' | 'both')
 */
async function handleGetRelationships(
  _req: Request,
  supabaseClient: ReturnType<typeof createClient>,
  url: URL
): Promise<Response> {
  const userId = url.searchParams.get('user_id');
  const role = url.searchParams.get('role') || 'both';
  const status = url.searchParams.get('status');

  if (!userId) {
    return new Response(
      JSON.stringify({ error: 'user_id query parameter is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Build query based on role filter
  let query = supabaseClient.from('coach_relationships').select('*');

  if (role === 'coach') {
    query = query.eq('coach_user_id', userId);
  } else if (role === 'coachee') {
    query = query.eq('coachee_user_id', userId);
  } else {
    // Both - user is either coach or coachee
    query = query.or(`coach_user_id.eq.${userId},coachee_user_id.eq.${userId}`);
  }

  // Filter by status if provided
  if (status) {
    query = query.eq('status', status);
  } else {
    // By default, exclude revoked relationships
    query = query.neq('status', 'revoked');
  }

  query = query.order('created_at', { ascending: false });

  const { data: relationships, error: fetchError } = await query;

  if (fetchError) {
    return new Response(
      JSON.stringify({ error: 'Error fetching relationships', details: fetchError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Enhance with user info for coach and coachee
  const enhancedRelationships = await Promise.all(
    (relationships || []).map(async (rel) => {
      const enhanced: Record<string, unknown> = { ...rel };

      // Get coach user info if available
      if (rel.coach_user_id) {
        const { data: coachUser } = await supabaseClient
          .from('user_settings')
          .select('display_name, avatar_url')
          .eq('user_id', rel.coach_user_id)
          .maybeSingle();

        enhanced.coach_display_name = coachUser?.display_name || null;
        enhanced.coach_avatar_url = coachUser?.avatar_url || null;
      }

      // Get coachee user info if available
      if (rel.coachee_user_id) {
        const { data: coacheeUser } = await supabaseClient
          .from('user_settings')
          .select('display_name, avatar_url')
          .eq('user_id', rel.coachee_user_id)
          .maybeSingle();

        enhanced.coachee_display_name = coacheeUser?.display_name || null;
        enhanced.coachee_avatar_url = coacheeUser?.avatar_url || null;
      }

      // Determine user's role in this relationship
      enhanced.user_role = rel.coach_user_id === userId ? 'coach' : 'coachee';

      return enhanced;
    })
  );

  return new Response(
    JSON.stringify({ relationships: enhancedRelationships }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * PATCH /coach-relationships?id=xxx
 * Update relationship status (pause, resume, etc.)
 */
async function handleUpdateRelationship(
  req: Request,
  supabaseClient: ReturnType<typeof createClient>,
  url: URL
): Promise<Response> {
  const id = url.searchParams.get('id');
  const body = await req.json() as UpdateRelationshipInput;
  const { user_id, status: newStatus } = body;

  if (!id) {
    return new Response(
      JSON.stringify({ error: 'Relationship id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!user_id) {
    return new Response(
      JSON.stringify({ error: 'user_id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!newStatus || !['active', 'paused'].includes(newStatus)) {
    return new Response(
      JSON.stringify({ error: 'status must be "active" or "paused"' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Verify relationship exists and user is part of it
  const { data: relationship, error: fetchError } = await supabaseClient
    .from('coach_relationships')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !relationship) {
    return new Response(
      JSON.stringify({ error: 'Relationship not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Verify user is part of this relationship
  if (relationship.coach_user_id !== user_id && relationship.coachee_user_id !== user_id) {
    return new Response(
      JSON.stringify({ error: 'You are not part of this relationship' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Cannot update pending or revoked relationships this way
  if (relationship.status === 'pending') {
    return new Response(
      JSON.stringify({ error: 'Cannot update a pending relationship. Use accept invite instead.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (relationship.status === 'revoked') {
    return new Response(
      JSON.stringify({ error: 'Cannot update a revoked relationship' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Update the status
  const { data: updatedRelationship, error: updateError } = await supabaseClient
    .from('coach_relationships')
    .update({ status: newStatus })
    .eq('id', id)
    .select()
    .single();

  if (updateError) {
    return new Response(
      JSON.stringify({ error: 'Error updating relationship', details: updateError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({
      relationship: updatedRelationship,
      message: `Relationship ${newStatus === 'paused' ? 'paused' : 'resumed'} successfully`,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * DELETE /coach-relationships?id=xxx
 * End a relationship (sets status to 'revoked')
 */
async function handleEndRelationship(
  req: Request,
  supabaseClient: ReturnType<typeof createClient>,
  url: URL
): Promise<Response> {
  const id = url.searchParams.get('id');

  // Get user_id from body
  let userId: string | null = null;
  try {
    const body = await req.json();
    userId = body.user_id;
  } catch {
    // Body might be empty
  }

  if (!id) {
    return new Response(
      JSON.stringify({ error: 'Relationship id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Verify relationship exists
  const { data: relationship, error: fetchError } = await supabaseClient
    .from('coach_relationships')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !relationship) {
    return new Response(
      JSON.stringify({ error: 'Relationship not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Verify user is part of this relationship (if user_id provided)
  if (userId && relationship.coach_user_id !== userId && relationship.coachee_user_id !== userId) {
    return new Response(
      JSON.stringify({ error: 'You are not part of this relationship' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Already revoked
  if (relationship.status === 'revoked') {
    return new Response(
      JSON.stringify({ message: 'Relationship is already ended' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Update to revoked status
  const { data: updatedRelationship, error: updateError } = await supabaseClient
    .from('coach_relationships')
    .update({
      status: 'revoked',
      ended_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (updateError) {
    return new Response(
      JSON.stringify({ error: 'Error ending relationship', details: updateError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Also revoke all associated coach_shares for this relationship
  await supabaseClient
    .from('coach_shares')
    .delete()
    .eq('relationship_id', id);

  return new Response(
    JSON.stringify({
      relationship: updatedRelationship,
      message: 'Relationship ended successfully',
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
