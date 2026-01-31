/**
 * Polar Customer State Edge Function
 * 
 * Fetches current customer state from Polar and syncs with local database.
 * Addresses race condition where webhooks may not have arrived after checkout.
 * 
 * POST /polar-customer-state
 * Returns: {
 *   subscriptionId: string | null,
 *   status: string | null,
 *   productId: string | null,
 *   periodEnd: string | null,
 *   synced: boolean
 * }
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

  // Accept both POST and GET for flexibility
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Initialize Supabase client
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

    // Get current local state
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('subscription_id, subscription_status, product_id, current_period_end, polar_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user profile' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Polar client
    const polar = getPolarClient();

    // Fetch current state from Polar
    let polarState;
    try {
      polarState = await polar.customers.getStateExternal({
        externalId: user.id,
      });
    } catch (error) {
      // Customer might not exist yet
      console.log(`No Polar customer found for user ${user.id}:`, error);
      return new Response(
        JSON.stringify({
          success: true,
          subscriptionId: null,
          status: null,
          productId: null,
          periodEnd: null,
          synced: false,
          message: 'No Polar customer found',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract active subscription from state
    const activeSubscription = polarState.activeSubscriptions?.[0] || null;

    let subscriptionId: string | null = null;
    let status: string | null = null;
    let productId: string | null = null;
    let periodEnd: string | null = null;

    if (activeSubscription) {
      subscriptionId = activeSubscription.id;
      status = activeSubscription.status;
      productId = activeSubscription.productId;
      periodEnd = activeSubscription.currentPeriodEnd || null;
    }

    // Compare with local state and sync if different
    let synced = false;
    const needsSync = 
      profile?.subscription_id !== subscriptionId ||
      profile?.subscription_status !== status ||
      profile?.product_id !== productId ||
      profile?.current_period_end !== periodEnd;

    if (needsSync) {
      console.log(`Syncing subscription state for user ${user.id}`);
      
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          subscription_id: subscriptionId,
          subscription_status: status,
          product_id: productId,
          current_period_end: periodEnd,
        })
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Error syncing subscription state:', updateError);
        // Continue - return current Polar state even if sync failed
      } else {
        synced = true;
        console.log(`Subscription state synced for user ${user.id}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        subscriptionId,
        status,
        productId,
        periodEnd,
        synced,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Customer state error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
