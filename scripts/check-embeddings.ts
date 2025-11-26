#!/usr/bin/env node
/**
 * CHECK EMBEDDINGS STATUS
 * =======================
 *
 * Verify that transcript chunks and embeddings exist before running RAG tests
 *
 * Usage:
 *   npx tsx scripts/check-embeddings.ts <user_id>
 *
 * Example:
 *   npx tsx scripts/check-embeddings.ts 550e8400-e29b-41d4-a716-446655440000
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: Missing required environment variables');
  console.error('Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEmbeddings(userId: string) {
  console.log('═'.repeat(80));
  console.log('EMBEDDING STATUS CHECK');
  console.log('═'.repeat(80));
  console.log(`\nUser ID: ${userId}\n`);

  try {
    // Check total chunks
    const { count: totalChunks, error: totalError } = await supabase
      .from('transcript_chunks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (totalError) {
      console.error('ERROR checking chunks:', totalError.message);
      process.exit(1);
    }

    console.log(`✓ Total chunks: ${totalChunks || 0}`);

    if (!totalChunks || totalChunks === 0) {
      console.log('\n❌ No transcript chunks found for this user');
      console.log('\nNext steps:');
      console.log('1. Ensure you have transcripts in fathom_calls table');
      console.log('2. Run the embedding Edge Function to create chunks');
      console.log('3. Re-run this check');
      process.exit(1);
    }

    // Check chunks with embeddings
    const { count: withEmbeddings, error: embError } = await supabase
      .from('transcript_chunks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .not('embedding', 'is', null);

    if (embError) {
      console.error('ERROR checking embeddings:', embError.message);
      process.exit(1);
    }

    console.log(`✓ Chunks with embeddings: ${withEmbeddings || 0}`);

    const embedPercentage = totalChunks > 0 ? ((withEmbeddings || 0) / totalChunks * 100).toFixed(1) : '0.0';
    console.log(`  (${embedPercentage}% embedded)`);

    // Check chunks with topics
    const { count: withTopics, error: topicsError } = await supabase
      .from('transcript_chunks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .not('topics', 'is', null)
      .neq('topics', '{}');

    if (topicsError) {
      console.error('ERROR checking topics:', topicsError.message);
    } else {
      console.log(`✓ Chunks with topics: ${withTopics || 0}`);
      const topicsPercentage = totalChunks > 0 ? ((withTopics || 0) / totalChunks * 100).toFixed(1) : '0.0';
      console.log(`  (${topicsPercentage}% tagged)`);
    }

    // Check chunks with intent signals
    const { count: withIntent, error: intentError } = await supabase
      .from('transcript_chunks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .not('intent_signals', 'is', null)
      .neq('intent_signals', '{}');

    if (intentError) {
      console.error('ERROR checking intent signals:', intentError.message);
    } else {
      console.log(`✓ Chunks with intent signals: ${withIntent || 0}`);
      const intentPercentage = totalChunks > 0 ? ((withIntent || 0) / totalChunks * 100).toFixed(1) : '0.0';
      console.log(`  (${intentPercentage}% tagged)`);
    }

    // Check unique recordings
    const { data: recordings, error: recError } = await supabase
      .from('transcript_chunks')
      .select('recording_id')
      .eq('user_id', userId);

    if (!recError && recordings) {
      const uniqueRecordings = new Set(recordings.map(r => r.recording_id)).size;
      console.log(`✓ Unique recordings: ${uniqueRecordings}`);
    }

    // Get sample chunk for inspection
    const { data: sample, error: sampleError } = await supabase
      .from('transcript_chunks')
      .select('chunk_text, topics, intent_signals, sentiment')
      .eq('user_id', userId)
      .not('embedding', 'is', null)
      .limit(1)
      .single();

    if (!sampleError && sample) {
      console.log('\n' + '─'.repeat(80));
      console.log('SAMPLE CHUNK');
      console.log('─'.repeat(80));
      console.log(`\nText: ${sample.chunk_text.substring(0, 200)}...`);
      console.log(`\nTopics: ${sample.topics?.join(', ') || 'none'}`);
      console.log(`Intent: ${sample.intent_signals?.join(', ') || 'none'}`);
      console.log(`Sentiment: ${sample.sentiment || 'none'}`);
    }

    console.log('\n' + '═'.repeat(80));
    console.log('READINESS ASSESSMENT');
    console.log('═'.repeat(80));

    const ready = (withEmbeddings || 0) >= (totalChunks || 0) * 0.8;

    if (ready) {
      console.log('\n✅ READY FOR RAG TESTING');
      console.log('\nRun the test suite with:');
      console.log(`npm run test:rag ${userId}`);
    } else {
      console.log('\n⚠️  NOT READY FOR RAG TESTING');
      console.log('\nIssues:');
      if ((withEmbeddings || 0) === 0) {
        console.log('- No embeddings generated yet');
      } else if ((withEmbeddings || 0) < (totalChunks || 0) * 0.8) {
        console.log(`- Only ${embedPercentage}% of chunks have embeddings (need >80%)`);
      }
      if ((withTopics || 0) === 0) {
        console.log('- No topics extracted (optional but recommended)');
      }
      if ((withIntent || 0) === 0) {
        console.log('- No intent signals extracted (optional but recommended)');
      }
      console.log('\nNext steps:');
      console.log('1. Run embedding job for this user');
      console.log('2. Optionally run metadata extraction for topics/intents');
      console.log('3. Re-run this check');
    }

    console.log('');

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
  console.error('  npx tsx scripts/check-embeddings.ts <user_id>\n');
  console.error('Example:');
  console.error('  npx tsx scripts/check-embeddings.ts 550e8400-e29b-41d4-a716-446655440000\n');
  console.error('Get user ID with:');
  console.error('  npx tsx scripts/get-user-id.ts <email>');
  process.exit(1);
}

checkEmbeddings(userId);
