import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';
import { authenticateRequest } from '../_shared/auth.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
const RESEND_API_URL = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'CallVault AI <onboarding@resend.dev>';
const PRODUCTION_FROM = 'CallVault AI <noreply@mail.callvaultai.com>';
const DEFAULT_RECIPIENT = 'support@callvaultai.com';
const payloadSchema = z.object({
  preview: z.boolean().optional()
});
function countBy(rows, key) {
  const counts = {};
  for (const row of rows){
    const value = String(row[key] ?? 'unknown');
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}
function renderCountRows(counts) {
  const entries = Object.entries(counts);
  if (entries.length === 0) {
    return '<tr><td style="padding:4px 12px;color:#6b7280;" colspan="2">None</td></tr>';
  }
  return entries.map(([label, count])=>`<tr><td style="padding:4px 12px;border-bottom:1px solid #f3f4f6;">${label}</td><td style="padding:4px 12px;border-bottom:1px solid #f3f4f6;text-align:right;font-variant-numeric:tabular-nums;">${count}</td></tr>`).join('');
}
function buildDigestHtml(digest) {
  const qa = digest.latest_qa_run;
  const runner = digest.latest_runner_run;
  const qaSection = qa ? `<p style="margin:0 0 4px;"><strong>Status:</strong> ${qa.status ?? 'unknown'}</p>
       <p style="margin:0 0 4px;"><strong>Routes crawled:</strong> ${qa.routes_crawled ?? 0}</p>
       <p style="margin:0 0 4px;"><strong>Findings:</strong> ${qa.findings_count ?? 0} (${qa.critical_count ?? 0} critical)</p>
       <p style="margin:0;"><strong>Started:</strong> ${qa.started_at ?? 'unknown'}</p>` : '<p style="margin:0;color:#6b7280;">No QA runs recorded yet.</p>';
  const runnerSection = runner ? `<p style="margin:0 0 4px;"><strong>Started:</strong> ${runner.started_at ?? 'unknown'}${runner.age_hours !== null ? ` (${runner.age_hours}h ago)` : ''}</p>
       <p style="margin:0 0 4px;"><strong>Tickets processed:</strong> ${runner.tickets_processed ?? 0}</p>
       <p style="margin:0;"><strong>Outcome:</strong> ${runner.outcome ?? 'unknown'}</p>` : '<p style="margin:0;color:#6b7280;">No runner runs recorded yet — check the local schedule.</p>';
  return `<!DOCTYPE html>
<html lang="en">
  <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;line-height:1.5;background:#f9fafb;padding:24px;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:24px;">
      <h2 style="margin:0 0 4px;">CallVault Daily Digest</h2>
      <p style="margin:0 0 20px;color:#6b7280;">Generated ${digest.generated_at}</p>

      <h3 style="margin:0 0 8px;">Tickets in the last 24 hours: ${digest.tickets_last_24h.total}</h3>
      <table style="border-collapse:collapse;width:100%;margin:0 0 8px;">
        <tr><th style="text-align:left;padding:4px 12px;color:#6b7280;font-weight:600;" colspan="2">By severity</th></tr>
        ${renderCountRows(digest.tickets_last_24h.by_severity)}
      </table>
      <table style="border-collapse:collapse;width:100%;margin:0 0 20px;">
        <tr><th style="text-align:left;padding:4px 12px;color:#6b7280;font-weight:600;" colspan="2">By source</th></tr>
        ${renderCountRows(digest.tickets_last_24h.by_source)}
      </table>

      <h3 style="margin:0 0 8px;">All tickets by status</h3>
      <table style="border-collapse:collapse;width:100%;margin:0 0 20px;">
        ${renderCountRows(digest.tickets_by_status)}
      </table>

      <h3 style="margin:0 0 8px;">Needs your eyes</h3>
      <p style="margin:0 0 4px;"><strong>Tickets flagged for review (7d):</strong> ${digest.needs_review_last_7d}</p>
      <p style="margin:0 0 20px;"><strong>Reverts available (7d):</strong> ${digest.reverts_available_last_7d}</p>

      <h3 style="margin:0 0 8px;">Latest QA crawl</h3>
      <div style="margin:0 0 20px;">${qaSection}</div>

      <h3 style="margin:0 0 8px;">Latest runner run</h3>
      <div style="margin:0;">${runnerSection}</div>
    </div>
  </body>
</html>`;
}
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
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const isProduction = Deno.env.get('RESEND_DOMAIN_VERIFIED') === 'true';
    // Two valid callers:
    //   1. Scheduled invocation carrying the shared x-cron-secret header.
    //   2. An authenticated admin (manual trigger or preview from the admin UI).
    const cronSecret = Deno.env.get('CRON_SECRET');
    const providedSecret = req.headers.get('x-cron-secret');
    const isCronCaller = Boolean(cronSecret) && providedSecret === cronSecret;
    let isAdminCaller = false;
    if (!isCronCaller) {
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
      // is_admin() reads auth.uid(), so it must run on the forwarded-auth
      // client to evaluate the caller.
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
      isAdminCaller = true;
    }
    // Body is optional (scheduled invocations may send none).
    let rawBody = {};
    try {
      rawBody = await req.json();
    } catch  {
      rawBody = {};
    }
    const validation = payloadSchema.safeParse(rawBody ?? {});
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
    const isPreview = isAdminCaller && validation.data.preview === true;
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    const { data: settings, error: settingsError } = await serviceClient.from('admin_automation_settings').select('digest_enabled, digest_recipient').eq('id', 1).maybeSingle();
    if (settingsError) {
      console.error('Failed to read automation settings:', settingsError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to read settings'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const digestEnabled = settings?.digest_enabled === true;
    if (!digestEnabled && !isPreview) {
      return new Response(JSON.stringify({
        success: true,
        skipped: true
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    // Tickets created in the last 24 hours, broken down by severity and source.
    const { data: recentTickets, error: recentError } = await serviceClient.from('support_tickets').select('severity, source').gte('created_at', dayAgo);
    if (recentError) console.error('Failed to query recent tickets:', recentError);
    // All tickets by current status.
    const { data: allTickets, error: statusError } = await serviceClient.from('support_tickets').select('status');
    if (statusError) console.error('Failed to query ticket statuses:', statusError);
    // Tickets flagged for review in the last 7 days (distinct).
    const { data: needsReviewEvents, error: needsReviewError } = await serviceClient.from('ticket_events').select('ticket_id').eq('type', 'needs_review').gte('created_at', weekAgo);
    if (needsReviewError) console.error('Failed to query needs_review events:', needsReviewError);
    const needsReviewCount = new Set((needsReviewEvents ?? []).map((e)=>e.ticket_id)).size;
    // Reverts available in the last 7 days on tickets that were not reverted.
    const { data: revertEvents, error: revertError } = await serviceClient.from('ticket_events').select('ticket_id').eq('type', 'revert_available').gte('created_at', weekAgo);
    if (revertError) console.error('Failed to query revert_available events:', revertError);
    let revertsAvailable = 0;
    const revertTicketIds = [
      ...new Set((revertEvents ?? []).map((e)=>e.ticket_id))
    ];
    if (revertTicketIds.length > 0) {
      const { data: nonRevertedTickets, error: nonRevertedError } = await serviceClient.from('support_tickets').select('id').in('id', revertTicketIds).neq('status', 'reverted');
      if (nonRevertedError) console.error('Failed to query non-reverted tickets:', nonRevertedError);
      revertsAvailable = nonRevertedTickets?.length ?? 0;
    }
    // Latest QA crawl run.
    const { data: latestQaRun, error: qaError } = await serviceClient.from('qa_runs').select('id, started_at, finished_at, status, routes_crawled, findings_count, critical_count, triggered_by').order('started_at', {
      ascending: false
    }).limit(1).maybeSingle();
    if (qaError) console.error('Failed to query qa_runs:', qaError);
    // Latest runner run plus its age — a stale heartbeat means the local
    // schedule needs attention.
    const { data: latestRunnerRun, error: runnerError } = await serviceClient.from('runner_runs').select('id, started_at, finished_at, tickets_processed, outcome').order('started_at', {
      ascending: false
    }).limit(1).maybeSingle();
    if (runnerError) console.error('Failed to query runner_runs:', runnerError);
    const runnerAgeHours = latestRunnerRun?.started_at ? Math.round((now.getTime() - new Date(latestRunnerRun.started_at).getTime()) / 36e5 * 10) / 10 : null;
    const digest = {
      generated_at: now.toISOString(),
      tickets_last_24h: {
        total: recentTickets?.length ?? 0,
        by_severity: countBy(recentTickets ?? [], 'severity'),
        by_source: countBy(recentTickets ?? [], 'source')
      },
      tickets_by_status: countBy(allTickets ?? [], 'status'),
      needs_review_last_7d: needsReviewCount,
      reverts_available_last_7d: revertsAvailable,
      latest_qa_run: latestQaRun ?? null,
      latest_runner_run: latestRunnerRun ? {
        ...latestRunnerRun,
        age_hours: runnerAgeHours
      } : null
    };
    const html = buildDigestHtml(digest);
    // Preview requests return the aggregate without sending an email.
    if (isPreview) {
      return new Response(JSON.stringify({
        success: true,
        sent: false,
        preview: true,
        digest
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Send the digest. Email failure is reported but the aggregate is still
    // returned — the data is the substance, the email is the delivery.
    let sent = false;
    let emailError = null;
    if (!resendApiKey) {
      emailError = 'RESEND_API_KEY not configured';
    } else {
      try {
        const resendResponse = await fetch(RESEND_API_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: isProduction ? PRODUCTION_FROM : DEFAULT_FROM,
            to: [
              settings?.digest_recipient ?? DEFAULT_RECIPIENT
            ],
            subject: `CallVault Daily Digest — ${now.toISOString().slice(0, 10)}`,
            html,
            tags: [
              {
                name: 'source',
                value: 'daily-digest'
              }
            ]
          })
        });
        if (resendResponse.ok) {
          sent = true;
        } else {
          emailError = `Resend responded with status ${resendResponse.status}`;
        }
      } catch (err) {
        emailError = err instanceof Error ? err.message : 'Unknown email error';
      }
    }
    if (emailError) console.error('Daily digest email failed:', emailError);
    return new Response(JSON.stringify({
      success: true,
      sent,
      ...emailError ? {
        email_error: emailError
      } : {},
      digest
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (err) {
    console.error('daily-digest unhandled error:', err);
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
