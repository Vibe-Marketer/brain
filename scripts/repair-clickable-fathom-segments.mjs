// Complete structured content locally for this incident; never refetch or replace content.
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import dotenv from 'dotenv';
import { parseFathomCopyFormat } from '../supabase/functions/_shared/fathom-transcript-parser.ts';
import { canonicalTurnsToSegments } from '../supabase/functions/_shared/canonical-recording.ts';

dotenv.config({ quiet: true });
const storage = process.env.BB_THREAD_STORAGE;
const apply = process.argv.includes('--apply');
if (!storage || !process.env.DATABASE_URL?.includes('vltmrnjsubfzrgrtdqey')) throw new Error('Expected production connection and incident storage');
const ids = new Set();
for (const dir of fs.readdirSync(storage).filter(f => f.startsWith('fathom-recovery-'))) {
  for (const file of fs.readdirSync(path.join(storage, dir)).filter(f => f.endsWith('.json'))) {
    const snapshot = JSON.parse(fs.readFileSync(path.join(storage, dir, file), 'utf8'));
    for (const row of snapshot.before ?? []) ids.add(row.id);
  }
}
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const result = { mode: apply ? 'apply' : 'preview', snapshotIds: ids.size, candidates: 0, parsed: 0, segments: 0, updated: 0, skipped: [] };
try {
  await c.connect();
  const { rows } = await c.query(`select * from recordings where id=any($1::uuid[]) and source_app='fathom'
    and owner_user_id=any($2::uuid[])
    and (transcript_segments is null or transcript_segments='[]'::jsonb)
    and nullif(trim(full_transcript),'') is not null`, [[...ids], ['67605e64-8a57-4844-a72e-63cb90c84238','ef054159-3a5a-49e3-9fd8-31fa5a180ee6']]);
  result.candidates = rows.length;
  const updates = [];
  for (const row of rows) {
    const parsed = parseFathomCopyFormat(row.full_transcript);
    if (parsed.parse_status !== 'parsed') { result.skipped.push(row.id); continue; }
    const segments = canonicalTurnsToSegments(parsed.segments.map(s => ({ speakerName: s.speaker, text: s.text, startSeconds: s.start_ms / 1000 })));
    if (!segments.length) { result.skipped.push(row.id); continue; }
    result.parsed++;
    result.segments += segments.length;
    updates.push({ row, segments });
  }
  if (apply && updates.length) {
    const run = path.join(storage, `fathom-segments-${Date.now()}`);
    fs.mkdirSync(run, { mode: 0o700 });
    fs.writeFileSync(path.join(run, 'before.json'), JSON.stringify({ before: updates.map(u => u.row) }), { mode: 0o600 });
    await c.query('begin');
    for (const { row, segments } of updates) {
      const updated = await c.query(`update recordings set transcript_segments=$1::jsonb where id=$2
        and full_transcript=$3 and (transcript_segments is null or transcript_segments='[]'::jsonb)`, [JSON.stringify(segments), row.id, row.full_transcript]);
      result.updated += updated.rowCount;
    }
    if (result.updated !== updates.length) throw new Error('Concurrent change detected; rolling back segment updates');
    await c.query('commit');
    fs.writeFileSync(path.join(run, 'result.json'), JSON.stringify(result, null, 2), { mode: 0o600 });
  }
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  await c.query('rollback');
  throw error;
} finally { await c.end(); }
