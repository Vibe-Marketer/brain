import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';
import { authenticateRequest } from '../_shared/auth.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
const payloadSchema = z.object({
  ticketId: z.string().uuid(),
  status: z.enum([
    'open',
    'investigating',
    'resolved',
    'reverted',
    'closed'
  ]).optional(),
  severity: z.enum([
    'low',
    'medium',
    'high',
    'critical'
  ]).optional(),
  note: z.string().optional()
}).refine((data)=>data.status || data.severity || data.note, {
  message: 'Must provide at least one of status, severity, or note to update.'
});
Deno.serve(async (req)=>{
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({
      success: false,
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    // Anon client with the caller's Authorization header forwarded — used for
    // identity and the is_admin() check (which reads auth.uid()).
    const authHeader = req.headers.get('Authorization');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader ?? ''
        }
      }
    });
    const authResult = await authenticateRequest(req, supabase, corsHeaders);
    if (authResult instanceof Response) return authResult;
    // Caller must be an admin — checked on the forwarded-auth client so
    // is_admin() evaluates the caller, never the service role.
    const { data: isAdmin, error: adminCheckError } = await supabase.rpc('is_admin');
    if (adminCheckError || !isAdmin) {
      if (adminCheckError) console.error('is_admin check failed:', adminCheckError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Admin access required'
      }), {
        status: 403,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const rawBody = await req.json();
    const validation = payloadSchema.safeParse(rawBody);
    if (!validation.success) {
      return new Response(JSON.stringify({
        success: false,
        error: validation.error.issues[0]?.message
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const { ticketId, status, severity, note } = validation.data;
    // Service-role client for the privileged writes.
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    // Fetch current state first so the event records the real transition and
    // a missing ticket returns a clear 404 instead of a silent no-op.
    const { data: ticket, error: fetchError } = await serviceClient.from('support_tickets').select('id, status').eq('id', ticketId).maybeSingle();
    if (fetchError) {
      console.error('Failed to fetch ticket:', fetchError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to fetch ticket'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    if (!ticket) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Ticket not found'
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const previousStatus = ticket.status;
    if (status || severity) {
      const updates = {
        updated_at: new Date().toISOString()
      };
      if (status) {
        updates.status = status;
        if (status === 'resolved') {
          updates.resolved_at = new Date().toISOString();
        } else if (status === 'open' || status === 'investigating') {
          // Re-opening clears the resolution timestamp.
          updates.resolved_at = null;
        }
      }
      if (severity) updates.severity = severity;
      const { data: updatedRows, error: updateError } = await serviceClient.from('support_tickets').update(updates).eq('id', ticketId).select('id');
      if (updateError) {
        console.error('Failed to update ticket:', updateError);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to update ticket'
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      // The ticket existed moments ago — an empty update result means the
      // write silently failed and must not be reported as success.
      if (!updatedRows || updatedRows.length === 0) {
        console.error('Ticket update affected zero rows:', ticketId);
        return new Response(JSON.stringify({
          success: false,
          error: 'Ticket update affected no rows'
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      if (status) {
        const { error: eventError } = await serviceClient.from('ticket_events').insert({
          ticket_id: ticketId,
          type: 'status_change',
          actor_id: authResult.userId,
          payload: {
            previous_status: previousStatus,
            new_status: status
          }
        });
        if (eventError) console.error('Event insert failed:', eventError);
      }
      // Audit trail — written via service role. Log failures loudly but never
      // fail a mutation that already succeeded.
      const { error: auditError } = await serviceClient.from('admin_audit_log').insert({
        actor_user_id: authResult.userId,
        action: 'update_ticket_status',
        target_type: 'ticket',
        target_id: ticketId,
        metadata: {
          ...status ? {
            previous_status: previousStatus,
            new_status: status
          } : {},
          ...severity ? {
            new_severity: severity
          } : {}
        }
      });
      if (auditError) {
        console.error('AUDIT LOG WRITE FAILED for update-ticket-status:', auditError);
      }
    }
    if (note) {
      const { error: noteError } = await serviceClient.from('ticket_events').insert({
        ticket_id: ticketId,
        type: 'note',
        actor_id: authResult.userId,
        payload: {
          note
        }
      });
      if (noteError) {
        console.error('Failed to add note:', noteError);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to add note'
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
    }
    return new Response(JSON.stringify({
      success: true
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (err) {
    console.error('update-ticket-status unhandled error:', err);
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal error'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
