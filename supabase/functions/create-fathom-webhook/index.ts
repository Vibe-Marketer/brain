import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
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

    // Get OAuth access token
    const { data: settings } = await supabase
      .from('user_settings')
      .select('oauth_access_token')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!settings?.oauth_access_token) {
      return new Response(
        JSON.stringify({ error: 'OAuth not connected. Please connect with OAuth first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accessToken = settings.oauth_access_token;
    const webhookUrl = `${supabaseUrl}/functions/v1/webhook`;

    // Create webhook in Fathom using OAuth
    const webhookResponse = await fetch('https://fathom.video/external/v1/webhooks', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        destination_url: webhookUrl,
        triggered_for: ['my_recordings'],
        include_transcript: true,
        include_summary: true,
        include_action_items: true,
      }),
    });

    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text();
      console.error('Webhook creation failed:', webhookResponse.status, errorText);
      
      // Check if webhook already exists
      if (webhookResponse.status === 409 || errorText.includes('already exists')) {
        return new Response(
          JSON.stringify({ 
            error: 'Webhook already exists for this URL. You\'re all set!',
            alreadyExists: true 
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`Failed to create webhook: ${errorText}`);
    }

    const webhookData = await webhookResponse.json();
    console.log('Webhook created successfully:', webhookData);

    // Store webhook secret in user_settings
    if (webhookData.secret) {
      const { error: updateError } = await supabase
        .from('user_settings')
        .update({
          webhook_secret: webhookData.secret,
        })
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Error storing webhook secret:', updateError);
        throw updateError;
      }
    }

    console.log('Webhook auto-configured successfully for user:', user.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Webhook created and configured automatically!',
        webhookId: webhookData.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error creating webhook:', error);
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
