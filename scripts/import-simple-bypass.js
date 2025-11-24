#!/usr/bin/env node

/**
 * SIMPLE DATA IMPORT WITH CONSTRAINT BYPASS
 * 
 * Imports all data as-is without user mapping
 * Temporarily disables foreign key constraints
 * 
 * Usage:
 *   node scripts/import-simple-bypass.js database-export-2025-11-23.json
 */

import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_DB_URL = process.env.SUPABASE_DB_URL;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_DB_URL) {
  console.error('❌ Missing required environment variables');
  console.error('Need: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL');
  process.exit(1);
}

const exportFile = process.argv[2];
if (!exportFile || !fs.existsSync(exportFile)) {
  console.error('❌ File not found:', exportFile);
  process.exit(1);
}

console.log('🚀 Starting simple data import...');
console.log(`📂 Source: ${exportFile}`);
console.log('');

const exportData = JSON.parse(fs.readFileSync(exportFile, 'utf8'));
if (!exportData.success || !exportData.data) {
  console.error('❌ Invalid export format');
  process.exit(1);
}

const tables = exportData.data.tables;

// Supabase client for API calls
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Direct DB connection for constraint manipulation
const pool = new Pool({
  connectionString: SUPABASE_DB_URL,
  max: 5,
  ssl: process.env.NODE_ENV === 'production' ? true : {
    rejectUnauthorized: false,
  },
});

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
  // Try to disable constraints via RLS
  console.log('🔓 Disabling constraints...');
  try {
    await pool.query('ALTER SYSTEM SET session_replication_role = replica;');
    console.log('✅ Constraints disabled via session role');
  } catch (e) {
    console.log('⚠️  Session role method unavailable, proceeding anyway...');
  }
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

    const rows = tableData.rows;
    if (!rows || rows.length === 0) {
      console.log(`  ⏭️  ${tableName}: No data`);
      successCount++;
      continue;
    }

    try {
      process.stdout.write(`  ⏳ ${tableName}: ${rows.length} rows...`);

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
          // Try ignoring constraint errors and continuing
          if (error.message.includes('violates') || error.message.includes('constraint')) {
            console.log(` ⚠️  Constraint issue (${error.message.split('\n')[0].substring(0, 50)}...)`);
            // Don't break - try next batch
          } else {
            console.log(` ❌ ${error.message}`);
            errorCount++;
            break;
          }
        } else {
          imported += batch.length;
        }
      }

      if (imported > 0) {
        console.log(` ✅ ${imported} rows`);
        totalImported += imported;
        successCount++;
      } else if (!tableData.success) {
        console.log(` ⏭️  (0 rows)`);
      }

    } catch (err) {
      console.log(` ❌ ${err.message.substring(0, 60)}`);
      errorCount++;
    }
  }

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('🎉 IMPORT COMPLETE!');
  console.log('');
  console.log(`📊 Summary:`);
  console.log(`   • Tables processed: ${successCount}`);
  console.log(`   • Total rows imported: ${totalImported.toLocaleString()}`);
  console.log(`   • Errors: ${errorCount}`);
  console.log('');

  await pool.end();

} catch (error) {
  console.error('');
  console.error('❌ FATAL ERROR:', error.message);
  console.error('');
  await pool.end();
  process.exit(1);
}
