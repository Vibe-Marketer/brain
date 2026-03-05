import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const supabase = createClient(supabaseUrl, supabaseKey)

async function setAdmins() {
  const { data: users, error: userError } = await supabase.auth.admin.listUsers()
  if (userError) {
    console.error('Error fetching users:', userError)
    return
  }

  const adminEmails = ['a@vibeos.com', 'andrew@aisimple.co', 'naegele412@gmail.com']

  console.log(`Setting ${adminEmails.join(', ')} to ADMIN, everyone else to FREE...`)

  for (const user of users.users) {
    const isTargetAdmin = adminEmails.includes(user.email || '')
    const targetRole = isTargetAdmin ? 'ADMIN' : 'FREE'
    
    // Delete old role
    await supabase.from('user_roles').delete().eq('user_id', user.id)
    
    // Insert new role
    const { error: insertError } = await supabase
      .from('user_roles')
      .insert({ user_id: user.id, role: targetRole })
      
    if (insertError) {
      console.error(`Error setting ${targetRole} for ${user.email}:`, insertError)
    } else {
      console.log(`Set ${user.email} -> ${targetRole}`)
    }
  }
}

setAdmins()
