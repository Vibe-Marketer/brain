import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateRequest } from '../_shared/auth.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { createPkcePair, GrainClient, serializeGrainOAuthState } from '../_shared/grain-client.ts';
import { resolveGrainSource } from '../_shared/grain-source.ts';

interface GrainOAuthUrlRequest {
  sourceId?: string | null;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const authResult = await authenticateRequest(req, supabase as any, corsHeaders);
    if (authResult instanceof Response) return authResult;
    const userId = authResult.userId;

    const body = await req.json().catch(() => ({})) as GrainOAuthUrlRequest;
    const clientId = Deno.env.get('GRAIN_OAUTH_CLIENT_ID');
    const redirectUri = Deno.env.get('GRAIN_OAUTH_REDIRECT_URI')
      || `${Deno.env.get('SITE_URL') || 'https://app.callvaultai.com'}/oauth/callback/grain`;

    if (!clientId) {
      return json({ success: false, error: 'Grain OAuth is not configured. Set GRAIN_OAUTH_CLIENT_ID.' }, 500, corsHeaders);
    }

    const requestedSourceId = body.sourceId ?? null;
    let sourceId = requestedSourceId;
    if (requestedSourceId) {
      const source = await resolveGrainSource(supabase, userId, requestedSourceId);
      if (!source) return json({ success: false, error: 'Grain source not found.' }, 404, corsHeaders);
    } else {
      const { data, error } = await supabase
        .from('import_sources')
        .insert({
          user_id: userId,
          source_app: 'grain',
          is_active: false,
          connection_metadata: { auth_type: 'oauth' },
        })
        .select('id')
        .single();
      if (error || !data?.id) throw new Error(error?.message ?? 'Failed to initialize Grain source');
      sourceId = data.id;
    }

    const state = crypto.randomUUID();
    const pkce = await createPkcePair();
    const { error: settingsError } = await supabase
      .from('user_settings')
      .upsert({
        user_id: userId,
        oauth_state: serializeGrainOAuthState(state, pkce.verifier),
        pending_import_source_id: sourceId,
      }, { onConflict: 'user_id' });
    if (settingsError) {
      console.error('Failed to persist Grain OAuth state:', { userId, sourceId, error: settingsError });
      return json({ success: false, error: 'Failed to start Grain OAuth. Try again.' }, 500, corsHeaders);
    }

    const authUrl = GrainClient.buildAuthorizationUrl({
      clientId,
      redirectUri,
      state,
      codeChallenge: pkce.challenge,
    });
    return json({ success: true, authUrl, sourceId }, 200, corsHeaders);
  } catch (error) {
    console.error('Error generating Grain OAuth URL:', error);
    return json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500, corsHeaders);
  }
});

function json(payload: unknown, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
