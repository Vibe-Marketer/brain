#!/usr/bin/env node

/**
 * Compare schemas between old and new Supabase instances
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

// Old database
const OLD_URL = 'https://phfwibxcuavoqykrlcir.supabase.co';
const OLD_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoZndpYnhjdWF2b3F5a3JsY2lyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTQzNzc4OSwiZXhwIjoyMDc3MDEzNzg5fQ.9cvdPgZ9mtAKYuXGiW-M0oOPTjTDK4EkOfiC9hXVNpg';

// New database
const NEW_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const NEW_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!NEW_URL || !NEW_KEY) {
  console.error('❌ Missing new database credentials in .env');
  process.exit(1);
}

const oldSupabase = createClient(OLD_URL, OLD_KEY);
const newSupabase = createClient(NEW_URL, NEW_KEY);

console.log('🔍 Schema Comparison: Old vs New Database');
console.log('==========================================\n');

// List of tables to check from the export
const tablesToCheck = [
  'fathom_calls',
  'fathom_transcripts',
  'user_settings',
  'user_profiles',
  'call_categories',
  'call_category_assignments',
  'processed_webhooks',
  'webhook_deliveries',
  'sync_jobs',
  'app_config',
  'contacts',
  'contact_tags',
  'contact_tag_assignments',
  'contact_call_associations',
  'transcript_tags',
  'transcript_tag_assignments',
  'intel_items',
  'call_speakers',
  'speakers',
  'shared_links',
];

async function getTableColumns(supabase, tableName) {
  try {
    // Try to get a single row to see the column structure
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);
    
    if (error) {
      return { exists: false, error: error.message };
    }
    
    if (!data || data.length === 0) {
      // Table exists but is empty - try to infer from metadata
      return { exists: true, columns: [], empty: true };
    }
    
    const columns = Object.keys(data[0]);
    return { exists: true, columns };
  } catch (e) {
    return { exists: false, error: e.message };
  }
}

console.log('Checking tables...\n');

const results = {
  onlyInOld: [],
  onlyInNew: [],
  inBoth: [],
  columnDiffs: {},
};

for (const tableName of tablesToCheck) {
  process.stdout.write(`  Checking ${tableName}...`);
  
  const oldInfo = await getTableColumns(oldSupabase, tableName);
  const newInfo = await getTableColumns(newSupabase, tableName);
  
  if (oldInfo.exists && !newInfo.exists) {
    results.onlyInOld.push(tableName);
    console.log(' ❌ Only in OLD');
  } else if (!oldInfo.exists && newInfo.exists) {
    results.onlyInNew.push(tableName);
    console.log(' ✅ Only in NEW');
  } else if (oldInfo.exists && newInfo.exists) {
    results.inBoth.push(tableName);
    
    // Compare columns
    const oldCols = new Set(oldInfo.columns || []);
    const newCols = new Set(newInfo.columns || []);
    
    const onlyInOldCols = [...oldCols].filter(c => !newCols.has(c));
    const onlyInNewCols = [...newCols].filter(c => !oldCols.has(c));
    
    if (onlyInOldCols.length > 0 || onlyInNewCols.length > 0) {
      results.columnDiffs[tableName] = {
        onlyInOld: onlyInOldCols,
        onlyInNew: onlyInNewCols,
        common: [...oldCols].filter(c => newCols.has(c)),
      };
      console.log(' ⚠️  Column differences');
    } else {
      console.log(' ✅ Schemas match');
    }
  } else {
    console.log(' ❌ Not in either');
  }
}

console.log('\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('\n📊 SCHEMA COMPARISON RESULTS\n');

// Tables only in old
if (results.onlyInOld.length > 0) {
  console.log('❌ Tables ONLY in OLD database (missing in new):');
  results.onlyInOld.forEach(t => console.log(`   • ${t}`));
  console.log('');
}

// Tables only in new
if (results.onlyInNew.length > 0) {
  console.log('✅ Tables ONLY in NEW database:');
  results.onlyInNew.forEach(t => console.log(`   • ${t}`));
  console.log('');
}

// Tables in both
if (results.inBoth.length > 0) {
  console.log(`📋 Tables in BOTH databases: ${results.inBoth.length}`);
  
  const matching = results.inBoth.filter(t => !results.columnDiffs[t]);
  const different = results.inBoth.filter(t => results.columnDiffs[t]);
  
  if (matching.length > 0) {
    console.log(`   ✅ Perfect matches: ${matching.length}`);
    matching.forEach(t => console.log(`      • ${t}`));
  }
  
  if (different.length > 0) {
    console.log(`   ⚠️  Column differences: ${different.length}`);
    different.forEach(t => console.log(`      • ${t}`));
  }
  console.log('');
}

// Detailed column differences
if (Object.keys(results.columnDiffs).length > 0) {
  console.log('⚠️  DETAILED COLUMN DIFFERENCES:\n');
  
  for (const [tableName, diffs] of Object.entries(results.columnDiffs)) {
    console.log(`📋 ${tableName}:`);
    
    if (diffs.onlyInOld.length > 0) {
      console.log(`   ❌ Columns only in OLD (will fail to import):`);
      diffs.onlyInOld.forEach(col => console.log(`      • ${col}`));
    }
    
    if (diffs.onlyInNew.length > 0) {
      console.log(`   ✅ Columns only in NEW (will be empty):`);
      diffs.onlyInNew.forEach(col => console.log(`      • ${col}`));
    }
    
    if (diffs.common.length > 0) {
      console.log(`   ✓ Common columns: ${diffs.common.length}`);
    }
    
    console.log('');
  }
}

// Migration feasibility
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('\n🎯 MIGRATION FEASIBILITY:\n');

const criticalTablesMissing = ['fathom_calls', 'fathom_transcripts', 'user_settings']
  .filter(t => results.onlyInOld.includes(t));

const criticalColumnsIssues = ['fathom_calls', 'fathom_transcripts', 'user_settings']
  .filter(t => results.columnDiffs[t])
  .map(t => ({ table: t, ...results.columnDiffs[t] }));

if (criticalTablesMissing.length > 0) {
  console.log('❌ CANNOT MIGRATE:');
  console.log(`   Critical tables missing in new database:`);
  criticalTablesMissing.forEach(t => console.log(`   • ${t}`));
  console.log('');
  console.log('   Solution: Apply migrations from old to new database first.');
} else if (criticalColumnsIssues.length > 0) {
  console.log('⚠️  MIGRATION POSSIBLE BUT REQUIRES FIXES:');
  criticalColumnsIssues.forEach(({ table, onlyInOld }) => {
    if (onlyInOld.length > 0) {
      console.log(`   ${table}: Missing columns in new database`);
      onlyInOld.forEach(col => console.log(`      • ${col}`));
    }
  });
  console.log('');
  console.log('   Solution: Add missing columns or filter them during import.');
} else {
  console.log('✅ MIGRATION FEASIBLE:');
  console.log('   All critical tables exist with compatible schemas.');
  console.log('   You can proceed with data import.');
}

console.log('');

// Save detailed report
const report = {
  timestamp: new Date().toISOString(),
  tablesOnlyInOld: results.onlyInOld,
  tablesOnlyInNew: results.onlyInNew,
  tablesInBoth: results.inBoth,
  columnDifferences: results.columnDiffs,
};

fs.writeFileSync(
  'schema-comparison-report.json',
  JSON.stringify(report, null, 2)
);

console.log('📄 Detailed report saved to: schema-comparison-report.json\n');
