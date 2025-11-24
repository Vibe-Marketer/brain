#!/usr/bin/env node

import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_DB_URL = process.env.SUPABASE_DB_URL;

if (!SUPABASE_DB_URL) {
  console.error('❌ Missing SUPABASE_DB_URL');
  process.exit(1);
}

const pool = new Pool({
  connectionString: SUPABASE_DB_URL,
  max: 1,
  ssl: {
    rejectUnauthorized: false,
  },
});

const sqlCommands = [
  'ALTER TABLE user_settings DROP CONSTRAINT IF EXISTS user_settings_user_id_fkey;',
  'ALTER TABLE fathom_calls DROP CONSTRAINT IF EXISTS fathom_calls_user_id_fkey;',
  'ALTER TABLE fathom_transcripts DROP CONSTRAINT IF EXISTS fathom_transcripts_recording_id_fkey;',
  'ALTER TABLE call_categories DROP CONSTRAINT IF EXISTS call_categories_user_id_fkey;',
  'ALTER TABLE call_category_assignments DROP CONSTRAINT IF EXISTS call_category_assignments_call_recording_id_fkey;',
];

try {
  console.log('🔓 Dropping foreign key constraints...');
  console.log('');

  for (const sql of sqlCommands) {
    try {
      const result = await pool.query(sql);
      console.log(`✅ ${sql.split(' DROP')[0].trim()}`);
    } catch (e) {
      console.log(`⚠️  ${sql.split(' DROP')[0].trim()} - ${e.message.substring(0, 50)}`);
    }
  }

  console.log('');
  console.log('✅ Foreign key constraints have been removed');
  console.log('You can now run the import script');
  console.log('');

  await pool.end();

} catch (error) {
  console.error('❌ Error:', error.message);
  await pool.end();
  process.exit(1);
}
