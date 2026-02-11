import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vltmrnjsubfzrgrtdqey.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsdG1ybmpzdWJmenJncnRkcWV5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mzg3NTAwNywiZXhwIjoyMDc5NDUxMDA3fQ.a8Lp_JzIk4f4ROiRPBTNGZgnTMQ6Ok5rRuQzkx3stv8';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkSchema() {
  console.log('=== CHECKING SCHEMA ===\n');

  // Get fathom_transcripts columns by fetching one row
  const { data: transcript, error: tError } = await supabase
    .from('fathom_transcripts')
    .select('*')
    .limit(1);
  
  if (transcript && transcript.length > 0) {
    console.log('fathom_transcripts columns:', Object.keys(transcript[0]).join(', '));
  } else {
    console.log('No transcript data found', tError);
  }

  // Get fathom_calls columns
  const { data: call, error: cError } = await supabase
    .from('fathom_calls')
    .select('*')
    .limit(1);
  
  if (call && call.length > 0) {
    console.log('\nfathom_calls columns:', Object.keys(call[0]).join(', '));
  } else {
    console.log('No call data found', cError);
  }

  // Check a transcript with actual data
  const { data: transcriptSample, error: tsError } = await supabase
    .from('fathom_transcripts')
    .select('*')
    .not('content', 'is', null)
    .limit(1);
  
  if (transcriptSample && transcriptSample.length > 0) {
    console.log('\nSample transcript with data:');
    const t = transcriptSample[0];
    console.log('  ID:', t.id);
    console.log('  Recording ID:', t.recording_id);
    console.log('  Speaker:', t.speaker_name);
    console.log('  Content length:', t.content?.length || 0);
    console.log('  Has embedding:', !!t.embedding);
    console.log('  Columns:', Object.keys(t).filter(k => t[k] !== null).join(', '));
  }
}

checkSchema().catch(console.error);
