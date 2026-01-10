#!/usr/bin/env node
/**
 * BACKFILL CHUNK METADATA
 * =======================
 *
 * This script enriches existing transcript chunks with metadata
 * (topics, sentiment, entities, intent_signals) using the
 * enrich-chunk-metadata edge function.
 *
 * Usage:
 *   npx tsx scripts/backfill-chunk-metadata.ts [options]
 *
 * Options:
 *   --limit=N       Maximum number of chunks to process (default: all)
 *   --batch-size=N  Number of chunks per API call (default: 10)
 *   --dry-run       Show what would be done without making changes
 *   --help          Show this help message
 *
 * Example:
 *   npx tsx scripts/backfill-chunk-metadata.ts --limit 10
 *   npx tsx scripts/backfill-chunk-metadata.ts --batch-size=5
 *   npx tsx scripts/backfill-chunk-metadata.ts --dry-run
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: Missing required environment variables');
  console.error('Required: SUPABASE_URL (or VITE_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface BackfillOptions {
  limit: number | null;
  batchSize: number;
  dryRun: boolean;
}

interface ChunkToEnrich {
  id: string;
  recording_id: number;
  chunk_index: number;
  user_id: string;
}

function parseArgs(): BackfillOptions | null {
  const args = process.argv.slice(2);

  // Check for help flag
  if (args.includes('--help') || args.includes('-h')) {
    return null;
  }

  // Parse limit
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;

  // Parse batch size
  const batchSizeArg = args.find(arg => arg.startsWith('--batch-size='));
  const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1], 10) : 10;

  // Check for dry run
  const dryRun = args.includes('--dry-run');

  return { limit, batchSize, dryRun };
}

function showUsage() {
  console.error('BACKFILL CHUNK METADATA');
  console.error('='.repeat(40));
  console.error('');
  console.error('Usage:');
  console.error('  npx tsx scripts/backfill-chunk-metadata.ts [options]');
  console.error('');
  console.error('Options:');
  console.error('  --limit=N       Maximum number of chunks to process (default: all)');
  console.error('  --batch-size=N  Number of chunks per API call (default: 10)');
  console.error('  --dry-run       Show what would be done without making changes');
  console.error('  --help          Show this help message');
  console.error('');
  console.error('Example:');
  console.error('  npx tsx scripts/backfill-chunk-metadata.ts --limit 10');
  console.error('  npx tsx scripts/backfill-chunk-metadata.ts --batch-size=5');
  console.error('  npx tsx scripts/backfill-chunk-metadata.ts --dry-run');
}

async function findChunksWithoutMetadata(limit: number | null): Promise<ChunkToEnrich[]> {
  // Find chunks where topics is NULL (meaning no metadata has been extracted)
  let query = supabase
    .from('transcript_chunks')
    .select('id, recording_id, chunk_index, user_id')
    .is('topics', null)
    .order('created_at', { ascending: true });

  if (limit) {
    query = query.limit(limit);
  }

  const { data: chunks, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch chunks: ${error.message}`);
  }

  return chunks || [];
}

async function getTotalChunkStats(): Promise<{ total: number; withMetadata: number; withoutMetadata: number }> {
  // Get total chunks count
  const { count: total, error: totalError } = await supabase
    .from('transcript_chunks')
    .select('*', { count: 'exact', head: true });

  if (totalError) {
    throw new Error(`Failed to count chunks: ${totalError.message}`);
  }

  // Get chunks with metadata count
  const { count: withMetadata, error: metadataError } = await supabase
    .from('transcript_chunks')
    .select('*', { count: 'exact', head: true })
    .not('topics', 'is', null);

  if (metadataError) {
    throw new Error(`Failed to count enriched chunks: ${metadataError.message}`);
  }

  return {
    total: total || 0,
    withMetadata: withMetadata || 0,
    withoutMetadata: (total || 0) - (withMetadata || 0),
  };
}

async function enrichChunkBatch(chunkIds: string[]): Promise<{
  processed: number;
  successful: number;
  failed: number;
  results: Array<{ id: string; success: boolean; error?: string }>;
}> {
  const enrichUrl = `${supabaseUrl}/functions/v1/enrich-chunk-metadata`;

  const response = await fetch(enrichUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({ chunk_ids: chunkIds }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return {
    processed: data.processed || 0,
    successful: data.successful || 0,
    failed: data.failed || 0,
    results: data.results || [],
  };
}

async function backfillChunkMetadata(options: BackfillOptions) {
  const { limit, batchSize, dryRun } = options;

  console.log('═'.repeat(80));
  console.log('BACKFILL CHUNK METADATA');
  console.log('═'.repeat(80));
  console.log(`\nBatch Size: ${batchSize}`);
  console.log(`Limit: ${limit || 'all'}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}\n`);

  try {
    // Get statistics
    console.log('Fetching chunk statistics...');
    const stats = await getTotalChunkStats();

    console.log(`\nTotal chunks: ${stats.total}`);
    console.log(`Already enriched: ${stats.withMetadata} (${((stats.withMetadata / (stats.total || 1)) * 100).toFixed(1)}%)`);
    console.log(`Missing metadata: ${stats.withoutMetadata}`);

    // Find chunks without metadata
    console.log('\nFinding chunks without metadata...');
    const chunksToEnrich = await findChunksWithoutMetadata(limit);

    if (chunksToEnrich.length === 0) {
      console.log('\n✅ All chunks already have metadata!');
      return;
    }

    console.log(`\nFound ${chunksToEnrich.length} chunks to enrich`);

    // Calculate batches
    const totalBatches = Math.ceil(chunksToEnrich.length / batchSize);
    console.log(`Will process in ${totalBatches} batch(es) of up to ${batchSize} chunks each`);

    if (dryRun) {
      console.log('\n' + '─'.repeat(80));
      console.log('DRY RUN - No changes will be made');
      console.log('─'.repeat(80));
      console.log(`\nWould enrich ${chunksToEnrich.length} chunks in ${totalBatches} batches`);
      console.log('\nSample chunk IDs:');
      chunksToEnrich.slice(0, 10).forEach(chunk => {
        console.log(`  - ${chunk.id} (recording: ${chunk.recording_id}, index: ${chunk.chunk_index})`);
      });
      if (chunksToEnrich.length > 10) {
        console.log(`  ... and ${chunksToEnrich.length - 10} more`);
      }
      return;
    }

    console.log('\n' + '─'.repeat(80));
    console.log('PROCESSING BATCHES');
    console.log('─'.repeat(80));

    let totalProcessed = 0;
    let totalSuccessful = 0;
    let totalFailed = 0;

    // Process in batches
    for (let i = 0; i < chunksToEnrich.length; i += batchSize) {
      const batchNumber = Math.floor(i / batchSize) + 1;
      const batchChunks = chunksToEnrich.slice(i, i + batchSize);
      const batchChunkIds = batchChunks.map(c => c.id);

      console.log(`\n[Batch ${batchNumber}/${totalBatches}] Processing ${batchChunkIds.length} chunks...`);

      try {
        const result = await enrichChunkBatch(batchChunkIds);

        console.log(`  ✓ Processed: ${result.processed}, Successful: ${result.successful}, Failed: ${result.failed}`);

        totalProcessed += result.processed;
        totalSuccessful += result.successful;
        totalFailed += result.failed;

        // Log any failures
        const failures = result.results.filter(r => !r.success);
        if (failures.length > 0) {
          console.log(`  ⚠ Failures:`);
          failures.slice(0, 3).forEach(f => {
            console.log(`    - ${f.id}: ${f.error}`);
          });
          if (failures.length > 3) {
            console.log(`    ... and ${failures.length - 3} more failures`);
          }
        }

        // Small delay between batches to avoid rate limiting
        if (i + batchSize < chunksToEnrich.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

      } catch (batchError) {
        console.error(`  ✗ Batch error: ${batchError}`);
        totalFailed += batchChunkIds.length;
      }
    }

    // Summary
    console.log('\n' + '═'.repeat(80));
    console.log('BACKFILL SUMMARY');
    console.log('═'.repeat(80));
    console.log(`\nTotal processed: ${totalProcessed}`);
    console.log(`Successful: ${totalSuccessful}`);
    console.log(`Failed: ${totalFailed}`);

    // Calculate new coverage
    const newWithMetadata = stats.withMetadata + totalSuccessful;
    const newCoverage = ((newWithMetadata / (stats.total || 1)) * 100).toFixed(1);
    console.log(`\nNew metadata coverage: ${newWithMetadata}/${stats.total} (${newCoverage}%)`);

    if (totalFailed > 0) {
      console.log('\n⚠️  Some chunks failed to enrich. You may need to re-run for remaining chunks.');
      process.exit(1);
    }

    console.log(`\n✅ Successfully enriched ${totalSuccessful} chunks with metadata`);

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

backfillChunkMetadata(options);
