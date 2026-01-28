import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts';

// Dynamic CORS headers - set per-request from origin
let corsHeaders: Record<string, string> = {};

/**
 * Team Shares Edge Function
 *
 * Handles peer-to-peer sharing rules within a team:
 * - POST /team-shares - Create a sharing rule (folder or tag)
 * - GET /team-shares - Get sharing rules for a user
 * - GET /team-shares?action=recipients - Get teammates user is sharing with
 * - GET /team-shares?action=shared-calls - Get calls shared with user by teammates
 * - DELETE /team-shares?id=xxx - Remove a sharing rule
 *
 * Unlike coach shares, team shares only support folder and tag types (no 'all').
 */

type ShareType = 'folder' | 'tag';

interface CreateShareInput {
  user_id: string;
  team_id: string;
  recipient_user_id: string;
  share_type: ShareType;
  folder_id?: string;
  tag_id?: string;
}

interface DeleteShareInput {
  user_id: string;
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

    // Route by HTTP method and action
    switch (req.method) {
      case 'POST':
        return handleCreateShare(req, supabaseClient);
      case 'GET':
        if (action === 'recipients') {
          return handleGetRecipients(url, supabaseClient);
        }
        if (action === 'shared-calls') {
          return handleGetSharedCalls(url, supabaseClient);
        }
        return handleGetShares(url, supabaseClient);
      case 'DELETE':
        return handleDeleteShare(req, supabaseClient, url);
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
 * POST /team-shares
 * Create a new peer sharing rule within a team
 */
async function handleCreateShare(
  req: Request,
  supabaseClient: ReturnType<typeof createClient>
): Promise<Response> {
  const body = await req.json() as CreateShareInput;
  const { user_id, team_id, recipient_user_id, share_type, folder_id, tag_id } = body;

  // Validate required fields
  if (!user_id) {
    return new Response(
      JSON.stringify({ error: 'user_id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!team_id) {
    return new Response(
      JSON.stringify({ error: 'team_id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!recipient_user_id) {
    return new Response(
      JSON.stringify({ error: 'recipient_user_id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!share_type || !['folder', 'tag'].includes(share_type)) {
    return new Response(
      JSON.stringify({ error: 'share_type must be "folder" or "tag"' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Cannot share with yourself
  if (user_id === recipient_user_id) {
    return new Response(
      JSON.stringify({ error: 'Cannot share with yourself' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Validate type-specific requirements
  if (share_type === 'folder' && !folder_id) {
    return new Response(
      JSON.stringify({ error: 'folder_id is required when share_type is "folder"' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (share_type === 'tag' && !tag_id) {
    return new Response(
      JSON.stringify({ error: 'tag_id is required when share_type is "tag"' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Verify team exists
  const { data: team, error: teamError } = await supabaseClient
    .from('teams')
    .select('id')
    .eq('id', team_id)
    .single();

  if (teamError || !team) {
    return new Response(
      JSON.stringify({ error: 'Team not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Verify user is an active member of the team
  const { data: ownerMembership, error: ownerError } = await supabaseClient
    .from('team_memberships')
    .select('id, status')
    .eq('team_id', team_id)
    .eq('user_id', user_id)
    .eq('status', 'active')
    .maybeSingle();

  if (ownerError || !ownerMembership) {
    return new Response(
      JSON.stringify({ error: 'You must be an active member of this team to share content' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Verify recipient is an active member of the team
  const { data: recipientMembership, error: recipientError } = await supabaseClient
    .from('team_memberships')
    .select('id, status')
    .eq('team_id', team_id)
    .eq('user_id', recipient_user_id)
    .eq('status', 'active')
    .maybeSingle();

  if (recipientError || !recipientMembership) {
    return new Response(
      JSON.stringify({ error: 'Recipient must be an active member of this team' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // If sharing a folder, verify the user owns it
  if (share_type === 'folder' && folder_id) {
    const { data: folder, error: folderError } = await supabaseClient
      .from('folders')
      .select('id, user_id')
      .eq('id', folder_id)
      .eq('user_id', user_id)
      .maybeSingle();

    if (folderError || !folder) {
      return new Response(
        JSON.stringify({ error: 'Folder not found or you do not own it' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  // If sharing a tag, verify the user owns it
  if (share_type === 'tag' && tag_id) {
    const { data: tag, error: tagError } = await supabaseClient
      .from('user_tags')
      .select('id, user_id')
      .eq('id', tag_id)
      .eq('user_id', user_id)
      .maybeSingle();

    if (tagError || !tag) {
      return new Response(
        JSON.stringify({ error: 'Tag not found or you do not own it' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  // Prepare share data
  const shareData: Record<string, unknown> = {
    team_id,
    owner_user_id: user_id,
    recipient_user_id,
    share_type,
  };

  if (share_type === 'folder') {
    shareData.folder_id = folder_id;
  } else if (share_type === 'tag') {
    shareData.tag_id = tag_id;
  }

  // Create the share rule
  const { data: share, error: insertError } = await supabaseClient
    .from('team_shares')
    .insert(shareData)
    .select()
    .single();

  if (insertError) {
    // Check for duplicate
    if (insertError.code === '23505') {
      return new Response(
        JSON.stringify({ error: 'This sharing rule already exists' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    return new Response(
      JSON.stringify({ error: 'Error creating share rule', details: insertError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({
      share,
      message: 'Sharing rule created successfully',
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * GET /team-shares
 * Get sharing rules for a user (as owner or recipient)
 */
async function handleGetShares(
  url: URL,
  supabaseClient: ReturnType<typeof createClient>
): Promise<Response> {
  const userId = url.searchParams.get('user_id');
  const teamId = url.searchParams.get('team_id');
  const role = url.searchParams.get('role'); // 'owner' or 'recipient'

  if (!userId) {
    return new Response(
      JSON.stringify({ error: 'user_id query parameter is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Build query
  let query = supabaseClient
    .from('team_shares')
    .select(`
      id,
      team_id,
      owner_user_id,
      recipient_user_id,
      share_type,
      folder_id,
      tag_id,
      created_at,
      folders (id, name),
      user_tags (id, name, color)
    `)
    .order('created_at', { ascending: true });

  // Filter by team if provided
  if (teamId) {
    query = query.eq('team_id', teamId);
  }

  // Filter by role
  if (role === 'owner') {
    query = query.eq('owner_user_id', userId);
  } else if (role === 'recipient') {
    query = query.eq('recipient_user_id', userId);
  } else {
    // Default: get shares where user is owner or recipient
    query = query.or(`owner_user_id.eq.${userId},recipient_user_id.eq.${userId}`);
  }

  const { data: shares, error: fetchError } = await query;

  if (fetchError) {
    return new Response(
      JSON.stringify({ error: 'Error fetching shares', details: fetchError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ shares: shares || [] }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * DELETE /team-shares?id=xxx
 * Remove a sharing rule
 */
async function handleDeleteShare(
  req: Request,
  supabaseClient: ReturnType<typeof createClient>,
  url: URL
): Promise<Response> {
  const shareId = url.searchParams.get('id');

  // Get user_id from body
  let userId: string | null = null;
  try {
    const body = await req.json() as DeleteShareInput;
    userId = body.user_id;
  } catch {
    // Body might be empty
  }

  if (!shareId) {
    return new Response(
      JSON.stringify({ error: 'Share id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Fetch the share
  const { data: share, error: fetchError } = await supabaseClient
    .from('team_shares')
    .select('id, owner_user_id')
    .eq('id', shareId)
    .single();

  if (fetchError || !share) {
    return new Response(
      JSON.stringify({ error: 'Share rule not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Verify user is the owner of the share
  if (userId && share.owner_user_id !== userId) {
    return new Response(
      JSON.stringify({ error: 'Only the owner can remove sharing rules' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Delete the share
  const { error: deleteError } = await supabaseClient
    .from('team_shares')
    .delete()
    .eq('id', shareId);

  if (deleteError) {
    return new Response(
      JSON.stringify({ error: 'Error deleting share rule', details: deleteError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ message: 'Sharing rule removed successfully' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * GET /team-shares?action=recipients
 * Get all teammates the user is sharing with, with shared call counts
 */
async function handleGetRecipients(
  url: URL,
  supabaseClient: ReturnType<typeof createClient>
): Promise<Response> {
  const userId = url.searchParams.get('user_id');
  const teamId = url.searchParams.get('team_id');

  if (!userId) {
    return new Response(
      JSON.stringify({ error: 'user_id query parameter is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Build query for shares where user is the owner
  let sharesQuery = supabaseClient
    .from('team_shares')
    .select('id, recipient_user_id, share_type, folder_id, tag_id')
    .eq('owner_user_id', userId);

  if (teamId) {
    sharesQuery = sharesQuery.eq('team_id', teamId);
  }

  const { data: shares, error: sharesError } = await sharesQuery;

  if (sharesError) {
    return new Response(
      JSON.stringify({ error: 'Error fetching shares', details: sharesError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Group shares by recipient
  const recipientMap = new Map<string, Array<{ share_type: string; folder_id?: string; tag_id?: string }>>();
  for (const share of shares || []) {
    const existing = recipientMap.get(share.recipient_user_id) || [];
    existing.push({
      share_type: share.share_type,
      folder_id: share.folder_id,
      tag_id: share.tag_id,
    });
    recipientMap.set(share.recipient_user_id, existing);
  }

  // Get recipient details and shared call counts
  const recipients = await Promise.all(
    Array.from(recipientMap.entries()).map(async ([recipientUserId, shareRules]) => {
      // Get user info
      const { data: userSettings } = await supabaseClient
        .from('user_settings')
        .select('display_name, avatar_url')
        .eq('user_id', recipientUserId)
        .maybeSingle();

      // Count shared calls based on sharing rules
      let sharedCallCount = 0;

      const folderIds = shareRules
        .filter(s => s.share_type === 'folder' && s.folder_id)
        .map(s => s.folder_id as string);
      const tagIds = shareRules
        .filter(s => s.share_type === 'tag' && s.tag_id)
        .map(s => s.tag_id as string);

      // Get calls in shared folders
      if (folderIds.length > 0) {
        const { count: folderCount } = await supabaseClient
          .from('fathom_calls')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .in('folder_id', folderIds);

        sharedCallCount += folderCount || 0;
      }

      // Get calls with shared tags (avoiding duplicates from folders)
      if (tagIds.length > 0) {
        const { data: taggedCalls } = await supabaseClient
          .from('call_tags')
          .select('recording_id, user_id, fathom_calls!inner(recording_id)')
          .eq('user_id', userId)
          .in('tag_id', tagIds);

        if (taggedCalls) {
          const uniqueRecordingIds = new Set(taggedCalls.map(tc => tc.recording_id));
          sharedCallCount += uniqueRecordingIds.size;
        }
      }

      return {
        recipient_user_id: recipientUserId,
        display_name: userSettings?.display_name || null,
        avatar_url: userSettings?.avatar_url || null,
        shared_call_count: sharedCallCount,
        sharing_rules_count: shareRules.length,
      };
    })
  );

  return new Response(
    JSON.stringify({ recipients }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * GET /team-shares?action=shared-calls
 * Get all calls shared with the user by teammates (evaluates sharing rules)
 */
async function handleGetSharedCalls(
  url: URL,
  supabaseClient: ReturnType<typeof createClient>
): Promise<Response> {
  const userId = url.searchParams.get('user_id');
  const teamId = url.searchParams.get('team_id');
  const ownerId = url.searchParams.get('owner_id'); // Optional filter by specific owner
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  if (!userId) {
    return new Response(
      JSON.stringify({ error: 'user_id query parameter is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Build query for shares where user is the recipient
  let sharesQuery = supabaseClient
    .from('team_shares')
    .select('id, team_id, owner_user_id, share_type, folder_id, tag_id')
    .eq('recipient_user_id', userId);

  if (teamId) {
    sharesQuery = sharesQuery.eq('team_id', teamId);
  }

  if (ownerId) {
    sharesQuery = sharesQuery.eq('owner_user_id', ownerId);
  }

  const { data: shares, error: sharesError } = await sharesQuery;

  if (sharesError) {
    return new Response(
      JSON.stringify({ error: 'Error fetching shares', details: sharesError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!shares || shares.length === 0) {
    return new Response(
      JSON.stringify({ calls: [], total: 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Group shares by owner
  const ownerSharesMap = new Map<string, Array<{ team_id: string; share_type: string; folder_id?: string; tag_id?: string }>>();
  for (const share of shares) {
    const existing = ownerSharesMap.get(share.owner_user_id) || [];
    existing.push({
      team_id: share.team_id,
      share_type: share.share_type,
      folder_id: share.folder_id,
      tag_id: share.tag_id,
    });
    ownerSharesMap.set(share.owner_user_id, existing);
  }

  // Collect all shared calls
  const sharedCalls: Array<{
    call: Record<string, unknown>;
    owner_user_id: string;
    team_id: string;
    share_source: string;
  }> = [];

  for (const [ownerUserId, shareRules] of ownerSharesMap.entries()) {
    const teamIdForOwner = shareRules[0].team_id;

    const folderIds = shareRules
      .filter(s => s.share_type === 'folder' && s.folder_id)
      .map(s => s.folder_id as string);
    const tagIds = shareRules
      .filter(s => s.share_type === 'tag' && s.tag_id)
      .map(s => s.tag_id as string);

    // Get calls in shared folders
    if (folderIds.length > 0) {
      const { data: folderCalls } = await supabaseClient
        .from('fathom_calls')
        .select(`
          recording_id,
          user_id,
          name,
          created_at,
          duration_seconds,
          recorded_by_email,
          folder_id,
          folders (id, name)
        `)
        .eq('user_id', ownerUserId)
        .in('folder_id', folderIds)
        .order('created_at', { ascending: false });

      if (folderCalls) {
        for (const call of folderCalls) {
          sharedCalls.push({
            call,
            owner_user_id: ownerUserId,
            team_id: teamIdForOwner,
            share_source: 'folder',
          });
        }
      }
    }

    // Get calls with shared tags
    if (tagIds.length > 0) {
      const { data: taggedCallRecords } = await supabaseClient
        .from('call_tags')
        .select('recording_id, user_id')
        .eq('user_id', ownerUserId)
        .in('tag_id', tagIds);

      if (taggedCallRecords && taggedCallRecords.length > 0) {
        const uniqueRecordingIds = [...new Set(taggedCallRecords.map(tc => tc.recording_id))];

        const { data: taggedCalls } = await supabaseClient
          .from('fathom_calls')
          .select(`
            recording_id,
            user_id,
            name,
            created_at,
            duration_seconds,
            recorded_by_email,
            folder_id,
            folders (id, name)
          `)
          .eq('user_id', ownerUserId)
          .in('recording_id', uniqueRecordingIds)
          .order('created_at', { ascending: false });

        if (taggedCalls) {
          for (const call of taggedCalls) {
            // Check if this call is already in the list (from folder share)
            const exists = sharedCalls.some(
              sc => sc.call.recording_id === call.recording_id && sc.owner_user_id === ownerUserId
            );
            if (!exists) {
              sharedCalls.push({
                call,
                owner_user_id: ownerUserId,
                team_id: teamIdForOwner,
                share_source: 'tag',
              });
            }
          }
        }
      }
    }
  }

  // Sort by created_at descending
  sharedCalls.sort((a, b) => {
    const dateA = new Date(a.call.created_at as string).getTime();
    const dateB = new Date(b.call.created_at as string).getTime();
    return dateB - dateA;
  });

  // Apply pagination
  const total = sharedCalls.length;
  const paginatedCalls = sharedCalls.slice(offset, offset + limit);

  // Enhance calls with owner user info
  const enhancedCalls = await Promise.all(
    paginatedCalls.map(async (sc) => {
      const { data: userSettings } = await supabaseClient
        .from('user_settings')
        .select('display_name, avatar_url')
        .eq('user_id', sc.owner_user_id)
        .maybeSingle();

      // Get tags for the call
      const { data: callTags } = await supabaseClient
        .from('call_tags')
        .select('user_tags (id, name, color)')
        .eq('recording_id', sc.call.recording_id)
        .eq('user_id', sc.owner_user_id);

      return {
        ...sc.call,
        owner_user_id: sc.owner_user_id,
        owner_display_name: userSettings?.display_name || null,
        owner_avatar_url: userSettings?.avatar_url || null,
        team_id: sc.team_id,
        share_source: sc.share_source,
        tags: callTags?.map(ct => ct.user_tags) || [],
      };
    })
  );

  return new Response(
    JSON.stringify({
      calls: enhancedCalls,
      total,
      limit,
      offset,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
