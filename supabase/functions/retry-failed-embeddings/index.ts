import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
};

/**
 * RETRY-FAILED-EMBEDDINGS - Recovery Worker for Dead Letter Queue
 *
 * This function is designed to handle recordings that failed in the main pipeline
 * due to database timeouts or other transient errors. It uses:
 * - Ultra-small batch sizes for chunk insertion (5 per batch)
 * - Single recording processing (no batch claiming)
 * - Incremental progress tracking
 * - Extended timeout tolerance
 *
 * Trigger this manually or via cron for dead_letter queue recovery.
 */

const CHUNK_INSERT_BATCH_SIZE = 5; // Much smaller than main worker (50)
const MAX_PROCESSING_TIME_MS = 120000; // 2 minutes (more conservative)

// Simple token estimation
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
  last_error: string | null;
}

// Split oversized text
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

  const sentences = text.match(/[^.!?]+[.!?]+[\s]*/g) || [text];
  let currentText = '';
  const maxChars = maxTokens * 4;

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

// Chunk transcript with adaptive sizing
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

    if (segmentTokens > maxTokens) {
      if (currentChunk.text.length > 0) {
        chunks.push({
          text: currentChunk.text,
          speakers: new Set(currentChunk.speakers),
          startTimestamp: currentChunk.startTimestamp,
          endTimestamp: currentChunk.endTimestamp,
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

      const splitChunks = splitOversizedText(
        fullSegmentText,
        targetTokens,
        segment.speaker_name,
        segment.timestamp
      );
      chunks.push(...splitChunks);

      overlapBuffer.length = 0;
      overlapBufferTokens = 0;
      continue;
    }

    const willExceedTarget = currentTokens + segmentTokens > targetTokens;
    const willExceedMax = currentTokens + segmentTokens > maxTokens;
    const isSameSpeaker = currentChunk.lastSpeaker === segment.speaker_name;
    const shouldSplit = willExceedMax || (willExceedTarget && !isSameSpeaker);

    if (shouldSplit && currentChunk.text.length > 0) {
      chunks.push({
        text: currentChunk.text,
        speakers: new Set(currentChunk.speakers),
        startTimestamp: currentChunk.startTimestamp,
        endTimestamp: currentChunk.endTimestamp,
      });

      currentChunk = {
        text: '',
        speakers: new Set<string>(),
        startTimestamp: null,
        endTimestamp: null,
        lastSpeaker: null,
      };
      currentTokens = 0;

      for (const bufferedItem of overlapBuffer) {
        const bufferedSegment = bufferedItem.segment;

        if (currentTokens + bufferedItem.tokens < targetTokens) {
          currentChunk.text += (currentChunk.text ? '\n' : '') + bufferedItem.formattedText;
          if (bufferedSegment.speaker_name) {
            currentChunk.speakers.add(bufferedSegment.speaker_name);
          }
          if (!currentChunk.startTimestamp && bufferedSegment.timestamp) {
            currentChunk.startTimestamp = bufferedSegment.timestamp;
          }
          currentChunk.lastSpeaker = bufferedSegment.speaker_name || null;
          currentTokens += bufferedItem.tokens;
        }
      }
    }

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

    overlapBuffer.push({
      segment,
      formattedText: fullSegmentText,
      tokens: segmentTokens,
    });
    overlapBufferTokens += segmentTokens;

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
      endTimestamp: currentChunk.endTimestamp,
    });
  }

  return chunks;
}

// Generate embeddings using OpenAI
async function generateEmbeddings(texts: string[], openaiApiKey: string): Promise<number[][]> {
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
  return data.data.map((item: { embedding: number[] }) => item.embedding);
}

