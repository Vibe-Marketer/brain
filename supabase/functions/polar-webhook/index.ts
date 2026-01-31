/**
 * Polar Webhook Handler
 * 
 * Handles subscription lifecycle events from Polar.
 * Updates user_profiles with subscription status.
 * 
 * Events handled:
 * - subscription.created - Create subscription record
 * - subscription.active - Mark subscription active
 * - subscription.canceled - Mark canceled (user keeps access until period end)
 * - subscription.revoked - Immediate access loss (clear subscription fields)
 * - customer.created - Store polar_customer_id
 * - customer.state_changed - Trigger state sync
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { validateEvent, WebhookVerificationError } from 'npm:@polar-sh/sdk/webhooks';
import type {
  WebhookSubscriptionCreatedPayload,
  WebhookSubscriptionActivePayload,
  WebhookSubscriptionCanceledPayload,
  WebhookSubscriptionRevokedPayload,
  WebhookCustomerCreatedPayload,
  WebhookCustomerStateChangedPayload,
} from 'npm:@polar-sh/sdk/models/components';
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
    // Get webhook secret
    const webhookSecret = Deno.env.get('POLAR_WEBHOOK_SECRET');
    if (!webhookSecret) {
      console.error('POLAR_WEBHOOK_SECRET not configured');
      return new Response(
        JSON.stringify({ error: 'Webhook secret not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Read raw body for signature validation
    const body = await req.text();

    // Build headers object for validation
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key] = value;
    });

    // Validate webhook signature
    let event;
    try {
      event = validateEvent(body, headers, webhookSecret);
    } catch (error) {
      if (error instanceof WebhookVerificationError) {
        console.error('Webhook signature verification failed:', error.message);
        return new Response(
          JSON.stringify({ error: 'Invalid webhook signature' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw error;
    }

    console.log(`Received Polar webhook: ${event.type}`);

    // Initialize Supabase client with service role to bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle events
    switch (event.type) {
      case 'subscription.created':
        await handleSubscriptionCreated(supabase, event.data as WebhookSubscriptionCreatedPayload['data']);
        break;

      case 'subscription.active':
        await handleSubscriptionActive(supabase, event.data as WebhookSubscriptionActivePayload['data']);
        break;

      case 'subscription.canceled':
        await handleSubscriptionCanceled(supabase, event.data as WebhookSubscriptionCanceledPayload['data']);
        break;

      case 'subscription.revoked':
        await handleSubscriptionRevoked(supabase, event.data as WebhookSubscriptionRevokedPayload['data']);
        break;

      case 'customer.created':
        await handleCustomerCreated(supabase, event.data as WebhookCustomerCreatedPayload['data']);
        break;

      case 'customer.state_changed':
        await handleCustomerStateChanged(supabase, event.data as WebhookCustomerStateChangedPayload['data']);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(
      JSON.stringify({ success: true, event: event.type }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Webhook processing error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Handle subscription.created event
 * Initial subscription record - may not be active yet (e.g., pending payment)
 */
async function handleSubscriptionCreated(
  supabase: ReturnType<typeof createClient>,
  data: WebhookSubscriptionCreatedPayload['data']
) {
  const { subscription, customer } = data;
  
  console.log(`Subscription created: ${subscription.id} for customer ${customer.id}`);

  // Find user by polar_customer_id or polar_external_id
  const userId = customer.externalId || await findUserByCustomerId(supabase, customer.id);
  if (!userId) {
    console.error(`No user found for customer ${customer.id}`);
    return;
  }

  const { error } = await supabase
    .from('user_profiles')
    .update({
      subscription_id: subscription.id,
      subscription_status: subscription.status,
      product_id: subscription.productId,
      current_period_end: subscription.currentPeriodEnd,
    })
    .eq('user_id', userId);

  if (error) {
    console.error('Error updating subscription:', error);
    throw error;
  }

  console.log(`Subscription created for user ${userId}`);
}

/**
 * Handle subscription.active event
 * Subscription is now active and user has access
 */
