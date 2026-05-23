#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const jobId = '4d1dbb3e-1ac9-44ab-94b2-b03395a459a9';

  console.log('Testing increment_embedding_progress RPC...\n');

  // Get job before
  const { data: before } = await supabase
    .from('embedding_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  console.log('BEFORE:');
  console.log(`  Progress: ${before.progress_current}/${before.progress_total}`);
  console.log(`  Queue Completed: ${before.queue_completed}`);
  console.log(`  Chunks Created: ${before.chunks_created}`);

  // Try to increment
  console.log('\nCalling increment_embedding_progress...');
  const { data, error } = await supabase.rpc('increment_embedding_progress', {
    p_job_id: jobId,
    p_success: true,
    p_chunks_created: 5
  });

  if (error) {
    console.error('ERROR:', error);
    return;
  }

  console.log('RPC returned:', data);

  // Get job after
  const { data: after } = await supabase
    .from('embedding_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  console.log('\nAFTER:');
  console.log(`  Progress: ${after.progress_current}/${after.progress_total}`);
  console.log(`  Queue Completed: ${after.queue_completed}`);
  console.log(`  Chunks Created: ${after.chunks_created}`);

  const changed =
    after.progress_current !== before.progress_current ||
    after.queue_completed !== before.queue_completed ||
    after.chunks_created !== before.chunks_created;

  console.log(`\n${changed ? '✓ Function works!' : '❌ Function did NOT update job'}`);
}

test().catch(console.error);
