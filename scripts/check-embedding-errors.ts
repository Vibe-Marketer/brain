#!/usr/bin/env node
/**
 * Check embedding errors and database state
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const userId = 'ef054159-3a5a-49e3-9fd8-31fa5a180ee6';

async function main() {
  console.log('='.repeat(80));
  console.log('EMBEDDING ERROR ANALYSIS');
  console.log('='.repeat(80));

  // Check failed items
  console.log('\n1. Failed Queue Items:');
  const { data: failed, error: failError } = await supabase
    .from('embedding_queue')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'failed')
    .limit(5);

  if (failError) {
    console.error('Error:', failError);
  } else {
    console.log(`Found ${failed?.length || 0} failed items`);
    failed?.forEach((item: any) => {
      console.log(`\n  Recording ${item.recording_id}:`);
      console.log(`    Attempts: ${item.attempts}/${item.max_attempts}`);
      console.log(`    Error: ${item.last_error?.substring(0, 200)}`);
    });
  }

  // Check completed items - do they actually have chunks?
  console.log('\n\n2. Completed Items vs Actual Chunks:');
  const { data: completed } = await supabase
    .from('embedding_queue')
    .select('recording_id')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .limit(10);

  if (completed && completed.length > 0) {
    const recordingIds = completed.map((c: any) => c.recording_id);
    console.log(`Checking ${recordingIds.length} completed recordings...`);

    const { data: chunks, error: chunkError } = await supabase
      .from('transcript_chunks')
      .select('recording_id')
      .in('recording_id', recordingIds)
      .eq('user_id', userId);

    if (chunkError) {
      console.error('Error:', chunkError);
    } else {
      const chunkedRecordings = new Set(chunks?.map((c: any) => c.recording_id) || []);
      console.log(`  Completed in queue: ${recordingIds.length}`);
      console.log(`  Actually have chunks: ${chunkedRecordings.size}`);
      console.log(`  Missing chunks: ${recordingIds.length - chunkedRecordings.size}`);

      // Show which ones are missing
      const missing = recordingIds.filter((id: number) => !chunkedRecordings.has(id));
      if (missing.length > 0 && missing.length <= 5) {
        console.log(`  Missing: ${missing.join(', ')}`);
      }
    }
  }

  // Check if RPC functions exist
  console.log('\n\n3. Testing RPC Functions:');
  try {
    const { data, error } = await supabase.rpc('claim_embedding_tasks', {
      p_worker_id: 'test-check',
      p_batch_size: 0,  // Don't actually claim anything
      p_job_id: null
    });

    if (error) {
      console.log(`  ❌ claim_embedding_tasks: ${error.message}`);
    } else {
      console.log(`  ✓ claim_embedding_tasks exists (returned ${data?.length || 0} tasks)`);
    }
  } catch (err) {
    console.log(`  ❌ claim_embedding_tasks: ${err}`);
  }

  // Check recent job
  console.log('\n\n4. Recent Embedding Job:');
  const { data: jobs } = await supabase
    .from('embedding_jobs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (jobs && jobs.length > 0) {
    const job = jobs[0];
    console.log(`  Job ID: ${job.id}`);
    console.log(`  Status: ${job.status}`);
    console.log(`  Queue Total: ${job.queue_total}`);
    console.log(`  Queue Completed: ${job.queue_completed}`);
    console.log(`  Queue Failed: ${job.queue_failed}`);
    console.log(`  Chunks Created: ${job.chunks_created}`);
    console.log(`  Progress: ${job.progress_current}/${job.progress_total}`);
  }

  // Check OpenAI API key
  console.log('\n\n5. Environment Check:');
  const openaiKey = process.env.OPENAI_API_KEY;
  console.log(`  OPENAI_API_KEY: ${openaiKey ? '✓ Set (' + openaiKey.substring(0, 10) + '...)' : '❌ Missing'}`);
  console.log(`  SUPABASE_URL: ${supabaseUrl ? '✓ Set' : '❌ Missing'}`);
  console.log(`  SERVICE_ROLE_KEY: ${supabaseKey ? '✓ Set' : '❌ Missing'}`);
}

main().catch(console.error);
