/**
 * connector-dispatcher — single entrypoint for connector-framework adapters.
 *
 * Routes `{ source, action, payload }` requests to a registered
 * `ConnectorAdapter` (see `_shared/connector-framework.ts`). Existing native
 * sources (Fathom / Fireflies / Zoom / Plaud / YouTube) keep their dedicated
 * edge functions — this dispatcher is the entrypoint for NEW sources only.
 *
 * @composio-unverified — the Composio adapter registers itself here once
 * Phase B lands and a Composio account is provisioned.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  dispatchConnectorRequest,
  type AdapterContext,
  type ConnectorRequest,
} from "../_shared/connector-framework.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, sentry-trace, baggage",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    let body: ConnectorRequest;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Request body must be JSON" }, 400);
    }

    const ctx: AdapterContext = {
      supabase,
      userId: user.id,
    };

    const { status, body: result } = await dispatchConnectorRequest(ctx, body);
    return jsonResponse(result, status);
  } catch (error) {
    console.error("[connector-dispatcher] error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: errorMessage }, 500);
  }
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
