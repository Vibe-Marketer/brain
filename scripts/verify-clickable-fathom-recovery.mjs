import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ quiet: true });
const storage = process.env.BB_THREAD_STORAGE;
if (!storage || !process.env.DATABASE_URL?.includes('vltmrnjsubfzrgrtdqey')) throw new Error('Expected production connection and incident storage');
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const org = '3def74de-495f-411b-b5dd-b3852429b14d';
const baseline = JSON.parse(fs.readFileSync(path.join(storage, 'clickable-placement-before.json'), 'utf8'));
const beforeById = new Map();
for (const dir of fs.readdirSync(storage).filter(f => f.startsWith('fathom-recovery-')).sort()) {
  for (const file of fs.readdirSync(path.join(storage, dir)).filter(f => f.endsWith('.json'))) {
    const snapshot = JSON.parse(fs.readFileSync(path.join(storage, dir, file), 'utf8'));
    for (const row of snapshot.before ?? []) if (!beforeById.has(row.id)) beforeById.set(row.id, row);
  }
}
try {
  await c.connect();
  await c.query('begin read only');
  const { rows } = await c.query('select * from recordings where id=any($1::uuid[])', [[...new Set([...baseline.map(r => r.id), ...beforeById.keys()])]]);
  const current = new Map(rows.map(r => [r.id, r]));
  const violations = [];
  const stable = ['title','organization_id','owner_user_id','source_call_id','fathom_provider_id','source_metadata'];
  for (const before of baseline) {
    const after = current.get(before.id);
    if (!after) { violations.push({ id: before.id, field: 'missing_recording' }); continue; }
    for (const field of stable) if (JSON.stringify(before[field]) !== JSON.stringify(after[field])) violations.push({ id: before.id, field });
    const { rows: [{ entries }] } = await c.query('select jsonb_agg(to_jsonb(w) order by w.id) entries from workspace_entries w where w.recording_id=$1', [before.id]);
    if (JSON.stringify(entries) !== JSON.stringify(before.entries)) violations.push({ id: before.id, field: 'workspace_entries' });
  }
  for (const [id, before] of beforeById) {
    const after = current.get(id);
    if (!after) { violations.push({ id, field: 'missing_repaired_recording' }); continue; }
    for (const field of ['full_transcript','summary']) if (before[field]?.trim() && before[field] !== after[field]) violations.push({ id, field: `existing_${field}_overwritten` });
  }
  const { rows: counts } = await c.query(`select owner_user_id,count(*) total,
    count(*) filter(where nullif(trim(full_transcript),'') is null) empty_transcripts,
    count(*) filter(where nullif(trim(summary),'') is null) empty_summaries
    from recordings where organization_id=$1 group by owner_user_id`, [org]);
  const result = { verifiedAt: new Date().toISOString(), baselineRows: baseline.length, recoverySnapshotRows: beforeById.size, violations, counts };
  fs.writeFileSync(path.join(storage, 'clickable-recovery-verification.json'), JSON.stringify(result,null,2), { mode: 0o600 });
  console.log(JSON.stringify(result,null,2));
  if (violations.length) process.exitCode = 1;
} finally { await c.end(); }
