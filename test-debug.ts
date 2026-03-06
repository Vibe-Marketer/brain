import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceKey);

async function main() {
  // Check table existence
  console.log('--- Checking tables ---');
  
  const { data: tables, error: tablesError } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .in('table_name', ['fathom_calls', 'fathom_raw_calls', 'transcript_chunks', 'recordings'])
    .order('table_name');
    
  if (tablesError) {
    // Try direct queries instead
    console.log('Cannot query information_schema, trying direct...');
    
    const checks = [
      { name: 'fathom_calls', query: supabase.from('fathom_calls').select('recording_id').limit(1) },
      { name: 'fathom_raw_calls', query: supabase.from('fathom_raw_calls').select('recording_id').limit(1) },
      { name: 'transcript_chunks', query: supabase.from('transcript_chunks').select('id').limit(1) },
      { name: 'recordings', query: supabase.from('recordings').select('id').limit(1) },
    ];
    
    for (const check of checks) {
      const { data, error } = await check.query;
      console.log(`${check.name}: ${error ? `ERROR - ${error.message}` : `EXISTS (${data?.length || 0} rows sampled)`}`);
    }
  } else {
    console.log('Tables found:', tables?.map(t => t.table_name));
  }
  
  // Check if hybrid_search_transcripts function exists
  console.log('\n--- Checking RPC functions ---');
  
  // Try calling hybrid_search_transcripts with minimal params
  const { data: hsResult, error: hsError } = await supabase.rpc('hybrid_search_transcripts', {
    query_text: 'test',
    query_embedding: new Array(1536).fill(0), // OpenAI ada-002 dimension
    match_count: 1,
  });
  
  console.log('hybrid_search_transcripts:', hsError ? `ERROR - ${hsError.message}` : `OK (${hsResult?.length || 0} results)`);
  
  // Try calling hybrid_search_transcripts_scoped
  const { data: hsScopedResult, error: hsScopedError } = await supabase.rpc('hybrid_search_transcripts_scoped', {
    query_text: 'test',
    query_embedding: new Array(1536).fill(0),
    match_count: 1,
  });
  
  console.log('hybrid_search_transcripts_scoped:', hsScopedError ? `ERROR - ${hsScopedError.message}` : `OK (${hsScopedResult?.length || 0} results)`);
  
  // Check get_available_metadata
  const { data: metaResult, error: metaError } = await supabase.rpc('get_available_metadata', {
    p_user_id: 'ef054159-3a5a-49e3-9fd8-31fa5a180ee6',
    p_metadata_type: 'speakers',
  });
  
  console.log('get_available_metadata:', metaError ? `ERROR - ${metaError.message}` : `OK (${metaResult?.length || 0} values)`);
}

main().catch(console.error);
