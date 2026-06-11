/**
 * Polar Create Customer Edge Function
 *
 * Creates a Polar customer for new users (called at signup or first billing access).
 * If customer already exists, returns existing customer ID.
 *
 * POST /polar-create-customer
 * Returns: { customerId: string, created: boolean }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getPolarClient } from "../_shared/polar-client.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { authenticateRequest } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("Origin"));

  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Initialize Supabase client
    // service-role required: creates a Polar customer record + binds polar_customer_id into user_profiles.
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user from JWT
    // SEC-02A: Authenticate via shared helper (Phase 37 shared-auth migration)
    const authResult = await authenticateRequest(req, supabase, corsHeaders);
    if (authResult instanceof Response) return authResult;
    const { userId, user } = authResult;

    // Email guard (issue #301): Supabase Auth permits users without an email
    // (phone-only signups, OAuth without email scope). Polar requires email
    // on customer creation, so refuse here with a clear 400 instead of
    // letting `user.email!` send `undefined` to Polar and throw.
    if (!user.email) {
      return new Response(
        JSON.stringify({
          error: "Email required for Polar customer creation",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Check if user already has a Polar customer ID
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("polar_customer_id, display_name")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("Error fetching profile:", profileError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch user profile" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // If customer already exists, return it
    if (profile?.polar_customer_id) {
      console.log(
        `User ${userId} already has Polar customer: ${profile.polar_customer_id}`,
      );
      return new Response(
        JSON.stringify({
          success: true,
          customerId: profile.polar_customer_id,
          created: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Get Polar client
    const polar = getPolarClient();

    // Determine customer name
    const displayName =
      profile?.display_name || user.user_metadata?.display_name;
    const customerName = displayName || user.email?.split("@")[0] || "User";

    // Idempotency check (issue #302): a concurrent retry (double-click or
    // client-side retry over a slow first request) can race past the
    // `polar_customer_id IS NULL` check above and create a duplicate Polar
    // customer for the same externalId. Look up the existing customer by
    // externalId before creating; reuse if found.
    let polarCustomerId: string | null = null;
    let created = false;
    try {
      const existingState = await polar.customers.getStateExternal({
        externalId: userId,
      });
      polarCustomerId = existingState.id;
      console.log(
        `Idempotency: reusing existing Polar customer ${polarCustomerId} for user ${userId}`,
      );
    } catch (_lookupError) {
      // Not found is the common case for a true first-time customer.
      // `getStateExternal` throws for both "not found" and transport errors;
      // proceed to create either way and let create() surface real failures.
    }

    if (!polarCustomerId) {
      // Create Polar customer
      // Organization tokens are already scoped to one organization, so passing
      // organizationId here triggers Polar's validation error.
      const customer = await polar.customers.create({
        email: user.email,
        name: customerName,
        externalId: userId, // Links back to our user
      });
      polarCustomerId = customer.id;
      created = true;
      console.log(
        `Created Polar customer ${polarCustomerId} for user ${userId}`,
      );
    }

    // Store customer IDs in profile
    const { error: updateError } = await supabase
      .from("user_profiles")
      .update({
        polar_customer_id: polarCustomerId,
        polar_external_id: userId,
      })
      .eq("user_id", userId);

    if (updateError) {
      // Structured log for ops visibility — this branch returns success but
      // the local profile row was not updated. The polar-webhook
      // customer.created handler will reconcile. The externalId-lookup above
      // (issue #302) prevents a concurrent retry from creating a duplicate
      // Polar customer during the reconcile window.
      console.error("Error storing customer ID:", updateError, {
        polarCustomerId,
        userId,
        severity: "reconcile_required",
      });
      // Customer was created in Polar but failed to store locally
      // Return success anyway - we can reconcile later via webhook
    }

    return new Response(
      JSON.stringify({
        success: true,
        customerId: polarCustomerId,
        created,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Customer creation error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // Ticket 3d1da686: Polar validates email deliverability (MX lookup on the
    // domain). Test/fabricated addresses (e.g. @example.com) are rejected with
    // a RequestValidationError. Map that to a clear 400 instead of a raw 500
    // with Polar's JSON blob — the frontend shows this message in the toast.
    if (errorMessage.includes("is not a valid email address")) {
      return new Response(
        JSON.stringify({
          error:
            "Your account email can't receive mail, so billing setup was rejected. Sign up with a real email address to start a trial.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
