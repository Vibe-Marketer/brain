import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';
import { authenticateRequest } from '../_shared/auth.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { escapeHtml } from '../_shared/html-escape.ts';
const RESEND_API_URL = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'CallVault AI <onboarding@resend.dev>';
const PRODUCTION_FROM = 'CallVault AI <noreply@mail.callvaultai.com>';
const supportTicketSchema = z.object({
  message: z.string().trim().min(1).max(5000),
  replyEmail: z.string().trim().email().max(254).optional(),
  url: z.string().trim().max(2000).optional(),
  userAgent: z.string().trim().max(1000).optional(),
  userId: z.string().trim().max(128).optional(),
  organizationId: z.string().trim().max(128).optional(),
  workspaceId: z.string().trim().max(128).optional(),
  appVersion: z.string().trim().max(100).optional(),
  commit: z.string().trim().max(100).optional()
});
const extendedSchema = supportTicketSchema.extend({
  screenshotBase64: z.string().optional(),
  consoleLogs: z.any().optional()
});
/**
 * Normalize a message for duplicate detection: lowercase, strip UUIDs and
 * digits (so "row 42 failed" and "row 97 failed" match), collapse whitespace,
 * and keep only the first 200 characters.
 */ function normalizeForFingerprint(message) {
  return message.toLowerCase().replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '').replace(/\d+/g, '').replace(/\s+/g, ' ').trim().slice(0, 200);
}
/** sha256 hex of (url ?? '') + '|' + normalized message prefix. */ async function computeFingerprint(url, message) {
  const input = `${url ?? ''}|${normalizeForFingerprint(message)}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map((b)=>b.toString(16).padStart(2, '0')).join('');
}
function buildSupportHtml(input) {
  const safeMessage = escapeHtml(input.message);
  const safeReplyEmail = escapeHtml(input.replyEmail ?? 'Unavailable');
  const safeUrl = escapeHtml(input.url ?? 'Unavailable');
  const safeUserAgent = escapeHtml(input.userAgent ?? 'Unavailable');
  const safeUserId = escapeHtml(input.userId ?? 'Unavailable');
  const safeOrganizationId = escapeHtml(input.organizationId ?? 'Unavailable');
  const safeWorkspaceId = escapeHtml(input.workspaceId ?? 'Unavailable');
  const safeAppVersion = escapeHtml(input.appVersion ?? 'Unavailable');
  const safeCommit = escapeHtml(input.commit ?? 'Unavailable');
  return `<!DOCTYPE html>
<html lang="en">
  <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;line-height:1.5;">
    <h2 style="margin:0 0 12px;">CallVault Support Ticket</h2>
    <p style="white-space:pre-wrap;margin:0 0 20px;">${safeMessage}</p>
    <hr style="border:0;border-top:1px solid #e5e7eb;margin:16px 0;" />
    <p><strong>Reply Email:</strong> ${safeReplyEmail}</p>
    <p><strong>URL:</strong> ${safeUrl}</p>
    <p><strong>User Agent:</strong> ${safeUserAgent}</p>
    <p><strong>User ID:</strong> ${safeUserId}</p>
    <p><strong>Organization ID:</strong> ${safeOrganizationId}</p>
    <p><strong>Workspace ID:</strong> ${safeWorkspaceId}</p>
    <p><strong>App Version:</strong> ${safeAppVersion}</p>
    <p><strong>Commit:</strong> ${safeCommit}</p>
  </body>
</html>`;
}
function buildSupportText(input) {
  return [
    'CallVault Support Ticket',
    '',
    input.message,
    '',
    `Reply Email: ${input.replyEmail ?? 'Unavailable'}`,
    `URL: ${input.url ?? 'Unavailable'}`,
    `User Agent: ${input.userAgent ?? 'Unavailable'}`,
    `User ID: ${input.userId ?? 'Unavailable'}`,
    `Organization ID: ${input.organizationId ?? 'Unavailable'}`,
    `Workspace ID: ${input.workspaceId ?? 'Unavailable'}`,
    `App Version: ${input.appVersion ?? 'Unavailable'}`,
    `Commit: ${input.commit ?? 'Unavailable'}`
  ].join('\n');
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
    // Service-role client for privileged writes: storage upload (bucket
    // policies are owner-based; an anon-client upload sets no owner),
    // duplicate-ticket updates, and event logging.
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    const rawBody = await req.json();
    const validation = extendedSchema.safeParse(rawBody);
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
    const payload = validation.data;
    const subject = 'New CallVault support ticket';
    const emailToSave = payload.replyEmail || authResult.user.email || 'unknown@example.com';
    // Duplicate detection: same user reporting the same symptom on the same
    // page bumps the existing ticket instead of creating a new row.
    const fingerprint = await computeFingerprint(payload.url, payload.message);
    const { data: existingTicket, error: dedupError } = await serviceClient.from('support_tickets').select('id, occurrence_count').eq('user_id', authResult.userId).eq('fingerprint', fingerprint).in('status', [
      'open',
      'investigating'
    ]).order('created_at', {
      ascending: false
    }).limit(1).maybeSingle();
    if (dedupError) {
      console.error('Duplicate-check query failed (continuing with insert):', dedupError);
    }
    if (existingTicket) {
      const { error: bumpError } = await serviceClient.from('support_tickets').update({
        occurrence_count: (existingTicket.occurrence_count ?? 1) + 1,
        last_seen_at: new Date().toISOString()
      }).eq('id', existingTicket.id);
      if (bumpError) {
        console.error('Failed to bump duplicate ticket:', bumpError);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to record report'
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      const { error: dupEventError } = await serviceClient.from('ticket_events').insert({
        ticket_id: existingTicket.id,
        type: 'note',
        actor_id: authResult.userId,
        payload: {
          note: 'duplicate report received'
        }
      });
      if (dupEventError) console.error('Failed to log duplicate-report event:', dupEventError);
      return new Response(JSON.stringify({
        success: true,
        deduped: true
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Screenshot upload: store ONLY the storage path. The bucket is private,
    // so the admin UI fetches the image via a signed URL when needed.
    let screenshotPath = null;
    if (payload.screenshotBase64) {
      try {
        const base64Data = payload.screenshotBase64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Uint8Array.from(atob(base64Data), (c)=>c.charCodeAt(0));
        const fileName = `${authResult.userId}/${crypto.randomUUID()}.png`;
        const { error: uploadError } = await serviceClient.storage.from('support_attachments').upload(fileName, buffer, {
          contentType: 'image/png',
          upsert: false
        });
        if (uploadError) {
          console.error('Failed to upload screenshot:', uploadError);
        } else {
          screenshotPath = fileName;
        }
      } catch (err) {
        console.error('Failed to process screenshot:', err);
      }
    }
    const html = buildSupportHtml(payload);
    const text = buildSupportText(payload);
    // 1. Insert into database — this row is the system of record.
    const { data: insertedTicket, error: dbError } = await supabase.from('support_tickets').insert({
      user_id: authResult.userId,
      email: emailToSave,
      subject: 'In-App Support Request',
      body: payload.message,
      url: payload.url,
      user_agent: payload.userAgent,
      app_version: payload.appVersion,
      commit: payload.commit,
      source: 'user',
      status: 'open',
      severity: 'medium',
      fingerprint,
      screenshot_path: screenshotPath
    }).select().single();
    if (dbError) {
      console.error('Failed to persist ticket:', dbError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to persist ticket'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // 1.5 Attach console logs as a ticket event if provided.
    if (payload.consoleLogs && insertedTicket) {
      const { error: eventError } = await serviceClient.from('ticket_events').insert({
        ticket_id: insertedTicket.id,
        type: 'note',
        actor_id: authResult.userId,
        payload: {
          console_logs: payload.consoleLogs,
          type: 'attachment'
        }
      });
      if (eventError) console.error('Failed to insert ticket event:', eventError);
    }
    // 2. Email notification is best-effort. A failed send is recorded as a
    //    ticket event but never fails the request — the DB row already exists.
    let emailFailureReason = null;
    if (!resendApiKey) {
      emailFailureReason = 'RESEND_API_KEY not configured';
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
              'support@callvaultai.com'
            ],
            subject,
            html,
            text,
            reply_to: payload.replyEmail,
            tags: [
              {
                name: 'source',
                value: 'support-ticket'
              }
            ]
          })
        });
        if (!resendResponse.ok) {
          emailFailureReason = `Resend responded with status ${resendResponse.status}`;
        }
      } catch (err) {
        emailFailureReason = err instanceof Error ? err.message : 'Unknown email error';
      }
    }
    if (emailFailureReason && insertedTicket) {
      console.error('Support ticket email failed:', emailFailureReason);
      const { error: emailEventError } = await serviceClient.from('ticket_events').insert({
        ticket_id: insertedTicket.id,
        type: 'email_failed',
        actor_id: authResult.userId,
        payload: {
          reason: emailFailureReason
        }
      });
      if (emailEventError) console.error('Failed to log email_failed event:', emailEventError);
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
    console.error('send-support-ticket unhandled error:', err);
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
