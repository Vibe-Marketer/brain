#!/usr/bin/env node

/**
 * Get current user ID for email a@govibey.com
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.error('Set in .env file');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Get user by email
const { data, error } = await supabase.auth.admin.listUsers();

if (error) {
  console.error('❌ Error fetching users:', error.message);
  process.exit(1);
}

const targetEmail = 'a@govibey.com';
const user = data.users.find(u => u.email === targetEmail);

if (!user) {
  console.error(`❌ User not found: ${targetEmail}`);
  console.log('\nAvailable users:');
  data.users.forEach(u => console.log(`  • ${u.email} (${u.id})`));
  process.exit(1);
}

console.log('✅ Found user:');
console.log(`   Email: ${user.email}`);
console.log(`   ID: ${user.id}`);
console.log('');
console.log('Use this ID for migration mapping.');
