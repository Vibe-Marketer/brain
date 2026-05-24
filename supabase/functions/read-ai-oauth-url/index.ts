import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateRequest } from '../_shared/auth.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { ReadAiClient } from '../_shared/read-ai-client.ts';

interface ReadAiOAuthUrlRequest {
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

    const body = await req.json().catch(() => ({})) as ReadAiOAuthUrlRequest;
    const clientId = Deno.env.get('READAI_OAUTH_CLIENT_ID');
    const redirectUri = Deno.env.get('READAI_OAUTH_REDIRECT_URI')
      || `${Deno.env.get('SITE_URL') || 'https://app.callvaultai.com'}/oauth/callback/read-ai`;

    if (!clientId) {
      return json({ success: false, error: 'Read.ai OAuth is not configured. Set READAI_OAUTH_CLIENT_ID.' }, 500, corsHeaders);
    }

    let sourceId = body.sourceId ?? null;
    if (!sourceId) {
      const { data, error } = await supabase
        .from('import_sources')
        .insert({
          user_id: userId,
          source_app: 'read-ai',
          is_active: false,
          connection_metadata: { auth_type: 'oauth' },
        })
        .select('id')
        .single();
      if (error || !data?.id) throw new Error(error?.message ?? 'Failed to initialize Read.ai source');
      sourceId = data.id;
    }

    const state = crypto.randomUUID();
    await supabase
      .from('user_settings')
      .upsert({
        user_id: userId,
        oauth_state: `read-ai:${state}`,
        pending_import_source_id: sourceId,
      }, { onConflict: 'user_id' });

    const authUrl = ReadAiClient.buildAuthorizationUrl({ clientId, redirectUri, state });
    return json({ success: true, authUrl, sourceId }, 200, corsHeaders);
  } catch (error) {
    console.error('Error generating Read.ai OAuth URL:', error);
    return json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500, corsHeaders);
  }
});

function json(payload: unknown, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