async function handleSubscriptionActive(
  supabase: ReturnType<typeof createClient>,
  data: WebhookSubscriptionActivePayload['data']
) {
  const { subscription, customer } = data;
  
  console.log(`Subscription activated: ${subscription.id} for customer ${customer.id}`);

  const userId = customer.externalId || await findUserByCustomerId(supabase, customer.id);
  if (!userId) {
    console.error(`No user found for customer ${customer.id}`);
    return;
  }

  const { error } = await supabase
    .from('user_profiles')
    .update({
      subscription_id: subscription.id,
      subscription_status: 'active',
      product_id: subscription.productId,
      current_period_end: subscription.currentPeriodEnd,
    })
    .eq('user_id', userId);

  if (error) {
    console.error('Error updating subscription:', error);
    throw error;
  }

  console.log(`Subscription activated for user ${userId}`);
}

/**
 * Handle subscription.canceled event
 * User canceled but keeps access until current_period_end
 */
async function handleSubscriptionCanceled(
  supabase: ReturnType<typeof createClient>,
  data: WebhookSubscriptionCanceledPayload['data']
) {
  const { subscription, customer } = data;
  
  console.log(`Subscription canceled: ${subscription.id} for customer ${customer.id}`);

  const userId = customer.externalId || await findUserByCustomerId(supabase, customer.id);
  if (!userId) {
    console.error(`No user found for customer ${customer.id}`);
    return;
  }

  // Update status but keep subscription_id and current_period_end
  // User keeps access until the end of their billing period
  const { error } = await supabase
    .from('user_profiles')
    .update({
      subscription_status: 'canceled',
      // Keep current_period_end - user has access until then
    })
    .eq('user_id', userId);

  if (error) {
    console.error('Error updating subscription:', error);
    throw error;
  }

  console.log(`Subscription canceled for user ${userId} - access until period end`);
}

/**
 * Handle subscription.revoked event
 * Immediate loss of access (e.g., payment failure, manual revocation)
 */
async function handleSubscriptionRevoked(
  supabase: ReturnType<typeof createClient>,
  data: WebhookSubscriptionRevokedPayload['data']
) {
  const { subscription, customer } = data;
  
  console.log(`Subscription revoked: ${subscription.id} for customer ${customer.id}`);

  const userId = customer.externalId || await findUserByCustomerId(supabase, customer.id);
  if (!userId) {
    console.error(`No user found for customer ${customer.id}`);
    return;
  }

  // Clear all subscription fields - immediate loss of access
  const { error } = await supabase
    .from('user_profiles')
    .update({
      subscription_id: null,
      subscription_status: 'revoked',
      product_id: null,
      current_period_end: null,
    })
    .eq('user_id', userId);

  if (error) {
    console.error('Error updating subscription:', error);
    throw error;
  }

  console.log(`Subscription revoked for user ${userId} - immediate access loss`);
}

/**
 * Handle customer.created event
 * Store the polar_customer_id in user_profiles
 */
async function handleCustomerCreated(
  supabase: ReturnType<typeof createClient>,
  data: WebhookCustomerCreatedPayload['data']
) {
  const { customer } = data;
  
  console.log(`Customer created: ${customer.id} with externalId ${customer.externalId}`);

  // If we have an externalId, it's our user_id
  if (!customer.externalId) {
    console.log('Customer created without externalId - will be linked later');
    return;
  }

  const { error } = await supabase
    .from('user_profiles')
    .update({
      polar_customer_id: customer.id,
      polar_external_id: customer.externalId,
    })
    .eq('user_id', customer.externalId);

  if (error) {
    console.error('Error storing customer ID:', error);
    throw error;
  }

  console.log(`Stored polar_customer_id for user ${customer.externalId}`);
}

/**
 * Handle customer.state_changed event
 * Trigger state sync to catch any missed updates
 */
async function handleCustomerStateChanged(
  supabase: ReturnType<typeof createClient>,
  data: WebhookCustomerStateChangedPayload['data']
) {
  const { customer } = data;
  
  console.log(`Customer state changed: ${customer.id}`);

  // This event signals we should re-sync state
  // The actual sync is handled by polar-customer-state function
  // Here we just log it for debugging
  
  if (customer.externalId) {
    console.log(`State change for user ${customer.externalId} - frontend should call polar-customer-state`);
  }
}

/**
 * Helper to find user by polar_customer_id when externalId not available
 */
async function findUserByCustomerId(
  supabase: ReturnType<typeof createClient>,
  customerId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('user_id')
    .eq('polar_customer_id', customerId)
    .maybeSingle();

  if (error) {
    console.error('Error finding user by customer ID:', error);
    return null;
  }

  return data?.user_id || null;
}
