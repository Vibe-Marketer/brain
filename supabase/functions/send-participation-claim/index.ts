import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';

import { authenticateRequest } from '../_shared/auth.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import {
  buildParticipationClaimUrl,
  renderParticipationClaimEmail,
  type ParticipationClaimEmail,
} from '../_shared/participation-claim-email.ts';

const RESEND_API_URL = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'CallVault AI <onboarding@resend.dev>';
const PRODUCTION_FROM = 'CallVault AI <noreply@mail.callvaultai.com>';
const TEST_PROJECT_REF = 'swjzxiddcrtaqixsfaac';
const REMINDER_LEAD_MS = 24 * 60 * 60_000;

const sendRequestSchema = z.object({
  participant_id: z.string().uuid(),
  send_one_reminder: z.boolean().optional().default(false),
}).strict();

const cancelReminderRequestSchema = z.object({
  action: z.literal('cancel_reminder'),
  participant_id: z.string().uuid(),
}).strict();

const requestSchema = z.union([sendRequestSchema, cancelReminderRequestSchema]);

type JsonRecord = Record<string, unknown>;

interface InvitationRpcRow {
  invitation_id: string;
  invited_email: string;
  expires_at: string;
  reminder_opt_in: boolean;
  rotated: boolean;
}

interface ExistingInvitation {
  id: string;
  recording_id: string;
  sent_at: string;
  delivery_status: string;
  reminder_provider_id: string | null;
  reminder_cancelled_at: string | null;
}

function jsonResponse(body: JsonRecord, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isDedicatedTestProject(supabaseUrl: string): boolean {
  try {
    return new URL(supabaseUrl).hostname === `${TEST_PROJECT_REF}.supabase.co`;
  } catch {
    return false;
  }
}

function newRawToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sendEmail(input: {
  supabaseUrl: string;
  resendApiKey: string | undefined;
  recipient: string;
  invitationId: string;
  kind: 'initial' | 'reminder';
  email: ParticipationClaimEmail;
  scheduledAt?: string;
}): Promise<string> {
  const testMode = isDedicatedTestProject(input.supabaseUrl)
    ? Deno.env.get('PARTICIPATION_CLAIM_EMAIL_TEST_MODE')
    : null;
  if (testMode === 'success') return `test-${input.kind}-${input.invitationId}`;
  if (testMode === 'failure' || !input.resendApiKey) throw new Error('EMAIL_PROVIDER_UNAVAILABLE');

  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.resendApiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `participation-claim/${input.kind}/${input.invitationId}`,
    },
    body: JSON.stringify({
      from: Deno.env.get('RESEND_DOMAIN_VERIFIED') === 'true' ? PRODUCTION_FROM : DEFAULT_FROM,
      to: [input.recipient],
      subject: input.email.subject,
      html: input.email.html,
      text: input.email.text,
      ...(input.scheduledAt ? { scheduled_at: input.scheduledAt } : {}),
      tags: [{ name: 'source', value: `participation-claim-${input.kind}` }],
    }),
  });
  if (!response.ok) throw new Error('EMAIL_PROVIDER_UNAVAILABLE');
  const result = await response.json().catch(() => null) as { id?: unknown } | null;
  if (typeof result?.id !== 'string' || result.id.length === 0) {
    throw new Error('EMAIL_PROVIDER_UNAVAILABLE');
  }
  return result.id;
}

