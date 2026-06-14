import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';
import { authenticateRequest } from '../_shared/auth.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { escapeHtml } from '../_shared/html-escape.ts';

const RESEND_API_URL = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'CallVault AI <onboarding@resend.dev>';
const PRODUCTION_FROM = 'CallVault AI <noreply@mail.callvaultai.com>';

// Storage path references into the private ticket-attachments bucket
// (CAP-01 / D-04). Paths only — never inline binary/base64 payloads.
const attachmentSchema = z.object({
  type: z.enum(['screenshot', 'console_log']),
  path: z.string().trim().min(1).max(300),
  mime: z.string().trim().max(100),
  size_bytes: z.number().int().nonnegative(),
});

const supportTicketSchema = z.object({
  message: z.string().trim().min(1).max(5000),
  // Closed enums so plan 11-04's admin submission reuses this single intake.
  type: z.enum(['bug', 'suggestion', 'question', 'task']).default('bug'),
  severity: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  replyEmail: z.string().trim().email().max(254).optional(),
  url: z.string().trim().max(2000).optional(),
  userAgent: z.string().trim().max(1000).optional(),
  userId: z.string().trim().max(128).optional(),
  organizationId: z.string().trim().max(128).optional(),
  workspaceId: z.string().trim().max(128).optional(),
  appVersion: z.string().trim().max(100).optional(),
  commit: z.string().trim().max(100).optional(),
  attachments: z.array(attachmentSchema).max(2).optional(),
});

type SupportTicketInput = z.infer<typeof supportTicketSchema>;

function buildSupportHtml(input: SupportTicketInput): string {
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

function buildSupportText(input: SupportTicketInput): string {
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
    `Commit: ${input.commit ?? 'Unavailable'}`,
  ].join('\n');
}

async function sendSupportEmail(
  resendApiKey: string,
  isProduction: boolean,
  payload: SupportTicketInput,
): Promise<void> {
  const resendResponse = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: isProduction ? PRODUCTION_FROM : DEFAULT_FROM,
      to: ['support@callvaultai.com'],
      subject: 'New CallVault support ticket',
      html: buildSupportHtml(payload),
      text: buildSupportText(payload),
      reply_to: payload.replyEmail,
      tags: [{ name: 'source', value: 'support-ticket' }],
    }),
  });

  if (!resendResponse.ok) {
    throw new Error(`Resend responded ${resendResponse.status}`);
  }
}

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
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const isProduction = Deno.env.get('RESEND_DOMAIN_VERIFIED') === 'true';

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const authResult = await authenticateRequest(req, supabase, corsHeaders);
    if (authResult instanceof Response) return authResult;
    const { userId } = authResult;

    const rawBody = await req.json();
    const validation = supportTicketSchema.safeParse(rawBody);
    if (!validation.success) {
      const firstIssue = validation.error.issues[0]?.message ?? 'Invalid input';
      return new Response(JSON.stringify({ success: false, error: firstIssue }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = validation.data;

    // T-15-01 spoofing control: every attachment path must live inside the
    // authenticated user's own folder. A foreign prefix would let a client
    // reference another user's private objects (admins later resolve these
    // paths to signed URLs inside the ticket detail).
    const attachments = payload.attachments ?? [];
    const foreignPath = attachments.find((att) => !att.path.startsWith(`${userId}/`));
    if (foreignPath) {
      return new Response(
        JSON.stringify({ success: false, error: 'Attachment path does not belong to the authenticated user' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // --- DB is the system of record (TKT-01). Insert FIRST; email is a
    // side-effect. reporter_id comes EXCLUSIVELY from the authenticated JWT
    // (T-11-04 spoofing mitigation) — the body-supplied userId is legacy
    // email metadata only, kept inside context.
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const context: Record<string, unknown> = {};
    if (payload.url) context.url = payload.url;
    if (payload.userAgent) context.userAgent = payload.userAgent;
    if (payload.appVersion) context.appVersion = payload.appVersion;
    if (payload.commit) context.commit = payload.commit;
    if (payload.replyEmail) context.replyEmail = payload.replyEmail;
    if (payload.userId) context.legacyBodyUserId = payload.userId;

    // 11-05 hardening (trust boundary): organizationId/workspaceId arrive
    // from the client body UNVERIFIED — membership is not checked here.
    // Namespace them under client_claims so no downstream consumer can
    // mistake them for server-verified identifiers.
    const clientClaims: Record<string, string> = {};
    if (payload.organizationId) clientClaims.organization_id = payload.organizationId;
    if (payload.workspaceId) clientClaims.workspace_id = payload.workspaceId;
    if (Object.keys(clientClaims).length > 0) context.client_claims = clientClaims;

    const { data: ticket, error: ticketError } = await admin
      .from('tickets')
      .insert({
        reporter_id: userId,
        type: payload.type,
        severity: payload.severity,
        // D-00: server-authoritative source stamp. This is the sole authority
        // for the Phase 23 comms gate — only in_app_user tickets ever get
        // customer comms. Never derived from the client body (Spoofing T-23-01).
        source: 'in_app_user',
        context,
      })
      .select('id')
      .single();

    if (ticketError || !ticket) {
      console.error('Ticket insert failed:', ticketError);
      return new Response(JSON.stringify({ success: false, error: 'Failed to create ticket' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ticketId = ticket.id as string;

    const { error: messageError } = await admin.from('ticket_messages').insert({
      ticket_id: ticketId,
      author_type: 'user',
      author_id: userId,
      body: payload.message,
      attachments,
    });

    if (messageError) {
      console.error('Ticket message insert failed:', messageError);
      return new Response(JSON.stringify({ success: false, error: 'Failed to create ticket' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 'created' lifecycle event — service writes non-status events (locked
    // decision); status transitions are written by the DB trigger.
    const { error: eventError } = await admin.from('ticket_events').insert({
      ticket_id: ticketId,
      actor_id: userId,
      event_type: 'created',
      new_value: 'new',
    });

    if (eventError) {
      console.error('Ticket event insert failed:', eventError);
      return new Response(JSON.stringify({ success: false, error: 'Failed to create ticket' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- Email side-effect. A missing key or Resend failure never blocks
    // ticket creation (locked decision).
    if (!resendApiKey) {
      console.error('RESEND_API_KEY missing — ticket created without support email:', ticketId);
    } else {
      try {
        await sendSupportEmail(resendApiKey, isProduction, payload);
      } catch (emailError) {
        console.error('Support email side-effect failed for ticket', ticketId, emailError);
      }
    }

    return new Response(JSON.stringify({ success: true, ticketId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ success: false, error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
