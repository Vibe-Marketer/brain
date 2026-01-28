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

    // Get user settings
    const { data: settings, error } = await supabase
      .from('user_settings')
      .select('fathom_api_key, webhook_secret, host_email')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;

    const status = {
      hasFathomKey: false,
      hasWebhookSecret: false,
      fathomKeyMasked: '',
      webhookSecretMasked: '',
      hostEmail: '',
    };

    if (settings) {
      if (settings.fathom_api_key) {
        status.hasFathomKey = true;
        const key = settings.fathom_api_key;
        if (key.length > 8) {
          status.fathomKeyMasked = key.substring(0, 4) + '•'.repeat(key.length - 8) + key.substring(key.length - 4);
        } else {
          status.fathomKeyMasked = '•'.repeat(key.length);
        }
      }

      if (settings.webhook_secret) {
        status.hasWebhookSecret = true;
        const secret = settings.webhook_secret;
        if (secret.length > 8) {
          status.webhookSecretMasked = secret.substring(0, 6) + '•'.repeat(secret.length - 10) + secret.substring(secret.length - 4);
        } else {
          status.webhookSecretMasked = '•'.repeat(secret.length);
        }
      }

      if (settings.host_email) {
        status.hostEmail = settings.host_email;
      }
    }

    return new Response(
      JSON.stringify(status),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching config status:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
