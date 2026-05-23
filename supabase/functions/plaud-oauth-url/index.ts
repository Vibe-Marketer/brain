import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateRequest } from '../_shared/auth.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { createPkcePair, PlaudClient, serializePlaudOAuthState } from '../_shared/plaud-client.ts';

interface PlaudOAuthUrlRequest {
  sourceId?: string | null;
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

    let body: PlaudOAuthUrlRequest = {};
    try {
      body = await req.json() as PlaudOAuthUrlRequest;
    } catch {
      body = {};
    }

    const clientId = Deno.env.get('PLAUD_OAUTH_CLIENT_ID');
    const redirectUri = Deno.env.get('PLAUD_OAUTH_REDIRECT_URI')
      || `${Deno.env.get('SITE_URL') || 'https://app.callvaultai.com'}/oauth/callback/plaud`;

    if (!clientId) {
      return new Response(
        JSON.stringify({ error: 'Plaud OAuth is not configured. Set PLAUD_OAUTH_CLIENT_ID.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let targetSourceId = body.sourceId ?? null;
    if (!targetSourceId) {
      const { data: newSource, error: insertError } = await supabase
        .from('import_sources')
        .insert({
          user_id: userId,
          source_app: 'plaud',
          is_active: false,
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('Error creating Plaud import source:', insertError);
        throw new Error('Failed to initialize Plaud connection');
      }
      targetSourceId = newSource.id;
    }

    const state = crypto.randomUUID();
    const pkce = await createPkcePair();
    await supabase
      .from('user_settings')
      .upsert({
        user_id: userId,
        oauth_state: serializePlaudOAuthState(state, pkce.verifier),
        pending_import_source_id: targetSourceId,
      }, { onConflict: 'user_id' });

    const authUrl = PlaudClient.buildAuthorizationUrl({
      clientId,
      redirectUri,
      state,
      codeChallenge: pkce.challenge,
    });

    return new Response(
      JSON.stringify({ success: true, authUrl, sourceId: targetSourceId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error generating Plaud OAuth URL:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
