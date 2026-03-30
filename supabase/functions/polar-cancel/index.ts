/**
 * Polar Cancel Edge Function
 *
 * Cancels the user's active subscription via the Polar API.
 * The subscription is canceled at period end — the user retains access
 * until current_period_end, then downgrades to Free.
 *
 * POST /polar-cancel
 * Body: (empty)
 * Returns: { success: true, accessUntil: string | null }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getPolarClient } from '../_shared/polar-client.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('Origin'));

  // CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Initialize Supabase client (service role to bypass RLS for the update)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user from JWT
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

    // Fetch user's active subscription_id from user_profiles
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('subscription_id, subscription_status, current_period_end')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch subscription data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!profile?.subscription_id) {
      return new Response(
        JSON.stringify({ error: 'No active subscription' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Guard: don't try to cancel an already-canceled subscription
    if (profile.subscription_status === 'canceled') {
      return new Response(
        JSON.stringify({ error: 'Subscription is already canceled', accessUntil: profile.current_period_end }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const subscriptionId = profile.subscription_id;

    // Call Polar API to cancel the subscription (cancels at period end)
    const polar = getPolarClient();
    await polar.subscriptions.cancel({ id: subscriptionId });

    console.log(`Subscription ${subscriptionId} canceled for user ${user.id}`);

    // Update user_profiles to reflect canceled status
    // Keep subscription_id and current_period_end — user retains access until period end
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({ subscription_status: 'canceled' })
      .eq('user_id', user.id);

    if (updateError) {
      // Log but don't fail — Polar webhook will sync this eventually
      console.error('Failed to update subscription_status in user_profiles:', updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        accessUntil: profile.current_period_end ?? null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Cancel subscription error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
