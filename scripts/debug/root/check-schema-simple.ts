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

async function checkSchema() {
  console.log('🔍 Checking database schema...\n');
  
  // Try to query fathom_calls with select *
  console.log('1️⃣  Checking fathom_calls table...');
  const { data: calls, error: callsError } = await supabase
    .from('fathom_calls')
    .select('*')
    .limit(1);
  
  if (callsError) {
    console.log('   ❌ Error:', callsError.message);
  } else if (calls && calls.length > 0) {
    console.log('   ✅ Table exists with columns:', Object.keys(calls[0]).join(', '));
    console.log('   First record user_id:', calls[0].user_id);
  } else {
    console.log('   ⚠️  Table exists but no data');
  }
  
  // Check migrations
  console.log('\n2️⃣  Checking migrations...');
  const { data: migrations, error: migError } = await supabase
    .from('schema_migrations')
    .select('version')
    .order('version', { ascending: false })
    .limit(10);
  
  if (migError) {
    console.log('   ❌ Error:', migError.message);
  } else if (migrations) {
    console.log('   Recent migrations:');
    migrations.forEach(m => console.log(`     ${m.version}`));
    
    const has20260209 = migrations.some(m => m.version === '20260209080000');
    const has20260208 = migrations.some(m => m.version === '20260208223800');
    console.log(`\n   ✅ 20260209080000 applied: ${has20260209}`);
    console.log(`   ✅ 20260208223800 applied: ${has20260208}`);
  }
}

checkSchema().catch(console.error);
