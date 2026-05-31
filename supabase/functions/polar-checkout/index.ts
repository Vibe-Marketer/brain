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
import { authenticateRequest } from '../_shared/auth.ts';

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
    // service-role required: creates a Polar checkout session via server-to-server API; the resulting URL is returned to the user.
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user from JWT
        // SEC-02A: Authenticate via shared helper (Phase 37 shared-auth migration)
    const authResult = await authenticateRequest(req, supabase, corsHeaders);
    if (authResult instanceof Response) return authResult;
    const userId = authResult.userId;

    // Parse request body
    const body = await req.json();
    const { productId, successPath } = body;

    if (!productId) {
      return new Response(
        JSON.stringify({ error: 'productId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Polar client
    const polar = getPolarClient();

    // Get base URL for success redirect
    const rawBaseUrl =
      Deno.env.get('PUBLIC_SITE_URL') ||
      Deno.env.get('SITE_URL') ||
      'https://app.callvaultai.com';
    const baseUrl = rawBaseUrl.trim().replace(/\/+$/, '');
    const normalizedSuccessPath =
      typeof successPath === 'string' &&
        successPath.startsWith('/') &&
        !successPath.startsWith('//')
        ? successPath.trim()
        : '/settings?tab=billing';
    const successUrl = new URL(normalizedSuccessPath, `${baseUrl}/`).toString();

    // Create checkout
    const checkout = await polar.checkouts.create({
      productId,
      successUrl,
      customerExternalId: userId,  // Links to existing Polar customer
    });

    console.log(`Checkout created for user ${userId}: ${checkout.id}`);

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
