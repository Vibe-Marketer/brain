import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const supabase = createClient(supabaseUrl, supabaseKey)

async function debugData() {
  const { data: users, error: userError } = await supabase.auth.admin.listUsers()
  if (userError) {
    console.error('Error fetching users:', userError)
    return
  }

  const { data: roles } = await supabase.from('user_roles').select('*')
  
  console.log("== USERS ==")
  users.users.forEach(u => console.log(u.email, u.id))
  
  console.log("\n== ROLES ==")
  console.log(roles)

  console.log("\n== CALLS DB ==")
  const { data: calls } = await supabase
    .from('fathom_calls')
    .select('user_id, count(*)')
    .group('user_id')
    
  console.log("Calls aggregated by user:")
  console.log(calls)
}

debugData()
