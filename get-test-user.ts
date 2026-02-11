import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vltmrnjsubfzrgrtdqey.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsdG1ybmpzdWJmenJncnRkcWV5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mzg3NTAwNywiZXhwIjoyMDc5NDUxMDA3fQ.a8Lp_JzIk4f4ROiRPBTNGZgnTMQ6Ok5rRuQzkx3stv8';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function main() {
  // List all users
  const { data: users, error } = await supabase.auth.admin.listUsers();
  
  if (error) {
    console.error('Error listing users:', error);
    return;
  }
  
  console.log(`Found ${users.users.length} users:\n`);
  users.users.slice(0, 10).forEach((u, i) => {
    console.log(`${i + 1}. ${u.email} (${u.id})`);
    console.log(`   Created: ${u.created_at}`);
    console.log(`   Confirmed: ${u.email_confirmed_at ? 'Yes' : 'No'}`);
  });
  
  // Try to create a test session token for the first user
  if (users.users.length > 0) {
    const testUser = users.users[0];
    console.log(`\n\nGenerating session for: ${testUser.email}`);
    
    // Generate a custom access token
    const { data: sessionData, error: tokenError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: testUser.email!,
    });
    
    if (!tokenError && sessionData) {
      console.log('\n✓ Magic link generated - this can be used to sign in');
      console.log('  Link:', sessionData.properties.action_link);
    }
  }
}

main();
