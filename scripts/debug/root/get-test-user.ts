import { createClient } from '@supabase/supabase-js';

const requireEnv = (name: string, fallback?: string): string => {
  const value = process.env[name] ?? (fallback ? process.env[fallback] : undefined);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}${fallback ? ` (or ${fallback})` : ''}`);
  }
  return value;
};

const supabaseUrl = requireEnv('SUPABASE_URL', 'VITE_SUPABASE_URL');
const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

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
