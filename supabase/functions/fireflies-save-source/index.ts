import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateRequest } from '../_shared/auth.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { fetchFirefliesUser } from '../_shared/fireflies-connector.ts';

interface FirefliesSaveSourceRequest {
  apiKey?: string;
  webhookSigningSecret?: string | null;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authResult = await authenticateRequest(req, supabase, corsHeaders);
    if (authResult instanceof Response) return authResult;
    const userId = authResult.userId;

    const body = await req.json() as FirefliesSaveSourceRequest;
    const apiKey = body.apiKey?.trim() ?? '';
    const webhookSigningSecret = body.webhookSigningSecret?.trim() || null;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Fireflies API key is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const firefliesUser = await fetchFirefliesUser(apiKey);
    const accountEmail = firefliesUser.email?.trim() || null;

    const { data: existing } = await supabase
      .from('import_sources')
      .select('id')
      .eq('user_id', userId)
      .eq('source_app', 'fireflies')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const payload = {
      user_id: userId,
      source_app: 'fireflies',
      account_email: accountEmail,
      is_active: true,
      error_message: null,
      api_key: apiKey,
      webhook_signing_secret: webhookSigningSecret,
      updated_at: new Date().toISOString(),
    };

    let sourceRow;
    if (existing?.id) {
      const { data, error } = await supabase
        .from('import_sources')
        .update(payload)
        .eq('id', existing.id)
        .eq('user_id', userId)
        .select('id, source_app, account_email, is_active, last_sync_at, error_message, created_at, updated_at')
        .single();
      if (error) throw error;
      sourceRow = data;
    } else {
      const { data, error } = await supabase
        .from('import_sources')
        .insert(payload)
        .select('id, source_app, account_email, is_active, last_sync_at, error_message, created_at, updated_at')
        .single();
      if (error) throw error;
      sourceRow = data;
    }

    return new Response(JSON.stringify({ success: true, source: sourceRow }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error saving Fireflies source:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
