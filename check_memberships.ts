import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkMemberships() {
  const { data: users, error: userError } = await supabase.auth.admin.listUsers()
  if (userError) return

  for (const user of users.users) {
    const { data: memberships } = await supabase
      .from('organization_members')
      .select('organization_id, role, organizations(name)')
      .eq('user_id', user.id)
    
    if (memberships && memberships.length > 0) {
      console.log(`User ${user.email} (${user.id}):`)
      memberships.forEach(m => console.log(` - ${m.organizations.name} (${m.organization_id}) [${m.role}]`))
    }
  }
}

checkMemberships()
