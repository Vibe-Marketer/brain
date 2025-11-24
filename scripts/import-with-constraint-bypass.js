#!/usr/bin/env node

/**
 * IMPORT WITH FOREIGN KEY CONSTRAINT BYPASS
 * 
 * Temporarily disables foreign key constraints to allow data import,
 * then re-enables them. Maps old user (andrew@aisimple.co) to new user (a@govibey.com)
 * 
 * Usage:
 *   node scripts/import-with-constraint-bypass.js database-export-2025-11-23.json
 */

import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

// Get credentials from environment
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_DB_URL = process.env.SUPABASE_DB_URL;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: Missing required environment variables');
  console.error('Make sure .env has SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

if (!SUPABASE_DB_URL) {
  console.error('❌ Error: Missing SUPABASE_DB_URL');
  console.error('Cannot proceed without direct database connection');
  process.exit(1);
}

const exportFile = process.argv[2];
if (!exportFile || !fs.existsSync(exportFile)) {
  console.error('❌ Error: Please provide valid export file path');
  process.exit(1);
}

console.log('🚀 Starting data import with constraint bypass...');
console.log(`📂 Source: ${exportFile}`);
console.log('');

const exportData = JSON.parse(fs.readFileSync(exportFile, 'utf8'));

if (!exportData.success || !exportData.data) {
  console.error('❌ Invalid export file format');
  process.exit(1);
}

const tables = exportData.data.tables;

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Create direct DB pool
const pool = new Pool({
  connectionString: SUPABASE_DB_URL,
  max: 5,
  ssl: process.env.NODE_ENV === 'production' ? true : {
    rejectUnauthorized: false,
  },
});

// Get new user ID
console.log('🔍 Finding your new user ID...');
const { data: userData, error: userError } = await supabase.auth.admin.listUsers();

if (userError) {
  console.error('❌ Error fetching users:', userError.message);
  process.exit(1);
}

const newEmail = 'a@govibey.com';
const newUser = userData.users.find(u => u.email === newEmail);

if (!newUser) {
  console.error(`❌ User not found: ${newEmail}`);
  process.exit(1);
}

console.log(`✅ Found user: ${newUser.email}`);
console.log(`   User ID: ${newUser.id}`);
console.log('');

// Find old user ID
let oldUserId = null;
if (tables.user_profiles?.rows?.[0]) {
  oldUserId = tables.user_profiles.rows[0].user_id;
  console.log(`📋 Old User ID: ${oldUserId}`);
  console.log(`   Mapping: ${oldUserId} → ${newUser.id}`);
} else {
  console.log('⚠️ No old user found in export.');
}
console.log('');

function mapUserIds(row, oldId, newId) {
  const mapped = { ...row };
  if (mapped.user_id === oldId) {
    mapped.user_id = newId;
  }
  if (mapped.id === oldId) {
    mapped.id = newId;
  }
  return mapped;
}

const importOrder = [
  'user_settings',
  'fathom_calls',
  'fathom_transcripts',
  'processed_webhooks',
  'webhook_deliveries',
  'call_categories',
  'call_category_assignments',
  'sync_jobs',
];

let totalImported = 0;
let successCount = 0;
let errorCount = 0;

try {
  // Disable foreign key constraints
  console.log('🔓 Disabling foreign key constraints...');
  await pool.query('SET session_replication_role = REPLICA;');
  console.log('✅ Constraints disabled');
  console.log('');

  console.log('📊 Importing tables...');
  console.log('');

  for (const tableName of importOrder) {
    const tableData = tables[tableName];

    if (!tableData) {
      console.log(`  ⏭️  ${tableName}: Not in export`);
      continue;
    }

    if (!tableData.success) {
      console.log(`  ❌ ${tableName}: Export failed`);
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

      // Map user IDs
      if (oldUserId && newUser.id) {
        rows = rows.map(row => mapUserIds(row, oldUserId, newUser.id));
      }

      // Import in batches
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

  // Re-enable foreign key constraints
  console.log('🔒 Re-enabling foreign key constraints...');
  await pool.query('SET session_replication_role = DEFAULT;');
  console.log('✅ Constraints re-enabled');
  console.log('');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('🎉 IMPORT COMPLETE!');
  console.log('');
  console.log(`📊 Summary:`);
  console.log(`   • Imported: ${successCount} tables`);
  console.log(`   • Total rows: ${totalImported.toLocaleString()}`);
  console.log(`   • Failed: ${errorCount} tables`);
  console.log('');
  console.log(`✅ All data is now linked to: ${newUser.email}`);
  console.log('');

  await pool.end();

} catch (error) {
  console.error('');
  console.error('❌ FATAL ERROR:', error.message);
  console.error('');
  await pool.end();
  process.exit(1);
}