// Process a single recording with ultra-small batches
async function processRecordingWithSmallBatches(
  supabase: ReturnType<typeof createClient>,
  openaiApiKey: string,
  task: QueueTask
): Promise<number> {
  const { recording_id, user_id } = task;

  console.log(`[RETRY] Processing recording ${recording_id} with small batches`);

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

  // Get transcript segments
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
    console.log(`[RETRY] No segments for ${recording_id}, skipping`);
    return 0;
  }

  // Get tag
  const { data: tagAssignment } = await supabase
    .from('call_tag_assignments')
    .select('tag_id, call_tags(name)')
    .eq('call_recording_id', recording_id)
    .maybeSingle();

  const tagName = (tagAssignment?.call_tags as { name: string } | null)?.name || null;

  // Chunk the transcript
  const chunks = chunkTranscript(segments, 500, 100, 1200);
  console.log(`[RETRY] Created ${chunks.length} chunks for recording ${recording_id}`);

  if (chunks.length === 0) return 0;

  // Generate embeddings in batches of 100
  const embeddingBatchSize = 100;
  const allChunksToInsert: TranscriptChunk[] = [];

  for (let batchStart = 0; batchStart < chunks.length; batchStart += embeddingBatchSize) {
    const batchEnd = Math.min(batchStart + embeddingBatchSize, chunks.length);
    const batchChunks = chunks.slice(batchStart, batchEnd);
    const batchTexts = batchChunks.map((c) => c.text);

    const embeddings = await generateEmbeddings(batchTexts, openaiApiKey);

    for (let j = 0; j < batchChunks.length; j++) {
      const chunk = batchChunks[j];
      const chunkIndex = batchStart + j;
      const primarySpeaker = Array.from(chunk.speakers)[0] || null;

      const speakerSegment = segments.find((s) => s.speaker_name === primarySpeaker);
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
        embedding: embeddings[j],
        embedded_at: new Date().toISOString(),
      });
    }
  }

  // Delete existing chunks
  await supabase
    .from('transcript_chunks')
    .delete()
    .eq('recording_id', recording_id)
    .eq('user_id', user_id);

  // Insert chunks in ULTRA-SMALL batches (5 at a time instead of 50)
  const allInsertedIds: string[] = [];
  const totalBatches = Math.ceil(allChunksToInsert.length / CHUNK_INSERT_BATCH_SIZE);

  console.log(`[RETRY] Inserting ${allChunksToInsert.length} chunks in ${totalBatches} batches (${CHUNK_INSERT_BATCH_SIZE} per batch)`);

  for (let i = 0; i < allChunksToInsert.length; i += CHUNK_INSERT_BATCH_SIZE) {
    const batch = allChunksToInsert.slice(i, i + CHUNK_INSERT_BATCH_SIZE);
    const batchNumber = Math.floor(i / CHUNK_INSERT_BATCH_SIZE) + 1;

    const { data: inserted, error: insertError } = await supabase
      .from('transcript_chunks')
      .insert(batch)
      .select('id');

    if (insertError) {
      console.error(
        `[RETRY] Chunk insert batch ${batchNumber}/${totalBatches} failed for recording ${recording_id}:`,
        insertError
      );
      throw new Error(
        `Error inserting chunks batch ${batchNumber} for ${recording_id}: ${insertError.message}`
      );
    }

    if (inserted) {
      allInsertedIds.push(...inserted.map((c) => c.id));
    }

    // Log progress every 10 batches
    if (batchNumber % 10 === 0) {
      console.log(`[RETRY] Progress: ${batchNumber}/${totalBatches} batches inserted (${allInsertedIds.length} chunks)`);
    }
  }

  console.log(`[RETRY] Successfully inserted ${allInsertedIds.length} chunks in ${totalBatches} batches for recording ${recording_id}`);

  // Trigger metadata enrichment
  if (allInsertedIds.length > 0) {
    supabase.functions
      .invoke('enrich-chunk-metadata', {
        body: { chunk_ids: allInsertedIds },
      })
      .catch((err) => {
        console.error(`[RETRY] Metadata enrichment failed for recording ${recording_id}:`, err);
      });
  }

  return allInsertedIds.length;
}

Deno.serve(async (req) => {
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
    const { recording_id, force_retry = false } = body;

    console.log(`[RETRY] Worker ${workerId} starting for dead_letter recovery`);

    // Get dead_letter tasks (or specific recording if provided)
    let query = supabase
      .from('embedding_queue')
      .select('*')
      .eq('status', 'dead_letter')
      .order('created_at', { ascending: true });

    if (recording_id) {
      query = query.eq('recording_id', recording_id);
    }

    if (!force_retry) {
      // Only process items that haven't been retried recently (last 1 hour)
      const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
      query = query.or(`next_retry_at.is.null,next_retry_at.lte.${oneHourAgo}`);
    }

    const { data: tasks, error: fetchError } = await query.limit(1);

    if (fetchError) {
      console.error('[RETRY] Error fetching dead_letter tasks:', fetchError);
      throw new Error(`Failed to fetch dead_letter tasks: ${fetchError.message}`);
    }

    if (!tasks || tasks.length === 0) {
      console.log('[RETRY] No dead_letter tasks to process');
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: 'No dead_letter tasks' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const task = tasks[0] as QueueTask;
    console.log(`[RETRY] Processing dead_letter task for recording ${task.recording_id}`);

    // Mark as processing
    await supabase
      .from('embedding_queue')
      .update({
        locked_at: new Date().toISOString(),
        worker_id: workerId,
      })
      .eq('id', task.id);

    try {
      const chunksCreated = await processRecordingWithSmallBatches(supabase, openaiApiKey, task);

      // Mark task completed
      await supabase
        .from('embedding_queue')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', task.id);

      // Update job progress
      await supabase.rpc('increment_embedding_progress', {
        p_job_id: task.job_id,
        p_success: true,
        p_chunks_created: chunksCreated,
      });

      const durationMs = Date.now() - startTime;
      console.log(`[RETRY] Worker ${workerId}: Successfully recovered recording ${task.recording_id} in ${durationMs}ms (${chunksCreated} chunks)`);

      // Check if more dead_letter tasks exist
      const { count: remainingCount } = await supabase
        .from('embedding_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'dead_letter');

      return new Response(
        JSON.stringify({
          success: true,
          worker_id: workerId,
          processed: 1,
          recording_id: task.recording_id,
          chunks_created: chunksCreated,
          duration_ms: durationMs,
          dead_letter_remaining: remainingCount || 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[RETRY] Failed to process recording ${task.recording_id}:`, errorMessage);

      // Update task with new error
      await supabase
        .from('embedding_queue')
        .update({
          last_error: `[RETRY] ${errorMessage}`,
          next_retry_at: new Date(Date.now() + 3600000).toISOString(), // Retry in 1 hour
          locked_at: null,
          worker_id: null,
        })
        .eq('id', task.id);

      throw error;
    }
  } catch (error) {
    console.error(`[RETRY] Worker ${workerId} error:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
