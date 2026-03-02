import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase
    .from('organization_memberships')
    .select(`
      id,
      role,
      bank:organizations!inner (
        id,
        name,
        type,
        cross_bank_default,
        created_at,
        updated_at
      )
    `)
    .limit(1);

  console.log(JSON.stringify({ data, error }, null, 2));
}

test();
