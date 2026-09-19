import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

import { getCorsHeaders } from "../_shared/cors.ts";

const requestSchema = z.object({
  recording_id: z.string().uuid(),
});

const UNAVAILABLE_BODY = {
  code: "RECORDING_NOT_AVAILABLE",
  error: "This recording is not available.",
} as const;

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function unavailableResponse(corsHeaders: Record<string, string>): Response {
  return jsonResponse(UNAVAILABLE_BODY, 404, corsHeaders);
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("Origin"));

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders);
  }

  const url = new URL(req.url);
  const parsedRequest = requestSchema.safeParse({
    recording_id: url.searchParams.get("recording_id"),
  });

  if (!parsedRequest.success) {
    return unavailableResponse(corsHeaders);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("public-recording configuration unavailable");
    return unavailableResponse(corsHeaders);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await supabase
    .from("recordings")
    .select(
      "id, title, recording_start_time, duration, full_transcript, access_level",
    )
    .eq("id", parsedRequest.data.recording_id)
    .eq("access_level", "public")
    .maybeSingle();

  if (error) {
    console.error("public-recording lookup failed", { code: error.code });
    return unavailableResponse(corsHeaders);
  }

  if (!data) {
    return unavailableResponse(corsHeaders);
  }

  return jsonResponse(
    {
      recording_id: data.id,
      call_name: data.title,
      recording_start_time: data.recording_start_time,
      duration: data.duration,
      full_transcript: data.full_transcript,
    },
    200,
    corsHeaders,
  );
});
