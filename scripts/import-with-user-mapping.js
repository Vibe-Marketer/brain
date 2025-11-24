#!/usr/bin/env node

/**
 * IMPORT FROM OLD CONVERSION-BRAIN WITH USER MAPPING
 * 
 * Maps old user (andrew@aisimple.co) to new user (a@govibey.com)
 * 
 * Usage:
 *   node scripts/import-with-user-mapping.js database-export-2025-11-23.json
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

// Get credentials from environment
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: Missing required environment variables');
  console.error('');
  console.error('Make sure .env has:');
  console.error('  SUPABASE_URL="https://..."');
  console.error('  SUPABASE_SERVICE_ROLE_KEY="eyJhbG..."');
  console.error('');
  process.exit(1);
}

const exportFile = process.argv[2];
if (!exportFile) {
  console.error('❌ Error: Please provide export file path');
  console.error('Usage: node scripts/import-with-user-mapping.js export-file.json');
  process.exit(1);
}

if (!fs.existsSync(exportFile)) {
  console.error(`❌ Error: File not found: ${exportFile}`);
  process.exit(1);
}

console.log('🚀 Starting data import with user mapping...');
console.log(`📡 Target: ${SUPABASE_URL}`);
console.log(`📂 Source: ${exportFile}`);
console.log('');

// Load export data
const exportData = JSON.parse(fs.readFileSync(exportFile, 'utf8'));

if (!exportData.success || !exportData.data) {
  console.error('❌ Invalid export file format');
  process.exit(1);
}

const tables = exportData.data.tables;

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('🔍 Finding your new user ID...');

// Get new user ID for a@govibey.com
const { data: userData, error: userError } = await supabase.auth.admin.listUsers();

if (userError) {
  console.error('❌ Error fetching users:', userError.message);
  process.exit(1);
}

const newEmail = 'a@govibey.com';
const newUser = userData.users.find(u => u.email === newEmail);

if (!newUser) {
  console.error(`❌ User not found: ${newEmail}`);
  console.log('\nPlease sign up first with this email, then run the migration.');
  process.exit(1);
}

console.log(`✅ Found user: ${newUser.email}`);
console.log(`   New User ID: ${newUser.id}`);
console.log('');

// Find old user ID from export data
let oldUserId = null;
if (tables.user_profiles && tables.user_profiles.rows && tables.user_profiles.rows.length > 0) {
  // Assuming there's only one user in the export
  oldUserId = tables.user_profiles.rows[0].user_id;
  console.log(`📋 Old User ID: ${oldUserId}`);
  console.log(`   Mapping: ${oldUserId} → ${newUser.id}`);
} else {
  console.log('⚠️  No user_profiles found in export. Will import without user mapping.');
}

console.log('');

// Function to replace user IDs in a row
function mapUserIds(row, oldId, newId) {
  const mapped = { ...row };
  
  // Replace user_id field
  if (mapped.user_id === oldId) {
    mapped.user_id = newId;
  }
  
  // Replace id if it's the user's profile
  if (mapped.id === oldId) {
    mapped.id = newId;
  }
  
  return mapped;
}

// Tables to import (in dependency order)
const importOrder = [
  'user_settings',     // Map user_id
  'app_config',        // May have user_id
  'fathom_calls',      // Map user_id
  'fathom_transcripts', // No user_id usually
  'processed_webhooks', // No user_id
  'webhook_deliveries', // No user_id
  'call_speakers',     // Map user_id
  'speakers',          // Map user_id
  'contacts',          // Map user_id
  'contact_tags',      // Map user_id
  'contact_tag_assignments', // No direct user_id
  'contact_call_associations', // No direct user_id
  'call_categories',   // Map user_id
  'call_category_assignments', // No direct user_id
  'transcript_tags',   // Map user_id
  'transcript_tag_assignments', // No direct user_id
  'intel_items',       // Map user_id
  'sync_jobs',         // Map user_id
  'shared_links',      // Map user_id
];

let totalImported = 0;
let successCount = 0;
let errorCount = 0;
let mappedCount = 0;

try {
  console.log('📊 Importing tables...');
  console.log('');

  for (const tableName of importOrder) {
    const tableData = tables[tableName];

    if (!tableData) {
      console.log(`  ⏭️  ${tableName}: Not in export`);
      continue;
    }

    if (!tableData.success) {
      console.log(`  ❌ ${tableName}: Export failed (${tableData.error})`);
      errorCount++;
      continue;
    }

    let rows = tableData.rows;
    if (!rows || rows.length === 0) {
      console.log(`  ⏭️  ${tableName}: No data`);
      successCount++;
      continue;
    }

    try {
      process.stdout.write(`  ⏳ ${tableName}: ${rows.length} rows...`);

      // Map user IDs if needed
      if (oldUserId && newUser.id) {
        rows = rows.map(row => {
          const mapped = mapUserIds(row, oldUserId, newUser.id);
          if (JSON.stringify(mapped) !== JSON.stringify(row)) {
            mappedCount++;
          }
          return mapped;
        });
      }

      // Import in batches of 100 to avoid timeouts
      const batchSize = 100;
      let imported = 0;

      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);

        const { error } = await supabase
          .from(tableName)
          .upsert(batch, { 
            onConflict: tableName === 'fathom_calls' ? 'recording_id' : 
                       tableName === 'processed_webhooks' ? 'webhook_id' :
                       tableName === 'user_settings' ? 'user_id' :
                       'id',
            ignoreDuplicates: false 
          });

        if (error) {
          console.log(` ❌ Failed: ${error.message}`);
          console.log(`     Hint: ${error.hint || 'Check constraints'}`);
          errorCount++;
          break;
        }

        imported += batch.length;
      }

      if (imported === rows.length) {
        console.log(` ✅ ${imported} rows`);
        totalImported += imported;
        successCount++;
      }

    } catch (err) {
      console.log(` ❌ Exception: ${err.message}`);
      errorCount++;
    }
  }

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('🎉 IMPORT COMPLETE!');
  console.log('');
  console.log(`📊 Summary:`);
  console.log(`   • Imported: ${successCount} tables`);
  console.log(`   • Total rows: ${totalImported.toLocaleString()}`);
  console.log(`   • User IDs mapped: ${mappedCount}`);
  console.log(`   • Failed: ${errorCount} tables`);
  console.log('');

  if (errorCount > 0) {
    console.log('⚠️  Some tables failed to import. Check the errors above.');
    console.log('');
  }

  console.log('✅ Your data is now linked to: ' + newUser.email);
  console.log('');

} catch (error) {
  console.error('');
  console.error('❌ FATAL ERROR:', error.message);
  console.error('');
  process.exit(1);
}
