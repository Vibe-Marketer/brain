import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logUsage } from '../_shared/usage-tracker.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

/**
 * PROCESS-EMBEDDINGS - Worker Function
 *
 * This function processes embedding tasks from the queue in small batches:
 * 1. Claims a batch of tasks atomically (prevents race conditions)
 * 2. Processes each recording (chunk transcript, generate embeddings)
 * 3. Updates queue status and job progress
 * 4. Self-invokes for more work if queue has pending items
 *
 * Designed to complete within 90 seconds to avoid Edge Function timeouts.
 */

const BATCH_SIZE = 10; // Number of recordings per invocation
const MAX_PROCESSING_TIME_MS = 90000; // 90s safe limit (150s timeout - 60s buffer)
const CHUNK_INSERT_BATCH_SIZE = 50; // Insert chunks in batches to avoid statement timeouts

// Simple token estimation (avg ~4 chars per token for English text)
// This is a heuristic that works well for chunking purposes
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

interface TranscriptSegment {
  id: string;
  speaker_name: string | null;
  speaker_email: string | null;
  text: string;
  timestamp: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface FathomCall {
  recording_id: number;
  title: string;
  created_at: string;
  user_id: string;
  full_transcript: string | null;
}

interface TranscriptChunk {
  user_id: string;
  recording_id: number;
  chunk_text: string;
  chunk_index: number;
  speaker_name: string | null;
  speaker_email: string | null;
  timestamp_start: string | null;
  timestamp_end: string | null;
  call_date: string;
  call_title: string;
  call_category: string | null;
  embedding: number[];
  embedded_at: string;
}

interface QueueTask {
  id: string;
  user_id: string;
  job_id: string;
  recording_id: number;
  attempts: number;
  max_attempts: number;
}

// Split oversized text into smaller pieces at sentence boundaries
function splitOversizedText(
  text: string,
  maxTokens: number,
  speakerName: string | null,
  timestamp: string | null
): Array<{
  text: string;
  speakers: Set<string>;
  startTimestamp: string | null;
  endTimestamp: string | null;
}> {
  const chunks: Array<{
    text: string;
    speakers: Set<string>;
    startTimestamp: string | null;
    endTimestamp: string | null;
  }> = [];

  // Try to split on sentence boundaries (. ! ? followed by space or end)
  const sentences = text.match(/[^.!?]+[.!?]+[\s]*/g) || [text];

  let currentText = '';
  const maxChars = maxTokens * 4; // Convert tokens back to approx chars

  for (const sentence of sentences) {
    if (currentText.length + sentence.length > maxChars && currentText.length > 0) {
      chunks.push({
        text: currentText.trim(),
        speakers: speakerName ? new Set([speakerName]) : new Set(),
        startTimestamp: timestamp,
        endTimestamp: timestamp,
      });
      currentText = '';
    }

    // If a single sentence is too long, split it by words
    if (sentence.length > maxChars) {
      const words = sentence.split(/\s+/);
      let wordChunk = '';
      for (const word of words) {
        if (wordChunk.length + word.length + 1 > maxChars && wordChunk.length > 0) {
          chunks.push({
            text: wordChunk.trim(),
            speakers: speakerName ? new Set([speakerName]) : new Set(),
            startTimestamp: timestamp,
            endTimestamp: timestamp,
          });
          wordChunk = '';
        }
        wordChunk += (wordChunk ? ' ' : '') + word;
      }
      if (wordChunk) {
        currentText += (currentText ? ' ' : '') + wordChunk;
      }
    } else {
      currentText += sentence;
    }
  }

  if (currentText.trim()) {
    chunks.push({
      text: currentText.trim(),
      speakers: speakerName ? new Set([speakerName]) : new Set(),
      startTimestamp: timestamp,
      endTimestamp: timestamp,
    });
  }

  return chunks;
}

// Chunk transcripts with adaptive sizing to preserve speaker turns
// targetTokens: Preferred chunk size (e.g. 500)
// maxTokens: Absolute limit to allow for long speaker turns (e.g. 1200)
function chunkTranscript(
  segments: TranscriptSegment[],
  targetTokens: number = 500,
  overlapTokens: number = 100,
  maxTokens: number = 1200
): Array<{
  text: string;
  speakers: Set<string>;
  startTimestamp: string | null;
  endTimestamp: string | null;
}> {
  const chunks: Array<{
    text: string;
    speakers: Set<string>;
    startTimestamp: string | null;
    endTimestamp: string | null;
  }> = [];

  let currentChunk = {
    text: '',
    speakers: new Set<string>(),
    startTimestamp: null as string | null,
    endTimestamp: null as string | null,
    lastSpeaker: null as string | null, 
  };
  let currentTokens = 0;

  interface SegmentWithTokens {
    segment: TranscriptSegment;
    formattedText: string;
    tokens: number;
  }
  const overlapBuffer: SegmentWithTokens[] = [];
  let overlapBufferTokens = 0;

  for (const segment of segments) {
    const segmentText = segment.text.trim();
    if (!segmentText) continue;

    const speakerPrefix = segment.speaker_name ? `${segment.speaker_name}: ` : '';
    const fullSegmentText = speakerPrefix + segmentText;
    const segmentTokens = estimateTokens(fullSegmentText);

    // Case 1: Oversized Segment (Single turn > maxTokens)
    if (segmentTokens > maxTokens) {
      // Flush current chunk first if it has content
      if (currentChunk.text.length > 0) {
        chunks.push({ 
          text: currentChunk.text,
          speakers: new Set(currentChunk.speakers),
          startTimestamp: currentChunk.startTimestamp,
          endTimestamp: currentChunk.endTimestamp
        });
        currentChunk = {
          text: '',
          speakers: new Set<string>(),
          startTimestamp: null,
          endTimestamp: null,
          lastSpeaker: null,
        };
        currentTokens = 0;
      }

      // Split the oversized segment
      const splitChunks = splitOversizedText(
        fullSegmentText,
        targetTokens, // Use target size for splits
        segment.speaker_name,
        segment.timestamp
      );
      chunks.push(...splitChunks);

      // Reset buffers
      overlapBuffer.length = 0;
      overlapBufferTokens = 0;
      continue;
    }

    // Case 2: Check Limits
    const willExceedTarget = currentTokens + segmentTokens > targetTokens;
    const willExceedMax = currentTokens + segmentTokens > maxTokens;
    const isSameSpeaker = currentChunk.lastSpeaker === segment.speaker_name;

    // Decision: Should we split?
    // Split if:
    // 1. We would exceed the HARD limit (maxTokens)
    // 2. OR we would exceed the SOFT limit (targetTokens) AND it's a new speaker (don't break mid-turn if possible)
    const shouldSplit = willExceedMax || (willExceedTarget && !isSameSpeaker);

    if (shouldSplit && currentChunk.text.length > 0) {
      chunks.push({ 
        text: currentChunk.text,
        speakers: new Set(currentChunk.speakers),
        startTimestamp: currentChunk.startTimestamp,
        endTimestamp: currentChunk.endTimestamp
      });

      currentChunk = {
        text: '',
        speakers: new Set<string>(),
        startTimestamp: null,
        endTimestamp: null,
        lastSpeaker: null,
      };
      currentTokens = 0;

      // Add overlap buffer to new chunk (to maintain context across splits)
      for (const bufferedItem of overlapBuffer) {
        const bufferedSegment = bufferedItem.segment;
        
        // Only add overlap if it doesn't immediately blow the budget
        if (currentTokens + bufferedItem.tokens < targetTokens) {
            currentChunk.text += (currentChunk.text ? '\n' : '') + bufferedItem.formattedText;
            if (bufferedSegment.speaker_name) {
              currentChunk.speakers.add(bufferedSegment.speaker_name);
            }
            if (!currentChunk.startTimestamp && bufferedSegment.timestamp) {
              currentChunk.startTimestamp = bufferedSegment.timestamp;
            }
            // Don't update endTimestamp from overlap, let the new content define it
            currentChunk.lastSpeaker = bufferedSegment.speaker_name || null;
            currentTokens += bufferedItem.tokens;
        }
      }
    }

    // Add current segment
    currentChunk.text += (currentChunk.text ? '\n' : '') + fullSegmentText;
    if (segment.speaker_name) {
      currentChunk.speakers.add(segment.speaker_name);
    }
    if (!currentChunk.startTimestamp && segment.timestamp) {
      currentChunk.startTimestamp = segment.timestamp;
    }
    currentChunk.endTimestamp = segment.timestamp;
    currentChunk.lastSpeaker = segment.speaker_name || null;
    currentTokens += segmentTokens;

    // Update overlap buffer
    overlapBuffer.push({
      segment,
      formattedText: fullSegmentText,
      tokens: segmentTokens,
    });
    overlapBufferTokens += segmentTokens;

    // Maintain overlap buffer size
    while (overlapBufferTokens > overlapTokens && overlapBuffer.length > 1) {
      const removed = overlapBuffer.shift()!;
      overlapBufferTokens -= removed.tokens;
    }
  }

  if (currentChunk.text.length > 0) {
    chunks.push({
        text: currentChunk.text,
        speakers: new Set(currentChunk.speakers),
        startTimestamp: currentChunk.startTimestamp,
        endTimestamp: currentChunk.endTimestamp
    });
  }

  return chunks;
}

interface EmbeddingResult {
  embeddings: number[][];
  usage: {
    promptTokens: number;
    totalTokens: number;
  };
}

// Generate embeddings using OpenAI API directly (OpenRouter doesn't support embeddings)
async function generateEmbeddings(texts: string[], openaiApiKey: string): Promise<EmbeddingResult> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: texts,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return {
    embeddings: data.data.map((item: { embedding: number[] }) => item.embedding),
    usage: {
      promptTokens: data.usage?.prompt_tokens || 0,
      totalTokens: data.usage?.total_tokens || 0,
    },
  };
}

