import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

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

    // Get user ID from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse optional body — sourceId means reconnecting an existing account
    let sourceId: string | null = null;
    try {
      const body = await req.json();
      sourceId = body?.sourceId ?? null;
    } catch {
      // No body or invalid JSON — that's fine, means new account
    }

    // Get production OAuth credentials
    const clientId = Deno.env.get('FATHOM_OAUTH_CLIENT_ID');
    const siteUrl = Deno.env.get('SITE_URL') || 'https://app.callvaultai.com';
    const redirectUri = `${siteUrl}/oauth/callback/`;

    if (!clientId) {
      return new Response(
        JSON.stringify({ error: 'OAuth not configured. Contact administrator.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fathom OAuth - Production mode');
    console.log('Redirect URI:', redirectUri);

    // If reconnecting an existing account, use that sourceId.
    // Otherwise, create a new import_sources row for this account.
    let targetSourceId = sourceId;

    if (!targetSourceId) {
      const { data: newSource, error: insertError } = await supabase
        .from('import_sources')
        .insert({
          user_id: user.id,
          source_app: 'fathom',
          is_active: false, // Will be activated after OAuth completes
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('Error creating import_sources row:', insertError);
        throw new Error('Failed to initialize Fathom connection');
      }

      targetSourceId = newSource.id;
      console.log('Created new import_sources row:', targetSourceId);
    } else {
      console.log('Reconnecting existing account:', targetSourceId);
    }

    // Generate random state for CSRF protection
    const state = crypto.randomUUID();

    // Store state and pending source ID in user_settings for callback validation
    await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        oauth_state: state,
        pending_import_source_id: targetSourceId,
      }, {
        onConflict: 'user_id'
      });

    // Build authorization URL (note: external/v1 path is required)
    const authUrl = new URL('https://fathom.video/external/v1/oauth2/authorize');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'public_api');
    authUrl.searchParams.set('state', state);

    console.log('Generated OAuth URL for user:', user.id, 'source:', targetSourceId);

    return new Response(
      JSON.stringify({
        success: true,
        authUrl: authUrl.toString(),
        sourceId: targetSourceId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating OAuth URL:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
