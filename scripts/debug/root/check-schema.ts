import { createClient } from '@supabase/supabase-js';

const requireEnv = (name: string, fallback?: string): string => {
  const value = process.env[name] ?? (fallback ? process.env[fallback] : undefined);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}${fallback ? ` (or ${fallback})` : ''}`);
  }
  return value;
};

const supabaseUrl = requireEnv('SUPABASE_URL', 'VITE_SUPABASE_URL');
const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

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
