/**
 * REQUEST EMAIL ALIAS VERIFICATION EDGE FUNCTION (Phase 34, Plan 03, IDENT-03)
 *
 * Lets a signed-in user request a 6-digit verification code for an email
 * address they do not yet have verified, so it can later be added to their
 * identity as a verified `identity_aliases` row (see
 * confirm-email-alias-verification). This NEVER calls Supabase Auth's
 * updateUser/verifyOtp and never touches the session -- Supabase Auth is
 * one-email-per-account, so changing the account email there would replace
 * the login email rather than add a second one (34-RESEARCH.md Pitfall 1).
 * Instead this reuses the existing Resend HTTP integration (mirrors
 * send-org-invite/index.ts) and a small hashed-OTP table
 * (identity_alias_verifications, service-role-only, client-deny RLS).
 *
 * Security:
 * - T-34-03-01: code is generated via crypto.getRandomValues() (CSPRNG,
 *   otp.ts), never Math.random(); only a SHA-256 hash is stored; 10-minute
 *   expiry; the 5-attempt cap is enforced by confirm-email-alias-verification.
 * - T-34-03-02: a per-user RateLimiter (below) bounds email-bombing --
 *   at most maxRequests requests per user per windowMs, plus a short
 *   per-address resend cooldown. UNIQUE(user_id, email) also coalesces
 *   repeated requests for the same address into one row.
 * - T-34-03-03: the response never includes the code.
 * - T-34-03-05: rejects a request for an email already verified on a
 *   DIFFERENT identity, before ever sending a code.
 *
 * Accepts POST with: { email: string }
 *
 * Environment Variables:
 * - RESEND_API_KEY, RESEND_DOMAIN_VERIFIED (already configured project-wide,
 *   same secrets send-org-invite uses -- no new secret for this function)
 */

import { z } from 'https://esm.sh/zod@3.23.8';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { authenticateRequest } from '../_shared/auth.ts';
import { escapeHtml } from '../_shared/html-escape.ts';
import { generateCode, hashCode } from '../_shared/otp.ts';

const RESEND_API_URL = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'CallVault AI <onboarding@resend.dev>';
const PRODUCTION_FROM = 'CallVault AI <noreply@mail.callvaultai.com>';

const CODE_EXPIRY_MS = 10 * 60_000; // 10 minutes

/**
 * Per-user request rate limit (T-34-03-02). Mirrors this repo's existing
 * `RateLimiter` class shape (maxRequests / windowMs -- see
 * sync-meetings/index.ts, zoom-sync-meetings/index.ts, and
 * supabase/CLAUDE.md's OWASP "Rate Limiting" section), adapted to be
 * DB-backed rather than in-memory: those existing RateLimiters throttle
 * outbound calls to an external API *within a single function invocation*,
 * but edge functions are stateless across invocations -- an in-memory
 * counter here would reset on every HTTP request and enforce nothing. Two
 * checks, both against identity_alias_verifications (no new table needed):
 *   1. Resend cooldown -- reject a repeat request for the SAME (user, email)
 *      within resendCooldownMs of the last one.
 *   2. Window cap -- reject once this user has made maxRequests requests
 *      (any target email) within windowMs.
 */
class RateLimiter {
  private readonly maxRequests = 5;
  private readonly windowMs = 60 * 60_000; // 1 hour
  private readonly resendCooldownMs = 60_000; // 60 seconds

  constructor(private readonly supabase: ReturnType<typeof createClient>) {}

  /** Returns null if the request is allowed, or a user-facing reason string if it should be denied. */
  async check(userId: string, email: string): Promise<string | null> {
    const windowStart = new Date(Date.now() - this.windowMs).toISOString();

    const { count, error: countError } = await this.supabase
      .from('identity_alias_verifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', windowStart);

    if (countError) {
      throw new Error(`rate_limit count query failed: ${countError.message}`);
    }
    if ((count ?? 0) >= this.maxRequests) {
      return 'Too many verification requests. Please try again later.';
    }

    const cooldownStart = new Date(Date.now() - this.resendCooldownMs).toISOString();
    const { data: recent, error: recentError } = await this.supabase
      .from('identity_alias_verifications')
      .select('id')
      .eq('user_id', userId)
      .eq('email', email)
      .gte('created_at', cooldownStart)
      .maybeSingle();

    if (recentError) {
      throw new Error(`rate_limit cooldown query failed: ${recentError.message}`);
    }
    if (recent) {
      return 'Please wait a moment before requesting another code for this email.';
    }

    return null;
  }
}

const requestSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address').max(254),
});

function buildEmailHtml(code: string): string {
  const safeCode = escapeHtml(code);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify your email for CallVault AI</title>
</head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <span style="font-size:22px;font-weight:700;color:#1f2937;letter-spacing:-0.5px;">CallVault AI</span>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;padding:40px 36px;">
              <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:#111827;">Verify this email address</p>
              <p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.5;">
                Enter this code to confirm you own this email address on CallVault AI.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:16px 24px;">
                    <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#c2410c;">${safeCode}</span>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">
                This code expires in 10 minutes. If you did not request this, you can safely ignore this email.
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

function buildEmailText(code: string): string {
  return [
    'Verify this email address on CallVault AI',
    '',
    `Your verification code: ${code}`,
    '',
    'This code expires in 10 minutes.',
    '',
    'If you did not request this, you can safely ignore this email.',
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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const isProduction = Deno.env.get('RESEND_DOMAIN_VERIFIED') === 'true';

    // Authenticate against the anon client first (standard pattern).
    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const authResult = await authenticateRequest(req, authClient, corsHeaders);
    if (authResult instanceof Response) return authResult;
    const { userId, user } = authResult;

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'RESEND_API_KEY is not configured.', code: 'MISSING_API_KEY' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rawBody = await req.json();
    const validation = requestSchema.safeParse(rawBody);
    if (!validation.success) {
      const errorMessage = validation.error.errors[0]?.message || 'Invalid input';
      return new Response(
        JSON.stringify({ success: false, error: errorMessage, code: 'VALIDATION_ERROR' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const { email } = validation.data;

    // Service-role client for everything after auth -- writes to a
    // client-deny table and reads across users for the double-claim check.
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const ownEmail = (user.email || '').trim().toLowerCase();
    if (ownEmail && email === ownEmail) {
      return new Response(
        JSON.stringify({ success: false, error: 'This is already your account email.', code: 'ALREADY_OWN_EMAIL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Reject if already a verified alias on a DIFFERENT identity (T-34-03-05)
    // -- no point sending a code that confirm would reject anyway.
    const existingAlias = await supabase
      .from('identity_aliases')
      .select('identity_id')
      .eq('alias_type', 'email')
      .eq('value', email)
      .eq('verified', true)
      .maybeSingle();

    if (existingAlias.error) {
      throw new Error(`Failed to check existing alias: ${existingAlias.error.message}`);
    }

    if (existingAlias.data) {
      const identityRow = await supabase
        .from('identities')
        .select('owner_user_id')
        .eq('id', existingAlias.data.identity_id)
        .maybeSingle();
      if (identityRow.error) {
        throw new Error(`Failed to check identity ownership: ${identityRow.error.message}`);
      }
      if (identityRow.data?.owner_user_id !== userId) {
        return new Response(
          JSON.stringify({ success: false, error: 'This email is already verified on another account.', code: 'ALREADY_CLAIMED' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Per-user rate limit (T-34-03-02).
    const rateLimiter = new RateLimiter(supabase);
    const denyReason = await rateLimiter.check(userId, email);
    if (denyReason) {
      return new Response(
        JSON.stringify({ success: false, error: denyReason, code: 'RATE_LIMITED' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const code = generateCode();
    const codeHash = await hashCode(code);
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MS).toISOString();

    const upsert = await supabase
      .from('identity_alias_verifications')
      .upsert(
        { user_id: userId, email, code_hash: codeHash, expires_at: expiresAt, attempts: 0 },
        { onConflict: 'user_id,email' }
      );

    if (upsert.error) {
      throw new Error(`Failed to store verification code: ${upsert.error.message}`);
    }

    const fromAddress = isProduction ? PRODUCTION_FROM : DEFAULT_FROM;
    const resendResponse = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [email],
        subject: 'Verify your email for CallVault AI',
        html: buildEmailHtml(code),
        text: buildEmailText(code),
        tags: [{ name: 'source', value: 'identity-alias-verification' }],
      }),
    });

    if (!resendResponse.ok) {
      const errorData = await resendResponse.json().catch(() => ({ message: 'Unknown Resend error' }));
      return new Response(
        JSON.stringify({ success: false, error: errorData.message ?? 'Failed to send email', code: 'RESEND_ERROR' }),
        { status: resendResponse.status >= 500 ? 502 : resendResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Never return the code in the response body (T-34-03-03).
    return new Response(
      JSON.stringify({ success: true, message: 'Verification code sent.' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Error in request-email-alias-verification:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message, code: 'INTERNAL_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
