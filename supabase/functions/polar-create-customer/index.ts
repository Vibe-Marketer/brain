/**
 * Polar Create Customer Edge Function
 * 
 * Creates a Polar customer for new users (called at signup or first billing access).
 * If customer already exists, returns existing customer ID.
 * 
 * POST /polar-create-customer
 * Returns: { customerId: string, created: boolean }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getPolarClient, getPolarOrgId } from '../_shared/polar-client.ts';
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

    // Check if user already has a Polar customer ID
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('polar_customer_id, display_name')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user profile' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If customer already exists, return it
    if (profile?.polar_customer_id) {
      console.log(`User ${user.id} already has Polar customer: ${profile.polar_customer_id}`);
      return new Response(
        JSON.stringify({
          success: true,
          customerId: profile.polar_customer_id,
          created: false,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Polar client and org ID
    const polar = getPolarClient();
    const organizationId = getPolarOrgId();

    // Determine customer name
    const displayName = profile?.display_name || user.user_metadata?.display_name;
    const customerName = displayName || user.email?.split('@')[0] || 'User';

    // Create Polar customer
    const customer = await polar.customers.create({
      email: user.email!,
      name: customerName,
      externalId: user.id,  // Links back to our user
      organizationId,
    });

    console.log(`Created Polar customer ${customer.id} for user ${user.id}`);

    // Store customer IDs in profile
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        polar_customer_id: customer.id,
        polar_external_id: user.id,
      })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error storing customer ID:', updateError);
      // Customer was created in Polar but failed to store locally
      // Return success anyway - we can reconcile later via webhook
    }

    return new Response(
      JSON.stringify({
        success: true,
        customerId: customer.id,
        created: true,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Customer creation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
