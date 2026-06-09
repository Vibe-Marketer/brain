/**
 * SECURITY MODEL — Grain webhook authentication
 * --------------------------------------------------------------------------
 * Grain's public API documentation does NOT expose webhook signing semantics
 * as of 2026-05. See docs/integrations/02-platform-specs.md and
 * docs/integrations/05-rollout-plan.md (Phase 1 — "Grain support response
 * time for webhook-signing confirmation").
 *
 * Until Grain support confirms an HMAC scheme, authentication is by
 * per-customer unguessable URL segment:
 *
 *   POST /grain-webhook/{webhook_path_token}
 *
 * `webhook_path_token` is a 32+ char cryptographically random hex token
 * generated server-side in grain-create-webhooks/index.ts, stored only on
 * the customer's import_sources row, never logged, never exposed in client
 * responses, and rotated when the source is disconnected.
 *
 * Why this is acceptable (defense-in-depth):
 *  1. Token entropy >= 128 bits — infeasible to guess
 *  2. Token never appears in logs (we log webhookId, not the path)
 *  3. Source row lookup additionally filters by source_app='grain' AND
 *     is_active=true (revoking a source kills its webhook)
 *  4. Idempotency table (processed_webhooks) prevents replay
 *
 * Why this is NOT real signature verification and the follow-up:
 *  - A leaked path token (URL log, Grain account compromise, MITM during
 *    initial webhook configuration) authorizes arbitrary writes to the
 *    customer's recordings. HMAC body verification would tighten this.
 *  - When Grain confirms a signing scheme, replace this block with the
 *    same crypto.subtle.importKey + sign + timingSafeEqual pattern used in
 *    supabase/functions/read-ai-webhook/index.ts (X-Read-Signature handler).
 *  - Tracking: docs/integrations/05-rollout-plan.md line ~47 (#295)
 * --------------------------------------------------------------------------
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import {
  json,
  resolveConnectorWorkspaceBinding,
  resolveOAuthAccessToken,
} from '../_shared/connector-function-utils.ts';
import { getRecording, getRecordingTranscript, GrainClient } from '../_shared/grain-client.ts';
import { grainRecordingToCanonical, type GrainRecording, type GrainTranscriptSegment } from '../_shared/grain-connector.ts';
import { runCanonicalConnectorPipeline } from '../_shared/recording-connectors.ts';

interface GrainWebhookPayload {
  type?: string;
  user_id?: string;
  data?: {
    id?: string;
    end_datetime?: string | null;
  } & Record<string, unknown>;
}

interface GrainWebhookSource {
  id: string;
  user_id: string;
}

const PROCESSABLE_TYPES = new Set(['recording_added', 'recording_updated']);
const GRAIN_DETAIL_INCLUDE = { participants: true, ai_summary: true, ai_action_items: true, calendar_event: true };

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method === 'GET') {
    return json({ success: true, message: 'Grain webhook endpoint is ready' }, 200, corsHeaders);
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, corsHeaders);
  }

  try {
    const pathToken = extractPathToken(req.url);
    if (!pathToken) return json({ error: 'Missing Grain webhook token' }, 404, corsHeaders);

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: source, error: sourceError } = await supabase
      .from('import_sources')
      .select('id, user_id')
      .eq('source_app', 'grain')
      .eq('webhook_path_token', pathToken)
      .eq('is_active', true)
      .maybeSingle();
    if (sourceError) throw sourceError;
    if (!source) return json({ error: 'Unknown Grain webhook token' }, 404, corsHeaders);

    const rawBody = await req.text();
    const payload = parseJsonBody<GrainWebhookPayload>(rawBody);
    if (!payload?.type) return json({ success: true, ignored: true, reason: 'missing_type' }, 200, corsHeaders);
    if (!PROCESSABLE_TYPES.has(payload.type)) {
      return json({ success: true, ignored: true, type: payload.type }, 200, corsHeaders);
    }

    const recordingId = payload.data?.id;
    if (!recordingId) return json({ success: true, ignored: true, reason: 'missing_recording_id' }, 200, corsHeaders);

    const webhookId = await buildWebhookId(payload.type, recordingId, rawBody);
    const { data: existing, error: idempotencyReadError } = await supabase
      .from('processed_webhooks')
      .select('webhook_id')
      .eq('webhook_id', webhookId)
      .maybeSingle();
    if (idempotencyReadError) throw idempotencyReadError;
    if (existing) return json({ success: true, duplicate: true, webhookId }, 200, corsHeaders);

    const task = processRecordingWebhook({
      supabase,
      source: source as GrainWebhookSource,
      payload,
      recordingId,
      webhookId,
    });
    // @ts-expect-error EdgeRuntime is available in Supabase Edge Functions.
    EdgeRuntime.waitUntil(task);

    return json({ success: true, webhookId, queued: true }, 202, corsHeaders);
  } catch (error) {
    console.error('Grain webhook error:', error);
    return json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500, corsHeaders);
  }
});

async function processRecordingWebhook({
  supabase,
  source,
  payload,
  recordingId,
  webhookId,
}: {
  supabase: any;
  source: GrainWebhookSource;
  payload: GrainWebhookPayload;
  recordingId: string;
  webhookId: string;
}) {
  try {
    const accessToken = await resolveOAuthAccessToken({
      supabase,
      sourceId: source.id,
      userId: source.user_id,
      providerLabel: 'Grain',
      clientIdEnv: 'GRAIN_OAUTH_CLIENT_ID',
      clientSecretEnv: 'GRAIN_OAUTH_CLIENT_SECRET',
      refreshTokens: GrainClient.refreshTokens,
    });
    const recording = await getRecording<GrainRecording>(accessToken, recordingId, GRAIN_DETAIL_INCLUDE);
    if (!recording.end_datetime) {
      await markWebhookProcessed(supabase, webhookId);
      return;
    }

    const transcript = await getRecordingTranscript(accessToken, recordingId) as GrainTranscriptSegment[];
    const canonical = grainRecordingToCanonical({ ...recording, transcript });
    const workspaceBinding = await resolveConnectorWorkspaceBinding({
      supabase,
      userId: source.user_id,
      sourceId: source.id,
      sourceApp: 'grain',
    });
    const result = await runCanonicalConnectorPipeline(supabase, source.user_id, canonical, {
      importSource: 'grain-webhook',
      fallbackWorkspaceId: workspaceBinding.workspaceId,
      includeRawPayload: true,
    });

    if (result.success || result.skipped) {
      await markWebhookProcessed(supabase, webhookId);
    } else {
      await markWebhookProcessed(supabase, `${webhookId}_ERROR`);
    }
  } catch (error) {
    console.error('Grain webhook processing failed:', error);
    await markWebhookProcessed(supabase, `${webhookId}_ERROR`);
  }
}

async function markWebhookProcessed(supabase: any, webhookId: string) {
  const { error } = await supabase
    .from('processed_webhooks')
    .insert({
      webhook_id: webhookId,
      processed_at: new Date().toISOString(),
    });
  if (error) console.error('Failed to mark Grain webhook processed:', error);
}

function extractPathToken(url: string): string | null {
  const match = new URL(url).pathname.match(/\/grain-webhook\/([^/]+)/);
  if (!match) return null;
  const token = decodeURIComponent(match[1]);
  return token && token !== 'grain-webhook' ? token : null;
}

function parseJsonBody<T>(rawBody: string): T | null {
  try {
    return JSON.parse(rawBody) as T;
  } catch {
    return null;
  }
}

async function buildWebhookId(
  type: string,
  recordingId: string,
  rawBody: string,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(rawBody),
  );
  const hash = [...new Uint8Array(digest)]
    .slice(0, 12)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `grain_${type}_${recordingId}_${hash}`;
}
