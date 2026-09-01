/**
 * resolve-events — Phase 31 Plan 01 deterministic-resolution shadow sweep.
 *
 * Cron-triggered (Plan 04 wires the pg_cron schedule), NOT user-JWT
 * authenticated -- gated by a shared secret header, mirroring
 * fathom-reconcile's X-Reconcile-Secret pattern. This endpoint:
 *   1. Rejects any request missing/mismatching X-Reconcile-Secret with 401,
 *      BEFORE any other work (no DB call, no body parsing beyond what's
 *      needed to reject cleanly).
 *   2. Zod-validates the body ({ mode: 'shadow' }).
 *   3. Resolves which organizations have the 'event_resolution' flag
 *      enabled (SAFE-01 gate) -- an org with no such row, or enabled=false,
 *      is invisible to the sweep.
 *   4. Delegates to runShadowSweep (_shared/event-resolver.ts), which
 *      computes and RECORDS proposed deterministic merges but never applies
 *      them and never writes recordings.event_id or the events table
 *      (SAFE-02).
 *
 * Deploy: `supabase functions deploy resolve-events --use-api --no-verify-jwt`
 *   (shared-secret auth happens in application code, not Supabase's JWT
 *   gate -- matches fathom-reconcile's reconcile-mode deploy note).
 *
 * Env vars required:
 *   - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (standard)
 *   - RECONCILE_SECRET (shared secret; also gates fathom-reconcile)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';
import { getCorsHeaders } from '../_shared/cors.ts';
import { runShadowSweep } from '../_shared/event-resolver.ts';

const requestSchema = z.object({
  mode: z.literal('shadow'),
});

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  // 1. CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 2. Shared-secret gate BEFORE any other work -- this endpoint is
    //    cron-triggered, never user-JWT (mirrors fathom-reconcile's
    //    reconcile mode). No DB call happens before this check passes.
    const secret = req.headers.get('X-Reconcile-Secret');
    const expected = Deno.env.get('RECONCILE_SECRET');
    if (!expected || secret !== expected) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Validate request body
    const body = await req.json().catch(() => ({}));
    const validation = requestSchema.safeParse(body);
    if (!validation.success) {
      const errorMessage = validation.error.errors[0]?.message || 'Invalid input';
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Service-role client -- this endpoint has no user session to bind to.
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 5. Resolve which orgs have the flag enabled (SAFE-01 gate). An org with
    //    no row here, or enabled=false, is invisible to the sweep below.
    const { data: flags, error: flagsError } = await supabase
      .from('organization_feature_flags')
      .select('organization_id')
      .eq('flag_key', 'event_resolution')
      .eq('enabled', true);

    if (flagsError) {
      console.error('[resolve-events] flag lookup failed:', flagsError.message);
      return new Response(JSON.stringify({ error: flagsError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const flaggedOrgIds = (flags ?? []).map((row) => row.organization_id as string);
    if (flaggedOrgIds.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 6. Run the shadow sweep -- computes + records only, never applies
    //    (SAFE-02). runShadowSweep never writes recordings.event_id/events
    //    and never calls the apply RPC (Plan 02, not imported here).
    const summary = await runShadowSweep(supabase, { flaggedOrgIds });

    return new Response(
      JSON.stringify({ success: true, processed: summary.recordingsScanned, ...summary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('[resolve-events] handler error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
