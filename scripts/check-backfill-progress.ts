#!/usr/bin/env node
/**
 * CHECK BACKFILL PROGRESS
 * =======================
 *
 * Monitor the progress of embedding backfill operations, including queue status,
 * job progress, coverage statistics, and stuck items.
 *
 * Usage:
 *   npx tsx scripts/check-backfill-progress.ts <user_id> [--watch] [--interval=10]
 *
 * Options:
 *   --watch         Continuously monitor progress (refresh every interval)
 *   --interval=N    Refresh interval in seconds (default: 10, requires --watch)
 *   --help          Show this help message
 *
 * Example:
 *   npx tsx scripts/check-backfill-progress.ts ef054159-3a5a-49e3-9fd8-31fa5a180ee6
 *   npx tsx scripts/check-backfill-progress.ts ef054159-3a5a-49e3-9fd8-31fa5a180ee6 --watch
 *   npx tsx scripts/check-backfill-progress.ts ef054159-3a5a-49e3-9fd8-31fa5a180ee6 --watch --interval=5
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

interface ProgressOptions {
  userId: string;
  watch: boolean;
  interval: number;
}

interface QueueStatus {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

interface JobSummary {
  status: string;
  count: number;
  chunksCreated: number;
}

function parseArgs(): ProgressOptions | null {
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

  // Check for watch mode
  const watch = args.includes('--watch');

  // Parse interval
  const intervalArg = args.find(arg => arg.startsWith('--interval='));
  const interval = intervalArg ? parseInt(intervalArg.split('=')[1], 10) : 10;

  return { userId, watch, interval };
}

function showUsage() {
  console.error('CHECK BACKFILL PROGRESS');
  console.error('='.repeat(40));
  console.error('');
  console.error('Usage:');
  console.error('  npx tsx scripts/check-backfill-progress.ts <user_id> [options]');
  console.error('');
  console.error('Options:');
  console.error('  --watch         Continuously monitor progress');
  console.error('  --interval=N    Refresh interval in seconds (default: 10)');
  console.error('  --help          Show this help message');
  console.error('');
  console.error('Example:');
  console.error('  npx tsx scripts/check-backfill-progress.ts ef054159-3a5a-49e3-9fd8-31fa5a180ee6');
  console.error('  npx tsx scripts/check-backfill-progress.ts ef054159-3a5a-49e3-9fd8-31fa5a180ee6 --watch');
  console.error('  npx tsx scripts/check-backfill-progress.ts ef054159-3a5a-49e3-9fd8-31fa5a180ee6 --watch --interval=5');
  console.error('');
  console.error('Get user ID with:');
  console.error('  npx tsx scripts/get-user-id.ts <email>');
}

async function getQueueStatus(userId: string): Promise<QueueStatus> {
  const status: QueueStatus = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
  };

  // Get counts for each status
  const statuses = ['pending', 'processing', 'completed', 'failed'] as const;

  for (const s of statuses) {
    const { count, error } = await supabase
      .from('embedding_queue')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', s);

    if (!error && count !== null) {
      status[s] = count;
    }
  }

  return status;
}

async function getJobsSummary(userId: string): Promise<JobSummary[]> {
  const { data, error } = await supabase
    .from('embedding_jobs')
    .select('status, chunks_created')
    .eq('user_id', userId)
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  if (error || !data) {
    return [];
  }

  // Aggregate by status
  const summary: Record<string, { count: number; chunksCreated: number }> = {};

  for (const job of data) {
    if (!summary[job.status]) {
      summary[job.status] = { count: 0, chunksCreated: 0 };
    }
    summary[job.status].count++;
    summary[job.status].chunksCreated += job.chunks_created || 0;
  }

  return Object.entries(summary).map(([status, data]) => ({
    status,
    count: data.count,
    chunksCreated: data.chunksCreated,
  }));
}

async function getCoverage(userId: string): Promise<{ total: number; embedded: number; percentage: number }> {
  // Get total calls with transcripts
  const { count: totalCalls, error: totalError } = await supabase
    .from('fathom_calls')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .not('full_transcript', 'is', null);

  if (totalError) {
    throw new Error(`Failed to get total calls: ${totalError.message}`);
  }

  // Get unique embedded recordings
  const { data: embeddedRecordings, error: embError } = await supabase
    .from('transcript_chunks')
    .select('recording_id')
    .eq('user_id', userId);

  if (embError) {
    throw new Error(`Failed to get embedded recordings: ${embError.message}`);
  }

  const uniqueEmbedded = new Set(embeddedRecordings?.map(r => r.recording_id) || []).size;
  const total = totalCalls || 0;
  const percentage = total > 0 ? (uniqueEmbedded / total) * 100 : 0;

  return { total, embedded: uniqueEmbedded, percentage };
}

async function getStuckItems(userId: string): Promise<Array<{ id: string; recordingId: number; lockedAt: string; duration: string }>> {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('embedding_queue')
    .select('id, recording_id, locked_at')
    .eq('user_id', userId)
    .eq('status', 'processing')
    .lt('locked_at', fiveMinutesAgo)
    .limit(10);

  if (error || !data) {
    return [];
  }

  return data.map(item => {
    const lockedAt = new Date(item.locked_at);
    const durationMs = Date.now() - lockedAt.getTime();
    const durationMinutes = Math.floor(durationMs / 60000);
    const durationSeconds = Math.floor((durationMs % 60000) / 1000);

    return {
      id: item.id,
      recordingId: item.recording_id,
      lockedAt: item.locked_at,
      duration: `${durationMinutes}m ${durationSeconds}s`,
    };
  });
}

async function getRecentFailures(userId: string): Promise<Array<{ recordingId: number; error: string; attempts: number }>> {
  const { data, error } = await supabase
    .from('embedding_queue')
    .select('recording_id, last_error, attempts')
    .eq('user_id', userId)
    .eq('status', 'failed')
    .order('updated_at', { ascending: false })
    .limit(5);

  if (error || !data) {
    return [];
  }

  return data.map(item => ({
    recordingId: item.recording_id,
    error: item.last_error || 'Unknown error',
    attempts: item.attempts || 0,
  }));
}

function formatProgressBar(completed: number, total: number, width: number = 40): string {
  if (total === 0) return '[' + ' '.repeat(width) + ']';
  const percentage = completed / total;
  const filled = Math.round(width * percentage);
  const empty = width - filled;
  return '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']';
}

function estimateTimeRemaining(queueStatus: QueueStatus): string {
  const remaining = queueStatus.pending + queueStatus.processing;
  if (remaining === 0) return 'Complete';
  if (queueStatus.completed === 0) return 'Calculating...';

  // Estimate based on recent processing rate (roughly 30 seconds per recording)
  const estimatedSecondsPerRecording = 30;
  const totalSeconds = remaining * estimatedSecondsPerRecording;

  if (totalSeconds < 60) return `~${totalSeconds} seconds`;
  if (totalSeconds < 3600) return `~${Math.ceil(totalSeconds / 60)} minutes`;
  return `~${(totalSeconds / 3600).toFixed(1)} hours`;
}

async function displayProgress(userId: string, clearScreen: boolean = false) {
  if (clearScreen) {
    process.stdout.write('\x1B[2J\x1B[0f');
  }

  console.log('═'.repeat(80));
  console.log('BACKFILL PROGRESS MONITOR');
  console.log('═'.repeat(80));
  console.log(`\nUser ID: ${userId}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  try {
    // Get queue status
    const queueStatus = await getQueueStatus(userId);
    const queueTotal = queueStatus.pending + queueStatus.processing + queueStatus.completed + queueStatus.failed;

    console.log('─'.repeat(80));
    console.log('QUEUE STATUS');
    console.log('─'.repeat(80));
    console.log(`\n  Pending:     ${queueStatus.pending.toString().padStart(6)}`);
    console.log(`  Processing:  ${queueStatus.processing.toString().padStart(6)}`);
    console.log(`  Completed:   ${queueStatus.completed.toString().padStart(6)}`);
    console.log(`  Failed:      ${queueStatus.failed.toString().padStart(6)}`);
    console.log(`  ────────────────────`);
    console.log(`  Total:       ${queueTotal.toString().padStart(6)}`);

    if (queueTotal > 0) {
      const progressPercentage = ((queueStatus.completed / queueTotal) * 100).toFixed(1);
      console.log(`\n  Progress: ${formatProgressBar(queueStatus.completed, queueTotal)} ${progressPercentage}%`);
      console.log(`  Est. Time Remaining: ${estimateTimeRemaining(queueStatus)}`);
    }

    // Get jobs summary
    const jobsSummary = await getJobsSummary(userId);

    if (jobsSummary.length > 0) {
      console.log('\n' + '─'.repeat(80));
      console.log('JOBS (Last 7 Days)');
      console.log('─'.repeat(80));

      let totalJobs = 0;
      let totalChunks = 0;

      for (const job of jobsSummary) {
        const statusIcon = job.status === 'completed' ? '✓' :
                          job.status === 'running' ? '⋯' :
                          job.status === 'failed' ? '✗' : '•';
        console.log(`\n  ${statusIcon} ${job.status.padEnd(20)} Jobs: ${job.count.toString().padStart(4)}  Chunks: ${job.chunksCreated.toString().padStart(6)}`);
        totalJobs += job.count;
        totalChunks += job.chunksCreated;
      }

      console.log(`  ────────────────────────────────────────────────`);
      console.log(`  Total                     Jobs: ${totalJobs.toString().padStart(4)}  Chunks: ${totalChunks.toString().padStart(6)}`);
    }

    // Get coverage
    const coverage = await getCoverage(userId);

    console.log('\n' + '─'.repeat(80));
    console.log('EMBEDDING COVERAGE');
    console.log('─'.repeat(80));
    console.log(`\n  Total Calls:    ${coverage.total}`);
    console.log(`  Embedded:       ${coverage.embedded}`);
    console.log(`  Coverage:       ${coverage.percentage.toFixed(1)}%`);
    console.log(`\n  ${formatProgressBar(coverage.embedded, coverage.total)} ${coverage.percentage.toFixed(1)}%`);

    if (coverage.percentage >= 95) {
      console.log('\n  ✅ Coverage goal achieved (>95%)');
    } else if (coverage.percentage >= 80) {
      console.log('\n  ⚠️  Good progress, approaching goal (need >95%)');
    } else {
      console.log(`\n  ⏳ ${(coverage.total - coverage.embedded)} calls still need embeddings`);
    }

    // Get stuck items
    const stuckItems = await getStuckItems(userId);

    if (stuckItems.length > 0) {
      console.log('\n' + '─'.repeat(80));
      console.log('⚠️  STUCK ITEMS (Processing > 5 minutes)');
      console.log('─'.repeat(80));

      for (const item of stuckItems) {
        console.log(`\n  Recording: ${item.recordingId}`);
        console.log(`  Locked:    ${item.lockedAt}`);
        console.log(`  Duration:  ${item.duration}`);
      }

      console.log('\n  Consider checking worker logs or resetting these items.');
    }

    // Get recent failures
    const failures = await getRecentFailures(userId);

    if (failures.length > 0) {
      console.log('\n' + '─'.repeat(80));
      console.log('❌ RECENT FAILURES');
      console.log('─'.repeat(80));

      for (const failure of failures) {
        console.log(`\n  Recording: ${failure.recordingId}`);
        console.log(`  Attempts:  ${failure.attempts}`);
        console.log(`  Error:     ${failure.error.substring(0, 100)}${failure.error.length > 100 ? '...' : ''}`);
      }
    }

    // Summary
    console.log('\n' + '═'.repeat(80));
    console.log('STATUS SUMMARY');
    console.log('═'.repeat(80));

    const isComplete = queueStatus.pending === 0 && queueStatus.processing === 0;
    const hasFailures = queueStatus.failed > 0;
    const hasStuck = stuckItems.length > 0;

    if (isComplete && !hasFailures) {
      console.log('\n✅ Backfill complete! All queue items processed.');
    } else if (isComplete && hasFailures) {
      console.log(`\n⚠️  Backfill complete with ${queueStatus.failed} failures.`);
      console.log('   Consider investigating failed items or re-running backfill.');
    } else if (hasStuck) {
      console.log('\n⚠️  Backfill in progress with stuck items.');
      console.log('   Worker may need attention.');
    } else {
      console.log('\n⏳ Backfill in progress...');
      console.log(`   ${queueStatus.pending + queueStatus.processing} items remaining.`);
    }

    console.log('');

    return { isComplete, queueStatus, coverage };

  } catch (error) {
    console.error('\nFATAL ERROR:', error);
    process.exit(1);
  }
}

async function checkBackfillProgress(options: ProgressOptions) {
  const { userId, watch, interval } = options;

  if (!watch) {
    await displayProgress(userId);
    return;
  }

  // Watch mode - continuously monitor
  console.log(`Starting watch mode (refresh every ${interval}s, press Ctrl+C to stop)\n`);

  const runCheck = async () => {
    const result = await displayProgress(userId, true);

    // If complete, offer to stop
    if (result?.isComplete && result?.queueStatus.failed === 0) {
      console.log('Backfill complete! Stopping watch mode.');
      process.exit(0);
    }
  };

  await runCheck();

  setInterval(runCheck, interval * 1000);
}

// CLI execution
const options = parseArgs();

if (!options) {
  showUsage();
  process.exit(1);
}

checkBackfillProgress(options);
