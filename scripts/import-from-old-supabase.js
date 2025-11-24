#!/usr/bin/env node

/**
 * IMPORT FROM OLD CONVERSION-BRAIN
 * 
 * Imports data from the old Supabase instance export
 * Focuses on fathom_calls and related tables
 * 
 * Usage:
 *   SUPABASE_URL="https://xxx.supabase.co" \
 *   SUPABASE_SERVICE_ROLE_KEY="eyJhbG..." \
 *   node scripts/import-from-old-supabase.js database-export-2025-11-23.json
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

// Get credentials from environment
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: Missing required environment variables');
  console.error('');
  console.error('Usage:');
  console.error('  SUPABASE_URL="https://xxx.supabase.co" \\');
  console.error('  SUPABASE_SERVICE_ROLE_KEY="eyJhbG..." \\');
  console.error('  node scripts/import-from-old-supabase.js export-file.json');
  console.error('');
  process.exit(1);
}

const exportFile = process.argv[2];
if (!exportFile) {
  console.error('❌ Error: Please provide export file path');
  console.error('Usage: node scripts/import-from-old-supabase.js export-file.json');
  process.exit(1);
}

if (!fs.existsSync(exportFile)) {
  console.error(`❌ Error: File not found: ${exportFile}`);
  process.exit(1);
}

console.log('🚀 Starting data import...');
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

// Tables to import (in dependency order)
const importOrder = [
  'user_profiles',
  'user_settings',
  'app_config',
  'fathom_calls',
  'fathom_transcripts',
  'processed_webhooks',
  'webhook_deliveries',
  'call_speakers',
  'speakers',
  'contacts',
  'contact_tags',
  'contact_tag_assignments',
  'contact_call_associations',
  'call_categories',
  'call_category_assignments',
  'transcript_tags',
  'transcript_tag_assignments',
  'intel_items',
  'sync_jobs',
  'shared_links',
];

let totalImported = 0;
let successCount = 0;
let errorCount = 0;

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

    const rows = tableData.rows;
    if (!rows || rows.length === 0) {
      console.log(`  ⏭️  ${tableName}: No data`);
      successCount++;
      continue;
    }

    try {
      process.stdout.write(`  ⏳ ${tableName}: ${rows.length} rows...`);

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
  console.log(`   • Failed: ${errorCount} tables`);
  console.log('');

  if (errorCount > 0) {
    console.log('⚠️  Some tables failed to import. Check the errors above.');
    console.log('');
  }

  console.log('✅ You can now use your new Supabase instance!');
  console.log('');

} catch (error) {
  console.error('');
  console.error('❌ FATAL ERROR:', error.message);
  console.error('');
  process.exit(1);
}
