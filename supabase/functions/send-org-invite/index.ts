/**
 * SEND ORG INVITE EDGE FUNCTION
 *
 * Sends an invitation email via Resend API when a user is invited to an
 * organization or workspace.
 *
 * Accepts POST with:
 * {
 *   inviteeEmail: string      — recipient
 *   inviterName:  string      — display name or email of the person sending the invite
 *   orgName:      string      — organization or workspace name
 *   inviteUrl:    string      — full URL the invitee should click to accept
 *   role:         string      — role they are being assigned (e.g. "member", "organization_admin")
 *   context?:     string      — optional label: "organization" | "workspace" (default "organization")
 * }
 *
 * Environment Variables:
 * - RESEND_API_KEY            : API key from resend.com (set as Supabase secret)
 * - RESEND_DOMAIN_VERIFIED    : Set to "true" once callvaultai.com domain is verified in Resend
 * - APP_URL                   : Application base URL (optional, for footer links)
 */

import { z } from 'https://esm.sh/zod@3.23.8';
import { getCorsHeaders } from '../_shared/cors.ts';
import { authenticateRequest } from '../_shared/auth.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_URL = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'CallVault AI <onboarding@resend.dev>';
const PRODUCTION_FROM = 'CallVault AI <noreply@mail.callvaultai.com>';

/** Allowed domains for invite URLs — prevents phishing via crafted inviteUrl */
const ALLOWED_URL_PREFIXES = [
  Deno.env.get('APP_URL') || 'https://app.callvaultai.com',
  'https://callvault.vercel.app',
];

const sendOrgInviteSchema = z.object({
  inviteeEmail: z.string().trim().email('Invalid email address').max(254),
  inviterName: z.string().trim().min(1, 'inviterName is required').max(200),
  orgName: z.string().trim().min(1, 'orgName is required').max(200),
  inviteUrl: z.string().url('inviteUrl must be a valid URL').refine(
    (url) => ALLOWED_URL_PREFIXES.some((prefix) => url.startsWith(prefix)),
    { message: 'inviteUrl must start with an allowed application domain' }
  ),
  role: z.string().trim().min(1, 'role is required').max(100),
  context: z.enum(['organization', 'workspace']).optional().default('organization'),
});

/** Format role slug into a human-readable label */
function formatRole(role: string): string {
  return role
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Build the HTML email body */
function buildEmailHtml(
  inviteeEmail: string,
  inviterName: string,
  orgName: string,
  inviteUrl: string,
  role: string,
  context: string,
  appUrl: string
): string {
  const formattedRole = formatRole(role);
  const contextLabel = context === 'workspace' ? 'workspace' : 'organization';
  const ContextLabel = contextLabel.charAt(0).toUpperCase() + contextLabel.slice(1);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You've been invited to ${orgName}</title>
</head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

          <!-- Logo / Brand -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <span style="font-size:22px;font-weight:700;color:#1f2937;letter-spacing:-0.5px;">
                CallVault AI
              </span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;padding:40px 36px;">

              <!-- Heading -->
              <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;line-height:1.3;">
                You've been invited to join <span style="color:#f97316;">${orgName}</span>
              </p>
              <p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.5;">
                <strong style="color:#374151;">${inviterName}</strong> has invited you to join the
                <strong style="color:#374151;">${orgName}</strong> ${contextLabel} on CallVault AI
                as a <strong style="color:#374151;">${formattedRole}</strong>.
              </p>

              <!-- Role Badge -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;padding:10px 16px;">
                    <span style="font-size:13px;color:#c2410c;font-weight:600;">${ContextLabel} Role: ${formattedRole}</span>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center" style="border-radius:8px;background:#f97316;">
                    <a href="${inviteUrl}"
                       style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;letter-spacing:0.2px;">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Fallback URL -->
              <p style="margin:0 0 6px;font-size:12px;color:#9ca3af;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin:0 0 28px;font-size:12px;word-break:break-all;">
                <a href="${inviteUrl}" style="color:#f97316;text-decoration:none;">${inviteUrl}</a>
              </p>

              <!-- Expiry note -->
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">
                This invitation link expires in <strong>7 days</strong>. If you were not expecting this
                invitation, you can safely ignore this email.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="margin:0;font-size:11px;color:#9ca3af;">
                &copy; ${new Date().getFullYear()} CallVault AI &middot;
                <a href="${appUrl}" style="color:#9ca3af;text-decoration:none;">callvaultai.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Build plain-text fallback */
function buildEmailText(
  inviterName: string,
  orgName: string,
  inviteUrl: string,
  role: string,
  context: string
): string {
  const formattedRole = formatRole(role);
  const contextLabel = context === 'workspace' ? 'workspace' : 'organization';
  return [
    `You've been invited to join ${orgName} on CallVault AI`,
    '',
    `${inviterName} has invited you to join the ${orgName} ${contextLabel} as a ${formattedRole}.`,
    '',
    `Accept your invitation here:`,
    inviteUrl,
    '',
    `This link expires in 7 days.`,
    '',
    `If you were not expecting this invitation, you can safely ignore this email.`,
  ].join('\n');
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const appUrl = Deno.env.get('APP_URL') || 'https://app.callvaultai.com';
    const isProduction = Deno.env.get('RESEND_DOMAIN_VERIFIED') === 'true';

    // Authenticate caller
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    const authResult = await authenticateRequest(req, supabaseClient, corsHeaders);
    if (authResult instanceof Response) return authResult;

    // Validate Resend is configured
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'RESEND_API_KEY is not configured. Add it as a Supabase secret.',
          code: 'MISSING_API_KEY',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate body with Zod
    const rawBody = await req.json();
    const validation = sendOrgInviteSchema.safeParse(rawBody);

    if (!validation.success) {
      const errorMessage = validation.error.errors[0]?.message || 'Invalid input';
      return new Response(
        JSON.stringify({ success: false, error: errorMessage, code: 'VALIDATION_ERROR' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { inviteeEmail, inviterName, orgName, inviteUrl, role, context } = validation.data;

    // Build email content
    const subject = `${inviterName} invited you to join ${orgName} on CallVault AI`;
    const htmlBody = buildEmailHtml(inviteeEmail, inviterName, orgName, inviteUrl, role, context, appUrl);
    const textBody = buildEmailText(inviterName, orgName, inviteUrl, role, context);
    const fromAddress = isProduction ? PRODUCTION_FROM : DEFAULT_FROM;

    // Send via Resend
    const resendResponse = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [inviteeEmail],
        subject,
        html: htmlBody,
        text: textBody,
        tags: [
          { name: 'source', value: 'invite' },
          { name: 'context', value: context },
        ],
      }),
    });

    if (!resendResponse.ok) {
      const errorData = await resendResponse.json().catch(() => ({ message: 'Unknown Resend error' }));
      return new Response(
        JSON.stringify({
          success: false,
          error: errorData.message ?? 'Failed to send email',
          code: 'RESEND_ERROR',
        }),
        {
          status: resendResponse.status >= 500 ? 502 : resendResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const resendData = await resendResponse.json();

    return new Response(
      JSON.stringify({ success: true, message_id: resendData.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message, code: 'INTERNAL_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
