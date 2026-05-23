/**
 * composio-oauth-callback — @composio-unverified
 *
 * Two responsibilities:
 *   1. action='initiate' — user-initiated request to start a Composio OAuth
 *      flow for a toolkit. Returns the Composio-hosted auth URL the client
 *      opens in a new tab.
 *   2. action='complete' — Composio's redirect after the user authorizes.
 *      Receives the resulting `connectedAccountId`, persists it on the
 *      matching `import_sources` row.
 *
 * Status: SCAFFOLD. Calling this function before Phase B (Composio account
 * provisioning + OAuth app registration with each vendor) will fail. The
 * shape is defined so the frontend `ComposioAdapter` can be unit-tested.
 *
 * Reviewers: this function intentionally returns 503 when COMPOSIO_API_KEY
 * is missing so a misconfigured deploy doesn't silently 200.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ComposioClient } from "../_shared/composio-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, sentry-trace, baggage",
};

interface RequestBody {
  action?: "initiate" | "complete";
  toolkit?: string;
  sourceId?: string | null;
  /** Provided on 'complete' callbacks from Composio. */
  connectedAccountId?: string | null;
  /** Optional account email captured by the vendor during authorization. */
  accountEmail?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("COMPOSIO_API_KEY");
    if (!apiKey) {
      return jsonResponse({ error: "COMPOSIO_API_KEY not configured" }, 503);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "No authorization header" }, 401);
    }
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    let body: RequestBody;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Request body must be JSON" }, 400);
    }

    const composio = new ComposioClient({ apiKey });

    if (body.action === "initiate") {
      if (!body.toolkit) {
        return jsonResponse({ error: "toolkit is required for initiate" }, 400);
      }
      const callbackUrl = `${supabaseUrl}/functions/v1/composio-oauth-callback?return=${encodeURIComponent("/import")}`;
      const result = await composio.initiateOAuth(
        body.toolkit,
        callbackUrl,
        user.id,
      );
      return jsonResponse({
        success: true,
        authUrl: result.authUrl,
        connectedAccountId: result.connectedAccountId,
      });
    }

    if (body.action === "complete") {
      if (!body.connectedAccountId || !body.toolkit) {
        return jsonResponse(
          { error: "connectedAccountId and toolkit are required for complete" },
          400,
        );
      }

      const account = await composio.getConnectedAccount(
        body.connectedAccountId,
      );
      if (account.status !== "ACTIVE") {
        return jsonResponse(
          {
            error: `Composio account status is ${account.status}; refusing to persist`,
          },
          422,
        );
      }

      const sourceApp = body.toolkit;
      const { error: upsertError } = await supabase
        .from("import_sources")
        .upsert(
          {
            user_id: user.id,
            source_app: sourceApp,
            is_active: true,
            account_email: body.accountEmail ?? null,
            connection_metadata: {
              composio_connected_account_id: body.connectedAccountId,
              composio_toolkit: body.toolkit,
            },
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,source_app" },
        );

      if (upsertError) {
        console.error("[composio-oauth-callback] upsert failed:", upsertError);
        return jsonResponse({ error: upsertError.message }, 500);
      }

      return jsonResponse({
        success: true,
        connectedAccountId: body.connectedAccountId,
      });
    }

    return jsonResponse({ error: "action must be initiate or complete" }, 400);
  } catch (error) {
    console.error("[composio-oauth-callback] error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
