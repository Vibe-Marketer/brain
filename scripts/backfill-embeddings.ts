#!/usr/bin/env node
/**
 * BACKFILL EMBEDDINGS FOR MISSING RECORDINGS
 * ==========================================
 *
 * This script identifies recordings without embeddings and queues them
 * for processing using the embedding queue system.
 *
 * Usage:
 *   npx tsx scripts/backfill-embeddings.ts <user_id> [--batch-size=50] [--dry-run]
 *
 * Options:
 *   --batch-size=N  Number of recordings per job batch (default: 50)
 *   --dry-run       Show what would be done without making changes
 *   --help          Show this help message
 *
 * Example:
 *   npx tsx scripts/backfill-embeddings.ts ef054159-3a5a-49e3-9fd8-31fa5a180ee6
 *   npx tsx scripts/backfill-embeddings.ts ef054159-3a5a-49e3-9fd8-31fa5a180ee6 --batch-size=25
 *   npx tsx scripts/backfill-embeddings.ts ef054159-3a5a-49e3-9fd8-31fa5a180ee6 --dry-run
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: Missing required environment variables');
  console.error('Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface BackfillOptions {
  userId: string;
  batchSize: number;
  dryRun: boolean;
}

function parseArgs(): BackfillOptions | null {
  const args = process.argv.slice(2);

  // Check for help flag
  if (args.includes('--help') || args.includes('-h')) {
    return null;
  }

  // Find user ID (first non-flag argument)
  const userId = args.find(arg => !arg.startsWith('--'));

  if (!userId) {
    return null;
  }

  // Parse batch size
  const batchSizeArg = args.find(arg => arg.startsWith('--batch-size='));
  const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1], 10) : 50;

  // Check for dry run
  const dryRun = args.includes('--dry-run');

  return { userId, batchSize, dryRun };
}

function showUsage() {
  console.error('BACKFILL EMBEDDINGS');
  console.error('='.repeat(40));
  console.error('');
  console.error('Usage:');
  console.error('  npx tsx scripts/backfill-embeddings.ts <user_id> [options]');
  console.error('');
  console.error('Options:');
  console.error('  --batch-size=N  Number of recordings per job batch (default: 50)');
  console.error('  --dry-run       Show what would be done without making changes');
  console.error('  --help          Show this help message');
  console.error('');
  console.error('Example:');
  console.error('  npx tsx scripts/backfill-embeddings.ts ef054159-3a5a-49e3-9fd8-31fa5a180ee6');
  console.error('  npx tsx scripts/backfill-embeddings.ts ef054159-3a5a-49e3-9fd8-31fa5a180ee6 --batch-size=25');
  console.error('  npx tsx scripts/backfill-embeddings.ts ef054159-3a5a-49e3-9fd8-31fa5a180ee6 --dry-run');
  console.error('');
  console.error('Get user ID with:');
  console.error('  npx tsx scripts/get-user-id.ts <email>');
}

async function findMissingRecordings(userId: string): Promise<number[]> {
  // Get all user's recordings with transcripts
  const { data: allCalls, error: callsError } = await supabase
    .from('fathom_calls')
    .select('recording_id')
    .eq('user_id', userId)
    .not('full_transcript', 'is', null);

  if (callsError) {
    throw new Error(`Failed to fetch calls: ${callsError.message}`);
  }

  if (!allCalls || allCalls.length === 0) {
    return [];
  }

  // Get recordings that already have chunks
  const { data: indexedChunks, error: chunksError } = await supabase
    .from('transcript_chunks')
    .select('recording_id')
    .eq('user_id', userId);

  if (chunksError) {
    throw new Error(`Failed to fetch indexed chunks: ${chunksError.message}`);
  }

  const indexedRecordingIds = new Set(indexedChunks?.map(c => c.recording_id) || []);
  const missingRecordings = allCalls
    .map(c => c.recording_id)
    .filter(id => !indexedRecordingIds.has(id));

  return missingRecordings;
}

async function createJobAndQueue(
  userId: string,
  recordingIds: number[],
  batchNumber: number,
  totalBatches: number
): Promise<{ jobId: string; queued: number }> {
  // Create embedding job
  const { data: job, error: jobError } = await supabase
    .from('embedding_jobs')
    .insert({
      user_id: userId,
      recording_ids: recordingIds,
      status: 'running',
      progress_total: recordingIds.length,
      progress_current: 0,
      chunks_created: 0,
      queue_total: recordingIds.length,
      queue_completed: 0,
      queue_failed: 0,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (jobError) {
    throw new Error(`Failed to create embedding job: ${jobError.message}`);
  }

  // Create queue entries
  const queueEntries = recordingIds.map(recordingId => ({
    user_id: userId,
    job_id: job.id,
    recording_id: recordingId,
    status: 'pending',
  }));

  const { error: queueError } = await supabase
    .from('embedding_queue')
    .insert(queueEntries);

  if (queueError) {
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

  return { jobId: job.id, queued: recordingIds.length };
}

async function triggerWorker(jobId: string): Promise<boolean> {
  try {
    const workerUrl = `${supabaseUrl}/functions/v1/process-embeddings`;
    const response = await fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ job_id: jobId, batch_size: 10, triggered_by: 'backfill-script' }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`  Worker trigger failed: ${response.status} - ${errorText}`);
      return false;
    }

    return true;
  } catch (err) {
    console.error(`  Worker trigger error: ${err}`);
    return false;
  }
}

async function backfillEmbeddings(options: BackfillOptions) {
  const { userId, batchSize, dryRun } = options;

  console.log('═'.repeat(80));
  console.log('BACKFILL EMBEDDINGS');
  console.log('═'.repeat(80));
  console.log(`\nUser ID: ${userId}`);
  console.log(`Batch Size: ${batchSize}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}\n`);

  try {
    // Find recordings without embeddings
    console.log('Finding recordings without embeddings...');
    const missingRecordings = await findMissingRecordings(userId);

    if (missingRecordings.length === 0) {
      console.log('\n✅ All recordings are already embedded!');
      return;
    }

    // Get total calls for context
    const { count: totalCalls } = await supabase
      .from('fathom_calls')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .not('full_transcript', 'is', null);

    const embeddedCount = (totalCalls || 0) - missingRecordings.length;
    const currentCoverage = ((embeddedCount / (totalCalls || 1)) * 100).toFixed(1);

    console.log(`\nTotal calls with transcripts: ${totalCalls}`);
    console.log(`Already embedded: ${embeddedCount} (${currentCoverage}%)`);
    console.log(`Missing embeddings: ${missingRecordings.length}`);

    // Calculate batches
    const totalBatches = Math.ceil(missingRecordings.length / batchSize);
    console.log(`\nWill create ${totalBatches} batch(es) of up to ${batchSize} recordings each`);

    if (dryRun) {
      console.log('\n' + '─'.repeat(80));
      console.log('DRY RUN - No changes will be made');
      console.log('─'.repeat(80));
      console.log(`\nWould queue ${missingRecordings.length} recordings in ${totalBatches} batches`);
      console.log('\nSample recording IDs:');
      missingRecordings.slice(0, 10).forEach(id => console.log(`  - ${id}`));
      if (missingRecordings.length > 10) {
        console.log(`  ... and ${missingRecordings.length - 10} more`);
      }
      return;
    }

    console.log('\n' + '─'.repeat(80));
    console.log('PROCESSING BATCHES');
    console.log('─'.repeat(80));

    let totalQueued = 0;
    let successfulJobs = 0;
    let failedJobs = 0;
    const jobIds: string[] = [];

    // Process in batches
    for (let i = 0; i < missingRecordings.length; i += batchSize) {
      const batchNumber = Math.floor(i / batchSize) + 1;
      const batchRecordings = missingRecordings.slice(i, i + batchSize);

      console.log(`\n[Batch ${batchNumber}/${totalBatches}] Processing ${batchRecordings.length} recordings...`);

      try {
        // Create job and queue entries
        const { jobId, queued } = await createJobAndQueue(
          userId,
          batchRecordings,
          batchNumber,
          totalBatches
        );

        console.log(`  Created job ${jobId}`);
        console.log(`  Queued ${queued} recordings`);
        jobIds.push(jobId);
        totalQueued += queued;

        // Trigger the worker
        const triggered = await triggerWorker(jobId);
        if (triggered) {
          console.log(`  ✓ Worker triggered successfully`);
          successfulJobs++;
        } else {
          console.log(`  ⚠ Worker trigger failed (job will be picked up by cron)`);
          successfulJobs++; // Job is still created, just worker trigger failed
        }

        // Small delay between batches to avoid overwhelming the system
        if (i + batchSize < missingRecordings.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (batchError) {
        console.error(`  ✗ Error: ${batchError}`);
        failedJobs++;
      }
    }

    // Summary
    console.log('\n' + '═'.repeat(80));
    console.log('BACKFILL SUMMARY');
    console.log('═'.repeat(80));
    console.log(`\nTotal recordings queued: ${totalQueued}`);
    console.log(`Successful job batches: ${successfulJobs}`);
    console.log(`Failed job batches: ${failedJobs}`);

    if (jobIds.length > 0) {
      console.log(`\nJob IDs created:`);
      jobIds.forEach(id => console.log(`  - ${id}`));
    }

    const expectedCoverage = (((embeddedCount + totalQueued) / (totalCalls || 1)) * 100).toFixed(1);
    console.log(`\nExpected coverage after processing: ${expectedCoverage}%`);

    console.log('\n' + '─'.repeat(80));
    console.log('NEXT STEPS');
    console.log('─'.repeat(80));
    console.log('\n1. Monitor progress with:');
    console.log(`   npx tsx scripts/check-backfill-progress.ts ${userId}`);
    console.log('\n2. Check queue status with:');
    console.log(`   npx tsx scripts/check-embeddings.ts ${userId}`);
    console.log('\n3. Workers will process the queue automatically');
    console.log('   (via self-chain or external cron trigger)');

    if (failedJobs > 0) {
      console.log('\n⚠️  Some batches failed. You may need to re-run for remaining recordings.');
      process.exit(1);
    }

    console.log('\n✅ Backfill queued successfully!');

  } catch (error) {
    console.error('\nFATAL ERROR:', error);
    process.exit(1);
  }
}

// CLI execution
const options = parseArgs();

if (!options) {
  showUsage();
  process.exit(1);
}

backfillEmbeddings(options);
