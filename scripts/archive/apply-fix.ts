import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceKey, {
  db: { schema: 'public' },
});

async function main() {
  const sql = readFileSync('supabase/migrations/20260306060000_fix_rag_search_path.sql', 'utf-8');
  
  console.log('Applying migration...');
  console.log('SQL length:', sql.length);
  
  // Use the exec SQL endpoint via REST
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql_string: sql }),
  });
  
  if (!response.ok) {
    console.log('RPC not available, trying direct SQL via pgrest...');
    // Fall back to raw SQL via the Supabase SQL HTTP API
    const mgmtResponse = await fetch(`https://api.supabase.com/v1/projects/vltmrnjsubfzrgrtdqey/database/sql`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_ACCESS_TOKEN || ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    });
    
    if (!mgmtResponse.ok) {
      console.log('Management API failed too. Using raw Postgres connection...');
      
      // Last resort: Use Supabase client's internal postgres connection
      // We can execute SQL through a custom function or via the SQL editor
      throw new Error('No SQL execution method available');
    }
    
    const mgmtResult = await mgmtResponse.json();
    console.log('Management API result:', mgmtResult);
    return;
  }
  
  const result = await response.json();
  console.log('RPC result:', result);
}

main().catch(console.error);
