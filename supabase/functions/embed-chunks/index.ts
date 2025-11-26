import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { get_encoding } from 'https://esm.sh/tiktoken@1.0.12';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize tiktoken encoder for accurate token counting
// Using cl100k_base encoding for OpenAI text-embedding-3-small model
const encoder = get_encoding('cl100k_base');

interface TranscriptSegment {
  id: string;
  speaker_name: string | null;
  speaker_email: string | null;
  text: string;
  timestamp: string | null;
}

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

// Chunk transcripts into ~400 token segments with 20% overlap (100 tokens)
// Total chunk size with overlap: ~500 tokens
function chunkTranscript(
  segments: TranscriptSegment[],
  maxTokens: number = 400,
  overlapTokens: number = 100
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
  };
  let currentTokens = 0;

  // Buffer to store segments for overlap (last ~100 tokens worth)
  interface SegmentWithTokens {
    segment: TranscriptSegment;
    formattedText: string;
    tokens: number;
  }
  let overlapBuffer: SegmentWithTokens[] = [];
  let overlapBufferTokens = 0;

  for (const segment of segments) {
    const segmentText = segment.text.trim();
    if (!segmentText) continue;

    // Accurate token counting using tiktoken (cl100k_base encoding)
    const speakerPrefix = segment.speaker_name ? `${segment.speaker_name}: ` : '';
    const fullSegmentText = speakerPrefix + segmentText;
    const tokens = encoder.encode(fullSegmentText);
    const segmentTokens = tokens.length;

    // If adding this segment would exceed the limit, save current chunk and start new one
    if (currentTokens + segmentTokens > maxTokens && currentChunk.text.length > 0) {
      chunks.push({ ...currentChunk, speakers: new Set(currentChunk.speakers) });

      // Log the completed chunk token count for debugging
      const chunkTokens = encoder.encode(currentChunk.text);
      console.log(`Chunk ${chunks.length - 1}: ${chunkTokens.length} tokens, ${currentChunk.text.length} chars`);

      // Start new chunk with overlap from previous chunk
      currentChunk = {
        text: '',
        speakers: new Set<string>(),
        startTimestamp: null,
        endTimestamp: null,
      };
      currentTokens = 0;

      // Add overlap buffer to new chunk
      for (const bufferedItem of overlapBuffer) {
        const bufferedSegment = bufferedItem.segment;

        currentChunk.text += (currentChunk.text ? '\n' : '') + bufferedItem.formattedText;

        if (bufferedSegment.speaker_name) {
          currentChunk.speakers.add(bufferedSegment.speaker_name);
        }

        if (!currentChunk.startTimestamp && bufferedSegment.timestamp) {
          currentChunk.startTimestamp = bufferedSegment.timestamp;
        }
        currentChunk.endTimestamp = bufferedSegment.timestamp;
        currentTokens += bufferedItem.tokens;
      }
    }

    // Add speaker prefix for context
    currentChunk.text += (currentChunk.text ? '\n' : '') + speakerPrefix + segmentText;

    if (segment.speaker_name) {
      currentChunk.speakers.add(segment.speaker_name);
    }

    if (!currentChunk.startTimestamp && segment.timestamp) {
      currentChunk.startTimestamp = segment.timestamp;
    }
    currentChunk.endTimestamp = segment.timestamp;
    currentTokens += segmentTokens;

    // Update overlap buffer - keep last ~100 tokens worth of segments
    overlapBuffer.push({
      segment,
      formattedText: fullSegmentText,
      tokens: segmentTokens,
    });
    overlapBufferTokens += segmentTokens;

    // Remove oldest segments from buffer if we exceed overlap token limit
    while (overlapBufferTokens > overlapTokens && overlapBuffer.length > 1) {
      const removed = overlapBuffer.shift()!;
      overlapBufferTokens -= removed.tokens;
    }
  }

  // Don't forget the last chunk
  if (currentChunk.text.length > 0) {
    chunks.push(currentChunk);

    // Log the final chunk token count for debugging
    const chunkTokens = encoder.encode(currentChunk.text);
    console.log(`Chunk ${chunks.length - 1} (final): ${chunkTokens.length} tokens, ${currentChunk.text.length} chars`);
  }

  return chunks;
}

