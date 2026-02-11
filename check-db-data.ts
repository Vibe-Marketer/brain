import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vltmrnjsubfzrgrtdqey.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsdG1ybmpzdWJmenJncnRkcWV5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mzg3NTAwNywiZXhwIjoyMDc5NDUxMDA3fQ.a8Lp_JzIk4f4ROiRPBTNGZgnTMQ6Ok5rRuQzkx3stv8';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkData() {
  console.log('=== CHECKING DATABASE ===\n');

  // Count calls
  const { count: callsCount, error: callsError } = await supabase
    .from('fathom_calls')
    .select('*', { count: 'exact', head: true });
  console.log(`Total fathom_calls: ${callsCount}`);
  if (callsError) console.error('Error counting calls:', callsError);

  // Sample calls with details
  const { data: calls, error: callsSampleError } = await supabase
    .from('fathom_calls')
    .select('recording_id, title, created_at, recorded_by_name, summary')
    .order('created_at', { ascending: false })
    .limit(10);
  console.log(`\nSample calls (${calls?.length || 0} found):`);
  calls?.forEach(c => {
    console.log(`  - ID ${c.recording_id}: "${c.title}" (${c.created_at?.split('T')[0]}) by ${c.recorded_by_name}`);
    if (c.summary) console.log(`    Summary: ${c.summary.slice(0, 100)}...`);
  });
  if (callsSampleError) console.error('Error fetching calls:', callsSampleError);

  // Count transcripts
  const { count: transcriptsCount, error: transcriptsError } = await supabase
    .from('fathom_transcripts')
    .select('*', { count: 'exact', head: true });
  console.log(`\nTotal fathom_transcripts: ${transcriptsCount}`);
  if (transcriptsError) console.error('Error counting transcripts:', transcriptsError);

  // Check embeddings status
  const { count: withEmbeddings, error: embError } = await supabase
    .from('fathom_transcripts')
    .select('*', { count: 'exact', head: true })
    .not('embedding', 'is', null);
  console.log(`Transcripts WITH embeddings: ${withEmbeddings} (${Math.round((withEmbeddings || 0) / (transcriptsCount || 1) * 100)}%)`);
  if (embError) console.error('Error checking embeddings:', embError);

  // Sample transcripts with speaker names
  const { data: transcripts, error: transcriptsSampleError } = await supabase
    .from('fathom_transcripts')
    .select('id, recording_id, speaker_name, speaker_email, chunk_text, embedding')
    .limit(5);
  console.log(`\nSample transcripts (${transcripts?.length || 0} found):`);
  transcripts?.forEach(t => {
    console.log(`  - ID ${t.id}: Speaker "${t.speaker_name}" (${t.speaker_email || 'no email'}) on recording ${t.recording_id}`);
    console.log(`    Text: ${t.chunk_text?.slice(0, 80)}...`);
    console.log(`    Has embedding: ${!!t.embedding}`);
  });
  if (transcriptsSampleError) console.error('Error fetching transcripts:', transcriptsSampleError);

  // Get unique speakers
  const { data: speakers, error: speakersError } = await supabase
    .from('fathom_transcripts')
    .select('speaker_name')
    .not('speaker_name', 'is', null)
    .limit(1000);
  const uniqueSpeakers = [...new Set(speakers?.map(s => s.speaker_name))];
  console.log(`\nUnique speakers (${uniqueSpeakers.length} total):`, uniqueSpeakers.slice(0, 10).join(', '));
  if (speakersError) console.error('Error fetching speakers:', speakersError);

  // Get categories if available (might be in a column or JSONB)
  const { data: categorySample, error: catError } = await supabase
    .from('fathom_calls')
    .select('recording_id, title, category')
    .not('category', 'is', null)
    .limit(5);
  console.log(`\nCategories found: ${categorySample?.length || 0} calls with categories`);
  if (categorySample?.length) {
    categorySample.forEach(c => console.log(`  - Recording ${c.recording_id}: category "${c.category}"`));
  }
  if (catError) console.error('Error fetching categories:', catError);

  // Check recordings table if it exists
  const { count: recordingsCount, error: recordingsError } = await supabase
    .from('recordings')
    .select('*', { count: 'exact', head: true });
  console.log(`\nTotal recordings table: ${recordingsCount}`);
  if (recordingsError) console.log('Recordings table error (might not exist):', recordingsError.message);

  // Date range of available data
  const { data: dateRange, error: dateError } = await supabase
    .from('fathom_calls')
    .select('created_at')
    .order('created_at', { ascending: true })
    .limit(1);
  const { data: dateRangeEnd, error: dateEndError } = await supabase
    .from('fathom_calls')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1);
  console.log(`\nDate range: ${dateRange?.[0]?.created_at?.split('T')[0]} to ${dateRangeEnd?.[0]?.created_at?.split('T')[0]}`);
}

checkData().catch(console.error);
