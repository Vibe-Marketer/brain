import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateRequest } from '../_shared/auth.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import {
  decodePlaudAccessTokenExpiry,
  fetchPlaudUserMeEmail,
  isValidPlaudApiUrl,
  PlaudClient,
  serverKeyFromApiBase,
} from '../_shared/plaud-client.ts';

interface PlaudConnectTokenRequest {
  sourceId?: string | null;
  accessToken?: string;
  apiBase?: string;
  accountEmail?: string | null;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authResult = await authenticateRequest(req, supabase as any, corsHeaders);
    if (authResult instanceof Response) return authResult;
    const userId = authResult.userId;

    const body = await req.json().catch(() => ({})) as PlaudConnectTokenRequest;
    const accessToken = body.accessToken?.trim().replace(/^Bearer\s+/i, '') ?? '';
    const apiBase = normalizeApiBase(body.apiBase);

    if (!accessToken) {
      return json({ error: 'Plaud access token is required.' }, 400, corsHeaders);
    }

    if (accessToken.split('.').length !== 3) {
      return json({ error: 'That does not look like a Plaud web access token.' }, 400, corsHeaders);
    }

    if (!isValidPlaudApiUrl(apiBase)) {
      return json({ error: 'Invalid Plaud API base.' }, 400, corsHeaders);
    }

    const sourceId = await resolvePlaudSourceId(supabase, userId, body.sourceId ?? null);
    const plaudClient = new PlaudClient(accessToken, { apiBase });
    const devices = await plaudClient.listDevices();
    const detectedAccountEmail = await fetchPlaudUserMeEmail(accessToken, apiBase);
    const accountEmail = detectedAccountEmail ?? normalizeEmail(body.accountEmail);
    const tokenExpires = decodePlaudAccessTokenExpiry(accessToken);
    const connectionMetadata = {
      auth_type: 'consumer_token',
      api_base: apiBase,
      workspace_id: plaudClient.workspaceId ?? null,
      server_key: serverKeyFromApiBase(apiBase),
      using_user_token_fallback: plaudClient.usingUserTokenFallback,
      workspace_error: plaudClient.lastWorkspaceResolutionError,
    };

    await storePlaudAccessToken({
      supabase,
      sourceId,
      userId,
      accessToken,
      tokenExpires,
      accountEmail,
      connectionMetadata,
    });

    return json({
      success: true,
      sourceId,
      accountEmail,
      devices: devices.data_devices,
      connectionMetadata,
    }, 200, corsHeaders);
  } catch (error) {
    console.error('Plaud connect-token error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (isInvalidPlaudAuthError(message)) {
      return json({
        success: false,
        error: 'Plaud rejected the captured browser token. In the Plaud tab, refresh the page and open a recording so the bridge can capture a fresh authenticated request, then try Connect Plaud again.',
      }, 400, corsHeaders);
    }
    return json({ success: false, error: message }, 500, corsHeaders);
  }
});

async function resolvePlaudSourceId(supabase: any, userId: string, requestedSourceId: string | null): Promise<string> {
  if (requestedSourceId) {
    const { data: requested, error } = await supabase
      .from('import_sources')
      .select('id')
      .eq('id', requestedSourceId)
      .eq('user_id', userId)
      .eq('source_app', 'plaud')
      .maybeSingle();
    if (error) throw error;
    if (!requested?.id) {
      throw new Error('Plaud source not found for this user');
    }
    return requested.id;
  }

  const { data: existing } = await supabase
    .from('import_sources')
    .select('id')
    .eq('user_id', userId)
    .eq('source_app', 'plaud')
    .limit(1)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: created, error } = await supabase
    .from('import_sources')
    .insert({
      user_id: userId,
      source_app: 'plaud',
      is_active: false,
    })
    .select('id')
    .single();

  if (error || !created?.id) {
    throw new Error(error?.message ?? 'Failed to create Plaud import source');
  }

  return created.id;
}

async function storePlaudAccessToken(params: {
  supabase: any;
  sourceId: string;
  userId: string;
  accessToken: string;
  tokenExpires: number | null;
  accountEmail: string | null;
  connectionMetadata: Record<string, unknown>;
}): Promise<void> {
  const encryptionKey = Deno.env.get('OAUTH_ENCRYPTION_KEY');

  if (encryptionKey) {
    const { error: encError } = await params.supabase.rpc('store_encrypted_oauth_tokens', {
      p_source_id: params.sourceId,
      p_user_id: params.userId,
      p_access_token: params.accessToken,
      p_refresh_token: null,
      p_token_expires: params.tokenExpires,
      p_encryption_key: encryptionKey,
      p_is_active: true,
    });
    if (encError) throw encError;
  } else {
    const { error: tokenError } = await params.supabase
      .from('import_sources')
      .update({
        oauth_access_token: params.accessToken,
        oauth_refresh_token: null,
        oauth_token_expires: params.tokenExpires,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.sourceId)
      .eq('user_id', params.userId);
    if (tokenError) throw tokenError;
  }

  const { data: updatedSource, error: sourceError } = await params.supabase
    .from('import_sources')
    .update({
      account_email: params.accountEmail,
      connection_metadata: params.connectionMetadata,
      error_message: null,
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.sourceId)
    .eq('user_id', params.userId)
    .eq('source_app', 'plaud')
    .select('id')
    .maybeSingle();

  if (sourceError) throw sourceError;
  if (!updatedSource?.id) {
    throw new Error('Plaud source was not updated');
  }
}

function normalizeApiBase(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return 'https://api.plaud.ai';
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

function normalizeEmail(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase();
  return trimmed && trimmed.includes('@') ? trimmed : null;
}

function isInvalidPlaudAuthError(message: string): boolean {
  return /invalid auth header|invalid token|unauthorized|401/i.test(message);
}

function json(payload: unknown, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