// Generate embeddings using OpenAI API
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

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

      // Get all user's recordings
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
            recordings_processed: 0,
            recordings_failed: 0,
            chunks_created: 0,
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
            recordings_processed: 0,
            recordings_failed: 0,
            chunks_created: 0,
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

    console.log(`Embedding ${recordingsToProcess.length} recordings for user ${user.id}`);

    // Create embedding job
    const { data: job, error: jobError } = await supabase
      .from('embedding_jobs')
      .insert({
        user_id: user.id,
        recording_ids: recordingsToProcess,
        status: 'running',
        progress_total: recordingsToProcess.length,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (jobError) {
      console.error('Error creating job:', jobError);
      throw jobError;
    }

    let totalChunksCreated = 0;
    const failedRecordingIds: number[] = [];

    // Process each recording
    for (let i = 0; i < recordingsToProcess.length; i++) {
      const recordingId = recordingsToProcess[i];

      try {
        // Get call metadata
        const { data: call, error: callError } = await supabase
          .from('fathom_calls')
          .select('*')
          .eq('recording_id', recordingId)
          .eq('user_id', user.id)
          .single();

        if (callError || !call) {
          console.error(`Call ${recordingId} not found:`, callError);
          failedRecordingIds.push(recordingId);
          continue;
        }

        // Get transcript segments
        const { data: segments, error: segmentsError } = await supabase
          .from('fathom_transcripts')
          .select('*')
          .eq('recording_id', recordingId)
          .eq('is_deleted', false)
          .order('timestamp', { ascending: true });

        if (segmentsError) {
          console.error(`Error fetching segments for ${recordingId}:`, segmentsError);
          failedRecordingIds.push(recordingId);
          continue;
        }

        if (!segments || segments.length === 0) {
          console.log(`No segments for ${recordingId}, skipping`);
          continue;
        }

        // Get category for this call
        const { data: categoryAssignment } = await supabase
          .from('call_category_assignments')
          .select('category_id, call_categories(name)')
          .eq('call_recording_id', recordingId)
          .maybeSingle();

        const categoryName = categoryAssignment?.call_categories?.name || null;

        // Chunk the transcript with 400 token chunks + 100 token overlap
        const chunks = chunkTranscript(segments, 400, 100);
        console.log(`Created ${chunks.length} chunks for recording ${recordingId}`);

        if (chunks.length === 0) continue;

        // Generate embeddings in batches of 100
        const batchSize = 100;
        const allChunksToInsert: TranscriptChunk[] = [];

        for (let batchStart = 0; batchStart < chunks.length; batchStart += batchSize) {
          const batchEnd = Math.min(batchStart + batchSize, chunks.length);
          const batchChunks = chunks.slice(batchStart, batchEnd);
          const batchTexts = batchChunks.map(c => c.text);

          // Generate embeddings
          const embeddings = await generateEmbeddings(batchTexts, openaiApiKey);

          // Prepare chunks for insertion
          for (let j = 0; j < batchChunks.length; j++) {
            const chunk = batchChunks[j];
            const chunkIndex = batchStart + j;
            const primarySpeaker = Array.from(chunk.speakers)[0] || null;

            // Find speaker email from segments
            const speakerSegment = segments.find(s => s.speaker_name === primarySpeaker);
            const speakerEmail = speakerSegment?.speaker_email || null;

            allChunksToInsert.push({
              user_id: user.id,
              recording_id: recordingId,
              chunk_text: chunk.text,
              chunk_index: chunkIndex,
              speaker_name: primarySpeaker,
              speaker_email: speakerEmail,
              timestamp_start: chunk.startTimestamp,
              timestamp_end: chunk.endTimestamp,
              call_date: call.created_at,
              call_title: call.title,
              call_category: categoryName,
              embedding: embeddings[j],
              embedded_at: new Date().toISOString(),
            });
          }
        }

        // Delete existing chunks for this recording (for re-indexing)
        await supabase
          .from('transcript_chunks')
          .delete()
          .eq('recording_id', recordingId)
          .eq('user_id', user.id);

        // Insert all chunks
        const { data: insertedChunks, error: insertError } = await supabase
          .from('transcript_chunks')
          .insert(allChunksToInsert)
          .select('id');

        if (insertError) {
          console.error(`Error inserting chunks for ${recordingId}:`, insertError);
          failedRecordingIds.push(recordingId);
          continue;
        }

        totalChunksCreated += allChunksToInsert.length;
        console.log(`Inserted ${allChunksToInsert.length} chunks for recording ${recordingId}`);

        // Enrich chunk metadata asynchronously (fire-and-forget)
        // Don't await - we don't want to block the embedding response
        if (insertedChunks && insertedChunks.length > 0) {
          const insertedChunkIds = insertedChunks.map(c => c.id);
          console.log(`Triggering metadata enrichment for ${insertedChunkIds.length} chunks`);

          supabase.functions.invoke('enrich-chunk-metadata', {
            body: { chunk_ids: insertedChunkIds },
          }).then(({ data, error }) => {
            if (error) {
              console.error(`Metadata enrichment failed for recording ${recordingId}:`, error);
            } else {
              console.log(`Metadata enrichment completed for recording ${recordingId}:`, data);
            }
          }).catch((err) => {
            console.error(`Metadata enrichment call failed for recording ${recordingId}:`, err);
          });
        }

        // Update job progress
        await supabase
          .from('embedding_jobs')
          .update({
            progress_current: i + 1,
            chunks_created: totalChunksCreated,
          })
          .eq('id', job.id);

      } catch (recordingError) {
        console.error(`Error processing recording ${recordingId}:`, recordingError);
        failedRecordingIds.push(recordingId);
      }
    }

    // Complete the job
    await supabase
      .from('embedding_jobs')
      .update({
        status: failedRecordingIds.length === recordingsToProcess.length ? 'failed' : 'completed',
        progress_current: recordingsToProcess.length,
        chunks_created: totalChunksCreated,
        failed_recording_ids: failedRecordingIds,
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    return new Response(
      JSON.stringify({
        success: true,
        job_id: job.id,
        recordings_processed: recordingsToProcess.length - failedRecordingIds.length,
        recordings_failed: failedRecordingIds.length,
        chunks_created: totalChunksCreated,
        failed_recording_ids: failedRecordingIds,
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
