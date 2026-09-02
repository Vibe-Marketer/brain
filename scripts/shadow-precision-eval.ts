#!/usr/bin/env node
/**
 * SHADOW PRECISION EVALUATOR (SAFE-06)
 * =====================================
 * Phase 32 Plan 05 ("32-match-rule-hardening-provider-agnostic-matcher"),
 * Task 1.
 *
 * READ-ONLY BY CONSTRUCTION. Every Supabase call in this file is a read:
 * `.select(`, `.eq(`, `.in(`, `.maybeSingle(`, or `supabase.auth.admin.listUsers(`.
 * There are no insert, update, upsert, or delete write calls anywhere in this
 * file (see 32-05-PLAN.md acceptance criteria for the exact grep gate). The
 * only filesystem writes are the local JSON worksheet under
 * `.planning/phases/.../` -- never a database write.
 *
 * Two modes:
 *
 *   --find-org
 *       For each of Andrew's known account emails, resolve the auth user id
 *       (direct auth.users select, falling back to auth.admin.listUsers()
 *       when the direct select is blocked or empty -- same pattern as
 *       scripts/get-user-id.ts), then resolve organization membership via
 *       organization_memberships, and print each candidate organization_id with
 *       its name, matched email, membership role, and a recording count (so
 *       a human can judge "enough real call history to make a precision
 *       measurement meaningful").
 *
 *   --score <organization_id>
 *       Reads event_match_decisions rows touching recordings in that org
 *       (joined client-side via a recordings.organization_id lookup, since
 *       the ledger has no organization_id column of its own), groups by tier
 *       and decision, and emits a hand-labeling worksheet: each proposed
 *       pair with both recordings' titles + start times, plus the total
 *       merge_proposed denominator needed for the false-merge rate
 *       (false / total-proposed -- 32-RESEARCH.md "Don't Hand-Roll" framing,
 *       NOT false / total O(n^2) pair-space). Requires an explicit org id --
 *       refuses to scan every org. Does NOT auto-label; SAFE-06 requires
 *       human judgment (32-VALIDATION.md: manual-only).
 *
 * Usage:
 *   node scripts/shadow-precision-eval.ts --find-org
 *   node scripts/shadow-precision-eval.ts --score <organization_id>
 *
 * Env (same convention as scripts/get-user-id.ts / scripts/verify-connectors-live.ts):
 *   SUPABASE_URL or VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   Loaded from .env via `dotenv/config` -- .env is PRODUCTION (root
 *   CLAUDE.md env file map). Running this from the repo root queries prod,
 *   which is the point: SAFE-06 requires a real hand-labeled data set, not
 *   synthetic data.
 */

import 'dotenv/config';
import { config as loadDotenvFrom } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Fallback: some local checkouts keep the real .env one directory above the
// repo root (secrets shared across sibling worktrees instead of duplicated
// into each one) rather than in the repo root itself, where `dotenv/config`
// above already looked. Only used if that cwd-relative load didn't already
// populate these vars -- never overrides a value that's already set.
if (!process.env.SUPABASE_URL && !process.env.VITE_SUPABASE_URL && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  loadDotenvFrom({ path: path.resolve(__dirname, '../../.env') });
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: Missing required environment variables');
  console.error('Required: SUPABASE_URL (or VITE_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY');
  console.error('Looked in the repo root .env and one directory above it.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Andrew's known account emails (32-05-PLAN.md <interfaces>). --find-org
// tries each, read-only. a@vibeos.com is noted as the only ADMIN per
// project memory -- not assumed here, just tried like the others.
const KNOWN_EMAILS = [
  'a@vibeos.com',
  'andrew@aisimple.co',
  'andrew@vibeos.com',
  'naegele412@gmail.com',
];

const PHASE_DIR = path.resolve(
  __dirname,
  '../.planning/phases/32-match-rule-hardening-provider-agnostic-matcher',
);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// Shared read-only helpers
// ---------------------------------------------------------------------------

interface AuthUserLite {
  id: string;
  email: string;
}

/**
 * Resolve a user by email, read-only. Tries a direct auth.users select
 * first; falls back to supabase.auth.admin.listUsers() (paginated) when the
 * direct select errors or comes back empty -- mirrors scripts/get-user-id.ts,
 * including the fallback (the direct select is expected to fail because
 * `auth` is not in PostgREST's exposed schema list; the fallback is the
 * real path).
 */
async function findAuthUserByEmail(email: string): Promise<AuthUserLite | null> {
  const direct = await supabase
    .from('auth.users')
    .select('id, email')
    .eq('email', email)
    .maybeSingle();

  if (!direct.error && direct.data) {
    return { id: direct.data.id as string, email: (direct.data.email as string) ?? email };
  }

  // Fallback: auth admin API, paginated defensively (get-user-id.ts only
  // checks page 1; we page so a larger user base can't silently hide a match).
  const perPage = 1000;
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error(`  auth.admin.listUsers() failed: ${error.message}`);
      return null;
    }
    const match = data.users.find((u) => u.email === email);
    if (match) return { id: match.id, email: match.email ?? email };
    if (data.users.length < perPage) break; // last page reached
  }
  return null;
}

