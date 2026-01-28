import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts';

// Dynamic CORS headers - set per-request from origin
let corsHeaders: Record<string, string> = {};

/**
 * Coach Shares Edge Function
 *
 * Handles coach sharing rules and shared calls:
 * - POST /coach-shares - Add a sharing rule (folder, tag, or all)
 * - DELETE /coach-shares?id=xxx - Remove a sharing rule
 * - GET /coach-shares - Get sharing rules for a relationship
 * - GET /coach-shares?action=coachees - Get all coachees for a coach with call counts
 * - GET /coach-shares?action=shared-calls - Get all shared calls for a coach
 */

type ShareType = 'folder' | 'tag' | 'all';

interface CreateShareInput {
  user_id: string;
  relationship_id: string;
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
        if (action === 'coachees') {
          return handleGetCoachees(url, supabaseClient);
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
 * POST /coach-shares
 * Create a new sharing rule for a coach relationship
 */
async function handleCreateShare(
  req: Request,
  supabaseClient: ReturnType<typeof createClient>
): Promise<Response> {
  const body = await req.json() as CreateShareInput;
  const { user_id, relationship_id, share_type, folder_id, tag_id } = body;

  // Validate required fields
  if (!user_id) {
    return new Response(
      JSON.stringify({ error: 'user_id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!relationship_id) {
    return new Response(
      JSON.stringify({ error: 'relationship_id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!share_type || !['folder', 'tag', 'all'].includes(share_type)) {
    return new Response(
      JSON.stringify({ error: 'share_type must be "folder", "tag", or "all"' }),
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

  // Verify relationship exists and user is the coachee
  const { data: relationship, error: relError } = await supabaseClient
    .from('coach_relationships')
    .select('id, coachee_user_id, status')
    .eq('id', relationship_id)
    .single();

  if (relError || !relationship) {
    return new Response(
      JSON.stringify({ error: 'Relationship not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Only coachee can add sharing rules
  if (relationship.coachee_user_id !== user_id) {
    return new Response(
      JSON.stringify({ error: 'Only the coachee can configure sharing rules' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Relationship must be active
  if (relationship.status !== 'active') {
    return new Response(
      JSON.stringify({ error: 'Relationship must be active to add sharing rules' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check for existing 'all' share - can't add more rules if 'all' exists
  if (share_type !== 'all') {
    const { data: existingAll } = await supabaseClient
      .from('coach_shares')
      .select('id')
      .eq('relationship_id', relationship_id)
      .eq('share_type', 'all')
      .maybeSingle();

    if (existingAll) {
      return new Response(
        JSON.stringify({
          error: 'Cannot add folder/tag rules when "all" sharing is enabled. Remove "all" first.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  // If adding 'all', remove existing folder/tag rules
  if (share_type === 'all') {
    await supabaseClient
      .from('coach_shares')
      .delete()
      .eq('relationship_id', relationship_id);
  }

  // Prepare share data
  const shareData: Record<string, unknown> = {
    relationship_id,
    share_type,
  };

  if (share_type === 'folder') {
    shareData.folder_id = folder_id;
  } else if (share_type === 'tag') {
    shareData.tag_id = tag_id;
  }

  // Create the share rule
  const { data: share, error: insertError } = await supabaseClient
    .from('coach_shares')
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
 * GET /coach-shares
 * Get sharing rules for a relationship
 */
async function handleGetShares(
  url: URL,
  supabaseClient: ReturnType<typeof createClient>
): Promise<Response> {
  const userId = url.searchParams.get('user_id');
  const relationshipId = url.searchParams.get('relationship_id');

  if (!userId) {
    return new Response(
      JSON.stringify({ error: 'user_id query parameter is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!relationshipId) {
    return new Response(
      JSON.stringify({ error: 'relationship_id query parameter is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Verify user is part of the relationship
  const { data: relationship, error: relError } = await supabaseClient
    .from('coach_relationships')
    .select('id, coach_user_id, coachee_user_id')
    .eq('id', relationshipId)
    .single();

  if (relError || !relationship) {
    return new Response(
      JSON.stringify({ error: 'Relationship not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (relationship.coach_user_id !== userId && relationship.coachee_user_id !== userId) {
    return new Response(
      JSON.stringify({ error: 'You are not part of this relationship' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Fetch shares with folder/tag details
  const { data: shares, error: fetchError } = await supabaseClient
    .from('coach_shares')
    .select(`
      id,
      relationship_id,
      share_type,
      folder_id,
      tag_id,
      created_at,
      folders (id, name),
      user_tags (id, name, color)
    `)
    .eq('relationship_id', relationshipId)
    .order('created_at', { ascending: true });

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
 * DELETE /coach-shares?id=xxx
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

  // Fetch the share and verify ownership
  const { data: share, error: fetchError } = await supabaseClient
    .from('coach_shares')
    .select(`
      id,
      relationship_id,
      coach_relationships (coachee_user_id)
    `)
    .eq('id', shareId)
    .single();

  if (fetchError || !share) {
    return new Response(
      JSON.stringify({ error: 'Share rule not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Verify user is the coachee
  const coacheeUserId = (share.coach_relationships as { coachee_user_id: string })?.coachee_user_id;
  if (userId && coacheeUserId !== userId) {
    return new Response(
      JSON.stringify({ error: 'Only the coachee can remove sharing rules' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Delete the share
  const { error: deleteError } = await supabaseClient
    .from('coach_shares')
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
 * GET /coach-shares?action=coachees
 * Get all coachees for a coach with their call counts
 */
async function handleGetCoachees(
  url: URL,
  supabaseClient: ReturnType<typeof createClient>
): Promise<Response> {
  const userId = url.searchParams.get('user_id');

  if (!userId) {
    return new Response(
      JSON.stringify({ error: 'user_id query parameter is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get all active relationships where user is coach
  const { data: relationships, error: relError } = await supabaseClient
    .from('coach_relationships')
    .select('id, coachee_user_id, status, created_at, accepted_at')
    .eq('coach_user_id', userId)
    .eq('status', 'active')
    .order('accepted_at', { ascending: false });

  if (relError) {
    return new Response(
      JSON.stringify({ error: 'Error fetching relationships', details: relError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get coachee details and shared call counts
  const coachees = await Promise.all(
    (relationships || []).map(async (rel) => {
      // Get coachee user info
      const { data: userSettings } = await supabaseClient
        .from('user_settings')
        .select('display_name, avatar_url')
        .eq('user_id', rel.coachee_user_id)
        .maybeSingle();

      // Get sharing rules for this relationship
      const { data: shares } = await supabaseClient
        .from('coach_shares')
        .select('id, share_type, folder_id, tag_id')
        .eq('relationship_id', rel.id);

      // Count shared calls based on sharing rules
      let sharedCallCount = 0;

      if (shares && shares.length > 0) {
        const hasAllAccess = shares.some((s: { share_type: string }) => s.share_type === 'all');

        if (hasAllAccess) {
          // Count all coachee's calls
          const { count } = await supabaseClient
            .from('fathom_calls')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', rel.coachee_user_id);

          sharedCallCount = count || 0;
        } else {
          // Count calls matching folder/tag rules
          const folderIds = shares
            .filter((s: { share_type: string; folder_id?: string }) => s.share_type === 'folder' && s.folder_id)
            .map((s: { folder_id: string }) => s.folder_id);
          const tagIds = shares
            .filter((s: { share_type: string; tag_id?: string }) => s.share_type === 'tag' && s.tag_id)
            .map((s: { tag_id: string }) => s.tag_id);

          // Get calls in shared folders
          if (folderIds.length > 0) {
            const { count: folderCount } = await supabaseClient
              .from('fathom_calls')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', rel.coachee_user_id)
              .in('folder_id', folderIds);

            sharedCallCount += folderCount || 0;
          }

          // Get calls with shared tags (avoiding duplicates)
          if (tagIds.length > 0) {
            const { data: taggedCalls } = await supabaseClient
              .from('call_tags')
              .select('recording_id, user_id, fathom_calls!inner(recording_id)')
              .eq('user_id', rel.coachee_user_id)
              .in('tag_id', tagIds);

            // Count unique calls with shared tags
            if (taggedCalls) {
              const uniqueRecordingIds = new Set(taggedCalls.map(tc => tc.recording_id));
              sharedCallCount += uniqueRecordingIds.size;
            }
          }
        }
      }

      return {
        relationship_id: rel.id,
        coachee_user_id: rel.coachee_user_id,
        display_name: userSettings?.display_name || null,
        avatar_url: userSettings?.avatar_url || null,
        status: rel.status,
        accepted_at: rel.accepted_at,
        shared_call_count: sharedCallCount,
        sharing_rules_count: shares?.length || 0,
      };
    })
  );

  return new Response(
    JSON.stringify({ coachees }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * GET /coach-shares?action=shared-calls
 * Get all shared calls for a coach (evaluates sharing rules)
 */
async function handleGetSharedCalls(
  url: URL,
  supabaseClient: ReturnType<typeof createClient>
): Promise<Response> {
  const userId = url.searchParams.get('user_id');
  const coacheeId = url.searchParams.get('coachee_id'); // Optional filter
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  if (!userId) {
    return new Response(
      JSON.stringify({ error: 'user_id query parameter is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Build relationships query
  let relQuery = supabaseClient
    .from('coach_relationships')
    .select('id, coachee_user_id')
    .eq('coach_user_id', userId)
    .eq('status', 'active');

  if (coacheeId) {
    relQuery = relQuery.eq('coachee_user_id', coacheeId);
  }

  const { data: relationships, error: relError } = await relQuery;

  if (relError) {
    return new Response(
      JSON.stringify({ error: 'Error fetching relationships', details: relError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!relationships || relationships.length === 0) {
    return new Response(
      JSON.stringify({ calls: [], total: 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Collect all shared calls across all coachees
  const sharedCalls: Array<{
    call: Record<string, unknown>;
    coachee_user_id: string;
    relationship_id: string;
    share_source: string;
  }> = [];

  for (const rel of relationships) {
    // Get sharing rules for this relationship
    const { data: shares } = await supabaseClient
      .from('coach_shares')
      .select('id, share_type, folder_id, tag_id')
      .eq('relationship_id', rel.id);

    if (!shares || shares.length === 0) continue;

    const hasAllAccess = shares.some((s: { share_type: string }) => s.share_type === 'all');

    if (hasAllAccess) {
      // Get all coachee's calls
      const { data: calls } = await supabaseClient
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
        .eq('user_id', rel.coachee_user_id)
        .order('created_at', { ascending: false });

      if (calls) {
        for (const call of calls) {
          sharedCalls.push({
            call,
            coachee_user_id: rel.coachee_user_id,
            relationship_id: rel.id,
            share_source: 'all',
          });
        }
      }
    } else {
      // Get calls matching specific folder/tag rules
      const folderIds = shares
        .filter((s: { share_type: string; folder_id?: string }) => s.share_type === 'folder' && s.folder_id)
        .map((s: { folder_id: string }) => s.folder_id);
      const tagIds = shares
        .filter((s: { share_type: string; tag_id?: string }) => s.share_type === 'tag' && s.tag_id)
        .map((s: { tag_id: string }) => s.tag_id);

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
          .eq('user_id', rel.coachee_user_id)
          .in('folder_id', folderIds)
          .order('created_at', { ascending: false });

        if (folderCalls) {
          for (const call of folderCalls) {
            sharedCalls.push({
              call,
              coachee_user_id: rel.coachee_user_id,
              relationship_id: rel.id,
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
          .eq('user_id', rel.coachee_user_id)
          .in('tag_id', tagIds);

        if (taggedCallRecords && taggedCallRecords.length > 0) {
          // Get unique recording IDs
          const uniqueRecordingIds = [...new Set(taggedCallRecords.map(tc => tc.recording_id))];

          // Fetch the actual calls
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
            .eq('user_id', rel.coachee_user_id)
            .in('recording_id', uniqueRecordingIds)
            .order('created_at', { ascending: false });

          if (taggedCalls) {
            for (const call of taggedCalls) {
              // Check if this call is already in the list (from folder share)
              const exists = sharedCalls.some(
                sc => sc.call.recording_id === call.recording_id && sc.coachee_user_id === rel.coachee_user_id
              );
              if (!exists) {
                sharedCalls.push({
                  call,
                  coachee_user_id: rel.coachee_user_id,
                  relationship_id: rel.id,
                  share_source: 'tag',
                });
              }
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

  // Enhance calls with coachee user info
  const enhancedCalls = await Promise.all(
    paginatedCalls.map(async (sc) => {
      const { data: userSettings } = await supabaseClient
        .from('user_settings')
        .select('display_name, avatar_url')
        .eq('user_id', sc.coachee_user_id)
        .maybeSingle();

      // Get tags for the call
      const { data: callTags } = await supabaseClient
        .from('call_tags')
        .select('user_tags (id, name, color)')
        .eq('recording_id', sc.call.recording_id)
        .eq('user_id', sc.coachee_user_id);

      return {
        ...sc.call,
        coachee_user_id: sc.coachee_user_id,
        coachee_display_name: userSettings?.display_name || null,
        coachee_avatar_url: userSettings?.avatar_url || null,
        relationship_id: sc.relationship_id,
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
