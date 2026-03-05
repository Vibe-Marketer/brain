import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role for testing to bypass JWT Gateway if needed, wait, gateway checks JWT anyway if no-verify-jwt is false.
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data, error } = await supabase.functions.invoke('fetch-meetings')
  console.log('Result:', data, error)
}
run()
