import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { json } from '../_shared/connector-function-utils.ts';
import { readAiMeetingToCanonical, type ReadAiMeeting } from '../_shared/read-ai-connector.ts';
import { runCanonicalConnectorPipeline } from '../_shared/recording-connectors.ts';

interface ReadAiWebhookPayload extends Record<string, unknown> {
  session_id?: string;
  request_id?: string;
  trigger?: string;
  title?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  report_url?: string | null;
  platform?: string | null;
  platform_meeting_id?: string | null;
  transcript?: ReadAiMeeting['transcript'];
}

interface ReadAiWebhookSource {
  id: string;
  user_id: string;
  webhook_signing_secret: string | null;
  connection_metadata: Record<string, unknown> | null;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method === 'GET') return json({ success: true, message: 'Read.ai webhook endpoint is ready' }, 200, corsHeaders);
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, corsHeaders);

  try {
    const pathToken = extractPathToken(req.url);
    if (!pathToken) return json({ error: 'Missing Read.ai webhook token' }, 404, corsHeaders);

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const source = await readWebhookSource(supabase, pathToken);
    if (!source) return json({ error: 'Unknown Read.ai webhook token' }, 404, corsHeaders);
    if (!source.webhook_signing_secret) return json({ error: 'Read.ai webhook signing secret is not configured' }, 400, corsHeaders);

    const rawBody = await req.text();
    const signature = req.headers.get('X-Read-Signature') ?? req.headers.get('x-read-signature');
    const verified = signature
      ? await verifyReadAiSignature(rawBody, signature, source.webhook_signing_secret)
      : false;
    if (!verified) return json({ error: 'Invalid Read.ai webhook signature' }, 401, corsHeaders);

    const payload = parseJsonBody<ReadAiWebhookPayload>(rawBody);
    if (!payload?.session_id) return json({ success: true, ignored: true, reason: 'missing_session_id' }, 200, corsHeaders);
    if (!payload.end_time) return json({ success: true, ignored: true, reason: 'meeting_not_ended' }, 200, corsHeaders);

    const webhookId = payload.request_id?.trim() || await buildWebhookId(payload.session_id, rawBody);
    const { data: existing, error: idempotencyReadError } = await supabase
      .from('processed_webhooks')
      .select('webhook_id')
      .eq('webhook_id', webhookId)
      .maybeSingle();
    if (idempotencyReadError) throw idempotencyReadError;
    if (existing) return json({ success: true, duplicate: true, webhookId }, 200, corsHeaders);

    const canonical = readAiMeetingToCanonical(readAiWebhookPayloadToMeeting(payload));
    const result = await runCanonicalConnectorPipeline(supabase, source.user_id, canonical, {
      importSource: 'read-ai-webhook',
      includeRawPayload: true,
    });

    await markWebhookProcessed(supabase, result.success || result.skipped ? webhookId : `${webhookId}_ERROR`);
    await markWebhookVerified(supabase, source, payload);

    if (result.success) return json({ success: true, webhookId }, 200, corsHeaders);
    if (result.skipped) return json({ success: true, skipped: true, webhookId }, 200, corsHeaders);
    return json({ success: false, webhookId, error: result.error ?? 'Read.ai webhook import failed' }, 500, corsHeaders);
  } catch (error) {
    console.error('Read.ai webhook error:', error);
    return json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500, corsHeaders);
  }
});

async function readWebhookSource(supabase: any, pathToken: string): Promise<ReadAiWebhookSource | null> {
  const { data, error } = await supabase
    .from('import_sources')
    .select('id, user_id, webhook_signing_secret, connection_metadata')
    .eq('source_app', 'read-ai')
    .eq('webhook_path_token', pathToken)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw error;
  return data as ReadAiWebhookSource | null;
}

function readAiWebhookPayloadToMeeting(payload: ReadAiWebhookPayload): ReadAiMeeting {
  return {
    ...(payload as unknown as ReadAiMeeting),
    id: payload.session_id ?? '',
    platform_id: typeof payload.platform_meeting_id === 'string' ? payload.platform_meeting_id : null,
  };
}

async function verifyReadAiSignature(
  rawBody: string,
  receivedSignature: string,
  signingKey: string,
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'raw',
    base64ToBytes(signingKey.trim()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const expected = [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return timingSafeEqual(expected, receivedSignature.trim().toLowerCase());
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

async function markWebhookProcessed(supabase: any, webhookId: string) {
  const { error } = await supabase
    .from('processed_webhooks')
    .insert({ webhook_id: webhookId, processed_at: new Date().toISOString() });
  if (error) console.error('Failed to mark Read.ai webhook processed:', error);
}

async function markWebhookVerified(
  supabase: any,
  source: ReadAiWebhookSource,
  payload: ReadAiWebhookPayload,
) {
  const metadata = source.connection_metadata && typeof source.connection_metadata === 'object'
    ? source.connection_metadata
    : {};
  const { error } = await supabase
    .from('import_sources')
    .update({
      connection_metadata: {
        ...metadata,
        readAiWebhook: {
          lastVerifiedAt: new Date().toISOString(),
          lastMessage: payload.trigger ? `Received ${payload.trigger}` : 'Received signed Read.ai webhook',
          lastRequestId: payload.request_id ?? null,
        },
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', source.id)
    .eq('user_id', source.user_id);
  if (error) console.error('Failed to update Read.ai webhook verification:', error);
}

function extractPathToken(url: string): string | null {
  const pathname = new URL(url).pathname;
  const token = pathname.split('/').filter(Boolean).pop();
  return token && token !== 'read-ai-webhook' ? decodeURIComponent(token) : null;
}

function parseJsonBody<T>(rawBody: string): T | null {
  try {
    return JSON.parse(rawBody) as T;
  } catch {
    return null;
  }
}

async function buildWebhookId(sessionId: string, rawBody: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(rawBody),
  );
  const hash = [...new Uint8Array(digest)]
    .slice(0, 12)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `read_ai_${sessionId}_${hash}`;
}
