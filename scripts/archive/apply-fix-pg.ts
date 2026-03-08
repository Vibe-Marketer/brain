import { readFileSync } from 'fs';
import * as dotenv from 'dotenv';
import pkg from 'pg';
const { Client } = pkg;

// Load .env from current directory explicitly
dotenv.config({ path: '.env' });

const connStr = 'postgresql://postgres.vltmrnjsubfzrgrtdqey:x2n2KlCAA8suZjqa@aws-1-us-east-1.pooler.supabase.com:6543/postgres';

async function main() {
  const sql = readFileSync('supabase/migrations/20260306060000_fix_rag_search_path.sql', 'utf-8');
  
  console.log('Connecting to Supabase database...');
  
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
  });
  
  await client.connect();
  console.log('Connected! Applying migration...');
  
  try {
    await client.query(sql);
    console.log('✓ Migration applied successfully!');
  } catch (err: any) {
    console.error('Error:', err.message);
    throw err;
  } finally {
    await client.end();
  }
}

main().catch(console.error);
