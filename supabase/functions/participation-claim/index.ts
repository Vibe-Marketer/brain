import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';

import { authenticateRequest } from '../_shared/auth.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

const RESEND_API_URL = 'https://api.resend.com/emails';
const TEST_PROJECT_REF = 'swjzxiddcrtaqixsfaac';
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/u;

const inspectSchema = z.object({
  mode: z.literal('inspect'),
  token: z.string().min(1).max(128),
}).strict();

const consumeSchema = z.object({
  mode: z.literal('consume'),
  token: z.string().min(1).max(128),
  confirmEmailAttachment: z.boolean().optional().default(false),
}).strict();

const requestSchema = z.discriminatedUnion('mode', [inspectSchema, consumeSchema]);

type JsonRecord = Record<string, unknown>;

interface InspectRpcRow {
  available: boolean;
  masked_invited_email: string | null;
  confirmation_required: boolean;
}

interface ConsumeRpcRow {
  success: boolean;
  discovered_event_count: number;
  reminder_provider_id: string | null;
  reminder_cancellation_required: boolean;
}

function jsonResponse(body: JsonRecord, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function unavailable(corsHeaders: Record<string, string>): Response {
  return jsonResponse({ status: 'unavailable', error: 'This claim link is unavailable.' }, 404, corsHeaders);
}

function isDedicatedTestProject(supabaseUrl: string): boolean {
  try {
    return new URL(supabaseUrl).hostname === `${TEST_PROJECT_REF}.supabase.co`;
  } catch {
    return false;
  }
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function cancelScheduledReminder(input: {
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

    const rawBody = await req.json().catch(() => null);
    const parsed = requestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonResponse({ code: 'INVALID_REQUEST', error: 'Invalid request.' }, 400, corsHeaders);
    }
    if (!TOKEN_PATTERN.test(parsed.data.token)) return unavailable(corsHeaders);

    const tokenHash = await sha256Hex(parsed.data.token);
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (parsed.data.mode === 'inspect') {
      const inspected = await callerClient.rpc('inspect_my_participation_claim', {
        p_token_hash: tokenHash,
      });
      if (inspected.error) {
        return jsonResponse({ status: 'retryable', error: 'Unable to inspect this claim right now.' }, 503, corsHeaders);
      }
      const row = Array.isArray(inspected.data) ? inspected.data[0] as InspectRpcRow | undefined : undefined;
      if (!row?.available || !row.masked_invited_email) return unavailable(corsHeaders);
      return jsonResponse({
        maskedInvitedEmail: row.masked_invited_email,
        confirmationRequired: row.confirmation_required,
      }, 200, corsHeaders);
    }

    const consumed = await callerClient.rpc('consume_my_participation_claim', {
      p_token_hash: tokenHash,
      p_confirm_email_attachment: parsed.data.confirmEmailAttachment,
    });
    if (consumed.error) {
      return jsonResponse({ status: 'retryable', error: 'Unable to finish this claim right now.' }, 503, corsHeaders);
    }
    const row = Array.isArray(consumed.data) ? consumed.data[0] as ConsumeRpcRow | undefined : undefined;
    if (!row?.success) return unavailable(corsHeaders);

    if (row.reminder_cancellation_required && row.reminder_provider_id) {
      const cancelled = await cancelScheduledReminder({
        supabaseUrl,
        resendApiKey: Deno.env.get('RESEND_API_KEY'),
        providerId: row.reminder_provider_id,
      });
      const service = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const invitations = await service
        .from('participation_claim_invitations')
        .select('id')
        .eq('token_hash', tokenHash)
        .limit(1)
        .maybeSingle();
      if (typeof invitations.data?.id === 'string') {
        await service.rpc('cancel_participation_claim_reminder', {
          p_invitation_id: invitations.data.id,
          p_cancelled: cancelled,
          p_failure_code: cancelled ? null : 'PROVIDER_CANCEL_FAILED',
        });
      }
    }

    return jsonResponse({
      status: 'claimed',
      discoveredEventCount: row.discovered_event_count,
    }, 200, corsHeaders);
  } catch {
    console.error('participation-claim failed', { code: 'INTERNAL_ERROR' });
    return jsonResponse({ status: 'retryable', error: 'Unable to process this claim right now.' }, 503, corsHeaders);
  }
});
