import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateRequest } from '../_shared/auth.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { json } from '../_shared/connector-function-utils.ts';
import { buildPublicWebhookUrl } from '../_shared/public-webhook-url.ts';
import { resolveReadAiSource } from '../_shared/read-ai-source.ts';

interface ReadAiWebhookSettingsRequest {
  sourceId?: string | null;
  webhookSigningSecret?: string | null;
}

interface ReadAiSourceRow {
  id: string;
  webhook_path_token: string | null;
  webhook_signing_secret: string | null;
  connection_metadata: Record<string, unknown> | null;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const authResult = await authenticateRequest(req, supabase as any, corsHeaders);
    if (authResult instanceof Response) return authResult;
    const userId = authResult.userId;

    const body = await req.json().catch(() => ({})) as ReadAiWebhookSettingsRequest;
    const source = await resolveReadAiSource(supabase, userId, body.sourceId ?? null);
    if (!source?.id) return json({ error: 'Read.ai is not connected. Connect Read.ai before configuring webhooks.' }, 400, corsHeaders);

    const row = await readSourceRow(supabase, userId, source.id);
    if (!row) return json({ error: 'Read.ai source not found.' }, 404, corsHeaders);

    const submittedSecret = body.webhookSigningSecret?.trim() || null;
    const pathToken = row.webhook_path_token ?? generateReadAiWebhookPathToken();
    const signingSecret = submittedSecret ?? row.webhook_signing_secret ?? null;
    const metadata = readMetadata(row.connection_metadata);

    if (!row.webhook_path_token || submittedSecret) {
      const { error } = await supabase
        .from('import_sources')
        .update({
          webhook_path_token: pathToken,
          webhook_signing_secret: signingSecret,
          connection_metadata: metadata,
          updated_at: new Date().toISOString(),
        })
        .eq('id', source.id)
        .eq('user_id', userId)
        .eq('source_app', 'read-ai');
      if (error) throw error;
    }

    return json({
      success: true,
      sourceId: source.id,
      webhookUrl: buildReadAiWebhookUrl(pathToken),
      webhookPathToken: pathToken,
      webhookSigningSecret: signingSecret,
      verification: readVerification(metadata),
    }, 200, corsHeaders);
  } catch (error) {
    console.error('Read.ai webhook settings error:', error);
    return json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500, corsHeaders);
  }
});

async function readSourceRow(
  supabase: any,
  userId: string,
  sourceId: string,
): Promise<ReadAiSourceRow | null> {
  const { data, error } = await supabase
    .from('import_sources')
    .select('id, webhook_path_token, webhook_signing_secret, connection_metadata')
    .eq('id', sourceId)
    .eq('user_id', userId)
    .eq('source_app', 'read-ai')
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw error;
  return data as ReadAiSourceRow | null;
}

function buildReadAiWebhookUrl(pathToken: string): string {
  const configured = Deno.env.get('READAI_WEBHOOK_URL')?.trim().replace(/\/+$/, '');
  if (configured) return `${configured}/${encodeURIComponent(pathToken)}`;
  return buildPublicWebhookUrl('read-ai-webhook', encodeURIComponent(pathToken));
}

function readMetadata(value: Record<string, unknown> | null): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function readVerification(metadata: Record<string, unknown>) {
  const webhook = metadata.readAiWebhook;
  const record = webhook && typeof webhook === 'object' && !Array.isArray(webhook)
    ? webhook as Record<string, unknown>
    : {};
  const lastVerifiedAt = typeof record.lastVerifiedAt === 'string' ? record.lastVerifiedAt : null;
  const lastMessage = typeof record.lastMessage === 'string' ? record.lastMessage : null;
  return {
    verified: Boolean(lastVerifiedAt),
    lastVerifiedAt,
    lastMessage,
  };
}

function generateReadAiWebhookPathToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `rwh_${Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')}`;
}
