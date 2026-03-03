import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkCallDistribution() {
  const { data: users, error: userError } = await supabase.auth.admin.listUsers()
  if (userError) {
    console.error('Error fetching users:', userError)
    return
  }

  console.log("== CALL DISTRIBUTION BY USER ==")
  for (const user of users.users) {
    const { count, error } = await supabase
      .from('fathom_calls')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
    
    if (error) {
      console.error(`Error counting calls for ${user.email}:`, error)
      continue
    }

    if (count && count > 0) {
      const { data: latest } = await supabase
        .from('fathom_calls')
        .select('recording_start_time')
        .eq('user_id', user.id)
        .order('recording_start_time', { ascending: false })
        .limit(1)
        .single()

      console.log(`${user.email} (${user.id}): ${count} calls. Latest: ${latest?.recording_start_time || 'N/A'}`)
    } else {
      console.log(`${user.email} (${user.id}): 0 calls.`)
    }
  }
}

checkCallDistribution()
