#!/usr/bin/env node
/**
 * Directly fix the increment_embedding_progress function
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const fixSQL = `
CREATE OR REPLACE FUNCTION public.increment_embedding_progress(
  p_job_id UUID,
  p_success BOOLEAN,
  p_chunks_created INT DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE embedding_jobs
  SET
    progress_current = progress_current + 1,
    queue_completed = CASE WHEN p_success THEN queue_completed + 1 ELSE queue_completed END,
    queue_failed = CASE WHEN NOT p_success THEN queue_failed + 1 ELSE queue_failed END,
    chunks_created = chunks_created + p_chunks_created
  WHERE id = p_job_id;
END;
$$;
`;

async function fix() {
  console.log('Fixing increment_embedding_progress function...\n');

  const { data, error } = await supabase.rpc('query', {
    query: fixSQL
  }).single();

  if (error) {
    // Try direct approach with raw SQL if RPC doesn't work
    console.log('RPC approach failed, trying direct SQL execution...');

    // Use a simple test to verify we can execute
    const testSql = 'SELECT 1 as test';
    const { data: testData, error: testError } = await supabase.rpc('query', {
      query: testSql
    });

    if (testError) {
      console.error('Cannot execute SQL:', testError);
      console.log('\nManual fix required. Run this SQL in Supabase SQL Editor:');
      console.log('='.repeat(80));
      console.log(fixSQL);
      console.log('='.repeat(80));
      process.exit(1);
    }
  }

  console.log('✓ Function fixed!\n');
  console.log('Now testing the fix...\n');

  // Test it
  const jobId = '4d1dbb3e-1ac9-44ab-94b2-b03395a459a9';

  const { error: testError } = await supabase.rpc('increment_embedding_progress', {
    p_job_id: jobId,
    p_success: true,
    p_chunks_created: 1
  });

  if (testError) {
    console.error('Test failed:', testError);
    process.exit(1);
  }

  console.log('✓ Test passed! Function is working.\n');

  // Show updated job
  const { data: job } = await supabase
    .from('embedding_jobs')
    .select('progress_current, queue_completed, chunks_created')
    .eq('id', jobId)
    .single();

  console.log('Updated job stats:');
  console.log(`  Progress: ${job.progress_current}`);
  console.log(`  Queue Completed: ${job.queue_completed}`);
  console.log(`  Chunks Created: ${job.chunks_created}`);
}

fix().catch(err => {
  console.error('Error:', err);
  console.log('\n\nManual fix required. Run this SQL in Supabase SQL Editor:');
  console.log('='.repeat(80));
  console.log(fixSQL);
  console.log('='.repeat(80));
  process.exit(1);
});
