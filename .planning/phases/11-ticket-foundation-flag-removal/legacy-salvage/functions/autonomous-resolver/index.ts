import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';
import { authenticateRequest } from '../_shared/auth.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
// Thin manual dispatcher. This function does NOT claim or mutate tickets —
// the runner itself (scripts/admin/autonomous-resolver.ts, scheduled locally
// via launchd) owns ticket claiming, attempts, and state transitions. This
// endpoint only lets an admin request an immediate run when a remote runner
// webhook is configured.
const payloadSchema = z.object({
  action: z.literal('dispatch')
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
      const firstIssue = validation.error.issues[0]?.message ?? 'Invalid input';
      return new Response(JSON.stringify({
        success: false,
        error: firstIssue
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const runnerWebhookUrl = Deno.env.get('AUTONOMOUS_RUNNER_WEBHOOK_URL');
    if (!runnerWebhookUrl) {
      return new Response(JSON.stringify({
        success: true,
        dispatched: false,
        reason: 'no runner webhook configured — runner is scheduled locally via launchd'
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    try {
      const webhookResponse = await fetch(runnerWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${Deno.env.get('AUTONOMOUS_RUNNER_TOKEN') ?? ''}`
        },
        body: JSON.stringify({
          requested_by: authResult.userId,
          requested_at: new Date().toISOString()
        })
      });
      if (!webhookResponse.ok) {
        console.error('Runner webhook returned non-OK status:', webhookResponse.status);
        return new Response(JSON.stringify({
          success: false,
          dispatched: false,
          error: 'Runner webhook rejected the dispatch'
        }), {
          status: 502,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
    } catch (webhookErr) {
      console.error('Runner webhook dispatch failed:', webhookErr);
      return new Response(JSON.stringify({
        success: false,
        dispatched: false,
        error: 'Runner webhook unreachable'
      }), {
        status: 502,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    return new Response(JSON.stringify({
      success: true,
      dispatched: true
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (err) {
    console.error('autonomous-resolver unhandled error:', err);
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