// Process a single recording and return chunks created count
async function processRecording(
  supabase: ReturnType<typeof createClient>,
  openaiApiKey: string,
  task: QueueTask
): Promise<number> {
  const { recording_id, user_id } = task;

  // Get call metadata
  const { data: call, error: callError } = await supabase
    .from('fathom_calls')
    .select('*')
    .eq('recording_id', recording_id)
    .eq('user_id', user_id)
    .single();

  if (callError || !call) {
    throw new Error(`Call ${recording_id} not found: ${callError?.message || 'Not found'}`);
  }

  // Get transcript segments (use composite key for user isolation)
  const { data: segments, error: segmentsError } = await supabase
    .from('fathom_transcripts')
    .select('*')
    .eq('recording_id', recording_id)
    .eq('user_id', user_id)
    .eq('is_deleted', false)
    .order('timestamp', { ascending: true });

  if (segmentsError) {
    throw new Error(`Error fetching segments for ${recording_id}: ${segmentsError.message}`);
  }

  if (!segments || segments.length === 0) {
    console.log(`No segments for ${recording_id}, skipping`);
    return 0;
  }

  // Get tag for this call
  const { data: tagAssignment } = await supabase
    .from('call_tag_assignments')
    .select('tag_id, call_tags(name)')
    .eq('call_recording_id', recording_id)
    .maybeSingle();

  const tagName = (tagAssignment?.call_tags as {name: string} | null)?.name || null;

  // Chunk the transcript - Adaptive Strategy
  // Target: 500 tokens (~2000 chars)
  // Max: 1200 tokens (~4800 chars) to allow long speaker turns to complete
  const chunks = chunkTranscript(segments, 500, 100, 1200);
  console.log(`Created ${chunks.length} chunks for recording ${recording_id}`);

  if (chunks.length === 0) return 0;

  // Generate embeddings in batches of 100
  const batchSize = 100;
  const allChunksToInsert: TranscriptChunk[] = [];
  let totalInputTokens = 0;

  for (let batchStart = 0; batchStart < chunks.length; batchStart += batchSize) {
    const batchEnd = Math.min(batchStart + batchSize, chunks.length);
    const batchChunks = chunks.slice(batchStart, batchEnd);
    const batchTexts = batchChunks.map(c => c.text);

    const startTime = Date.now();
    const result = await generateEmbeddings(batchTexts, openaiApiKey);
    const latencyMs = Date.now() - startTime;

    // Accumulate token usage for logging
    totalInputTokens += result.usage.promptTokens;

    // Log embedding usage for this batch
    await logUsage(supabase, {
      userId: user_id,
      operationType: 'embedding',
      model: 'text-embedding-3-small',
      inputTokens: result.usage.promptTokens,
      jobId: task.job_id,
      recordingId: recording_id,
      batchSize: batchChunks.length,
      latencyMs,
    });

    for (let j = 0; j < batchChunks.length; j++) {
      const chunk = batchChunks[j];
      const chunkIndex = batchStart + j;
      const primarySpeaker = Array.from(chunk.speakers)[0] || null;

      const speakerSegment = segments.find(s => s.speaker_name === primarySpeaker);
      const speakerEmail = speakerSegment?.speaker_email || null;

      allChunksToInsert.push({
        user_id: user_id,
        recording_id: recording_id,
        chunk_text: chunk.text,
        chunk_index: chunkIndex,
        speaker_name: primarySpeaker,
        speaker_email: speakerEmail,
        timestamp_start: chunk.startTimestamp,
        timestamp_end: chunk.endTimestamp,
        call_date: call.created_at,
        call_title: call.title,
        call_category: tagName,
        embedding: result.embeddings[j],
        embedded_at: new Date().toISOString(),
      });
    }
  }

  console.log(`Embedding usage for recording ${recording_id}: ${totalInputTokens} tokens`);

  // Delete existing chunks for this recording (for re-indexing)
  await supabase
    .from('transcript_chunks')
    .delete()
    .eq('recording_id', recording_id)
    .eq('user_id', user_id);

  // Insert chunks in batches to avoid statement timeouts
  const allInsertedIds: string[] = [];
  const totalBatches = Math.ceil(allChunksToInsert.length / CHUNK_INSERT_BATCH_SIZE);

  for (let i = 0; i < allChunksToInsert.length; i += CHUNK_INSERT_BATCH_SIZE) {
    const batch = allChunksToInsert.slice(i, i + CHUNK_INSERT_BATCH_SIZE);
    const batchNumber = Math.floor(i / CHUNK_INSERT_BATCH_SIZE) + 1;

    const { data: inserted, error: insertError } = await supabase
      .from('transcript_chunks')
      .insert(batch)
      .select('id');

    if (insertError) {
      console.error(`Chunk insert batch ${batchNumber}/${totalBatches} failed for recording ${recording_id}:`, insertError);
      throw new Error(`Error inserting chunks batch ${batchNumber} for ${recording_id}: ${insertError.message}`);
    }

    if (inserted) {
      allInsertedIds.push(...inserted.map(c => c.id));
    }
  }

  console.log(`Inserted ${allInsertedIds.length} chunks in ${totalBatches} batches for recording ${recording_id}`);

  // Trigger metadata enrichment asynchronously (fire-and-forget)
  if (allInsertedIds.length > 0) {
    supabase.functions.invoke('enrich-chunk-metadata', {
      body: { chunk_ids: allInsertedIds },
    }).catch(err => {
      console.error(`Metadata enrichment failed for recording ${recording_id}:`, err);
    });
  }

  return allInsertedIds.length;
}

