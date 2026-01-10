/**
 * AUTOMATION EMAIL EDGE FUNCTION
 *
 * Sends email notifications via Resend API for automation rule actions.
 * Called by the automation-engine's email action executor.
 *
 * Features:
 * - Resend API integration for reliable email delivery
 * - Support for to, cc, bcc recipients
 * - Template variable replacement with {{variable}} syntax
 * - Idempotency key support to prevent duplicate sends
 * - Rate limiting awareness
 * - Unsubscribe link support for compliance
 *
 * Template Variables:
 * Subject and body support variable interpolation using {{variable}} syntax:
 * - {{call.id}}, {{call.title}}, {{call.summary}}, {{call.duration_minutes}}
 * - {{call.participant_count}}, {{call.sentiment}}, {{call.sentiment_confidence}}
 * - {{call.created_at}}
 * - {{category.id}}, {{category.name}}
 * - {{tags}} - comma-separated list of tags
 * - {{rule.id}}, {{rule.name}} - automation rule info
 * - {{date}}, {{datetime}}, {{timestamp}} - current date/time
 * - {{custom.variable_name}} - custom variables from context.custom
 *
 * Environment Variables:
 * - RESEND_API_KEY: API key from resend.com
 * - APP_URL: Application URL for unsubscribe links (optional)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, sentry-trace, baggage, x-idempotency-key',
};

// Resend API configuration
const RESEND_API_URL = 'https://api.resend.com/emails';

// Default sender addresses
// Use onboarding@resend.dev for testing (per Resend docs)
// Use noreply@callvaultai.com after domain verification in production
const DEFAULT_FROM_ADDRESS = 'CallVault AI <onboarding@resend.dev>';
const PRODUCTION_FROM_ADDRESS = 'CallVault AI <noreply@callvaultai.com>';

// Rate limit tracking (in-memory, resets on function cold start)
// For production, this should be stored in Redis or database
const rateLimitTracker = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 95; // Leave buffer under 100/day free tier limit
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Template context for variable interpolation
 * Supports {{variable}} syntax in subject and body
 */
interface TemplateContext {
  // Call data
  call_id?: number;
  call_title?: string;
  call_summary?: string;
  call_duration_minutes?: number;
  call_participant_count?: number;
  call_sentiment?: string;
  call_sentiment_confidence?: number;
  call_created_at?: string;
  // Category data
  category_id?: string;
  category_name?: string;
  // Tags (comma-separated)
  tags?: string;
  // Automation rule data
  automation_rule_id?: string;
  automation_rule_name?: string;
  // Custom variables
  custom?: Record<string, string | number | boolean>;
}

interface EmailRequest {
  to: string | string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  html?: string;
  reply_to?: string;
  user_id?: string;
  context?: TemplateContext;
  include_unsubscribe?: boolean;
  idempotency_key?: string;
  // Test mode: validates request without sending
  test?: boolean;
}

interface ResendEmailPayload {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  text: string;
  html?: string;
  reply_to?: string;
  headers?: Record<string, string>;
  tags?: Array<{ name: string; value: string }>;
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
 * Check if we're under rate limit for a user
 */
function checkRateLimit(userId: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const tracker = rateLimitTracker.get(userId);

  if (!tracker || tracker.resetAt < now) {
    // Start new window
    rateLimitTracker.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
  }

  if (tracker.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0, resetAt: tracker.resetAt };
  }

  // Increment count
  tracker.count += 1;
  return { allowed: true, remaining: RATE_LIMIT_MAX - tracker.count, resetAt: tracker.resetAt };
}

/**
 * Build unsubscribe link for email compliance
 */
function buildUnsubscribeLink(userId: string, automationRuleId?: string): string {
  const appUrl = Deno.env.get('APP_URL') || 'https://app.callvaultai.com';
  const params = new URLSearchParams({
    user_id: userId,
    ...(automationRuleId && { rule_id: automationRuleId }),
  });
  return `${appUrl}/unsubscribe?${params.toString()}`;
}

/**
 * Append unsubscribe footer to email body
 */
function appendUnsubscribeFooter(body: string, unsubscribeLink: string): string {
  return `${body}\n\n---\nTo stop receiving these automated emails, visit: ${unsubscribeLink}`;
}

/**
 * Append unsubscribe footer to HTML email
 */
function appendUnsubscribeFooterHtml(html: string, unsubscribeLink: string): string {
  const footer = `
    <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280;">
      <p>To stop receiving these automated emails, <a href="${unsubscribeLink}" style="color: #3b82f6;">click here to unsubscribe</a>.</p>
    </div>
  `;

  // Try to insert before closing body tag, otherwise append
  if (html.includes('</body>')) {
    return html.replace('</body>', `${footer}</body>`);
  }
  return html + footer;
}

/**
 * Validate email address format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate email request
 */
