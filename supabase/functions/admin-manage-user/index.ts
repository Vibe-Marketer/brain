/**
 * admin-manage-user (16-02) — ported from worktree-admin-center.
 *
 * Privileged admin user-management actions. Rebinds from the branch:
 *   - is_admin() (branch-only helper) -> public.has_role(_user_id, 'ADMIN'),
 *     main's SECURITY DEFINER role check, called with the JWT-verified
 *     caller id (never client-supplied).
 *   - Audit writes land in admin_audit_log (service-role only; the table has
 *     no client-reachable INSERT policy).
 *
 * Auth design (dual-client):
 *   - The caller's JWT is verified IN FUNCTION CODE via authenticateRequest
 *     (supabase.auth.getUser(token)) — the gateway uses verify_jwt = false
 *     repo-wide because Supabase's ES256 tokens fail the legacy gateway check.
 *   - Privileged mutations and the audit write use a separate service-role
 *     client; the admin check keys on the verified userId from step 1.
 *
 * Billing actions are deliberately excluded — the admin surface reads
 * subscription status only and never mutates billing.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';
import { authenticateRequest } from '../_shared/auth.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

const payloadSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('change_role'),
    target_user_id: z.string().uuid(),
    new_role: z.enum(['ADMIN', 'TEAM', 'PRO', 'FREE']),
  }),
  z.object({
    action: z.literal('reset_password'),
    target_user_id: z.string().uuid(),
    new_password: z.string().min(8, 'Password must be at least 8 characters'),
  }),
  z.object({
    action: z.literal('revoke_access'),
    target_user_id: z.string().uuid(),
  }),
  z.object({
    action: z.literal('restore_access'),
    target_user_id: z.string().uuid(),
  }),
]);

Deno.serve(async (req) => {
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

    // Service-role client for the role check, the privileged mutations, and
    // the audit write. The admin check keys on the VERIFIED userId from the
    // JWT — has_role is SECURITY DEFINER and reads user_roles directly.
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

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

    const payload = validation.data;
    const { action, target_user_id } = payload;

    let metadata: Record<string, unknown> = {};

    if (payload.action === 'change_role') {
      const { error: deleteError } = await supabaseAdmin
        .from('user_roles')
        .delete()
        .eq('user_id', target_user_id);
      if (deleteError) {
        console.error('Failed to clear existing roles:', deleteError);
        return new Response(JSON.stringify({ success: false, error: 'Failed to change role' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error: insertError } = await supabaseAdmin
        .from('user_roles')
        .insert({ user_id: target_user_id, role: payload.new_role });
      if (insertError) {
        console.error('Failed to assign new role:', insertError);
        return new Response(JSON.stringify({ success: false, error: 'Failed to change role' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      metadata = { new_role: payload.new_role };
    } else if (payload.action === 'reset_password') {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(target_user_id, {
        password: payload.new_password,
      });
      if (error) {
        console.error('Failed to reset password:', error);
        return new Response(JSON.stringify({ success: false, error: 'Failed to reset password' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      // Never include the password itself in metadata.
      metadata = {};
    } else if (payload.action === 'revoke_access') {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(target_user_id, {
        ban_duration: '87600h',
      });
      if (error) {
        console.error('Failed to revoke access:', error);
        return new Response(JSON.stringify({ success: false, error: 'Failed to revoke access' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      metadata = { ban_duration: '87600h' };
    } else if (payload.action === 'restore_access') {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(target_user_id, {
        ban_duration: 'none',
      });
      if (error) {
        console.error('Failed to restore access:', error);
        return new Response(JSON.stringify({ success: false, error: 'Failed to restore access' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      metadata = { ban_duration: 'none' };
    }

    // Audit trail — written via service role (the table has no client INSERT
    // policy). Log failures loudly but never fail a mutation that already
    // succeeded.
    const { error: auditError } = await supabaseAdmin.from('admin_audit_log').insert({
      actor_user_id: authResult.userId,
      action: `manage_user_${action}`,
      target_type: 'user',
      target_id: target_user_id,
      metadata,
    });
    if (auditError) {
      console.error('AUDIT LOG WRITE FAILED for admin-manage-user:', auditError);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('admin-manage-user unhandled error:', err);
    return new Response(JSON.stringify({ success: false, error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
