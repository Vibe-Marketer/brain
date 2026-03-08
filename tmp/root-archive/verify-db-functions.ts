import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyFunctions() {
  console.log('🔍 Verifying Database Functions\n');
  
  // 1. Get a real user ID to test with
  console.log('1️⃣  Finding test user with data...');
  const { data: calls, error: callsError } = await supabase
    .from('fathom_calls')
    .select('user_id, id')
    .limit(1);
  
  if (callsError || !calls || calls.length === 0) {
    console.log('   ❌ No calls found in database');
    console.log('   Error:', callsError?.message);
    return;
  }
  
  const testUserId = calls[0].user_id;
  console.log(`   ✅ Using user_id: ${testUserId}`);
  
  // 2. Test get_available_metadata function
  console.log('\n2️⃣  Testing get_available_metadata function...');
  
  const metadataTypes = ['speakers', 'categories', 'tags', 'topics'];
  
  for (const metaType of metadataTypes) {
    const { data, error } = await supabase.rpc('get_available_metadata', {
      p_user_id: testUserId,
      p_metadata_type: metaType
    });
    
    if (error) {
      console.log(`   ❌ ${metaType}: Error - ${error.message}`);
    } else {
      console.log(`   ✅ ${metaType}: ${data?.length || 0} results`);
      if (data && data.length > 0) {
        console.log(`      Sample: ${data[0].value} (count: ${data[0].count})`);
      }
    }
  }
  
  // 3. Check migration status
  console.log('\n3️⃣  Checking migration status...');
  const { data: migrations, error: migError } = await supabase
    .from('schema_migrations')
    .select('version')
    .order('version', { ascending: false })
    .limit(5);
  
  if (migError) {
    console.log('   ❌ Error checking migrations:', migError.message);
  } else if (migrations) {
    console.log('   Recent migrations:');
    migrations.forEach(m => {
      const isBankIdMigration = m.version === '20260209080000';
      const isMetadataMigration = m.version === '20260208223800';
      console.log(`   ${isBankIdMigration || isMetadataMigration ? '✅' : '  '} ${m.version}`);
    });
    
    const hasBankIdMigration = migrations.some(m => m.version === '20260209080000');
    const hasMetadataMigration = migrations.some(m => m.version === '20260208223800');
    
    console.log(`\n   Migration 20260209080000 (filter_bank_id): ${hasBankIdMigration ? '✅ Applied' : '❌ Not applied'}`);
    console.log(`   Migration 20260208223800 (get_available_metadata): ${hasMetadataMigration ? '✅ Applied' : '❌ Not applied'}`);
  }
  
  // 4. Check fathom_calls schema for bank_id column
  console.log('\n4️⃣  Checking fathom_calls schema...');
  const { data: schemaData, error: schemaError } = await supabase
    .from('fathom_calls')
    .select('id, bank_id')
    .limit(1);
  
  if (schemaError) {
    console.log('   ❌ Error checking schema:', schemaError.message);
    if (schemaError.message.includes('bank_id')) {
      console.log('   ⚠️  bank_id column may not exist yet');
    }
  } else {
    console.log('   ✅ Schema check passed - bank_id column exists');
  }
  
  // 5. Test hybrid_search_transcripts function exists
  console.log('\n5️⃣  Testing hybrid_search_transcripts function...');
  try {
    const { data, error } = await supabase.rpc('hybrid_search_transcripts', {
      query_text: 'test',
      query_embedding: Array(1536).fill(0),
      match_count: 1,
      filter_user_id: testUserId
    });
    
    if (error) {
      console.log('   ❌ Error calling function:', error.message);
      console.log('   Code:', error.code);
    } else {
      console.log('   ✅ Function executed successfully');
      console.log(`   Results: ${data?.length || 0} chunks`);
    }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    console.log('   ❌ Exception:', e.message);
  }
}

verifyFunctions().catch(console.error);
