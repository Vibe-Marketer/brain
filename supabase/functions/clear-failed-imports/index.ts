import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { authenticateRequest } from "../_shared/auth.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const ClearFailedImportsSchema = z
  .object({
    syncJobId: z.string().uuid().optional(),
    failedExternalIds: z.array(z.string().min(1)).optional(),
    clearAll: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.clearAll === true ||
      (value.syncJobId && value.failedExternalIds && value.failedExternalIds.length > 0) ||
      (!!value.failedExternalIds && value.failedExternalIds.length > 0),
    {
      message:
        "Provide clearAll=true or at least one failedExternalId, with syncJobId for single-row clears",
    },
  );

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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

    const rawBody = await req.json();
    const parsed = ClearFailedImportsSchema.safeParse(rawBody);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          error: parsed.error.issues.map((issue) => issue.message).join("; "),
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { syncJobId, failedExternalIds = [], clearAll = false } = parsed.data;
    const idsToClear = new Set(failedExternalIds.map(String));

    let jobsQuery = (supabase as any)
      .from("sync_jobs")
      .select("id, failed_ids, error")
      .eq("user_id", authResult.userId)
      .not("failed_ids", "is", null);

    if (syncJobId) {
      jobsQuery = jobsQuery.eq("id", syncJobId);
    }

    const { data: jobs, error: jobsError } = await jobsQuery;
    if (jobsError) throw jobsError;

    if (!jobs || jobs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, clearedCount: 0 }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let clearedCount = 0;

    for (const job of jobs) {
      const currentFailedIds = Array.isArray(job.failed_ids) ? job.failed_ids : [];
      if (currentFailedIds.length === 0) continue;

      const nextFailedIds = clearAll
        ? []
        : currentFailedIds.filter((id: string | number) => !idsToClear.has(String(id)));

      const removedCount = currentFailedIds.length - nextFailedIds.length;
      if (removedCount === 0) continue;

      clearedCount += removedCount;

      const payload = {
        failed_ids: nextFailedIds.length > 0 ? nextFailedIds : null,
        error: nextFailedIds.length > 0 ? job.error : null,
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await (supabase as any)
        .from("sync_jobs")
        .update(payload)
        .eq("id", job.id)
        .eq("user_id", authResult.userId);

      if (updateError) throw updateError;
    }

    return new Response(
      JSON.stringify({ success: true, clearedCount }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error clearing failed imports:", error);
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
