import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkDateRanges() {
  const { data: users, error: userError } = await supabase.auth.admin.listUsers()
  if (userError) return

  for (const user of users.users) {
     const { data: calls } = await supabase
       .from('fathom_calls')
       .select('recording_start_time')
       .eq('user_id', user.id)
       .order('recording_start_time', { ascending: false })
     
     if (calls && calls.length > 0) {
       console.log(`${user.email}: Total ${calls.length}. Range: ${calls[calls.length-1].recording_start_time} to ${calls[0].recording_start_time}`)
     }
  }
}

checkDateRanges()
