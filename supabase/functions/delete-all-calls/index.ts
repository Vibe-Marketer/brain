import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authenticated user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;

    // Parse request body — organization_id is required
    const body = await req.json();
    const { organization_id: organizationId } = body;

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: 'organization_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user has membership in the specified organization
    const { data: membership } = await supabase
      .from('organization_memberships')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!membership) {
      return new Response(
        JSON.stringify({ error: 'Not a member of this organization' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Deleting all calls for user: ${userId}, organization: ${organizationId}`);

    // Delete recordings scoped to user + organization
    const { error: recordingsError, count: recordingsCount } = await supabase
      .from('recordings')
      .delete({ count: 'exact' })
      .eq('user_id', userId)
      .eq('organization_id', organizationId);

    if (recordingsError) {
      console.error('Error deleting recordings:', recordingsError);
      throw recordingsError;
    }

    // Delete legacy fathom_raw_calls scoped to user_id only.
    // NOTE: fathom_raw_calls does not have an organization_id column,
    // so we can only scope by user_id. This is a known limitation of the
    // legacy table — all fathom_raw_calls for the user are deleted regardless
    // of which organization context the request came from.
    const { error: legacyError, count: legacyCount } = await supabase
      .from('fathom_raw_calls')
      .delete({ count: 'exact' })
      .eq('user_id', userId);

    if (legacyError) {
      console.error('Error deleting legacy fathom_raw_calls:', legacyError);
      throw legacyError;
    }

    const totalDeleted = (recordingsCount || 0) + (legacyCount || 0);
    console.log(`Successfully deleted ${totalDeleted} calls (${recordingsCount || 0} recordings, ${legacyCount || 0} legacy) for user ${userId} in org ${organizationId}`);

    return new Response(
      JSON.stringify({
        success: true,
        deleted: totalDeleted,
        recordings_deleted: recordingsCount || 0,
        legacy_calls_deleted: legacyCount || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error deleting all calls:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