interface OrgMembershipRow {
  organization_id: string;
  role: string;
}

async function findMemberships(userId: string): Promise<OrgMembershipRow[]> {
  // Table is `organization_memberships` (plural "memberships"), confirmed
  // against the live PostgREST schema -- NOT `organization_members`, which
  // 404s ("not in schema cache") despite appearing in an older migration.
  // Matches the frontend type name in src/types/workspace.ts (OrganizationMembership).
  const { data, error } = await supabase
    .from('organization_memberships')
    .select('organization_id, role')
    .eq('user_id', userId);
  if (error) {
    console.error(`  organization_memberships lookup failed: ${error.message}`);
    return [];
  }
  return (data ?? []) as OrgMembershipRow[];
}

interface OrgLite {
  id: string;
  name: string;
  type: string;
}

async function fetchOrgs(orgIds: string[]): Promise<Map<string, OrgLite>> {
  const map = new Map<string, OrgLite>();
  if (orgIds.length === 0) return map;
  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, type')
    .in('id', orgIds);
  if (error) {
    console.error(`  organizations lookup failed: ${error.message}`);
    return map;
  }
  for (const row of (data ?? []) as OrgLite[]) map.set(row.id, row);
  return map;
}

async function countRecordings(orgId: string): Promise<number> {
  const { count, error } = await supabase
    .from('recordings')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId);
  if (error) {
    console.error(`  recordings count failed for ${orgId}: ${error.message}`);
    return -1;
  }
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// --find-org
// ---------------------------------------------------------------------------

interface Candidate {
  email: string;
  organization_id: string;
  org_name: string;
  org_type: string;
  role: string;
  recording_count: number;
}

async function runFindOrg(): Promise<void> {
  console.log(`Connecting to: ${supabaseUrl}`);
  console.log('Mode: --find-org (read-only)\n');

  const candidates: Candidate[] = [];
  const notFound: string[] = [];

  for (const email of KNOWN_EMAILS) {
    console.log(`Resolving ${email}...`);
    const user = await findAuthUserByEmail(email);
    if (!user) {
      console.log('  not found');
      notFound.push(email);
      continue;
    }
    const memberships = await findMemberships(user.id);
    if (memberships.length === 0) {
      console.log(`  user found (${user.id}) but has no organization_memberships rows`);
      continue;
    }
    const orgs = await fetchOrgs(memberships.map((m) => m.organization_id));
    for (const m of memberships) {
      const org = orgs.get(m.organization_id);
      const recording_count = await countRecordings(m.organization_id);
      candidates.push({
        email,
        organization_id: m.organization_id,
        org_name: org?.name ?? '(unknown)',
        org_type: org?.type ?? '(unknown)',
        role: m.role,
        recording_count,
      });
    }
  }

  console.log('\n=== Candidate organizations ===');
  if (candidates.length === 0) {
    console.log('No candidates found for any known email. Nothing to confirm.');
  } else {
    console.table(
      candidates.map((c) => ({
        organization_id: c.organization_id,
        org_name: c.org_name,
        org_type: c.org_type,
        matched_email: c.email,
        role: c.role,
        recordings: c.recording_count,
      })),
    );

    const distinctOrgIds = [...new Set(candidates.map((c) => c.organization_id))];
    console.log(`\n${distinctOrgIds.length} distinct candidate org(s): ${distinctOrgIds.join(', ')}`);
    if (distinctOrgIds.length === 1) {
      console.log('Single unambiguous candidate -- ready for the Task 2 confirmation gate.');
    } else {
      console.log('Multiple distinct orgs matched -- Task 2 must ask which one to confirm.');
    }
  }

  if (notFound.length > 0) {
    console.log(`\nEmails with no matching auth user: ${notFound.join(', ')}`);
  }
}