// Handle task failure with exponential backoff
async function handleTaskFailure(
  supabase: ReturnType<typeof createClient>,
  task: QueueTask,
  errorMessage: string
): Promise<void> {
  const newAttempts = task.attempts + 1;
  const isTimeoutError = errorMessage.toLowerCase().includes('statement timeout') ||
                         errorMessage.toLowerCase().includes('timeout');

  // Special handling for timeout errors - reset to pending with longer delay
  // Timeouts often succeed on retry when database load decreases
  if (isTimeoutError) {
    const timeoutBackoffSeconds = 300; // 5 minutes for timeout retry
    const nextRetryAt = new Date(Date.now() + timeoutBackoffSeconds * 1000);

    await supabase.from('embedding_queue').update({
      status: 'pending', // Reset to pending, not failed - timeouts are transient
      attempts: newAttempts,
      last_error: errorMessage,
      next_retry_at: nextRetryAt.toISOString(),
      locked_at: null,
      worker_id: null,
    }).eq('id', task.id);

    // Don't count timeout as a failure for job progress - it will be retried
    console.log(
      `Timeout error for task ${task.id} (recording ${task.recording_id}), ` +
      `scheduled retry in ${timeoutBackoffSeconds}s (attempt ${newAttempts}/${task.max_attempts})`
    );
    return;
  }

  // Standard failure handling for non-timeout errors
  const shouldRetry = newAttempts < task.max_attempts;

  // Exponential backoff: 30s, 90s, 270s
  const backoffSeconds = Math.pow(3, newAttempts) * 10;
  const nextRetryAt = new Date(Date.now() + backoffSeconds * 1000);

  await supabase.from('embedding_queue').update({
    status: shouldRetry ? 'failed' : 'dead_letter',
    attempts: newAttempts,
    last_error: errorMessage,
    next_retry_at: shouldRetry ? nextRetryAt.toISOString() : null,
    locked_at: null,
    worker_id: null,
  }).eq('id', task.id);

  // Update job progress with failure
  await supabase.rpc('increment_embedding_progress', {
    p_job_id: task.job_id,
    p_success: false,
    p_chunks_created: 0,
  });

  console.log(
    `Task ${task.id} (recording ${task.recording_id}) failed (attempt ${newAttempts}/${task.max_attempts}). ` +
    (shouldRetry ? `Will retry after ${backoffSeconds}s` : 'Moved to dead letter queue')
  );
}

