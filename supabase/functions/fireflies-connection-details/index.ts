import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRequest } from "../_shared/auth.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { getDecryptedFirefliesSourceForUser } from "../_shared/fireflies-credentials.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authResult = await authenticateRequest(
      req,
      supabase as any,
      corsHeaders,
    );
    if (authResult instanceof Response) return authResult;

    const source = await getDecryptedFirefliesSourceForUser(
      supabase as any,
      authResult.userId,
    );

    if (!source) {
      return new Response(JSON.stringify({ error: "Fireflies is not connected" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: row, error } = await (supabase as any)
      .from("import_sources")
      .select("webhook_path_token")
      .eq("id", source.id)
      .eq("user_id", authResult.userId)
      .single();
    if (error) throw error;

    return new Response(
      JSON.stringify({
        success: true,
        webhookSigningSecret: source.webhook_signing_secret,
        webhookPathToken: row?.webhook_path_token ?? null,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error loading Fireflies connection details:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
