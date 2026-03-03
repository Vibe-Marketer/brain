import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkRecordings() {
   const { data: orgs } = await supabase.from('organizations').select('id, name')
   if (!orgs) return

   for (const org of orgs) {
      const { count } = await supabase
        .from('recordings')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', org.id)
      
      console.log(`Org ${org.name} (${org.id}): ${count} linked recordings.`)
   }
}

checkRecordings()
