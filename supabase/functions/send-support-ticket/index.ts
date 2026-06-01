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
  commit: z.string().trim().max(100).optional(),
});

function buildSupportHtml(input: z.infer<typeof supportTicketSchema>): string {
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

function buildSupportText(input: z.infer<typeof supportTicketSchema>): string {
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
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const isProduction = Deno.env.get('RESEND_DOMAIN_VERIFIED') === 'true';

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const authResult = await authenticateRequest(req, supabase, corsHeaders);
    if (authResult instanceof Response) return authResult;

    if (!resendApiKey) {
      return new Response(JSON.stringify({ success: false, error: 'Support service unavailable' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
    const subject = 'New CallVault support ticket';
    const html = buildSupportHtml(payload);
    const text = buildSupportText(payload);

    const resendResponse = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: isProduction ? PRODUCTION_FROM : DEFAULT_FROM,
        to: ['support@callvaultai.com'],
        subject,
        html,
        text,
        reply_to: payload.replyEmail,
        tags: [{ name: 'source', value: 'support-ticket' }],
      }),
    });

    if (!resendResponse.ok) {
      return new Response(JSON.stringify({ success: false, error: 'Failed to send support ticket' }), {
        status: resendResponse.status >= 500 ? 502 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
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
