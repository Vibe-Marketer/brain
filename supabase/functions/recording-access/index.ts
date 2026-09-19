import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';

import { authenticateRequest } from '../_shared/auth.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { escapeHtml } from '../_shared/html-escape.ts';

const RESEND_API_URL = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'CallVault AI <onboarding@resend.dev>';
const PRODUCTION_FROM = 'CallVault AI <noreply@mail.callvaultai.com>';
const TEST_PROJECT_REF = 'swjzxiddcrtaqixsfaac';
const APP_ORIGIN = 'https://app.callvaultai.com';
const CLAIM_TIMEOUT_MS = 5 * 60_000;
const RETRY_DELAY_MS = 60_000;

const requestSchema = z.object({
  request_id: z.string().uuid(),
}).strict();

type JsonRecord = Record<string, unknown>;

interface TrustedRequest {
  id: string;
  recording_id: string;
  requester_user_id: string;
  requester_verified_email: string;
  requester_name: string | null;
  evidence: unknown;
  recordings: {
    owner_user_id: string;
    title: string | null;
    recording_start_time: string | null;
    created_at: string;
  };
}

interface OutboxRow {
  id: string;
  request_id: string | null;
  recipient_email: string | null;
  status: string;
  attempt_count: number;
  idempotency_key: string;
  next_attempt_at: string | null;
  last_attempt_at: string | null;
}

function jsonResponse(
  body: JsonRecord,
  status: number,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function evidenceSummary(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return 'Verified as a confirmed participant in this meeting.';
  }

  const evidence = value as JsonRecord;
  const sources = Array.isArray(evidence.sources)
    ? evidence.sources.filter((source): source is string => typeof source === 'string')
    : [];
  if (evidence.has_confirmed_speech === true || sources.includes('transcript') || sources.includes('transcript_speaker')) {
    return 'Verified through confirmed participation in the meeting transcript.';
  }
  if (evidence.participant_type === 'host' || evidence.participant_role === 'organizer' || sources.includes('recorded_by')) {
    return 'Verified as a host or organizer of the meeting.';
  }
  return 'Verified as a confirmed participant in this meeting.';
}

function formatMeetingDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return date.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  });
}

function buildOwnerEmail(input: {
  requesterName: string;
  requesterEmail: string;
  meetingTitle: string;
  meetingDate: string;
  evidence: string;
  reviewUrl: string;
}) {
  const requesterName = escapeHtml(input.requesterName);
  const requesterEmail = escapeHtml(input.requesterEmail);
  const meetingTitle = escapeHtml(input.meetingTitle);
  const meetingDate = escapeHtml(input.meetingDate);
  const evidence = escapeHtml(input.evidence);
  const reviewUrl = escapeHtml(input.reviewUrl);
  const subject = `Access requested for “${input.meetingTitle}”`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;background:#f9fafb;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;">
        <tr><td style="padding:36px;">
          <p style="margin:0 0 12px;font-size:20px;font-weight:700;">Access requested</p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#4b5563;">${requesterName} requested access to “${meetingTitle}”.</p>
          <p style="margin:0 0 8px;font-size:14px;"><strong>Requester:</strong> ${requesterName}</p>
          <p style="margin:0 0 8px;font-size:14px;"><strong>Verified email:</strong> ${requesterEmail}</p>
          <p style="margin:0 0 8px;font-size:14px;"><strong>Meeting:</strong> ${meetingTitle}</p>
          <p style="margin:0 0 8px;font-size:14px;"><strong>Meeting date:</strong> ${meetingDate}</p>
          <p style="margin:0 0 28px;font-size:14px;"><strong>Verified participant evidence:</strong> ${evidence}</p>
          <a href="${reviewUrl}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#111827;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;">Review request</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    'Access requested',
    '',
    `${input.requesterName} requested access to “${input.meetingTitle}”.`,
    `Verified email: ${input.requesterEmail}`,
    `Meeting date: ${input.meetingDate}`,
    `Verified participant evidence: ${input.evidence}`,
    '',
    `Review request: ${input.reviewUrl}`,
  ].join('\n');

  return { subject, html, text };
}

