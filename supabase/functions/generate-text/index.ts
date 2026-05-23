/**
 * GENERATE-TEXT EDGE FUNCTION
 *
 * Thin, generic prompt-to-text utility built on OpenRouter (Vercel AI SDK).
 *
 * There is no server-side AI gate here — gating is enforced client-side in
 * `useAiGate` BEFORE this function is invoked (DEBT-01).
 *
 * Endpoints:
 * - POST /functions/v1/generate-text
 *   Body: {
 *     prompt: string,                       // required, 1..8000 chars
 *     max_tokens?: number,                  // optional, 1..2000
 *     temperature?: number,                 // optional, 0..2
 *     model?: string,                       // optional, defaults to openai/gpt-5-nano
 *   }
 *   Returns: { content: string }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createOpenRouter } from "https://esm.sh/@openrouter/ai-sdk-provider@1.2.8";
import { generateText } from "https://esm.sh/ai@5.0.102";
import { z } from "https://esm.sh/zod@3.23.8";
import { getCorsHeaders } from "../_shared/cors.ts";
import { authenticateRequest } from "../_shared/auth.ts";

const DEFAULT_MODEL = "openai/gpt-5-nano";

const RequestSchema = z.object({
  prompt: z.string().min(1).max(8000),
  max_tokens: z.number().int().min(1).max(2000).optional(),
  temperature: z.number().min(0).max(2).optional(),
  model: z.string().optional(),
});

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openrouterApiKey = Deno.env.get("OPENROUTER_API_KEY");

    if (!openrouterApiKey) {
      return new Response(
        JSON.stringify({ error: "OPENROUTER_API_KEY not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authResult = await authenticateRequest(req, supabase, corsHeaders);
    if (authResult instanceof Response) return authResult;

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validation = RequestSchema.safeParse(rawBody);
    if (!validation.success) {
      const errorMessage =
        validation.error.errors[0]?.message || "Invalid input";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { prompt, max_tokens, temperature, model } = validation.data;

    const openrouter = createOpenRouter({
      apiKey: openrouterApiKey,
      headers: {
        "HTTP-Referer": "https://app.callvaultai.com",
        "X-Title": "CallVault",
      },
    });

    const result = await generateText({
      model: openrouter(model || DEFAULT_MODEL),
      prompt,
      maxTokens: max_tokens,
      temperature,
    });

    return new Response(JSON.stringify({ content: result.text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-text:", error);
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
