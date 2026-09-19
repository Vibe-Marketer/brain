// Scoped incident repair: missing content only; no new calls or placement changes.
import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ quiet: true });
const org = '3def74de-495f-411b-b5dd-b3852429b14d';
const john = process.argv.includes('--andrew')
  ? 'ef054159-3a5a-49e3-9fd8-31fa5a180ee6'
  : '67605e64-8a57-4844-a72e-63cb90c84238';
const apply = process.argv.includes('--apply');
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.split('=')[1]) : Infinity;
const storage = process.env.BB_THREAD_STORAGE;
if (!storage || !process.env.DATABASE_URL?.includes('vltmrnjsubfzrgrtdqey')) throw new Error('Expected production connection and thread storage');
const run = path.join(storage, `fathom-recovery-${Date.now()}`);
fs.mkdirSync(run, { mode: 0o700 });
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
const missing = s => !s?.trim();
const log = value => { const line = JSON.stringify(value); fs.appendFileSync(path.join(run, 'results.jsonl'), line + '\n', { mode: 0o600 }); console.log(line); };
let nextRequest = 0;
async function fetchContent(id, kind, token) {
  for (let attempt = 0; attempt < 5; attempt++) {
    await delay(Math.max(0, nextRequest - Date.now()));
    nextRequest = Date.now() + 1100;
    const response = await fetch(`https://api.fathom.ai/external/v1/recordings/${encodeURIComponent(id)}/${kind}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, signal: AbortSignal.timeout(25000),
    });
    if (response.status === 429 || response.status >= 500) {
      nextRequest = Date.now() + Math.min(60000, Math.max(10000, Number(response.headers.get('retry-after') || 0) * 1000, 2000 * 2 ** attempt));
      continue;
    }
    if (response.status === 404) return { status: 404, text: null };
    if (!response.ok) throw new Error(`${kind} HTTP ${response.status}`);
    const data = await response.json();
    if (kind === 'summary') return { status: 200, text: typeof data.summary?.markdown_formatted === 'string' ? data.summary.markdown_formatted : null };
    if (!Array.isArray(data.transcript)) throw new Error('Unexpected transcript response');
    const lines = data.transcript.filter(s => typeof s.text === 'string' && s.text.trim()).map(s => `[${s.timestamp || '00:00:00'}] ${s.speaker?.display_name || 'Unknown'}: ${s.text}`);
    return { status: 200, text: lines.join('\n\n') || null };
  }
  throw new Error(`${kind} retry budget exhausted`);
}
try {
  await c.connect();
  const { rows: targets } = await c.query(`select r.id, r.owner_user_id,
    coalesce(r.source_metadata->>'copied_from_recording_id',r.source_metadata->>'cross_org_routed_from_id') original_id
    from recordings r where organization_id=$1 and owner_user_id=$2 and source_app='fathom'
    and (not $3::boolean or source_metadata->>'import_source'='connector-sync-all')
    and (nullif(trim(full_transcript),'') is null or nullif(trim(summary),'') is null) order by r.id`, [org, john, process.argv.includes('--only-sync-all')]);
  const { rows: [source] } = await c.query(`select id,oauth_access_token from import_sources where user_id=$1 and source_app='fathom' and is_active order by updated_at desc limit 1`, [john]);
  if (!source?.oauth_access_token || source.oauth_access_token.includes('BEGIN PGP')) throw new Error('Usable owner credential unavailable');
  log({ mode: apply ? 'apply' : 'preview', owner: john, targets: targets.length, run });
  for (const [index, target] of targets.slice(0, limit).entries()) {
    try {
      const { rows } = await c.query(`select * from recordings where id=any($1::uuid[]) and owner_user_id=$2`, [[target.id, target.original_id].filter(Boolean), john]);
      const original = rows.find(r => r.id === target.original_id)
        ?? (process.argv.includes('--allow-missing-original') ? rows.find(r => r.id === target.id) : null);
      if (!original) throw new Error('Original linkage missing');
      const providerId = original.source_call_id || original.fathom_provider_id || original.source_metadata?.recording_id || original.source_metadata?.external_id || original.source_metadata?.fathom_call_id;
      if (!providerId || !/^\d+$/.test(providerId)) throw new Error('Provider ID unavailable');
      const needTranscript = rows.some(r => missing(r.full_transcript));
      const needSummary = rows.some(r => missing(r.summary));
      const transcript = needTranscript ? await fetchContent(providerId, 'transcript', source.oauth_access_token) : { status: 'existing', text: null };
      const summary = needSummary ? await fetchContent(providerId, 'summary', source.oauth_access_token) : { status: 'existing', text: null };
      const { rows: raw } = await c.query('select * from fathom_raw_calls where user_id=$1 and recording_id::text=$2', [john, providerId]);
      fs.writeFileSync(path.join(run, `${target.id}.json`), JSON.stringify({ before: rows, rawBefore: raw, providerId, transcript, summary }), { mode: 0o600 });
      let updated = [];
      if (apply && (transcript.text || summary.text)) {
        await c.query('begin');
        const result = await c.query(`update recordings set
          full_transcript=case when nullif(trim(full_transcript),'') is null and nullif($1,'') is not null then $1 else full_transcript end,
          summary=case when nullif(trim(summary),'') is null and nullif($2,'') is not null then $2 else summary end,
          synced_at=now()
          where id=any($3::uuid[]) and owner_user_id=$4 and
          ((nullif(trim(full_transcript),'') is null and nullif($1,'') is not null) or (nullif(trim(summary),'') is null and nullif($2,'') is not null))
          returning id,length(full_transcript) transcript_len,length(summary) summary_len`, [transcript.text,summary.text,rows.map(r => r.id),john]);
        updated = result.rows;
        await c.query(`update fathom_raw_calls set
          full_transcript=case when nullif(trim(full_transcript),'') is null and nullif($1,'') is not null then $1 else full_transcript end,
          summary=case when nullif(trim(summary),'') is null and nullif($2,'') is not null and not coalesce(summary_edited_by_user,false) then $2 else summary end
          where user_id=$3 and recording_id::text=$4`, [transcript.text,summary.text,john,providerId]);
        await c.query('commit');
      }
      log({ index: index+1, target: target.id, providerId, transcriptStatus: transcript.status, summaryStatus: summary.status, transcriptLength: transcript.text?.length || 0, summaryLength: summary.text?.length || 0, updated });
    } catch (e) { await c.query('rollback'); log({ target: target.id, error: e.message }); if (/HTTP 401|HTTP 403/.test(e.message)) throw e; }
  }
  log({ complete: true, counts: (await c.query(`select count(*) total,count(*) filter(where nullif(trim(full_transcript),'') is null) empty_transcript,count(*) filter(where nullif(trim(summary),'') is null) empty_summary from recordings where organization_id=$1 and owner_user_id=$2`,[org,john])).rows });
} finally { await c.end(); }
