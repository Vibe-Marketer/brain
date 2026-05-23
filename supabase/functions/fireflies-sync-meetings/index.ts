import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRequest } from "../_shared/auth.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  fetchFirefliesTranscript,
  firefliesTranscriptToCanonical,
} from "../_shared/fireflies-connector.ts";
import { getDecryptedFirefliesSourceForUser } from "../_shared/fireflies-credentials.ts";
import { runCanonicalConnectorPipeline } from "../_shared/recording-connectors.ts";

interface FirefliesSyncRequest {
  transcriptIds?: string[];
  singleCallId?: string;
  sourceId?: string | null;
  workspace_id?: string | null;
}

// Caps the number of transcripts that can be processed in a single
// EdgeRuntime.waitUntil() background invocation. Deno Deploy enforces an
// open-ended wall-clock limit on background tasks (per Supabase docs, on the
// order of minutes), so very large batches silently die mid-loop. The UI
// already pages requests at 50 to match fetch-meetings.
const MAX_BATCH_SIZE = 50;

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authResult = await authenticateRequest(req, supabase, corsHeaders);
    if (authResult instanceof Response) return authResult;
    const userId = authResult.userId;

    const body = (await req.json()) as FirefliesSyncRequest;
    const transcriptIds = body.singleCallId
      ? [body.singleCallId]
      : (body.transcriptIds ?? []);

    if (!Array.isArray(transcriptIds) || transcriptIds.length === 0) {
      return new Response(
        JSON.stringify({
          error:
            "transcriptIds must be an array or singleCallId must be provided",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (transcriptIds.length > MAX_BATCH_SIZE) {
      return new Response(
        JSON.stringify({
          error: `Too many transcripts: max ${MAX_BATCH_SIZE} per request, received ${transcriptIds.length}. Submit them in smaller batches.`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const source = await getDecryptedFirefliesSourceForUser(supabase, userId);
    const sourceId = body.sourceId ?? source?.id ?? null;
    const apiKey = source?.api_key?.trim() ?? "";

    if (!sourceId || !apiKey) {
      return new Response(
        JSON.stringify({
          error: "Fireflies is not connected. Save an API key first.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let validatedWorkspaceId: string | null = null;
    if (body.workspace_id) {
      const { data: membership, error: membershipError } = await supabase
        .from("workspace_memberships")
        .select("id")
        .eq("workspace_id", body.workspace_id)
        .eq("user_id", userId)
        .maybeSingle();

      if (membershipError) {
        // Transient DB failure — surface it instead of silently dropping the
        // user's workspace selection and routing recordings to the default.
        console.error("Workspace membership lookup failed:", membershipError);
        return new Response(
          JSON.stringify({
            error: "Failed to verify workspace membership. Try again.",
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      if (!membership) {
        return new Response(
          JSON.stringify({
            error: "You are not a member of the requested workspace.",
          }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      validatedWorkspaceId = body.workspace_id;
    }

    const { data: syncJob, error: jobError } = await supabase
      .from("sync_jobs")
      .insert({
        user_id: userId,
        recording_ids: transcriptIds,
        status: "processing",
        progress_current: 0,
        progress_total: transcriptIds.length,
        type: "fireflies",
      })
      .select()
      .single();

    if (jobError) throw jobError;
    const jobId = syncJob.id;

    const processSyncJob = async () => {
      const synced: string[] = [];
      const failed: string[] = [];
      let skippedCount = 0;

      try {
        for (const transcriptId of transcriptIds) {
          try {
            const transcript = await fetchFirefliesTranscript(
              apiKey,
              transcriptId,
            );
            const canonical = firefliesTranscriptToCanonical(transcript);
            const result = await runCanonicalConnectorPipeline(
              supabase,
              userId,
              canonical,
              {
                importSource: "fireflies-sync-meetings",
                workspaceId: validatedWorkspaceId,
                includeRawPayload: true,
              },
            );

            if (result.success) {
              synced.push(transcriptId);
            } else if (result.skipped) {
              skippedCount++;
            } else {
              failed.push(transcriptId);
              console.error(
                `Fireflies sync failed for ${transcriptId}:`,
                result.error,
              );
            }
          } catch (error) {
            failed.push(transcriptId);
            console.error(`Fireflies sync failed for ${transcriptId}:`, error);
          }

          await supabase
            .from("sync_jobs")
            .update({
              progress_current: synced.length + failed.length + skippedCount,
              synced_ids: synced,
              failed_ids: failed,
              skipped_count: skippedCount,
            })
            .eq("id", jobId);
        }

        const finalStatus =
          failed.length === 0
            ? "completed"
            : synced.length === 0
              ? "failed"
              : "completed_with_errors";

        await supabase
          .from("sync_jobs")
          .update({
            status: finalStatus,
            completed_at: new Date().toISOString(),
            skipped_count: skippedCount,
          })
          .eq("id", jobId);
        await supabase
          .from("import_sources")
          .update({
            last_sync_at: new Date().toISOString(),
            error_message:
              failed.length > 0
                ? `${failed.length} Fireflies recording${failed.length === 1 ? "" : "s"} failed to sync`
                : null,
          })
          .eq("id", sourceId)
          .eq("user_id", userId);
      } catch (outerError) {
        // Last-resort handler — if the loop itself throws (e.g. supabase
        // client failure between iterations), make sure the job row gets
        // marked failed so the frontend poller stops polling instead of
        // showing "processing" forever.
        console.error(`Fireflies sync job ${jobId} crashed:`, outerError);
        const message =
          outerError instanceof Error ? outerError.message : "Sync job crashed";
        try {
          await supabase
            .from("sync_jobs")
            .update({
              status: "failed",
              error_message: message,
              completed_at: new Date().toISOString(),
              synced_ids: synced,
              failed_ids: failed,
              skipped_count: skippedCount,
            })
            .eq("id", jobId);
          await supabase
            .from("import_sources")
            .update({
              last_sync_at: new Date().toISOString(),
              error_message: `Fireflies sync job crashed: ${message}`,
            })
            .eq("id", sourceId)
            .eq("user_id", userId);
        } catch (markFailedError) {
          // Nothing more we can do — log and let the frontend poll timeout
          // (5 min default) surface the stuck job to the user.
          console.error(
            `Failed to mark sync job ${jobId} as failed:`,
            markFailedError,
          );
        }
      }
    };

    // @ts-expect-error - EdgeRuntime is available in Deno Deploy
    EdgeRuntime.waitUntil(processSyncJob());

    return new Response(
      JSON.stringify({
        success: true,
        jobId,
        message: `Fireflies sync job started for ${transcriptIds.length} transcripts`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error syncing Fireflies transcripts:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