function validateRequest(request: EmailRequest): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate recipients
  const toRecipients = Array.isArray(request.to) ? request.to : [request.to];
  if (toRecipients.length === 0) {
    errors.push('At least one recipient (to) is required');
  }
  for (const email of toRecipients) {
    if (!isValidEmail(email)) {
      errors.push(`Invalid email address: ${email}`);
    }
  }

  // Validate CC if present
  if (request.cc) {
    for (const email of request.cc) {
      if (!isValidEmail(email)) {
        errors.push(`Invalid CC email address: ${email}`);
      }
    }
  }

  // Validate BCC if present
  if (request.bcc) {
    for (const email of request.bcc) {
      if (!isValidEmail(email)) {
        errors.push(`Invalid BCC email address: ${email}`);
      }
    }
  }

  // Validate subject
  if (!request.subject || request.subject.trim().length === 0) {
    errors.push('Subject is required');
  }
  if (request.subject && request.subject.length > 998) {
    errors.push('Subject must be less than 998 characters');
  }

  // Validate body
  if (!request.body && !request.html) {
    errors.push('Either body (text) or html content is required');
  }

  // Validate reply_to if present
  if (request.reply_to && !isValidEmail(request.reply_to)) {
    errors.push(`Invalid reply_to email address: ${request.reply_to}`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Replace template variables in strings with context values
 * Supports syntax: {{variable.path}}
 *
 * Available variables:
 * - {{call.id}}, {{call.title}}, {{call.summary}}, {{call.duration_minutes}}
 * - {{call.participant_count}}, {{call.sentiment}}, {{call.sentiment_confidence}}
 * - {{call.created_at}}
 * - {{category.id}}, {{category.name}}
 * - {{tags}} - comma-separated list of tags
 * - {{rule.id}}, {{rule.name}} - automation rule info
 * - {{date}}, {{datetime}}, {{timestamp}} - current date/time
 * - {{custom.variable_name}} - custom variables from context.custom
 */
function replaceTemplateVariables(template: string, context?: TemplateContext): string {
  if (!template || !context) {
    return template || '';
  }

  let result = template;

  // Call data variables
  result = result
    .replace(/\{\{call\.id\}\}/gi, String(context.call_id ?? ''))
    .replace(/\{\{call\.title\}\}/gi, context.call_title ?? '')
    .replace(/\{\{call\.summary\}\}/gi, context.call_summary ?? '')
    .replace(/\{\{call\.duration_minutes\}\}/gi, String(context.call_duration_minutes ?? ''))
    .replace(/\{\{call\.participant_count\}\}/gi, String(context.call_participant_count ?? ''))
    .replace(/\{\{call\.sentiment\}\}/gi, context.call_sentiment ?? '')
    .replace(/\{\{call\.sentiment_confidence\}\}/gi, String(context.call_sentiment_confidence ?? ''))
    .replace(/\{\{call\.created_at\}\}/gi, context.call_created_at ?? '');

  // Category variables
  result = result
    .replace(/\{\{category\.id\}\}/gi, context.category_id ?? '')
    .replace(/\{\{category\.name\}\}/gi, context.category_name ?? '');

  // Tags list
  result = result.replace(/\{\{tags\}\}/gi, context.tags ?? '');

  // Automation rule variables
  result = result
    .replace(/\{\{rule\.id\}\}/gi, context.automation_rule_id ?? '')
    .replace(/\{\{rule\.name\}\}/gi, context.automation_rule_name ?? '');

  // Date/time variables (generated at send time)
  const now = new Date();
  result = result
    .replace(/\{\{date\}\}/gi, now.toISOString().split('T')[0])
    .replace(/\{\{datetime\}\}/gi, now.toISOString())
    .replace(/\{\{timestamp\}\}/gi, String(now.getTime()));

  // Custom variables from context.custom
  if (context.custom) {
    for (const [key, value] of Object.entries(context.custom)) {
      const regex = new RegExp(`\\{\\{custom\\.${escapeRegExp(key)}\\}\\}`, 'gi');
      result = result.replace(regex, String(value ?? ''));
    }
  }

  // Clean up any remaining unmatched template variables (replace with empty string)
  // This prevents {{unknown.variable}} from appearing in the final email
  result = result.replace(/\{\{[a-zA-Z_][a-zA-Z0-9_.]*\}\}/g, '');

  return result;
}

/**
 * Escape special regex characters in a string
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check idempotency to prevent duplicate sends
 */
async function checkIdempotency(
  supabase: ReturnType<typeof createClient>,
  idempotencyKey: string
): Promise<{ isDuplicate: boolean; existingMessageId?: string }> {
  // Check if we've already processed this idempotency key
  const { data } = await supabase
    .from('automation_email_log')
    .select('resend_message_id')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();

  if (data) {
    return { isDuplicate: true, existingMessageId: data.resend_message_id };
  }

  return { isDuplicate: false };
}

/**
 * Log email send attempt
 */
async function logEmailSend(
  supabase: ReturnType<typeof createClient>,
  request: EmailRequest,
  result: { success: boolean; message_id?: string; error?: string },
  idempotencyKey?: string
): Promise<void> {
  try {
    await supabase.from('automation_email_log').insert({
      user_id: request.user_id,
      to_addresses: Array.isArray(request.to) ? request.to : [request.to],
      subject: request.subject,
      automation_rule_id: request.context?.automation_rule_id,
      call_id: request.context?.call_id,
      resend_message_id: result.message_id,
      success: result.success,
      error_message: result.error,
      idempotency_key: idempotencyKey,
      sent_at: new Date().toISOString(),
    });
  } catch {
    // Logging failure shouldn't break email sending
    // The table might not exist in some environments
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create Supabase client for logging
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const request: EmailRequest = await req.json();

    // Handle test mode (health check)
    if (request.test === true) {
      const hasApiKey = !!resendApiKey;
      return new Response(
        JSON.stringify({
          success: true,
          message: 'automation-email function is operational',
          resend_configured: hasApiKey,
          default_from: DEFAULT_FROM_ADDRESS,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate API key is configured
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'RESEND_API_KEY not configured',
          code: 'MISSING_API_KEY',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate request
    const validation = validateRequest(request);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Validation failed',
          details: validation.errors,
          code: 'VALIDATION_ERROR',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check rate limit
    const userId = request.user_id || 'anonymous';
    const rateLimit = checkRateLimit(userId);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
          reset_at: new Date(rateLimit.resetAt).toISOString(),
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.floor(rateLimit.resetAt / 1000)),
          },
        }
      );
    }

    // Check idempotency if key provided
    const idempotencyKey = request.idempotency_key || req.headers.get('x-idempotency-key');
    if (idempotencyKey) {
      const idempotencyCheck = await checkIdempotency(supabase, idempotencyKey);
      if (idempotencyCheck.isDuplicate) {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Email already sent (idempotent)',
            message_id: idempotencyCheck.existingMessageId,
            duplicate: true,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Prepare recipients
    const toRecipients = Array.isArray(request.to) ? request.to : [request.to];

    // Determine sender address based on environment
    const isProduction = Deno.env.get('RESEND_DOMAIN_VERIFIED') === 'true';
    const fromAddress = isProduction ? PRODUCTION_FROM_ADDRESS : DEFAULT_FROM_ADDRESS;

    // Build unsubscribe link if requested
    const includeUnsubscribe = request.include_unsubscribe !== false;
    const unsubscribeLink = includeUnsubscribe
      ? buildUnsubscribeLink(userId, request.context?.automation_rule_id)
      : null;

    // Apply template variable replacement to subject and body
    // This replaces {{call.title}}, {{category.name}}, etc. with actual values
    const templateContext = request.context;
    const renderedSubject = replaceTemplateVariables(request.subject, templateContext);
    let textBody = replaceTemplateVariables(request.body, templateContext);
    let htmlBody = request.html ? replaceTemplateVariables(request.html, templateContext) : undefined;

    if (unsubscribeLink) {
      textBody = appendUnsubscribeFooter(textBody, unsubscribeLink);
      if (htmlBody) {
        htmlBody = appendUnsubscribeFooterHtml(htmlBody, unsubscribeLink);
      }
    }

    // Build Resend API payload
    const emailPayload: ResendEmailPayload = {
      from: fromAddress,
      to: toRecipients,
      subject: renderedSubject,
      text: textBody,
    };

    if (htmlBody) {
      emailPayload.html = htmlBody;
    }

    if (request.cc && request.cc.length > 0) {
      emailPayload.cc = request.cc;
    }

    if (request.bcc && request.bcc.length > 0) {
      emailPayload.bcc = request.bcc;
    }

    if (request.reply_to) {
      emailPayload.reply_to = request.reply_to;
    }

    // Add List-Unsubscribe header for email clients
    if (unsubscribeLink) {
      emailPayload.headers = {
        'List-Unsubscribe': `<${unsubscribeLink}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      };
    }

    // Add tags for tracking
    emailPayload.tags = [
      { name: 'source', value: 'automation' },
      ...(request.context?.automation_rule_id
        ? [{ name: 'rule_id', value: request.context.automation_rule_id }]
        : []),
      ...(request.context?.call_id
        ? [{ name: 'call_id', value: String(request.context.call_id) }]
        : []),
    ];

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

      // Log failed attempt
      await logEmailSend(
        supabase,
        request,
        { success: false, error: errorData.message },
        idempotencyKey || undefined
      );

      return new Response(
        JSON.stringify({
          success: false,
          error: errorData.message,
          code: errorData.name || 'RESEND_ERROR',
          status: resendResponse.status,
        }),
        {
          status: resendResponse.status >= 500 ? 502 : resendResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const resendData: ResendResponse = await resendResponse.json();

    // Log successful send
    await logEmailSend(
      supabase,
      request,
      { success: true, message_id: resendData.id },
      idempotencyKey || undefined
    );

    return new Response(
      JSON.stringify({
        success: true,
        message_id: resendData.id,
        recipients: toRecipients.length,
        rate_limit_remaining: rateLimit.remaining,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-RateLimit-Remaining': String(rateLimit.remaining),
          'X-RateLimit-Reset': String(Math.floor(rateLimit.resetAt / 1000)),
        },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        code: 'INTERNAL_ERROR',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
