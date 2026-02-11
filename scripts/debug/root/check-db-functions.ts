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
const testUserId = requireEnv('DEBUG_TEST_USER_ID');

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
      filter_user_id: testUserId,
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
      p_user_id: testUserId,
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
      .eq('user_id', testUserId)
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
