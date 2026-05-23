/**
 * One-time cleanup: remove leftover Phase 39 p95 benchmark seed rows from prod
 * `recordings` table. The benchmark seeds 5000 rows with legacy_recording_id
 * 8_500_000_000_000..8_500_000_005_000 and source_call_id `bench-N-phase39bench-*`.
 *
 * Run with: npx tsx scripts/cleanup-phase39-bench-seed.ts
 */

import { config as loadDotenv } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

loadDotenv({ path: resolve(process.cwd(), '.env.test'), override: true });
loadDotenv({ path: resolve(process.cwd(), '.env'), override: true });

const url = process.env.VITE_SUPABASE_TEST_URL || process.env.VITE_SUPABASE_URL || '';
const key = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // 1. Find target recording IDs (PostgREST default limit is 1000; iterate)
  const ids: string[] = [];
  let offset = 0;
  while (true) {
    const { data: batch, error } = await supabase
      .from('recordings')
      .select('id')
      .like('source_call_id', 'bench-%-phase39bench-%')
      .range(offset, offset + 999);
    if (error) {
      console.error('Select error:', error);
      process.exit(1);
    }
    if (!batch || batch.length === 0) break;
    ids.push(...batch.map((r) => r.id as string));
    if (batch.length < 1000) break;
    offset += 1000;
  }
  console.log(`Found ${ids.length} bench rows to clean.`);

  if (ids.length === 0) {
    console.log('Nothing to clean.');
    return;
  }

  // 2. Delete workspace_entries first
  let totalDeletedEntries = 0;
  for (let i = 0; i < ids.length; i += 500) {
    const batch = ids.slice(i, i + 500);
    const { count, error } = await supabase
      .from('workspace_entries')
      .delete({ count: 'exact' })
      .in('recording_id', batch);
    if (error) {
      console.warn(`workspace_entries delete batch ${i}:`, error.message);
      continue;
    }
    totalDeletedEntries += count ?? 0;
  }
  console.log(`Deleted ${totalDeletedEntries} workspace_entries.`);

  // 3. Delete recordings
  let totalDeletedRecordings = 0;
  for (let i = 0; i < ids.length; i += 500) {
    const batch = ids.slice(i, i + 500);
    const { count, error } = await supabase
      .from('recordings')
      .delete({ count: 'exact' })
      .in('id', batch);
    if (error) {
      console.warn(`recordings delete batch ${i}:`, error.message);
      continue;
    }
    totalDeletedRecordings += count ?? 0;
  }
  console.log(`Deleted ${totalDeletedRecordings} recordings.`);
}

main();
