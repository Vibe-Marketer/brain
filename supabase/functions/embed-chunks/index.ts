import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * EMBED-CHUNKS - Job Creator
 *
 * This function has been refactored to use a queue-based architecture:
 * 1. Discovers unindexed recordings or accepts specific recording_ids
 * 2. Creates an embedding_job record
 * 3. Enqueues individual recording tasks to embedding_queue
 * 4. Returns immediately with job_id
 * 5. Triggers process-embeddings worker to start processing
 *
 * The actual embedding work is done by process-embeddings in small batches
 * to avoid timeouts.
 */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user ID from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { recording_ids, auto_discover } = await req.json();

    let recordingsToProcess: number[] = [];

    // Auto-discover mode: find all recordings without chunks
    if (auto_discover) {
      console.log(`Auto-discovering unindexed recordings for user ${user.id}`);

      // Get all user's recordings with transcripts
      const { data: allCalls, error: callsError } = await supabase
        .from('fathom_calls')
        .select('recording_id')
        .eq('user_id', user.id)
        .not('full_transcript', 'is', null);

      if (callsError) {
        throw new Error(`Failed to fetch calls: ${callsError.message}`);
      }

      if (!allCalls || allCalls.length === 0) {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'No calls found to embed',
            recordings_queued: 0,
            job_id: null,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get recordings that already have chunks
      const { data: indexedChunks, error: chunksError } = await supabase
        .from('transcript_chunks')
        .select('recording_id')
        .eq('user_id', user.id);

      if (chunksError) {
        throw new Error(`Failed to fetch indexed chunks: ${chunksError.message}`);
      }

      const indexedRecordingIds = new Set(indexedChunks?.map(c => c.recording_id) || []);
      recordingsToProcess = allCalls
        .map(c => c.recording_id)
        .filter(id => !indexedRecordingIds.has(id));

      console.log(`Found ${recordingsToProcess.length} unindexed recordings out of ${allCalls.length} total`);

      if (recordingsToProcess.length === 0) {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'All recordings are already indexed',
            recordings_queued: 0,
            job_id: null,
            total_indexed: indexedRecordingIds.size,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (recording_ids && Array.isArray(recording_ids) && recording_ids.length > 0) {
      recordingsToProcess = recording_ids;
    } else {
      return new Response(
        JSON.stringify({ error: 'Either recording_ids array or auto_discover=true is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Queuing ${recordingsToProcess.length} recordings for embedding for user ${user.id}`);

    // Create embedding job
    const { data: job, error: jobError } = await supabase
      .from('embedding_jobs')
      .insert({
        user_id: user.id,
        recording_ids: recordingsToProcess,
        status: 'running',
        progress_total: recordingsToProcess.length,
        progress_current: 0,
        chunks_created: 0,
        queue_total: recordingsToProcess.length,
        queue_completed: 0,
        queue_failed: 0,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (jobError) {
      console.error('Error creating job:', jobError);
      throw new Error(`Failed to create embedding job: ${jobError.message}`);
    }

    console.log(`Created embedding job ${job.id} for ${recordingsToProcess.length} recordings`);

    // Bulk insert queue entries in batches of 500
    const queueEntries = recordingsToProcess.map(recordingId => ({
      user_id: user.id,
      job_id: job.id,
      recording_id: recordingId,
      status: 'pending',
    }));

    for (let i = 0; i < queueEntries.length; i += 500) {
      const batch = queueEntries.slice(i, i + 500);
      const { error: queueError } = await supabase
        .from('embedding_queue')
        .insert(batch);

      if (queueError) {
        console.error(`Error inserting queue batch ${i / 500}:`, queueError);
        // Mark job as failed if we can't enqueue
        await supabase
          .from('embedding_jobs')
          .update({
            status: 'failed',
            error_message: `Failed to enqueue recordings: ${queueError.message}`,
            completed_at: new Date().toISOString(),
          })
          .eq('id', job.id);
        throw new Error(`Failed to enqueue recordings: ${queueError.message}`);
      }

      console.log(`Enqueued batch ${Math.floor(i / 500) + 1} (${batch.length} recordings)`);
    }

    console.log(`Successfully enqueued all ${recordingsToProcess.length} recordings`);

    // Trigger first worker invocation (fire-and-forget)
    // Use EdgeRuntime.waitUntil to not block the response
    EdgeRuntime.waitUntil(
      (async () => {
        try {
          console.log(`Triggering process-embeddings worker for job ${job.id}`);
          const { error: invokeError } = await supabase.functions.invoke('process-embeddings', {
            body: { job_id: job.id, batch_size: 10 },
          });

          if (invokeError) {
            console.error('Error invoking process-embeddings:', invokeError);
          } else {
            console.log('Successfully triggered process-embeddings worker');
          }
        } catch (err) {
          console.error('Failed to trigger process-embeddings:', err);
        }
      })()
    );

    // Return immediately with job ID
    return new Response(
      JSON.stringify({
        success: true,
        job_id: job.id,
        recordings_queued: recordingsToProcess.length,
        message: `Queued ${recordingsToProcess.length} recordings for embedding. Processing will continue in background.`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in embed-chunks:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
