import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vltmrnjsubfzrgrtdqey.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsdG1ybmpzdWJmenJncnRkcWV5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mzg3NTAwNywiZXhwIjoyMDc5NDUxMDA3fQ.a8Lp_JzIk4f4ROiRPBTNGZgnTMQ6Ok5rRuQzkx3stv8';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkFunctions() {
  console.log('🔍 Checking required database functions...\n');
  
  // Try calling hybrid_search_transcripts
  console.log('Testing: hybrid_search_transcripts');
  try {
    const { data, error } = await supabase.rpc('hybrid_search_transcripts', {
      query_text: 'test',
      query_embedding: '[0.1, 0.2, 0.3]', // Dummy embedding
      match_count: 1,
      full_text_weight: 1.0,
      semantic_weight: 1.0,
      rrf_k: 60,
      filter_user_id: 'ad6cdef0-8dc0-4ad5-bfe7-f0e1bce01be4', // a@vibeos.com
      filter_date_start: null,
      filter_date_end: null,
      filter_speakers: null,
      filter_categories: null,
      filter_recording_ids: null,
    });
    
    if (error) {
      console.log(`  ❌ Error: ${error.message}`);
      console.log(`  Code: ${error.code}`);
      console.log(`  Details: ${error.details}`);
    } else {
      console.log(`  ✅ Function exists and returns data (${data?.length || 0} results)`);
    }
  } catch (e) {
    console.log(`  ❌ Exception: ${e}`);
  }
  
  // Try calling get_available_metadata
  console.log('\nTesting: get_available_metadata');
  try {
    const { data, error } = await supabase.rpc('get_available_metadata', {
      p_user_id: 'ad6cdef0-8dc0-4ad5-bfe7-f0e1bce01be4',
      p_metadata_type: 'speakers',
    });
    
    if (error) {
      console.log(`  ❌ Error: ${error.message}`);
    } else {
      console.log(`  ✅ Function exists and returns ${data?.length || 0} values`);
      if (data && data.length > 0) {
        console.log(`     Sample: ${data.slice(0, 5).join(', ')}`);
      }
    }
  } catch (e) {
    console.log(`  ❌ Exception: ${e}`);
  }
  
  // Check if embeddings exist
  console.log('\nTesting: embeddings in fathom_transcripts');
  try {
    const { data, error } = await supabase
      .from('fathom_transcripts')
      .select('id, text')
      .eq('user_id', 'ad6cdef0-8dc0-4ad5-bfe7-f0e1bce01be4')
      .limit(1)
      .single();
    
    if (error) {
      console.log(`  ❌ Error: ${error.message}`);
    } else if (data) {
      console.log(`  ✅ Found transcript: ${data.text?.slice(0, 50)}...`);
      console.log(`     Columns available: ${Object.keys(data).join(', ')}`);
    }
  } catch (e) {
    console.log(`  ❌ Exception: ${e}`);
  }
  
  // List all RPC functions
  console.log('\nListing all RPC functions:');
  try {
    const { data, error } = await supabase
      .rpc('exec_sql', { 
        query: `
          SELECT routine_name, routine_type 
          FROM information_schema.routines 
          WHERE routine_schema = 'public' 
          AND routine_name LIKE '%search%' OR routine_name LIKE '%metadata%'
          ORDER BY routine_name
        `
      });
    
    if (!error && data) {
      data.forEach((row: any) => {
        console.log(`  - ${row.routine_name} (${row.routine_type})`);
      });
    }
  } catch (e) {
    console.log('  Could not list functions (exec_sql may not be available)');
  }
}

checkFunctions();
