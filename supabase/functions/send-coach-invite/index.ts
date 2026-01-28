/**
 * SEND COACH INVITE EDGE FUNCTION
 *
 * Sends email invitations to coaches via Resend API.
 * Called when a user invites someone to be their coach.
 *
 * Features:
 * - Resend API integration for reliable email delivery
 * - Personalized invitation email with accept link
 * - Error handling and validation
 *
 * Environment Variables:
 * - RESEND_API_KEY: API key from resend.com
 * - APP_URL: Application URL for invite links
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

// Resend API configuration
const RESEND_API_URL = 'https://api.resend.com/emails';

// Default sender addresses
const DEFAULT_FROM_ADDRESS = 'CallVault AI <onboarding@resend.dev>';
const PRODUCTION_FROM_ADDRESS = 'CallVault AI <noreply@mail.callvaultai.com>';

interface InviteRequest {
  coach_email: string;
  invite_token: string;
  inviter_email?: string;
  inviter_name?: string;
}

interface ResendEmailPayload {
  from: string;
  to: string[];
  subject: string;
  text: string;
  html: string;
  reply_to?: string;
}

interface ResendResponse {
  id: string;
}

interface ResendErrorResponse {
  statusCode: number;
  message: string;
  name: string;
}

/**
 * Validate email address format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Generate the invitation email body
 */
function generateEmailBody(inviteToken: string, inviterEmail?: string): { text: string; html: string } {
  const appUrl = Deno.env.get('APP_URL') || 'https://app.callvaultai.com';
  const inviteUrl = `${appUrl}/coach/join/${inviteToken}`;
  const inviterText = inviterEmail ? `from ${inviterEmail}` : '';

  const text = `
You've been invited ${inviterText} to become a coach on CallVault AI!

As a coach, you'll be able to view shared calls and provide valuable feedback to help improve communication skills.

To accept this invitation, click the link below:
${inviteUrl}

This invitation will expire in 30 days.

If you didn't expect this invitation, you can safely ignore this email.

---
CallVault AI - AI-powered call analysis and coaching
  `.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 32px; margin-bottom: 24px;">
    <h1 style="color: #1a1a1a; font-size: 24px; font-weight: 600; margin: 0 0 16px 0;">
      You're Invited to Be a Coach!
    </h1>
    <p style="color: #4a5568; font-size: 16px; margin: 0 0 24px 0;">
      ${inviterEmail ? `<strong>${inviterEmail}</strong> has invited you` : 'You\'ve been invited'} to become a coach on CallVault AI.
    </p>
    <p style="color: #4a5568; font-size: 16px; margin: 0 0 24px 0;">
      As a coach, you'll be able to:
    </p>
    <ul style="color: #4a5568; font-size: 16px; margin: 0 0 24px 0; padding-left: 24px;">
      <li>View calls shared with you</li>
      <li>Leave private coaching notes</li>
      <li>Help improve communication skills</li>
    </ul>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${inviteUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 500; font-size: 16px;">
        Accept Invitation
      </a>
    </div>
    <p style="color: #718096; font-size: 14px; margin: 24px 0 0 0;">
      This invitation will expire in 30 days.
    </p>
  </div>
  <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 24px;">
    <p style="color: #a0aec0; font-size: 12px; margin: 0;">
      If you didn't expect this invitation, you can safely ignore this email.
    </p>
    <p style="color: #a0aec0; font-size: 12px; margin: 8px 0 0 0;">
      <strong>CallVault AI</strong> - AI-powered call analysis and coaching
    </p>
  </div>
</body>
</html>
  `.trim();

  return { text, html };
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate API key is configured
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'RESEND_API_KEY not configured',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const request: InviteRequest = await req.json();

    // Validate email
    if (!request.coach_email || !isValidEmail(request.coach_email)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid email address',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate invite token
    if (!request.invite_token || request.invite_token.length < 20) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid invite token',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine sender address based on environment
    const isProduction = Deno.env.get('RESEND_DOMAIN_VERIFIED') === 'true';
    const fromAddress = isProduction ? PRODUCTION_FROM_ADDRESS : DEFAULT_FROM_ADDRESS;

    // Generate email body
    const { text, html } = generateEmailBody(
      request.invite_token,
      request.inviter_email || user.email
    );

    // Build Resend API payload
    const emailPayload: ResendEmailPayload = {
      from: fromAddress,
      to: [request.coach_email],
      subject: 'You\'re invited to be a coach on CallVault AI',
      text,
      html,
    };

    // Send email via Resend API
    const resendResponse = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });

    if (!resendResponse.ok) {
      const errorData: ResendErrorResponse = await resendResponse.json();

      console.error('Resend API error:', errorData);

      return new Response(
        JSON.stringify({
          success: false,
          error: errorData.message || 'Failed to send email',
          code: errorData.name || 'RESEND_ERROR',
        }),
        {
          status: resendResponse.status >= 500 ? 502 : resendResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const resendData: ResendResponse = await resendResponse.json();

    console.log('Coach invite email sent:', {
      to: request.coach_email,
      message_id: resendData.id,
      user_id: user.id,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message_id: resendData.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in send-coach-invite:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
