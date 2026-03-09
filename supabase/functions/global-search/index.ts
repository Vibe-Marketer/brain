import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

/**
 * GLOBAL SEARCH — Cross-entity search across calls, participants, tags, folders
 *
 * Calls the global_search() Postgres RPC and returns grouped results.
 *
 * Request body:
 *   query          string  — Search term (empty for filter-only mode)
 *   workspaceId    string? — UUID: restrict to a single workspace
 *   dateStart      string? — ISO 8601: lower bound on call date
 *   dateEnd        string? — ISO 8601: upper bound on call date
 *   sourceApps     string[]? — Filter by source: 'fathom','zoom','youtube','upload'
 *   tagIds         string[]? — UUID[]: only calls with at least one of these tags
 *   folderIds      string[]? — UUID[]: only calls in at least one of these folders
 *   limit          number? — Max results per call entity group (default 20)
 *
 * Response:
 *   {
 *     success: true,
 *     query: string,
 *     results: {
 *       calls:        SearchResult[],
 *       participants: SearchResult[],
 *       tags:         SearchResult[],
 *       folders:      SearchResult[],
 *       total:        number,
 *     },
 *     timing: { total_ms: number }
 *   }
 *
 * Each SearchResult:
 *   entity_type    'call' | 'participant' | 'tag' | 'folder'
 *   entity_id      string
 *   title          string
 *   subtitle       string
 *   metadata       Record<string, unknown>
 *   relevance_score number
 */

interface GlobalSearchRow {
  entity_type: 'call' | 'participant' | 'tag' | 'folder';
  entity_id: string;
  title: string;
  subtitle: string;
  metadata: Record<string, unknown>;
  relevance_score: number;
}

interface GroupedResults {
  calls: GlobalSearchRow[];
  participants: GlobalSearchRow[];
  tags: GlobalSearchRow[];
  folders: GlobalSearchRow[];
  total: number;
}

const VALID_SOURCE_APPS = ['fathom', 'zoom', 'youtube', 'upload', 'google_meet', 'other'];

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Authenticate user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate request body
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;

    const {
      query = '',
      workspaceId,
      dateStart,
      dateEnd,
      sourceApps,
      tagIds,
      folderIds,
      limit = 20,
    } = body;

    // Validate query
    if (typeof query !== 'string') {
      return new Response(
        JSON.stringify({ error: 'query must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const trimmedQuery = query.trim();

    // Validate limit
    const parsedLimit = typeof limit === 'number' ? Math.min(Math.max(1, limit), 100) : 20;

    // Validate sourceApps
    let validSourceApps: string[] | null = null;
    if (Array.isArray(sourceApps)) {
      validSourceApps = (sourceApps as unknown[])
        .filter((p): p is string => typeof p === 'string' && VALID_SOURCE_APPS.includes(p));
      if (validSourceApps.length === 0) validSourceApps = null;
    }

    // Validate tagIds (UUID array)
    let validTagIds: string[] | null = null;
    if (Array.isArray(tagIds)) {
      validTagIds = (tagIds as unknown[]).filter((id): id is string => typeof id === 'string' && id.length > 0);
      if (validTagIds.length === 0) validTagIds = null;
    }

    // Validate folderIds (UUID array)
    let validFolderIds: string[] | null = null;
    if (Array.isArray(folderIds)) {
      validFolderIds = (folderIds as unknown[]).filter((id): id is string => typeof id === 'string' && id.length > 0);
      if (validFolderIds.length === 0) validFolderIds = null;
    }

    const startTime = Date.now();

    // Build RPC params
    const rpcParams: Record<string, unknown> = {
      query_text: trimmedQuery,
      filter_user_id: user.id,
      filter_workspace_id: (typeof workspaceId === 'string' && workspaceId) ? workspaceId : null,
      filter_date_start: (typeof dateStart === 'string' && dateStart) ? dateStart : null,
      filter_date_end: (typeof dateEnd === 'string' && dateEnd) ? dateEnd : null,
      filter_source_apps: validSourceApps,
      filter_tag_ids: validTagIds,
      filter_folder_ids: validFolderIds,
      match_count: parsedLimit,
    };

    // Call global_search RPC
    const { data: rows, error: searchError } = await supabase.rpc('global_search', rpcParams);

    if (searchError) {
      console.error('global_search RPC error:', searchError);
      return new Response(
        JSON.stringify({ error: 'Search failed', details: searchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Group results by entity type
    const grouped: GroupedResults = {
      calls: [],
      participants: [],
      tags: [],
      folders: [],
      total: 0,
    };

    for (const row of (rows ?? []) as GlobalSearchRow[]) {
      switch (row.entity_type) {
        case 'call':
          grouped.calls.push(row);
          break;
        case 'participant':
          grouped.participants.push(row);
          break;
        case 'tag':
          grouped.tags.push(row);
          break;
        case 'folder':
          grouped.folders.push(row);
          break;
      }
      grouped.total++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        query: trimmedQuery,
        results: grouped,
        timing: {
          total_ms: Date.now() - startTime,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in global-search:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
