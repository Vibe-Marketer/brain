import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts';

// Dynamic CORS headers - set per-request from origin
let corsHeaders: Record<string, string> = {};

/**
 * Team Direct Reports Edge Function
 *
 * Returns calls from all direct reports for a manager view.
 * Supports filtering by specific direct report and pagination.
 *
 * GET /team-direct-reports?user_id=xxx - Get all direct report calls
 * GET /team-direct-reports?user_id=xxx&direct_report_id=yyy - Filter by specific report
 * GET /team-direct-reports?user_id=xxx&include_indirect=true - Include indirect reports
 */

interface DirectReport {
  membership_id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
  role: string;
  is_direct: boolean; // true if direct report, false if indirect
}

interface CallWithOwner {
  recording_id: number;
  user_id: string;
  name: string;
  created_at: string;
  duration_seconds: number | null;
  recorded_by_email: string | null;
  folder_id: string | null;
  folder?: { id: string; name: string } | null;
  owner_display_name: string | null;
  owner_avatar_url: string | null;
  owner_email: string | null;
  tags?: Array<{ id: string; name: string; color: string }>;
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
      case 'GET':
        if (action === 'list-reports') {
          return handleGetDirectReports(url, supabaseClient);
        }
        return handleGetDirectReportCalls(url, supabaseClient);
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
 * Get all direct reports (and optionally indirect reports) for a manager
 */
async function getDirectReports(
  supabaseClient: ReturnType<typeof createClient>,
  userId: string,
  includeIndirect: boolean = false
): Promise<DirectReport[]> {
  // Get the manager's membership
  const { data: managerMembership } = await supabaseClient
    .from('team_memberships')
    .select('id, team_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (!managerMembership) {
    return [];
  }

  const reports: DirectReport[] = [];
  const processedIds = new Set<string>();

  // Helper to recursively get reports
  async function fetchReports(managerMembershipId: string, isDirect: boolean): Promise<void> {
    const { data: directReports } = await supabaseClient
      .from('team_memberships')
      .select('id, user_id, role')
      .eq('manager_membership_id', managerMembershipId)
      .eq('status', 'active');

    if (!directReports || directReports.length === 0) return;

    for (const report of directReports) {
      // Skip if already processed (avoid cycles)
      if (processedIds.has(report.id)) continue;
      processedIds.add(report.id);

      // Get user info
      const { data: userSettings } = await supabaseClient
        .from('user_settings')
        .select('display_name, avatar_url, email')
        .eq('user_id', report.user_id)
        .maybeSingle();

      reports.push({
        membership_id: report.id,
        user_id: report.user_id,
        display_name: userSettings?.display_name || null,
        avatar_url: userSettings?.avatar_url || null,
        email: userSettings?.email || null,
        role: report.role,
        is_direct: isDirect,
      });

      // Recursively get indirect reports if requested
      if (includeIndirect) {
        await fetchReports(report.id, false);
      }
    }
  }

  await fetchReports(managerMembership.id, true);

  return reports;
}

/**
 * GET /team-direct-reports?action=list-reports
 * Get list of direct reports for a manager
 */
async function handleGetDirectReports(
  url: URL,
  supabaseClient: ReturnType<typeof createClient>
): Promise<Response> {
  const userId = url.searchParams.get('user_id');
  const includeIndirect = url.searchParams.get('include_indirect') === 'true';

  if (!userId) {
    return new Response(
      JSON.stringify({ error: 'user_id query parameter is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const reports = await getDirectReports(supabaseClient, userId, includeIndirect);

  // Also get call counts for each report
  const reportsWithCounts = await Promise.all(
    reports.map(async (report) => {
      const { count } = await supabaseClient
        .from('fathom_calls')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', report.user_id);

      return {
        ...report,
        call_count: count || 0,
      };
    })
  );

  return new Response(
    JSON.stringify({
      reports: reportsWithCounts,
      total: reportsWithCounts.length,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * GET /team-direct-reports
 * Get all calls from direct reports for a manager view
 */
async function handleGetDirectReportCalls(
  url: URL,
  supabaseClient: ReturnType<typeof createClient>
): Promise<Response> {
  const userId = url.searchParams.get('user_id');
  const directReportId = url.searchParams.get('direct_report_id'); // Optional: filter by specific report
  const includeIndirect = url.searchParams.get('include_indirect') === 'true';
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  if (!userId) {
    return new Response(
      JSON.stringify({ error: 'user_id query parameter is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get direct reports
  let reports = await getDirectReports(supabaseClient, userId, includeIndirect);

  // Filter to specific report if requested
  if (directReportId) {
    reports = reports.filter(r => r.user_id === directReportId);
    if (reports.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Specified user is not a direct report' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  if (reports.length === 0) {
    return new Response(
      JSON.stringify({ calls: [], total: 0, limit, offset }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get user IDs of all reports
  const reportUserIds = reports.map(r => r.user_id);

  // Create a map for quick lookup of report info
  const reportMap = new Map(reports.map(r => [r.user_id, r]));

  // Get total count first
  const { count: totalCount } = await supabaseClient
    .from('fathom_calls')
    .select('*', { count: 'exact', head: true })
    .in('user_id', reportUserIds);

  // Fetch calls with pagination
  const { data: calls, error: callsError } = await supabaseClient
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
    .in('user_id', reportUserIds)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (callsError) {
    return new Response(
      JSON.stringify({ error: 'Error fetching calls', details: callsError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Enhance calls with owner info and tags
  const enhancedCalls: CallWithOwner[] = await Promise.all(
    (calls || []).map(async (call) => {
      const report = reportMap.get(call.user_id);

      // Get tags for the call
      const { data: callTags } = await supabaseClient
        .from('call_tags')
        .select('user_tags (id, name, color)')
        .eq('recording_id', call.recording_id)
        .eq('user_id', call.user_id);

      return {
        recording_id: call.recording_id,
        user_id: call.user_id,
        name: call.name,
        created_at: call.created_at,
        duration_seconds: call.duration_seconds,
        recorded_by_email: call.recorded_by_email,
        folder_id: call.folder_id,
        folder: call.folders as { id: string; name: string } | null,
        owner_display_name: report?.display_name || null,
        owner_avatar_url: report?.avatar_url || null,
        owner_email: report?.email || null,
        tags: (callTags?.map(ct => ct.user_tags) || []).filter(Boolean) as Array<{ id: string; name: string; color: string }>,
      };
    })
  );

  return new Response(
    JSON.stringify({
      calls: enhancedCalls,
      total: totalCount || 0,
      limit,
      offset,
      reports_included: reports.length,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
