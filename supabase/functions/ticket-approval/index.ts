/**
 * ticket-approval (14-01) — APPR-02 server half.
 *
 * The ONLY authenticated path that can write the admin-authored
 * approval/rejection ticket_events rows the Phase 13 dispatcher polls for.
 * ticket_events INSERT stays service-role-only; this function is the bridge.
 *
 * Dispatcher recognition contract (13-RESEARCH ~307):
 *   event_type='approval' AND actor_id resolves to a real ADMIN AND ticket
 *   status is still 'awaiting_approval' at poll time. Therefore:
 *   - approve writes the event and DOES NOT change ticket status — the
 *     dispatcher merges the held branch, then advances status itself.
 *   - reject writes a 'rejection' event + an admin message with the reason
 *     + sets status to 'rejected' (dispatcher closes the branch, no merge).
 *
 * Auth design (dual-client, copied from admin-manage-user / 16-02):
 *   - Caller JWT verified IN FUNCTION CODE via authenticateRequest
 *     (verify_jwt = false at the gateway per repo-wide ES256 note).
 *   - has_role(verifiedUserId, 'ADMIN') checked on the SERVICE-ROLE client.
 *   - actor_id is ALWAYS the verified userId — never client-supplied (T-14-01).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';
import { authenticateRequest } from '../_shared/auth.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

const payloadSchema = z
  .object({
    ticket_id: z.string().uuid(),
    action: z.enum(['approve', 'reject']),
    reason: z.string().max(2000, 'Reason must be 2000 characters or fewer').optional(),
  })
  .superRefine((val, ctx) => {
    if (val.action === 'reject' && (!val.reason || val.reason.trim().length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A non-empty reason is required when rejecting',
        path: ['reason'],
      });
    }
  });

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

    // Service-role client: role check, event/message/status writes, audit.
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

    const { ticket_id, action, reason } = validation.data;

    // Status guard BEFORE any write (T-14-03). The dispatcher re-checks
    // status at poll time — defense in depth, not the only gate.
    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from('tickets')
      .select('id, status')
      .eq('id', ticket_id)
      .maybeSingle();
    if (ticketError) {
      console.error('Failed to load ticket:', ticketError);
      return new Response(JSON.stringify({ success: false, error: 'Failed to load ticket' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!ticket) {
      return new Response(JSON.stringify({ success: false, error: 'Ticket not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (ticket.status !== 'awaiting_approval') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'ticket_not_awaiting_approval',
          status: ticket.status,
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (action === 'approve') {
      // Admin-authored approval event. Do NOT change ticket status — the
      // dispatcher's recognition requires status still awaiting_approval at
      // poll time; it merges, then advances status itself.
      const { error: eventError } = await supabaseAdmin.from('ticket_events').insert({
        ticket_id,
        actor_id: authResult.userId,
        event_type: 'approval',
        old_value: 'awaiting_approval',
        new_value: 'approved',
      });
      if (eventError) {
        console.error('Failed to write approval event:', eventError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to record approval' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    } else {
      // Rejection: event + reason posted to the thread + status -> rejected.
      const { error: eventError } = await supabaseAdmin.from('ticket_events').insert({
        ticket_id,
        actor_id: authResult.userId,
        event_type: 'rejection',
        old_value: 'awaiting_approval',
        new_value: 'rejected',
      });
      if (eventError) {
        console.error('Failed to write rejection event:', eventError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to record rejection' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const { error: messageError } = await supabaseAdmin.from('ticket_messages').insert({
        ticket_id,
        author_id: authResult.userId,
        author_type: 'admin',
        body: `Rejected by admin: ${reason!.trim()}`,
      });
      if (messageError) {
        console.error('Failed to post rejection reason:', messageError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to post rejection reason' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      // The status_change audit trigger fires on this UPDATE — expected and
      // additive alongside the explicit rejection event above.
      const { error: statusError } = await supabaseAdmin
        .from('tickets')
        .update({ status: 'rejected' })
        .eq('id', ticket_id);
      if (statusError) {
        console.error('Failed to set ticket status rejected:', statusError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to update ticket status' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    // Audit trail (T-14-04) — service-role write; log failures loudly but
    // never fail a mutation that already succeeded. Never log secrets.
    const { error: auditError } = await supabaseAdmin.from('admin_audit_log').insert({
      actor_user_id: authResult.userId,
      action: `ticket_${action}`,
      target_type: 'ticket',
      target_id: ticket_id,
      metadata: action === 'reject' ? { reason: reason!.trim() } : {},
    });
    if (auditError) {
      console.error('AUDIT LOG WRITE FAILED for ticket-approval:', auditError);
    }

    return new Response(JSON.stringify({ success: true, action, ticket_id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('ticket-approval unhandled error:', err);
    return new Response(JSON.stringify({ success: false, error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