// ---------------------------------------------------------------------------
// --score <organization_id>
// ---------------------------------------------------------------------------

interface RecordingLite {
  id: string;
  title: string;
  recording_start_time: string | null;
  organization_id: string;
}

interface DecisionRow {
  id: string;
  recording_id_a: string;
  recording_id_b: string;
  event_id: string | null;
  tier: string;
  score: number | null;
  signals: Record<string, unknown>;
  decision: string;
  decided_by: string;
  applied: boolean;
  created_at: string;
}

interface WorksheetRow {
  id: string;
  tier: string;
  score: number | null;
  signals: Record<string, unknown>;
  decision: string;
  decided_by: string;
  applied: boolean;
  event_id: string | null;
  created_at: string;
  recording_a: { id: string; title: string; start: string | null };
  recording_b: { id: string; title: string; start: string | null };
  hand_label: null;
}

async function runScore(orgId: string): Promise<void> {
  if (!UUID_RE.test(orgId)) {
    console.error(`ERROR: --score requires an explicit organization_id (uuid). Got: "${orgId}"`);
    process.exit(1);
  }

  console.log(`Connecting to: ${supabaseUrl}`);
  console.log(`Mode: --score ${orgId} (read-only)\n`);

  // 1. Recordings in this org -- the join key. event_match_decisions has no
  //    organization_id column of its own (schema: recording_id_a/b only), so
  //    the org scope is resolved client-side through this lookup. Paginated
  //    with .range() -- PostgREST caps a single response at db.max_rows
  //    (1000 here); confirmed live against the "AI Simple" org, which alone
  //    has 1677 recordings, so a single unpaginated select silently truncates.
  const PAGE_SIZE = 1000;
  const recordings: RecordingLite[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data: page, error: recError } = await supabase
      .from('recordings')
      .select('id, title, recording_start_time, organization_id')
      .eq('organization_id', orgId)
      .range(offset, offset + PAGE_SIZE - 1);
    if (recError) {
      console.error(`FATAL: recordings lookup failed: ${recError.message}`);
      process.exit(1);
    }
    const rows = (page ?? []) as RecordingLite[];
    recordings.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  const recMap = new Map(recordings.map((r) => [r.id, r]));
  const recIds = recordings.map((r) => r.id);

  if (recIds.length === 0) {
    console.log(`No recordings found for org ${orgId}. Nothing to score.`);
    writeWorksheet(orgId, [], { totalProposed: 0, byTier: {} });
    return;
  }
  console.log(`${recIds.length} recording(s) in this org.`);

  // 2. event_match_decisions rows touching any of those recordings. Chunked
  //    -- a single .in() call built from 1000+ UUIDs exceeds PostgREST's
  //    request-line limit ("Bad Request"); confirmed live against the same
  //    org. Query both sides in bounded-size chunks (a pair should never
  //    span orgs -- T-32-04 -- but recording_id_a and recording_id_b are
  //    both checked defensively) and de-dupe by id.
  const CHUNK_SIZE = 150;
  const idChunks: string[][] = [];
  for (let i = 0; i < recIds.length; i += CHUNK_SIZE) idChunks.push(recIds.slice(i, i + CHUNK_SIZE));

  const byId = new Map<string, DecisionRow>();
  for (const ids of idChunks) {
    const [byA, byB] = await Promise.all([
      supabase.from('event_match_decisions').select('*').in('recording_id_a', ids),
      supabase.from('event_match_decisions').select('*').in('recording_id_b', ids),
    ]);
    if (byA.error || byB.error) {
      console.error(`FATAL: event_match_decisions lookup failed: ${(byA.error ?? byB.error)?.message}`);
      process.exit(1);
    }
    for (const row of [...(byA.data ?? []), ...(byB.data ?? [])] as DecisionRow[]) {
      byId.set(row.id, row);
    }
  }
  const decisions = [...byId.values()];

  if (decisions.length === 0) {
    console.log(
      `No event_match_decisions rows found for org ${orgId} yet. This is expected before ` +
        'Task 3 enables the flag and the sweep runs.',
    );
    writeWorksheet(orgId, [], { totalProposed: 0, byTier: {} });
    return;
  }

  // 3. Cross-org anomaly check -- defense-in-depth observability for T-32-04.
  //    Should be structurally impossible; report, don't block (read-only tool).
  let crossOrgAnomalies = 0;

  const worksheet: WorksheetRow[] = decisions
    .map((d) => {
      const a = recMap.get(d.recording_id_a);
      const b = recMap.get(d.recording_id_b);
      if (!a || !b) crossOrgAnomalies++;
      return {
        id: d.id,
        tier: d.tier,
        score: d.score,
        signals: d.signals,
        decision: d.decision,
        decided_by: d.decided_by,
        applied: d.applied,
        event_id: d.event_id,
        created_at: d.created_at,
        recording_a: a
          ? { id: a.id, title: a.title, start: a.recording_start_time }
          : { id: d.recording_id_a, title: '(outside org -- anomaly)', start: null },
        recording_b: b
          ? { id: b.id, title: b.title, start: b.recording_start_time }
          : { id: d.recording_id_b, title: '(outside org -- anomaly)', start: null },
        hand_label: null, // filled in by Task 3's human review pass
      };
    })
    .sort((x, y) => x.tier.localeCompare(y.tier) || x.created_at.localeCompare(y.created_at));

  if (crossOrgAnomalies > 0) {
    console.warn(
      `WARNING: ${crossOrgAnomalies} decision(s) reference a recording outside org ${orgId}. ` +
        'This should be structurally impossible (T-32-04) -- flag for investigation.',
    );
  }

  const totalProposed = worksheet.filter((w) => w.decision === 'merge_proposed').length;
  const byTier: Record<string, { proposed: number; total: number }> = {};
  for (const w of worksheet) {
    byTier[w.tier] ??= { proposed: 0, total: 0 };
    byTier[w.tier].total++;
    if (w.decision === 'merge_proposed') byTier[w.tier].proposed++;
  }

  console.log('\n=== Proposed pairs by tier ===');
  console.table(
    Object.entries(byTier).map(([tier, counts]) => ({
      tier,
      merge_proposed: counts.proposed,
      total_rows: counts.total,
    })),
  );
  console.log(`\nTotal merge_proposed (the false-merge-rate denominator): ${totalProposed}`);

  console.log('\n=== Worksheet (for hand-labeling) ===');
  console.table(
    worksheet.map((w) => ({
      id: w.id.slice(0, 8),
      tier: w.tier,
      score: w.score ?? '-',
      decision: w.decision,
      a_title: w.recording_a.title,
      a_start: w.recording_a.start,
      b_title: w.recording_b.title,
      b_start: w.recording_b.start,
    })),
  );

  writeWorksheet(orgId, worksheet, { totalProposed, byTier });
}

