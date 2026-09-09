/**
 * unclaim-organization-domain (36-04) — ORG-03 admin bridge to
 * unclaim_organization_domain_atomic.
 *
 * Mirrors merge-organizations/index.ts exactly (see that file's header for
 * the full auth-design rationale). unclaim_organization_domain_atomic
 * (36-02) is SECURITY DEFINER, authority BY PARAMETER, and EXECUTE-revoked
 * from PUBLIC/anon/authenticated -- it is unreachable by any client role.
 * This edge function is the sole sanctioned bridge: it verifies the
 * caller's JWT, independently checks has_role(caller, 'ADMIN') (the
 * platform-scoped gate -- NEVER is_organization_admin_or_owner, which is
 * org-scoped and irrelevant here -- unclaiming a domain is a platform-
 * operator action, not a self-serve org-admin one), then calls the RPC via
 * the service-role client, passing the JWT-VERIFIED caller id as
 * p_admin_user_id -- never a client-supplied value.
 *
 * Auth design (dual-client), mirrors admin-manage-user/index.ts exactly:
 *   - The caller's JWT is verified IN FUNCTION CODE via authenticateRequest
 *     (supabase.auth.getUser(token)).
 *   - The has_role check and the RPC call use a separate service-role
 *     client.
 *
 * admin_audit_log write intentionally omitted -- see merge-organizations/
 * index.ts's header for the rationale (the live table's target_type CHECK
 * constraint only allows 'user'/'ticket'/'system'; widening it is outside
 * this plan's declared file scope, and the plan's own action text marks
 * the audit write as optional).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';
import { authenticateRequest } from '../_shared/auth.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

const payloadSchema = z.object({
  domain_id: z.string().uuid('domain_id must be a valid UUID'),
});

// LOCAL_DENO_TEST_PORT is read ONLY by this repo's local `deno run`
// deploy-deferred integration-test harness (never set in the deployed
// Supabase Edge Runtime, which manages its own request dispatch
// independent of this literal port) -- lets each deploy-deferred edge
// function's test suite bind a distinct local port so multiple such
// suites (this function, merge-organizations, resolve-speakers) can run
// in the same `npm run test:integration` invocation without an AddrInUse
// collision. Falls back to Deno's own default (8000) when unset,
// preserving byte-identical behavior everywhere else, including deploy.
const LOCAL_TEST_PORT = Number(Deno.env.get('LOCAL_DENO_TEST_PORT')) || 8000;

Deno.serve({ port: LOCAL_TEST_PORT }, async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // Anon client used purely to verify the caller's JWT.
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const authResult = await authenticateRequest(req, supabase, corsHeaders);
    if (authResult instanceof Response) return authResult;

    // Service-role client for the has_role check and the RPC call. The
    // admin check keys on the VERIFIED userId from the JWT -- has_role is
    // SECURITY DEFINER and reads user_roles directly.
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Platform-scoped gate. NEVER is_organization_admin_or_owner (org-scoped).
    const { data: isAdmin, error: adminCheckError } = await supabaseAdmin.rpc('has_role', {
      _user_id: authResult.userId,
      _role: 'ADMIN',
    });
    if (adminCheckError || !isAdmin) {
      if (adminCheckError) console.error('has_role check failed:', adminCheckError);
      return new Response(JSON.stringify({ success: false, error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rawBody = await req.json();
    const validation = payloadSchema.safeParse(rawBody);
    if (!validation.success) {
      const firstIssue = validation.error.issues[0]?.message ?? 'Invalid input';
      return new Response(JSON.stringify({ success: false, error: firstIssue }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { domain_id } = validation.data;

    // p_admin_user_id is ALWAYS the JWT-verified caller id -- never a
    // client-supplied value. The RPC also re-validates has_role internally
    // (defense in depth), but that path is only reachable via a direct
    // service-role call -- this function's own gate above already rejects
    // any non-admin caller before reaching this point.
    const { error: unclaimError } = await supabaseAdmin.rpc('unclaim_organization_domain_atomic', {
      p_domain_id: domain_id,
      p_admin_user_id: authResult.userId,
    });
    if (unclaimError) {
      // Never echo the raw Postgres/RPC error text to the client. Log the
      // real error server-side only.
      console.error('unclaim_organization_domain_atomic RPC failed:', unclaimError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to unclaim domain' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('unclaim-organization-domain unhandled error:', err);
    return new Response(JSON.stringify({ success: false, error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
