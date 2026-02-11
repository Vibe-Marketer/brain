import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vltmrnjsubfzrgrtdqey.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsdG1ybmpzdWJmenJncnRkcWV5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mzg3NTAwNywiZXhwIjoyMDc5NDUxMDA3fQ.a8Lp_JzIk4f4ROiRPBTNGZgnTMQ6Ok5rRuQzkx3stv8';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkData() {
  console.log('=== DATABASE DATA CHECK ===\n');

  // 1. Check total data
  const { count: callsCount } = await supabase
    .from('fathom_calls')
    .select('*', { count: 'exact', head: true });
  console.log(`✓ Total calls: ${callsCount}`);

  const { count: transcriptsCount } = await supabase
    .from('fathom_transcripts')
    .select('*', { count: 'exact', head: true });
  console.log(`✓ Total transcripts: ${transcriptsCount}\n`);

  // 2. Get unique speakers
  const { data: speakers } = await supabase
    .from('fathom_transcripts')
    .select('speaker_name, speaker_email')
    .not('speaker_name', 'is', null)
    .limit(1000);
  const uniqueSpeakers = [...new Set(speakers?.map(s => s.speaker_name))].filter(Boolean);
  console.log(`✓ Unique speakers (${uniqueSpeakers.length}):`, uniqueSpeakers.slice(0, 15).join(', '));

  // 3. Sample call data
  const { data: calls } = await supabase
    .from('fathom_calls')
    .select('recording_id, title, created_at, recorded_by_name, auto_tags, metadata')
    .order('created_at', { ascending: false })
    .limit(5);
  
  console.log('\n✓ Sample calls:');
  calls?.forEach(c => {
    console.log(`  ID ${c.recording_id}: "${c.title}" by ${c.recorded_by_name}`);
    console.log(`    Date: ${c.created_at?.split('T')[0]}`);
    if (c.auto_tags) console.log(`    Auto tags: ${JSON.stringify(c.auto_tags)}`);
    if (c.metadata) {
      const meta = typeof c.metadata === 'string' ? JSON.parse(c.metadata) : c.metadata;
      console.log(`    Metadata keys: ${Object.keys(meta).join(', ')}`);
    }
  });

  // 4. Sample transcript data
  const { data: transcripts } = await supabase
    .from('fathom_transcripts')
    .select('id, recording_id, speaker_name, text, timestamp')
    .not('text', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5);
  
  console.log('\n✓ Sample transcripts:');
  transcripts?.forEach(t => {
    console.log(`  ID ${t.id} (recording ${t.recording_id})`);
    console.log(`    Speaker: ${t.speaker_name}`);
    console.log(`    Text: "${t.text.slice(0, 100)}..."`);
    console.log(`    Timestamp: ${t.timestamp}`);
  });

  // 5. Date range
  const { data: oldest } = await supabase
    .from('fathom_calls')
    .select('created_at, title')
    .order('created_at', { ascending: true })
    .limit(1);
  
  const { data: newest } = await supabase
    .from('fathom_calls')
    .select('created_at, title')
    .order('created_at', { ascending: false })
    .limit(1);

  console.log(`\n✓ Date range: ${oldest?.[0]?.created_at?.split('T')[0]} to ${newest?.[0]?.created_at?.split('T')[0]}`);
  console.log(`  Oldest: "${oldest?.[0]?.title}"`);
  console.log(`  Newest: "${newest?.[0]?.title}"`);

  // 6. Check for embeddings in a different table or column
  console.log('\n✓ Checking for embeddings/vectors...');
  
  // Try checking if there's a separate embeddings table or vector column
  try {
    const { data: pgTables, error } = await supabase.rpc('exec_sql', { 
      query: `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE '%embed%' OR tablename LIKE '%vector%'`
    });
    console.log('  Embedding/vector tables:', pgTables);
  } catch (e) {
    console.log('  Could not query pg_tables');
  }

  // Check if there's a recordings table (different from fathom_calls)
  const { count: recordingsCount, error: recError } = await supabase
    .from('recordings')
    .select('*', { count: 'exact', head: true });
  
  if (!recError) {
    console.log(`\n✓ recordings table exists: ${recordingsCount} rows`);
    
    const { data: recordingSample } = await supabase
      .from('recordings')
      .select('*')
      .limit(1);
    
    if (recordingSample?.[0]) {
      console.log('  recordings columns:', Object.keys(recordingSample[0]).join(', '));
    }
  }

  // 7. Check metadata for categories/topics
  console.log('\n✓ Checking metadata/tags for categories and topics...');
  const { data: callsWithMeta } = await supabase
    .from('fathom_calls')
    .select('auto_tags, metadata')
    .not('auto_tags', 'is', null)
    .limit(10);

  const allTags = new Set();
  const allMetaKeys = new Set();
  
  callsWithMeta?.forEach(c => {
    if (c.auto_tags) {
      if (Array.isArray(c.auto_tags)) {
        c.auto_tags.forEach(tag => allTags.add(tag));
      } else if (typeof c.auto_tags === 'object') {
        Object.keys(c.auto_tags).forEach(k => allTags.add(k));
      }
    }
    if (c.metadata) {
      const meta = typeof c.metadata === 'string' ? JSON.parse(c.metadata) : c.metadata;
      Object.keys(meta).forEach(k => allMetaKeys.add(k));
    }
  });

  console.log(`  Auto tags found: ${Array.from(allTags).slice(0, 20).join(', ')}`);
  console.log(`  Metadata keys found: ${Array.from(allMetaKeys).join(', ')}`);
}

checkData().catch(console.error);
