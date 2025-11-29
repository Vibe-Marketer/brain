#!/usr/bin/env node
/**
 * RUN EMBEDDINGS FOR ALL UNINDEXED RECORDINGS
 * ============================================
 *
 * This script directly generates embeddings for all unindexed recordings
 * using the service role key (bypasses user auth).
 *
 * Usage:
 *   npx tsx scripts/run-embeddings.ts <user_id>
 *
 * Example:
 *   npx tsx scripts/run-embeddings.ts ef054159-3a5a-49e3-9fd8-31fa5a180ee6
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: Missing required environment variables');
  console.error('Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

if (!openaiApiKey) {
  console.error('ERROR: Missing OPENAI_API_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface TranscriptSegment {
  id: string;
  speaker_name: string | null;
  speaker_email: string | null;
  text: string;
  timestamp: string | null;
}

// Simple token estimation (roughly 4 chars per token)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Chunk transcript into segments
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

    if (currentTokens + segmentTokens > maxTokens && currentChunk.text.length > 0) {
      chunks.push({ ...currentChunk, speakers: new Set(currentChunk.speakers) });

      currentChunk = {
        text: '',
        speakers: new Set<string>(),
        startTimestamp: null,
        endTimestamp: null,
      };
      currentTokens = 0;

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

    currentChunk.text += (currentChunk.text ? '\n' : '') + speakerPrefix + segmentText;

    if (segment.speaker_name) {
      currentChunk.speakers.add(segment.speaker_name);
    }

    if (!currentChunk.startTimestamp && segment.timestamp) {
      currentChunk.startTimestamp = segment.timestamp;
    }
    currentChunk.endTimestamp = segment.timestamp;
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
    chunks.push(currentChunk);
  }

  return chunks;
}

// Generate embeddings using OpenAI API
async function generateEmbeddings(texts: string[]): Promise<number[][]> {
    const response = await fetch("https://gateway.ai.vercel.dev/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
        "x-vercel-ai-provider": "openai"
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text,
      }),
    });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.data.map((item: { embedding: number[] }) => item.embedding);
}

async function runEmbeddings(userId: string) {
  console.log('═'.repeat(80));
  console.log('EMBEDDING GENERATOR');
  console.log('═'.repeat(80));
  console.log(`\nUser ID: ${userId}\n`);

  try {
    // Get all user's recordings
    const { data: allCalls, error: callsError } = await supabase
      .from('fathom_calls')
      .select('recording_id')
      .eq('user_id', userId)
      .not('full_transcript', 'is', null);

    if (callsError) {
      throw new Error(`Failed to fetch calls: ${callsError.message}`);
    }

    if (!allCalls || allCalls.length === 0) {
      console.log('No calls found to embed');
      return;
    }

    console.log(`Found ${allCalls.length} calls with transcripts`);

    // Get recordings that already have chunks
    const { data: indexedChunks, error: chunksError } = await supabase
      .from('transcript_chunks')
      .select('recording_id')
      .eq('user_id', userId);

    if (chunksError) {
      throw new Error(`Failed to fetch indexed chunks: ${chunksError.message}`);
    }

    const indexedRecordingIds = new Set(indexedChunks?.map(c => c.recording_id) || []);
    const recordingsToProcess = allCalls
      .map(c => c.recording_id)
      .filter(id => !indexedRecordingIds.has(id));

    console.log(`Found ${recordingsToProcess.length} unindexed recordings`);
    console.log(`Already indexed: ${indexedRecordingIds.size}`);

    if (recordingsToProcess.length === 0) {
      console.log('\n✅ All recordings are already indexed!');
      return;
    }

    let totalChunksCreated = 0;
    const failedRecordingIds: number[] = [];

    // Process each recording
    for (let i = 0; i < recordingsToProcess.length; i++) {
      const recordingId = recordingsToProcess[i];
      console.log(`\n[${i + 1}/${recordingsToProcess.length}] Processing recording ${recordingId}...`);

      try {
        // Get call metadata
        const { data: call, error: callError } = await supabase
          .from('fathom_calls')
          .select('*')
          .eq('recording_id', recordingId)
          .eq('user_id', userId)
          .single();

        if (callError || !call) {
          console.error(`  ✗ Call not found`);
          failedRecordingIds.push(recordingId);
          continue;
        }

        console.log(`  Title: ${call.title}`);

        // Get transcript segments
        const { data: segments, error: segmentsError } = await supabase
          .from('fathom_transcripts')
          .select('*')
          .eq('recording_id', recordingId)
          .eq('is_deleted', false)
          .order('timestamp', { ascending: true });

        if (segmentsError) {
          console.error(`  ✗ Error fetching segments: ${segmentsError.message}`);
          failedRecordingIds.push(recordingId);
          continue;
        }

        if (!segments || segments.length === 0) {
          console.log(`  ⚠ No segments found, skipping`);
          continue;
        }

        console.log(`  Segments: ${segments.length}`);

        // Get category for this call
        const { data: categoryAssignment } = await supabase
          .from('call_category_assignments')
          .select('category_id, call_categories(name)')
          .eq('call_recording_id', recordingId)
          .maybeSingle();

        const categoryName = (categoryAssignment?.call_categories as any)?.name || null;

        // Chunk the transcript
        const chunks = chunkTranscript(segments, 400, 100);
        console.log(`  Chunks: ${chunks.length}`);

        if (chunks.length === 0) continue;

        // Generate embeddings in batches of 100
        const batchSize = 100;
        const allChunksToInsert: any[] = [];

        for (let batchStart = 0; batchStart < chunks.length; batchStart += batchSize) {
          const batchEnd = Math.min(batchStart + batchSize, chunks.length);
          const batchChunks = chunks.slice(batchStart, batchEnd);
          const batchTexts = batchChunks.map(c => c.text);

          // Generate embeddings
          const embeddings = await generateEmbeddings(batchTexts);

          // Prepare chunks for insertion
          for (let j = 0; j < batchChunks.length; j++) {
            const chunk = batchChunks[j];
            const chunkIndex = batchStart + j;
            const primarySpeaker = Array.from(chunk.speakers)[0] || null;

            // Find speaker email from segments
            const speakerSegment = segments.find(s => s.speaker_name === primarySpeaker);
            const speakerEmail = speakerSegment?.speaker_email || null;

            allChunksToInsert.push({
              user_id: userId,
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
          .eq('user_id', userId);

        // Insert all chunks
        const { error: insertError } = await supabase
          .from('transcript_chunks')
          .insert(allChunksToInsert);

        if (insertError) {
          console.error(`  ✗ Error inserting chunks: ${insertError.message}`);
          failedRecordingIds.push(recordingId);
          continue;
        }

        totalChunksCreated += allChunksToInsert.length;
        console.log(`  ✓ Inserted ${allChunksToInsert.length} chunks`);

      } catch (recordingError) {
        console.error(`  ✗ Error: ${recordingError}`);
        failedRecordingIds.push(recordingId);
      }
    }

    console.log('\n' + '═'.repeat(80));
    console.log('EMBEDDING RESULTS');
    console.log('═'.repeat(80));
    console.log(`\nRecordings processed: ${recordingsToProcess.length - failedRecordingIds.length}`);
    console.log(`Recordings failed: ${failedRecordingIds.length}`);
    console.log(`Total chunks created: ${totalChunksCreated}`);

    if (failedRecordingIds.length > 0) {
      console.log(`\nFailed recording IDs: ${failedRecordingIds.join(', ')}`);
    }

    console.log('\n✅ Embedding complete!');

  } catch (error) {
    console.error('FATAL ERROR:', error);
    process.exit(1);
  }
}

// CLI execution
const userId = process.argv[2];

if (!userId) {
  console.error('ERROR: User ID required\n');
  console.error('Usage:');
  console.error('  npx tsx scripts/run-embeddings.ts <user_id>\n');
  console.error('Example:');
  console.error('  npx tsx scripts/run-embeddings.ts ef054159-3a5a-49e3-9fd8-31fa5a180ee6');
  process.exit(1);
}

runEmbeddings(userId);
