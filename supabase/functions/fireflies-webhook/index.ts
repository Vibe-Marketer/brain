import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { fetchFirefliesTranscript, firefliesTranscriptToCanonical } from '../_shared/fireflies-connector.ts';
import { runCanonicalConnectorPipeline } from '../_shared/recording-connectors.ts';

interface FirefliesWebhookEvent {
  event?: string;
  timestamp?: number;
  meeting_id?: string;
  client_reference_id?: string;
}

interface FirefliesSourceRow {
  id: string;
  user_id: string;
  api_key: string | null;
  webhook_signing_secret: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature' } });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const rawBody = await req.text();
    const signature = req.headers.get('X-Hub-Signature') || req.headers.get('x-hub-signature') || '';
    if (!signature) {
      return new Response(JSON.stringify({ error: 'Missing X-Hub-Signature header' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const { data: sources, error: sourceError } = await supabase
      .from('import_sources')
      .select('id, user_id, api_key, webhook_signing_secret')
      .eq('source_app', 'fireflies')
      .eq('is_active', true)
      .not('webhook_signing_secret', 'is', null);

    if (sourceError) throw sourceError;
    const matchedSource = await findMatchingSource(rawBody, signature, (sources ?? []) as FirefliesSourceRow[]);
    if (!matchedSource || !matchedSource.api_key) {
      return new Response(JSON.stringify({ error: 'No matching Fireflies webhook secret configured' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const payload = JSON.parse(rawBody) as FirefliesWebhookEvent;
    if (!payload.meeting_id) {
      return new Response(JSON.stringify({ error: 'meeting_id is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    if (payload.event !== 'meeting.transcribed' && payload.event !== 'meeting.summarized') {
      return new Response(JSON.stringify({ success: true, ignored: true, event: payload.event ?? null }), { headers: { 'Content-Type': 'application/json' } });
    }

    const transcript = await fetchFirefliesTranscript(matchedSource.api_key, payload.meeting_id);
    const canonical = firefliesTranscriptToCanonical(transcript);
    const result = await runCanonicalConnectorPipeline(supabase, matchedSource.user_id, canonical, {
      importSource: 'fireflies-webhook',
      includeRawPayload: true,
    });

    await supabase
      .from('import_sources')
      .update({
        last_sync_at: new Date().toISOString(),
        error_message: result.success || result.skipped ? null : result.error ?? 'Webhook import failed',
      })
      .eq('id', matchedSource.id)
      .eq('user_id', matchedSource.user_id);

    return new Response(JSON.stringify({ success: result.success, skipped: result.skipped ?? false, recordingId: result.recordingId ?? null }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Fireflies webhook error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

async function findMatchingSource(rawBody: string, actualSignature: string, sources: FirefliesSourceRow[]): Promise<FirefliesSourceRow | null> {
  for (const source of sources) {
    if (!source.webhook_signing_secret) continue;
    const expected = await computeSignature(rawBody, source.webhook_signing_secret);
    if (timingSafeEqual(expected, actualSignature)) {
      return source;
    }
  }
  return null;
}

async function computeSignature(rawBody: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
  const hex = Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `sha256=${hex}`;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
