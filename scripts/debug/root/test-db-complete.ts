import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

const requireEnv = (name: string, fallback?: string): string => {
  const value = process.env[name] ?? (fallback ? process.env[fallback] : undefined);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}${fallback ? ` (or ${fallback})` : ''}`);
  }
  return value;
};

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('DATABASE FUNCTION VERIFICATION');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Get test user
  const { data: calls } = await supabase
    .from('fathom_calls')
    .select('user_id, recording_id')
    .limit(1)
    .single();
  
  if (!calls) {
    console.log('❌ No test data found in database');
    return;
  }
  
  const testUserId = calls.user_id;
  console.log(`✅ Test user ID: ${testUserId}\n`);
  
  // TEST 1: Check if bank_id column exists
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 1: Check bank_id column in fathom_calls');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const { data: bankIdCheck, error: bankIdError } = await supabase
    .from('fathom_calls')
    .select('recording_id, bank_id')
    .limit(1)
    .single();
  
  if (bankIdError) {
    console.log('❌ FAIL: bank_id column does not exist');
    console.log('   Error:', bankIdError.message);
    console.log('   ⚠️  Migration 20260209080000 may not be applied\n');
  } else {
    console.log('✅ PASS: bank_id column exists');
    console.log('   Sample value:', bankIdCheck.bank_id || 'NULL');
    console.log('   ✅ Migration 20260209080000 appears to be applied\n');
  }
  
  // TEST 2: Test get_available_metadata function
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 2: get_available_metadata RPC Function');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const metadataTypes = ['speakers', 'categories', 'tags', 'topics'];
  let metadataTestsPassed = 0;
  
  for (const type of metadataTypes) {
    const { data, error } = await supabase.rpc('get_available_metadata', {
      p_user_id: testUserId,
      p_metadata_type: type
    });
    
    if (error) {
      console.log(`❌ FAIL: ${type}`);
      console.log(`   Error: ${error.message}\n`);
    } else {
      metadataTestsPassed++;
      console.log(`✅ PASS: ${type} - ${data?.length || 0} results`);
      if (data && data.length > 0) {
        console.log(`   Sample: "${data[0].value}" (count: ${data[0].count})`);
      }
      console.log('');
    }
  }
  
  console.log(`Result: ${metadataTestsPassed}/${metadataTypes.length} metadata types working\n`);
  
  // TEST 3: Test hybrid_search_transcripts function signature
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 3: hybrid_search_transcripts with filter_bank_id');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Test without filter_bank_id
  const embedding = Array(1536).fill(0);
  const { data: searchData1, error: searchError1 } = await supabase.rpc('hybrid_search_transcripts', {
    query_text: 'test',
    query_embedding: embedding,
    match_count: 1,
    filter_user_id: testUserId
  });
  
  if (searchError1) {
    console.log('❌ FAIL: Basic search failed');
    console.log('   Error:', searchError1.message);
    console.log('   Code:', searchError1.code);
  } else {
    console.log('✅ PASS: Basic search works');
    console.log(`   Results: ${searchData1?.length || 0} chunks`);
  }
  
  // Test WITH filter_bank_id parameter
  const { data: searchData2, error: searchError2 } = await supabase.rpc('hybrid_search_transcripts', {
    query_text: 'test',
    query_embedding: embedding,
    match_count: 1,
    filter_user_id: testUserId,
    filter_bank_id: null
  });
  
  if (searchError2) {
    console.log('\n❌ FAIL: Search with filter_bank_id parameter failed');
    console.log('   Error:', searchError2.message);
    console.log('   ⚠️  Function may not have filter_bank_id parameter yet\n');
  } else {
    console.log('\n✅ PASS: Search with filter_bank_id parameter works');
    console.log(`   Results: ${searchData2?.length || 0} chunks`);
    console.log('   ✅ filter_bank_id parameter is implemented\n');
  }
  
  // SUMMARY
  console.log('═══════════════════════════════════════════════════════════');
  console.log('SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`bank_id column: ${bankIdError ? '❌' : '✅'}`);
  console.log(`get_available_metadata: ${metadataTestsPassed === 4 ? '✅' : '⚠️ ' + metadataTestsPassed + '/4'}`);
  console.log(`hybrid_search_transcripts: ${searchError1 ? '❌' : '✅'}`);
  console.log(`filter_bank_id parameter: ${searchError2 ? '❌' : '✅'}`);
  console.log('═══════════════════════════════════════════════════════════\n');
}

runTests().catch(console.error);
