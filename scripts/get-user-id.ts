#!/usr/bin/env node
/**
 * GET USER ID HELPER
 * ===================
 *
 * Simple script to get user ID by email for RAG testing
 *
 * Usage:
 *   npx tsx scripts/get-user-id.ts <email>
 *
 * Example:
 *   npx tsx scripts/get-user-id.ts user@example.com
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: Missing required environment variables');
  console.error('Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function getUserId(email?: string) {
  try {
    if (email) {
      // Get user by email
      const { data, error } = await supabase
        .from('auth.users')
        .select('id, email')
        .eq('email', email)
        .single();

      if (error) {
        console.error('ERROR:', error.message);
        console.log('\nTrying alternative query method...');

        // Try using auth admin API
        const { data: adminData, error: adminError } = await supabase.auth.admin.listUsers();

        if (adminError) {
          console.error('ERROR:', adminError.message);
          process.exit(1);
        }

        const user = adminData.users.find(u => u.email === email);

        if (user) {
          console.log('\nUser found:');
          console.log(`Email: ${user.email}`);
          console.log(`ID: ${user.id}`);
          console.log('\nRun RAG test with:');
          console.log(`npm run test:rag ${user.id}`);
        } else {
          console.error(`User with email "${email}" not found`);
          process.exit(1);
        }
        return;
      }

      if (!data) {
        console.error(`User with email "${email}" not found`);
        process.exit(1);
      }

      console.log('\nUser found:');
      console.log(`Email: ${data.email}`);
      console.log(`ID: ${data.id}`);
      console.log('\nRun RAG test with:');
      console.log(`npm run test:rag ${data.id}`);
    } else {
      // List all users
      const { data, error } = await supabase.auth.admin.listUsers();

      if (error) {
        console.error('ERROR:', error.message);
        process.exit(1);
      }

      if (!data.users || data.users.length === 0) {
        console.log('No users found');
        process.exit(0);
      }

      console.log(`\nFound ${data.users.length} user(s):\n`);
      data.users.forEach((user, i) => {
        console.log(`${i + 1}. ${user.email || 'No email'}`);
        console.log(`   ID: ${user.id}\n`);
      });

      console.log('Run RAG test with:');
      console.log(`npm run test:rag <user_id>`);
    }
  } catch (error) {
    console.error('FATAL ERROR:', error);
    process.exit(1);
  }
}

// CLI execution
const email = process.argv[2];

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Get User ID Helper\n');
  console.log('Usage:');
  console.log('  npx tsx scripts/get-user-id.ts <email>  - Get ID for specific email');
  console.log('  npx tsx scripts/get-user-id.ts          - List all users');
  console.log('\nExample:');
  console.log('  npx tsx scripts/get-user-id.ts user@example.com');
  process.exit(0);
}

getUserId(email);
