import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

console.log('Connecting to', supabaseUrl)
const supabase = createClient(supabaseUrl, supabaseKey)

async function fixRolesAndData() {
  const adminEmail = 'naegele412@gmail.com'

  // 1. Revert all users to FREE except the admin
  const { data: users, error: userError } = await supabase.auth.admin.listUsers()
  if (userError) {
    console.error('Error fetching users:', userError)
    return
  }

  console.log(`Resetting roles for all users, except ${adminEmail}`)

  for (const user of users.users) {
    const isTargetAdmin = user.email === adminEmail
    const targetRole = isTargetAdmin ? 'ADMIN' : 'FREE'

    console.log(`Setting user ${user.email} (${user.id}) to ${targetRole}...`)
    
    // First try to update
    const { data: updateData, error: updateError } = await supabase
      .from('user_roles')
      .update({ role: targetRole })
      .eq('user_id', user.id)
      .select()
    
    if (updateError) {
      console.error(`Error updating role for ${user.email}:`, updateError)
    }

    if (!updateData || updateData.length === 0) {
      console.log(`Update yielded no rows for ${user.email}, trying insert...`)
      // Try to insert if update didn't work / row didn't exist
      const { error: insertError } = await supabase
        .from('user_roles')
        .insert([{ user_id: user.id, role: targetRole }])
        
      if (insertError) {
        console.error(`Error inserting role for ${user.email}:`, insertError)
      } else {
        console.log(`Successfully inserted new ${targetRole} role for ${user.email}.`)
      }
    } else {
      console.log(`Successfully updated user ${user.email} to ${targetRole}.`)
    }
  }

  // 2. Ensure feature_flags exist (if the migration wasn't pushed)
  console.log('Ensuring feature flags exist...')
  const initialFlags = [
    { id: 'beta_imports', name: 'Import Hub', description: 'Fathom, Zoom, and Video Imports', is_enabled: false, enabled_for_roles: ['ADMIN'] },
    { id: 'beta_youtube', name: 'YouTube Import', description: 'YouTube Video Imports', is_enabled: false, enabled_for_roles: ['ADMIN'] },
    { id: 'beta_analytics', name: 'Analytics', description: 'Call Analytics Dashboard', is_enabled: false, enabled_for_roles: ['ADMIN'] },
    { id: 'debug_panel', name: 'Debug Panel', description: 'Developer debug panel', is_enabled: false, enabled_for_roles: ['ADMIN'] }
  ]

  for (const flag of initialFlags) {
    const { error } = await supabase
      .from('feature_flags')
      .upsert(flag, { onConflict: 'id' })
    if (error) {
      console.error(`Error upserting feature flag ${flag.id}:`, error)
    } else {
      console.log(`Successfully inserted/verified feature flag ${flag.id}`)
    }
  }
}

fixRolesAndData()
