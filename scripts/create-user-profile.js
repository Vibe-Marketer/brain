#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Get user
const { data: users } = await supabase.auth.admin.listUsers();
const user = users.users.find(u => u.email === 'a@govibey.com');

if (!user) {
  console.log('❌ User not found');
  process.exit(1);
}

console.log(`Found user: ${user.email} (${user.id})`);

// Create/update user profile
const { error } = await supabase
  .from('user_profiles')
  .upsert({
    user_id: user.id,
    email: user.email,
    created_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });

if (error) {
  console.log('❌ Error:', error.message);
  process.exit(1);
}

console.log('✅ User profile created/updated');