function isDedicatedTestProject(supabaseUrl: string): boolean {
  try {
    return new URL(supabaseUrl).hostname === `${TEST_PROJECT_REF}.supabase.co`;
  } catch {
    return false;
  }
}

async function deliverEmail(input: {
  supabaseUrl: string;
  resendApiKey: string | undefined;
  recipientEmail: string;
  idempotencyKey: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  const testMode = isDedicatedTestProject(input.supabaseUrl)
    ? Deno.env.get('RECORDING_ACCESS_EMAIL_TEST_MODE')
    : null;

  if (testMode === 'success') return;
  if (testMode === 'failure') throw new Error('EMAIL_PROVIDER_UNAVAILABLE');
  if (!input.resendApiKey) throw new Error('EMAIL_PROVIDER_UNAVAILABLE');

  const isProduction = Deno.env.get('RESEND_DOMAIN_VERIFIED') === 'true';
  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.resendApiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': input.idempotencyKey,
    },
    body: JSON.stringify({
      from: isProduction ? PRODUCTION_FROM : DEFAULT_FROM,
      to: [input.recipientEmail],
      subject: input.subject,
      html: input.html,
      text: input.text,
      tags: [{ name: 'source', value: 'recording-access-request' }],
    }),
  });

  if (!response.ok) throw new Error('EMAIL_PROVIDER_UNAVAILABLE');
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('Origin'));
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') {
    return jsonResponse({ code: 'METHOD_NOT_ALLOWED', error: 'Method not allowed.' }, 405, corsHeaders);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const authClient = createClient(supabaseUrl, anonKey);
    const authResult = await authenticateRequest(req, authClient, corsHeaders);
    if (authResult instanceof Response) {
      const body = await authResult.clone().json().catch(() => ({}));
      return jsonResponse({ code: 'UNAUTHORIZED', error: (body as JsonRecord).error ?? 'Unauthorized.' }, 401, corsHeaders);
    }

    const rawBody = await req.json().catch(() => null);
    const parsed = requestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonResponse({ code: 'INVALID_REQUEST', error: 'A valid request ID is required.' }, 400, corsHeaders);
    }

    // The service-role client is deliberately created only after authentication.
    const service = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: requestRow, error: requestError } = await service
      .from('recording_access_requests')
      .select(`
        id,
        recording_id,
        requester_user_id,
        requester_verified_email,
        requester_name,
        evidence,
        recordings!inner(owner_user_id, title, recording_start_time, created_at)
      `)
      .eq('id', parsed.data.request_id)
      .maybeSingle();

    const trustedRequest = requestRow as TrustedRequest | null;
    if (
      requestError ||
      !trustedRequest ||
      ![trustedRequest.requester_user_id, trustedRequest.recordings.owner_user_id].includes(authResult.userId)
    ) {
      return jsonResponse(
        { code: 'REQUEST_NOT_AVAILABLE', error: 'This access request is no longer available.' },
        404,
        corsHeaders,
      );
    }

    const { data: outboxData, error: outboxError } = await service
      .from('recording_access_email_outbox')
      .select('id, request_id, recipient_email, status, attempt_count, idempotency_key, next_attempt_at, last_attempt_at')
      .eq('request_id', trustedRequest.id)
      .eq('delivery_kind', 'owner_request_review')
      .maybeSingle();
    const outbox = outboxData as OutboxRow | null;
    if (outboxError || !outbox || !outbox.recipient_email) {
      return jsonResponse({ code: 'DELIVERY_NOT_AVAILABLE', error: 'Email delivery is not available.' }, 202, corsHeaders);
    }
    if (outbox.status === 'sent') {
      return jsonResponse({ success: true, status: 'sent', request_id: trustedRequest.id }, 200, corsHeaders);
    }

    const now = new Date();
    const nextAttempt = outbox.next_attempt_at ? new Date(outbox.next_attempt_at) : null;
    const lastAttempt = outbox.last_attempt_at ? new Date(outbox.last_attempt_at) : null;
    const activeClaim = outbox.status === 'processing' &&
      lastAttempt !== null &&
      now.getTime() - lastAttempt.getTime() < CLAIM_TIMEOUT_MS;
    const waitingForRetry = outbox.status === 'failed' &&
      nextAttempt !== null &&
      nextAttempt.getTime() > now.getTime();
    if (activeClaim || waitingForRetry) {
      return jsonResponse({ success: true, status: 'delivery_pending', request_id: trustedRequest.id }, 202, corsHeaders);
    }

    const claimedAt = now.toISOString();
    const { data: claimedData, error: claimError } = await service
      .from('recording_access_email_outbox')
      .update({
        status: 'processing',
        attempt_count: outbox.attempt_count + 1,
        last_attempt_at: claimedAt,
        next_attempt_at: null,
        last_error: null,
        updated_at: claimedAt,
      })
      .eq('id', outbox.id)
      .eq('status', outbox.status)
      .eq('attempt_count', outbox.attempt_count)
      .select('id')
      .maybeSingle();
    if (claimError) throw new Error('OUTBOX_CLAIM_FAILED');
    if (!claimedData) {
      return jsonResponse({ success: true, status: 'delivery_pending', request_id: trustedRequest.id }, 202, corsHeaders);
    }

    const requesterName = trustedRequest.requester_name?.trim() || 'A confirmed participant';
    const meetingTitle = trustedRequest.recordings.title?.trim() || 'Untitled meeting';
    const meetingDate = formatMeetingDate(
      trustedRequest.recordings.recording_start_time ?? trustedRequest.recordings.created_at,
    );
    const evidence = evidenceSummary(trustedRequest.evidence);
    const reviewUrl = `${APP_ORIGIN}/calls/${encodeURIComponent(trustedRequest.recording_id)}?accessRequest=${encodeURIComponent(trustedRequest.id)}`;
    const email = buildOwnerEmail({
      requesterName,
      requesterEmail: trustedRequest.requester_verified_email,
      meetingTitle,
      meetingDate,
      evidence,
      reviewUrl,
    });

    const payloadSnapshot = {
      subject: escapeHtml(email.subject),
      html: email.html,
      text: escapeHtml(email.text),
      review_url: escapeHtml(reviewUrl),
    };
    await service
      .from('recording_access_email_outbox')
      .update({ payload_snapshot: payloadSnapshot, updated_at: claimedAt })
      .eq('id', outbox.id)
      .eq('status', 'processing');

    await service
      .from('user_notifications')
      .update({
        title: 'Access requested',
        body: `${requesterName} requested access to “${meetingTitle}”.`,
      })
      .eq('user_id', trustedRequest.recordings.owner_user_id)
      .eq('type', 'recording_access_requested')
      .contains('metadata', { request_id: trustedRequest.id });

    try {
      await deliverEmail({
        supabaseUrl,
        resendApiKey: Deno.env.get('RESEND_API_KEY'),
        recipientEmail: outbox.recipient_email,
        idempotencyKey: outbox.idempotency_key,
        ...email,
      });
      const sentAt = new Date().toISOString();
      const { error: sentError } = await service
        .from('recording_access_email_outbox')
        .update({
          status: 'sent',
          sent_at: sentAt,
          next_attempt_at: null,
          last_error: null,
          updated_at: sentAt,
        })
        .eq('id', outbox.id)
        .eq('status', 'processing');
      if (sentError) throw new Error('OUTBOX_FINALIZE_FAILED');
      return jsonResponse({ success: true, status: 'sent', request_id: trustedRequest.id }, 200, corsHeaders);
    } catch {
      const failedAt = new Date();
      await service
        .from('recording_access_email_outbox')
        .update({
          status: 'failed',
          next_attempt_at: new Date(failedAt.getTime() + RETRY_DELAY_MS).toISOString(),
          last_error: 'EMAIL_PROVIDER_UNAVAILABLE',
          updated_at: failedAt.toISOString(),
        })
        .eq('id', outbox.id)
        .eq('status', 'processing');
      return jsonResponse({
        success: true,
        status: 'delivery_pending',
        request_id: trustedRequest.id,
      }, 202, corsHeaders);
    }
  } catch {
    console.error('recording-access request failed', { code: 'INTERNAL_ERROR' });
    return jsonResponse({ code: 'INTERNAL_ERROR', error: 'Unable to process this access request.' }, 500, corsHeaders);
  }
});
