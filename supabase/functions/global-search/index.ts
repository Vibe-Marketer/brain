import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';
import { getCorsHeaders } from '../_shared/cors.ts';
// google_meet is excluded per FOUND-09: "Zero Google Meet references — removed from v2 entirely"
const VALID_SOURCE_APPS = [
  'fathom',
  'zoom',
  'youtube',
  'upload',
  'other'
];
const globalSearchSchema = z.object({
  query: z.string().max(500).default(''),
  workspaceId: z.string().uuid().optional(),
  dateStart: z.string().datetime({
    offset: true
  }).optional(),
  dateEnd: z.string().datetime({
    offset: true
  }).optional(),
  sourceApps: z.array(z.enum(VALID_SOURCE_APPS)).optional(),
  tagIds: z.array(z.string().uuid()).optional(),
  folderIds: z.array(z.string().uuid()).optional(),
  limit: z.number().int().min(1).max(100).default(20)
});
Deno.serve(async (req)=>{
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({
      error: 'Method not allowed'
    }), {
      status: 405,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    // Authenticate user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({
        error: 'No authorization header'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({
        error: 'Invalid token'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Parse and validate request body with Zod
    const rawBody = await req.json().catch(()=>({}));
    const validation = globalSearchSchema.safeParse(rawBody);
    if (!validation.success) {
      const errorMessage = validation.error.errors[0]?.message || 'Invalid input';
      return new Response(JSON.stringify({
        error: errorMessage
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const { query, workspaceId, dateStart, dateEnd, sourceApps, tagIds, folderIds, limit } = validation.data;
    const trimmedQuery = query.trim();
    const startTime = Date.now();
    // Build RPC params
    const rpcParams = {
      query_text: trimmedQuery,
      filter_user_id: user.id,
      filter_workspace_id: workspaceId || null,
      filter_date_start: dateStart || null,
      filter_date_end: dateEnd || null,
      filter_source_apps: sourceApps && sourceApps.length > 0 ? sourceApps : null,
      filter_tag_ids: tagIds && tagIds.length > 0 ? tagIds : null,
      filter_folder_ids: folderIds && folderIds.length > 0 ? folderIds : null,
      match_count: limit
    };
    // Call global_search RPC
    const { data: rows, error: searchError } = await supabase.rpc('global_search', rpcParams);
    if (searchError) {
      console.error('global_search RPC error:', searchError);
      return new Response(JSON.stringify({
        error: 'Search failed',
        details: searchError.message
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Group results by entity type
    const grouped = {
      calls: [],
      participants: [],
      tags: [],
      folders: [],
      total: 0
    };
    for (const row of rows ?? []){
      switch(row.entity_type){
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
    return new Response(JSON.stringify({
      success: true,
      query: trimmedQuery,
      results: grouped,
      timing: {
        total_ms: Date.now() - startTime
      }
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in global-search:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({
      error: errorMessage
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
