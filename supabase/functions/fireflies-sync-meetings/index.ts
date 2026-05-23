import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateRequest } from '../_shared/auth.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { fetchFirefliesTranscript, firefliesTranscriptToCanonical } from '../_shared/fireflies-connector.ts';
import { runCanonicalConnectorPipeline } from '../_shared/recording-connectors.ts';

interface FirefliesSyncRequest {
  transcriptIds?: string[];
  singleCallId?: string;
  apiKey?: string;
  workspace_id?: string | null;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authResult = await authenticateRequest(req, supabase, corsHeaders);
    if (authResult instanceof Response) return authResult;
    const userId = authResult.userId;

    const body = await req.json() as FirefliesSyncRequest;
    const transcriptIds = body.singleCallId ? [body.singleCallId] : body.transcriptIds ?? [];
    const apiKey = body.apiKey ?? Deno.env.get('FIREFLIES_API_KEY') ?? '';

    if (!Array.isArray(transcriptIds) || transcriptIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'transcriptIds must be an array or singleCallId must be provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!apiKey.trim()) {
      return new Response(
        JSON.stringify({ error: 'Fireflies API key is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let validatedWorkspaceId: string | null = null;
    if (body.workspace_id) {
      const { data: membership, error: membershipError } = await supabase
        .from('workspace_memberships')
        .select('id')
        .eq('workspace_id', body.workspace_id)
        .eq('user_id', userId)
        .maybeSingle();

      if (membershipError) {
        console.error('Error checking workspace membership:', membershipError);
      } else if (membership) {
        validatedWorkspaceId = body.workspace_id;
      }
    }

    const { data: syncJob, error: jobError } = await supabase
      .from('sync_jobs')
      .insert({
        user_id: userId,
        recording_ids: transcriptIds,
        status: 'processing',
        progress_current: 0,
        progress_total: transcriptIds.length,
        type: 'fireflies',
      })
      .select()
      .single();

    if (jobError) throw jobError;
    const jobId = syncJob.id;

    const processSyncJob = async () => {
      const synced: string[] = [];
      const failed: string[] = [];
      let skippedCount = 0;

      for (const transcriptId of transcriptIds) {
        try {
          const transcript = await fetchFirefliesTranscript(apiKey, transcriptId);
          const canonical = firefliesTranscriptToCanonical(transcript);
          const result = await runCanonicalConnectorPipeline(supabase, userId, canonical, {
            importSource: 'fireflies-sync-meetings',
            workspaceId: validatedWorkspaceId,
            includeRawPayload: true,
          });

          if (result.success) {
            synced.push(transcriptId);
          } else if (result.skipped) {
            skippedCount++;
          } else {
            failed.push(transcriptId);
            console.error(`Fireflies sync failed for ${transcriptId}:`, result.error);
          }
        } catch (error) {
          failed.push(transcriptId);
          console.error(`Fireflies sync failed for ${transcriptId}:`, error);
        }

        await supabase
          .from('sync_jobs')
          .update({
            progress_current: synced.length + failed.length + skippedCount,
            synced_ids: synced,
            failed_ids: failed,
            skipped_count: skippedCount,
          })
          .eq('id', jobId);
      }

      const finalStatus = failed.length === 0 ? 'completed'
        : synced.length === 0 ? 'failed'
        : 'completed_with_errors';

      await supabase
        .from('sync_jobs')
        .update({
          status: finalStatus,
          completed_at: new Date().toISOString(),
          skipped_count: skippedCount,
        })
        .eq('id', jobId);
    };

    // @ts-expect-error - EdgeRuntime is available in Deno Deploy
    EdgeRuntime.waitUntil(processSyncJob());

    return new Response(
      JSON.stringify({
        success: true,
        jobId,
        message: `Fireflies sync job started for ${transcriptIds.length} transcripts`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error syncing Fireflies transcripts:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