// Finalize jobs where all queue items are processed
async function finalizeCompletedJobs(supabase: ReturnType<typeof createClient>): Promise<void> {
  const { data: count } = await supabase.rpc('finalize_embedding_jobs');
  if (count && count > 0) {
    console.log(`Finalized ${count} embedding job(s)`);
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const workerId = crypto.randomUUID();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const { job_id, batch_size = BATCH_SIZE, triggered_by = 'api' } = body;

    console.log(`Worker ${workerId} starting (triggered by: ${triggered_by}, job_id: ${job_id || 'any'})`);

    // 1. Claim tasks atomically using the database function
    const { data: tasks, error: claimError } = await supabase.rpc('claim_embedding_tasks', {
      p_worker_id: workerId,
      p_batch_size: batch_size,
      p_job_id: job_id || null,
    });

    if (claimError) {
      console.error('Error claiming tasks:', claimError);
      throw new Error(`Failed to claim tasks: ${claimError.message}`);
    }

    if (!tasks || tasks.length === 0) {
      console.log(`Worker ${workerId}: No tasks to process`);

      // Check if any jobs need finalization
      await finalizeCompletedJobs(supabase);

      return new Response(
        JSON.stringify({ success: true, processed: 0, message: 'No pending tasks' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Worker ${workerId}: Claimed ${tasks.length} tasks`);

    let processed = 0;
    let failed = 0;
    let totalChunksCreated = 0;

    // 2. Process each claimed task
    for (const task of tasks as QueueTask[]) {
      // Check if we're approaching timeout (leave 30s buffer)
      const elapsedMs = Date.now() - startTime;
      if (elapsedMs > MAX_PROCESSING_TIME_MS) {
        console.log(`Worker ${workerId}: Approaching timeout after ${elapsedMs}ms, stopping with ${tasks.length - processed - failed} tasks remaining`);

        // Release unclaimed tasks back to queue
        const remainingTasks = (tasks as QueueTask[]).slice(processed + failed);
        for (const remainingTask of remainingTasks) {
          await supabase.from('embedding_queue').update({
            status: 'pending',
            locked_at: null,
            worker_id: null,
          }).eq('id', remainingTask.id);
        }
        break;
      }

      try {
        const chunksCreated = await processRecording(supabase, openaiApiKey, task);

        // Mark task completed
        await supabase.from('embedding_queue').update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        }).eq('id', task.id);

        // Update job progress
        await supabase.rpc('increment_embedding_progress', {
          p_job_id: task.job_id,
          p_success: true,
          p_chunks_created: chunksCreated,
        });

        processed++;
        totalChunksCreated += chunksCreated;
        console.log(`Worker ${workerId}: Completed recording ${task.recording_id} (${chunksCreated} chunks)`);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Worker ${workerId}: Failed recording ${task.recording_id}:`, errorMessage);
        await handleTaskFailure(supabase, task, errorMessage);
        failed++;
      }
    }

    // 3. Check if more work exists
    const { count: pendingCount } = await supabase
      .from('embedding_queue')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'failed'])
      .or('next_retry_at.is.null,next_retry_at.lte.now()');

    const hasPendingWork = (pendingCount ?? 0) > 0;

    if (hasPendingWork) {
      console.log(`Worker ${workerId}: ${pendingCount} tasks remaining, triggering next worker`);

      // Self-invoke next worker (fire-and-forget)
      EdgeRuntime.waitUntil(
        supabase.functions.invoke('process-embeddings', {
          body: { job_id, batch_size, triggered_by: 'self' },
        }).catch(err => {
          console.error('Failed to self-invoke worker:', err);
        })
      );
    } else {
      console.log(`Worker ${workerId}: No more pending tasks, finalizing jobs`);
      await finalizeCompletedJobs(supabase);
    }

    const durationMs = Date.now() - startTime;
    console.log(`Worker ${workerId}: Completed in ${durationMs}ms. Processed: ${processed}, Failed: ${failed}, Chunks: ${totalChunksCreated}`);

    return new Response(
      JSON.stringify({
        success: true,
        worker_id: workerId,
        processed,
        failed,
        chunks_created: totalChunksCreated,
        duration_ms: durationMs,
        pending_remaining: pendingCount || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`Worker ${workerId} error:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
