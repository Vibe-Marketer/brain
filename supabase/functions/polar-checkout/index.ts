/**
 * Polar Checkout Edge Function
 * 
 * Generates checkout URLs for subscription upgrades.
 * 
 * POST /polar-checkout
 * Body: { productId: string }
 * Returns: { checkoutUrl: string }
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

    // Parse request body
    const body = await req.json();
    const { productId } = body;

    if (!productId) {
      return new Response(
        JSON.stringify({ error: 'productId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Polar client
    const polar = getPolarClient();

    // Get base URL for success redirect
    const baseUrl = Deno.env.get('PUBLIC_SITE_URL') || Deno.env.get('SITE_URL') || 'https://callvault.ai';
    const successUrl = `${baseUrl}/settings?tab=billing`;

    // Create checkout
    const checkout = await polar.checkouts.create({
      productId,
      successUrl,
      customerExternalId: user.id,  // Links to existing Polar customer
    });

    console.log(`Checkout created for user ${user.id}: ${checkout.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        checkoutUrl: checkout.url,
        checkoutId: checkout.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Checkout creation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