async function cancelScheduledEmail(input: {
  supabaseUrl: string;
  resendApiKey: string | undefined;
  providerId: string;
}): Promise<boolean> {
  const testMode = isDedicatedTestProject(input.supabaseUrl)
    ? Deno.env.get('PARTICIPATION_CLAIM_EMAIL_TEST_MODE')
    : null;
  if (testMode === 'success') return true;
  if (testMode === 'failure' || !input.resendApiKey) return false;
  const response = await fetch(`${RESEND_API_URL}/${encodeURIComponent(input.providerId)}/cancel`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.resendApiKey}`,
      'Content-Type': 'application/json',
    },
  });
  return response.ok;
}

async function latestInvitation(
  service: SupabaseClient,
  participantId: string,
  callerId: string,
): Promise<ExistingInvitation | null> {
  const result = await service
    .from('participation_claim_invitations')
    .select('id,recording_id,sent_at,delivery_status,reminder_provider_id,reminder_cancelled_at')
    .eq('participant_id', participantId)
    .eq('inviter_user_id', callerId)
    .eq('state', 'sent')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (result.error) throw new Error('INVITATION_LOOKUP_FAILED');
  return result.data as ExistingInvitation | null;
}

async function awaitRacedInvitation(
  service: SupabaseClient,
  participantId: string,
  callerId: string,
): Promise<ExistingInvitation | null> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const invitation = await latestInvitation(service, participantId, callerId);
    if (invitation) return invitation;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return null;
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
    if (authResult instanceof Response) return authResult;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json().catch(() => null);
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse({ code: 'INVALID_REQUEST', error: 'Invalid request.' }, 400, corsHeaders);
    }

    const service = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if ('action' in parsed.data) {
      const invitation = await latestInvitation(
        service,
        parsed.data.participant_id,
        authResult.userId,
      );
      if (!invitation) {
        return jsonResponse({
          code: 'PARTICIPATION_INVITATION_NOT_AVAILABLE',
          error: 'This invitation is not available.',
        }, 404, corsHeaders);
      }
      const recording = await service
        .from('recordings')
        .select('owner_user_id')
        .eq('id', invitation.recording_id)
        .maybeSingle();
      if (recording.error || recording.data?.owner_user_id !== authResult.userId) {
        return jsonResponse({
          code: 'PARTICIPATION_INVITATION_NOT_AVAILABLE',
          error: 'This invitation is not available.',
        }, 404, corsHeaders);
      }
      if (invitation.reminder_cancelled_at || !invitation.reminder_provider_id) {
        return jsonResponse({ success: true, status: 'reminder_canceled' }, 200, corsHeaders);
      }
      const cancelled = await cancelScheduledEmail({
        supabaseUrl,
        resendApiKey: Deno.env.get('RESEND_API_KEY'),
        providerId: invitation.reminder_provider_id,
      });
      await service.rpc('cancel_participation_claim_reminder', {
        p_invitation_id: invitation.id,
        p_cancelled: cancelled,
        p_failure_code: cancelled ? null : 'PROVIDER_CANCEL_FAILED',
      });
      if (!cancelled) {
        return jsonResponse({
          code: 'REMINDER_CANCEL_FAILED',
          error: 'Unable to cancel this reminder right now.',
        }, 503, corsHeaders);
      }
      return jsonResponse({ success: true, status: 'reminder_canceled' }, 200, corsHeaders);
    }

    // Validate server configuration before revoking or creating any invitation.
    // Cancellation above must remain available even when routing is misconfigured.
    const rawToken = newRawToken();
    let claimUrl: string;
    try {
      claimUrl = buildParticipationClaimUrl(rawToken, {
        supabaseUrl,
        testAppOrigin: Deno.env.get('PARTICIPATION_CLAIM_TEST_APP_ORIGIN'),
        testEmailMode: Deno.env.get('PARTICIPATION_CLAIM_EMAIL_TEST_MODE'),
      });
    } catch {
      return jsonResponse({
        code: 'EMAIL_ROUTING_UNAVAILABLE',
        error: 'Unable to send this invitation right now.',
      }, 503, corsHeaders);
    }

    const initialExisting = await latestInvitation(service, parsed.data.participant_id, authResult.userId);
    const resendAvailable = initialExisting
      ? Date.parse(initialExisting.sent_at) <= Date.now() - 7 * 24 * 60 * 60_000
      : false;
    if (initialExisting?.delivery_status === 'sent' && !resendAvailable) {
      return jsonResponse({ code: 'RESEND_NOT_AVAILABLE', error: 'This invitation cannot be resent yet.' }, 409, corsHeaders);
    }
    if (initialExisting?.delivery_status === 'failed') {
      await service.from('participation_claim_invitations').update({
        state: 'revoked',
        revoked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', initialExisting.id).eq('state', 'sent');
    }

    const tokenHash = await sha256Hex(rawToken);
    const rpc = await callerClient.rpc('create_or_rotate_participation_claim', {
      p_participant_id: parsed.data.participant_id,
      p_token_hash: tokenHash,
      p_send_one_reminder: parsed.data.send_one_reminder,
    });
    const row = Array.isArray(rpc.data) ? rpc.data[0] as InvitationRpcRow | undefined : undefined;
    if (rpc.error || !row) {
      if (!initialExisting) {
        const raced = await awaitRacedInvitation(service, parsed.data.participant_id, authResult.userId);
        if (raced) {
          return jsonResponse({
            success: true,
            status: raced.delivery_status === 'sent' ? 'sent' : 'delivery_pending',
          }, raced.delivery_status === 'sent' ? 200 : 202, corsHeaders);
        }
      }
      const resendBlocked = rpc.error?.message.includes('participation_claim_resend_not_available');
      if (resendBlocked) {
        return jsonResponse({ code: 'RESEND_NOT_AVAILABLE', error: 'This invitation cannot be resent yet.' }, 409, corsHeaders);
      }
      return jsonResponse({
        code: 'PARTICIPATION_INVITATION_NOT_AVAILABLE',
        error: 'This invitation is not available.',
      }, 404, corsHeaders);
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (row.rotated && initialExisting?.reminder_provider_id) {
      const cancelled = await cancelScheduledEmail({
        supabaseUrl,
        resendApiKey,
        providerId: initialExisting.reminder_provider_id,
      });
      await service.rpc('cancel_participation_claim_reminder', {
        p_invitation_id: initialExisting.id,
        p_cancelled: cancelled,
        p_failure_code: cancelled ? null : 'PROVIDER_CANCEL_FAILED',
      });
    }

    const initialEmail = renderParticipationClaimEmail({ claimUrl, expiresAt: row.expires_at });
    try {
      const deliveryProviderId = await sendEmail({
        supabaseUrl,
        resendApiKey,
        recipient: row.invited_email,
        invitationId: row.invitation_id,
        kind: 'initial',
        email: initialEmail,
      });
      await service.from('participation_claim_invitations').update({
        delivery_provider_id: deliveryProviderId,
        delivery_status: 'sent',
        delivery_error_code: null,
        updated_at: new Date().toISOString(),
      }).eq('id', row.invitation_id).eq('state', 'sent');

      if (row.reminder_opt_in) {
        const scheduledAt = new Date(Date.parse(row.expires_at) - REMINDER_LEAD_MS).toISOString();
        try {
          const reminderEmail = renderParticipationClaimEmail({
            claimUrl,
            expiresAt: row.expires_at,
            reminder: true,
          });
          const reminderProviderId = await sendEmail({
            supabaseUrl,
            resendApiKey,
            recipient: row.invited_email,
            invitationId: row.invitation_id,
            kind: 'reminder',
            email: reminderEmail,
            scheduledAt,
          });
          await service.from('participation_claim_invitations').update({
            reminder_scheduled_for: scheduledAt,
            reminder_provider_id: reminderProviderId,
            reminder_cancellation_error: null,
            updated_at: new Date().toISOString(),
          }).eq('id', row.invitation_id).eq('state', 'sent');
        } catch {
          await service.from('participation_claim_invitations').update({
            reminder_cancellation_error: 'REMINDER_SCHEDULE_FAILED',
            updated_at: new Date().toISOString(),
          }).eq('id', row.invitation_id).eq('state', 'sent');
        }
      }
      return jsonResponse({ success: true, status: 'sent' }, 200, corsHeaders);
    } catch {
      await service.from('participation_claim_invitations').update({
        delivery_status: 'failed',
        delivery_error_code: 'EMAIL_PROVIDER_UNAVAILABLE',
        updated_at: new Date().toISOString(),
      }).eq('id', row.invitation_id).eq('state', 'sent');
      return jsonResponse({ success: true, status: 'delivery_pending' }, 202, corsHeaders);
    }
  } catch {
    console.error('send-participation-claim failed', { code: 'INTERNAL_ERROR' });
    return jsonResponse({ code: 'INTERNAL_ERROR', error: 'Unable to send this invitation.' }, 500, corsHeaders);
  }
});
