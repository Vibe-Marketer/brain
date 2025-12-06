import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    // Parse request body
    const { batch_size = 20, max_batches = 10, dry_run = false } = await req.json();

    // Validate inputs
    if (batch_size < 1 || batch_size > 100) {
      return new Response(
        JSON.stringify({ error: 'batch_size must be between 1 and 100' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (max_batches < 1 || max_batches > 100) {
      return new Response(
        JSON.stringify({ error: 'max_batches must be between 1 and 100' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get auth context from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Find un-enriched chunks for this user
    // Chunks are considered un-enriched if topics is NULL
    const { data: unprocessed, error: countError } = await supabase
      .from('transcript_chunks')
      .select('id', { count: 'exact' })
      .eq('user_id', user.id)
      .is('topics', null)
      .limit(batch_size * max_batches);

    if (countError) {
      return new Response(
        JSON.stringify({ error: countError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const totalChunks = unprocessed?.length || 0;
    const estimatedBatches = Math.ceil(totalChunks / batch_size);

    // If dry_run mode, just return what would be processed
    if (dry_run) {
      return new Response(
        JSON.stringify({
          dry_run: true,
          chunks_to_process: totalChunks,
          estimated_batches: estimatedBatches,
          batch_size,
          max_batches,
          estimated_time_seconds: estimatedBatches * 2, // ~1s per batch + 1s wait
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Process in batches
    let processed = 0;
    let failed = 0;
    const batchResults: Array<{
      batch: number;
      success: boolean;
      processed?: number;
      error?: string;
      chunk_ids?: string[];
    }> = [];

    const actualBatches = Math.min(max_batches, estimatedBatches);

    for (let i = 0; i < actualBatches; i++) {
      const startIdx = i * batch_size;
      const endIdx = Math.min((i + 1) * batch_size, totalChunks);
      const batchChunks = unprocessed!.slice(startIdx, endIdx);
      const chunk_ids = batchChunks.map((c) => c.id);

      console.log(`Processing batch ${i + 1}/${actualBatches} (${chunk_ids.length} chunks)`);

      try {
        // Call enrich-chunk-metadata Edge Function
        const { data, error } = await supabase.functions.invoke('enrich-chunk-metadata', {
          body: { chunk_ids },
        });

        if (error) {
          console.error(`Batch ${i + 1} failed:`, error);
          failed += chunk_ids.length;
          batchResults.push({
            batch: i + 1,
            success: false,
            error: error.message || 'Unknown error',
            chunk_ids,
          });
        } else {
          const processedCount = data?.processed || chunk_ids.length;
          processed += processedCount;
          batchResults.push({
            batch: i + 1,
            success: true,
            processed: processedCount,
            chunk_ids,
          });
          console.log(`Batch ${i + 1} completed: ${processedCount} chunks enriched`);
        }
      } catch (err) {
        console.error(`Batch ${i + 1} exception:`, err);
        failed += chunk_ids.length;
        batchResults.push({
          batch: i + 1,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
          chunk_ids,
        });
      }

      // Rate limiting: wait 1 second between batches to avoid overwhelming the API
      if (i < actualBatches - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Return summary
    return new Response(
      JSON.stringify({
        success: true,
        total_unprocessed: totalChunks,
        processed,
        failed,
        batches_executed: actualBatches,
        batches: batchResults,
        resume_instructions:
          failed > 0
            ? 'Some batches failed. Re-run this function to retry failed chunks (they will still have NULL topics).'
            : 'All chunks processed successfully!',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Backfill error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