function writeWorksheet(
  orgId: string,
  worksheet: WorksheetRow[],
  summary: { totalProposed: number; byTier: Record<string, { proposed: number; total: number }> },
): void {
  mkdirSync(PHASE_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = path.join(PHASE_DIR, `32-05-shadow-precision-worksheet-${orgId}-${stamp}.json`);
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        organization_id: orgId,
        generated_at: new Date().toISOString(),
        summary,
        worksheet,
      },
      null,
      2,
    ),
  );
  console.log(`\nWorksheet written to: ${outPath}`);
}

// ---------------------------------------------------------------------------
// CLI entry
// ---------------------------------------------------------------------------

function printUsage(): void {
  console.log('Shadow precision evaluator (read-only, SAFE-06)\n');
  console.log('Usage:');
  console.log('  node scripts/shadow-precision-eval.ts --find-org');
  console.log('  node scripts/shadow-precision-eval.ts --score <organization_id>');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    printUsage();
    process.exit(args.length === 0 ? 1 : 0);
  }

  if (args.includes('--find-org')) {
    await runFindOrg();
    return;
  }

  if (args.includes('--score')) {
    const idx = args.indexOf('--score');
    const orgId = args[idx + 1];
    if (!orgId) {
      console.error('ERROR: --score requires an organization_id argument.');
      printUsage();
      process.exit(1);
    }
    await runScore(orgId);
    return;
  }

  console.error(`ERROR: Unknown mode. Args: ${args.join(' ')}`);
  printUsage();
  process.exit(1);
}

main().catch((error) => {
  console.error('FATAL ERROR:', error);
  process.exit(1);
});
