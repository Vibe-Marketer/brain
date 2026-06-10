# CONNECTOR-PIPELINE.TS — DEEP VET

**Target file:** `supabase/functions/_shared/connector-pipeline.ts` (521 lines)
**Audit date:** 2026-05-15
**Auditor:** Don (Andrew's DA)
**Status:** Production-deployed and consumed by Fathom (`sync-meetings`), Zoom (`zoom-sync-meetings`), YouTube import, file-upload, and pasted-transcript paths.

The pipeline is the foundation we're going to bolt 8 more connectors onto. I went through it line-by-line. Here's what's strong, what's broken, and what's missing.

---

## VERDICT (LEAD)

The pipeline gets the **core abstraction right** — `ConnectorRecord` normalizes input across sources, `checkDuplicate → routing → insertRecording` separates concerns cleanly, and the cross-org cross-org routing has the correct try/catch placement that prevents the source-org duplicate-insert bug (line 489-512 — somebody already lived through this).

But it has **20 distinct gaps** that will bite us at platform #3 onward. Most are not fatal; they're paper cuts that compound. The biggest five (in priority):

1. **No `audio_url` / `video_url` fields on `ConnectorRecord`** — connectors that get a direct media URL (Zoom, Fathom, Grain, Teams) must mutate the row after insert, which breaks the abstraction.
2. **No "transcript not ready yet" state** — Teams, Fireflies, Zoom often deliver transcripts async (5–30 min after recording). Pipeline assumes full transcript at insert time.
3. **Race condition on `UNIQUE(organization_id, source_app, source_call_id)`** — dedup + insert isn't atomic. Two concurrent sync workers can both pass dedup, second hits 23505 with no graceful handler.
4. **Fathom-specific code lives in the universal pipeline** (lines 192–194). `fathom_provider_id` is hardcoded for `source_app === 'fathom'`. Code smell — universal pipeline shouldn't know about a source.
5. **No standardized webhook signature verifier**. Each connector rolls its own HMAC, which is where security bugs live.

The pipeline is **fixable, not rewritable**. Sections 3–5 below give the patch list and the upgraded interface.

---

## 1. STRENGTHS

| # | Strength | Where |
|---|----------|-------|
| 1 | Clean type-driven contract — every connector writes the same `ConnectorRecord` shape | Lines 21–51 |
| 2 | Fail-open on dedup query error — a dedup failure never blocks an import | Lines 97–101 |
| 3 | Non-blocking workspace_entry creation — recording persists even if entry insert fails | Lines 232–300 |
| 4 | Re-import path — `recording row exists but no workspace_entries` → re-creates entry instead of duplicate row (handles "user deleted from all workspaces, wants it back" flow) | Lines 353–389 |
| 5 | Cross-org routing placed OUTSIDE try/catch — bug-fix awareness baked in (lines 489–491 comment proves they hit this before) | Lines 489–512 |
| 6 | Source metadata audit trail — `routed_by_rule_id`, `routed_by_rule_name`, `routed_at` written to source_metadata so you can replay a routing decision | Lines 435–453 |
| 7 | HOME-entry deduplication when explicit workspace specified | Lines 274–292 |
| 8 | Indexed dedup via dedicated `source_call_id` column (not JSONB scan) | Line 94 comment |

---

## 2. FINDINGS — 20 ISSUES, RANKED

### CRITICAL (block scaling to N connectors)

#### F-01 — Missing `audio_url` / `video_url` on `ConnectorRecord`
**Severity:** Critical
**Location:** Interface at lines 21–51
**Impact:** Recordings table has `audio_url TEXT, video_url TEXT` columns (migration 20260131000007). Pipeline drops them. Every connector that has a media URL (Zoom, Fathom, Grain, Teams, tl;dv) must do a second `supabase.from('recordings').update({...}).eq('id', result.recordingId)` after the pipeline returns. That's a separate transaction, can fail independently, and is duplicated in every connector.

**Fix:** Add to `ConnectorRecord`:
```ts
audio_url?: string | null;       // Direct download URL or storage path
video_url?: string | null;
media_url_expires_at?: string;   // ISO datetime — re-fetch if past
```

#### F-02 — No async transcript state
**Severity:** Critical
**Location:** `full_transcript: string` is required at insert (line 27)
**Impact:** Teams, Fireflies, Zoom Cloud Recording all deliver transcript AFTER recording finishes — 5 to 60 min later. Forces connectors into one of three ugly choices: (a) skip insert until transcript arrives → lose calls on Plaud, where transcript may never arrive automatically; (b) insert with empty string and update later → no UPDATE path documented; (c) re-poll.

**Fix:** Allow nullable transcript + add status column:
```ts
full_transcript: string | null;
transcript_status?: 'ready' | 'pending' | 'failed' | 'unavailable';
transcript_ready_check?: { source_url: string; recheck_after_seconds: number };
```
Plus migration: `ALTER TABLE recordings ADD COLUMN transcript_status TEXT DEFAULT 'ready';` and a reconciler job that re-fetches `pending` ones.

#### F-03 — Race condition on UNIQUE constraint
**Severity:** Critical
**Location:** Lines 197–219, no transaction wrapper
**Impact:** Two concurrent sync workers (e.g., webhook + scheduled sync firing simultaneously) can both pass `checkDuplicate` returning `isDuplicate: false`, both reach `insertRecording`, second hits PG error code 23505 (unique_violation). Error propagates as `Failed to insert recording: duplicate key value violates unique constraint`. No graceful handling; treated as failure even though the correct action is "skip, the other worker won."

**Fix:** Wrap insertRecording in PG error-code catch:
```ts
} catch (err: any) {
  if (err?.code === '23505' || /duplicate key/i.test(err?.message)) {
    // Concurrent insert won the race. Idempotent skip.
    return { id: existingRecordingIdFromError(err) }; // or re-query
  }
  throw err;
}
```

#### F-04 — Fathom-specific logic in universal pipeline
**Severity:** High
**Location:** Lines 192–194
```ts
const legacyRecordingId = record.source_app === 'fathom'
  ? (Number.isFinite(Number(record.external_id)) ? Number(record.external_id) : null)
  : null;
```
**Impact:** Universal pipeline knows about Fathom. Every new connector author has to wonder whether their source needs special handling here.

**Fix:** Move to per-connector field:
```ts
// In ConnectorRecord:
legacy_id_numeric?: number | null;  // Connector explicitly sets this if needed

// In insertRecording (line 212):
fathom_provider_id: record.legacy_id_numeric ?? null,
```

Fathom connector (`sync-meetings/index.ts`) sets `legacy_id_numeric: recordingId` explicitly.

#### F-05 — No standardized webhook signature verifier
**Severity:** High
**Location:** Missing entirely
**Impact:** Fathom webhook, Zoom webhook, GHL webhook, Polar webhook each verify HMAC independently. Already 4 implementations of "HMAC SHA256 with timing-safe compare." Add 5 more for Fireflies/Grain/tldv/RingCentral/Teams and you have 9 places to get wrong.

**Fix:** New `_shared/webhook-verify.ts`:
```ts
export async function verifyHmacSha256({
  payload,         // raw string body
  signatureHeader, // value of x-hub-signature-256 etc
  secret,
  prefix = 'sha256=',
}: VerifyArgs): Promise<boolean> {
  const expected = await hmacSha256Hex(secret, payload);
  return timingSafeEqual(`${prefix}${expected}`, signatureHeader);
}
```
With matching `verifyTimestampedSignature` for platforms that include a timestamp + signature (RingCentral, Microsoft Graph).

### HIGH (will bite during platform integration)

#### F-06 — No standardized OAuth refresh + retry helper
**Severity:** High
**Location:** `zoom-token-refresh.ts` exists, but Fathom uses its own path. Each new OAuth source will reinvent.
**Fix:** `_shared/oauth-refresh.ts` with token-expiry-aware fetch wrapper:
```ts
export async function fetchWithTokenRefresh<T>(args: {
  supabase: SupabaseClient;
  sourceId: number;
  userId: string;
  sourceApp: string;
  request: (accessToken: string) => Promise<Response>;
  refreshFn: (refreshToken: string) => Promise<TokenResponse>;
}): Promise<Response>;
```
Returns a Response after one transparent refresh on 401.

#### F-07 — No structured logging / Langfuse integration
**Severity:** High
**Location:** Pipeline uses `console.log`/`console.error` only. `_shared/langfuse.ts` exists, unused here.
**Impact:** Hard to query "show me all failed Fathom syncs last 24h" or "which recording was the last successful insert" without grepping logs.
**Fix:** Wrap each stage in a Langfuse span: `pipeline.dedup`, `pipeline.route`, `pipeline.insert`, `pipeline.cross_org_copy`. Add `recordingId`, `userId`, `sourceApp` as common tags.

#### F-08 — Routing query runs even when user has zero rules
**Severity:** Medium-High
**Location:** Lines 405–487. `resolveRoutingDestination` is called every single insert.
**Impact:** A DB roundtrip on every recording for users who have never set a routing rule. At N=10K recordings/day this matters.
**Fix:** Cache "user has rules?" boolean per organization in Edge Function memory (TTL 60s) — skip the routing block entirely when empty.

#### F-09 — No multi-workspace insertion
**Severity:** Medium
**Location:** `workspace_id` is single-valued (line 49)
**Impact:** Common request: "import this call to both my personal vault AND my team workspace." Not currently possible without a second pipeline run (which fails dedup).
**Fix:** Allow `workspace_ids: string[]` — pipeline creates one workspace_entry per id. Update re-import path to match.

### MEDIUM (annoyances)

#### F-10 — `organization_id` resolution hardcoded to personal
**Severity:** Medium
**Location:** Lines 159–177 — falls back to user's `type='personal'` org. Users with multi-org setups (work + agency + client orgs) can't target a specific org without `record.organization_id` set upstream.
**Fix:** Add UI-driven org selector that sets `organization_id` before sync, OR add `default_organization_id` per `source_app` in `import_sources`.

#### F-11 — HOME-entry cleanup race
**Severity:** Medium
**Location:** Lines 274–292. Trigger `auto_home_workspace_entry` fires on recording INSERT, then code DELETEs the HOME entry. Brief window where call appears twice in UI.
**Fix:** Two options:
- (a) `BEFORE INSERT` trigger check — skip auto HOME entry when `_pgrst.intended_workspace_id` claim is set
- (b) Suppress the trigger conditionally via session variable

#### F-12 — Cross-org RPC has no idempotency
**Severity:** Medium
**Location:** Lines 494–511. `route_recording_cross_org` is called with `p_delete_source`. If copy succeeds but delete fails → orphan in source. If copy partially fails → partial recording in target.
**Fix:** Make the RPC transactional + return a status enum (`copied`, `copied_and_deleted`, `copy_partial`, `delete_failed`). Pipeline logs all four states.

#### F-13 — No backfill control
**Severity:** Medium
**Location:** Connectors hardcode "sync last N days." No parameter.
**Fix:** Add `backfill_until: string | null` (ISO datetime) to connector sync calls + cursor state in `import_sources` (`last_synced_external_id`).

#### F-14 — Transcript format normalizers scattered
**Severity:** Medium
**Location:** Zoom uses `vtt-parser.ts`. Fathom uses `fathom-transcript-parser.ts`. Each new platform that delivers transcripts in JSON/SRT/Otter format will need its own parser.
**Fix:** `_shared/transcript-normalizer.ts` with discriminated union:
```ts
export function normalizeTranscript(input:
  | { format: 'vtt';      content: string }
  | { format: 'srt';      content: string }
  | { format: 'fathom';   segments: FathomSegment[] }
  | { format: 'fireflies'; sentences: FirefliesSentence[] }
  | { format: 'plain';    content: string; speaker_hint?: string }
): Utterance[];
```
Where `Utterance` is `{ speaker: string; speaker_email?: string; text: string; start_ms: number; end_ms?: number }`.

#### F-15 — No per-recording sync audit row
**Severity:** Medium
**Location:** `sync_jobs.skipped_count` aggregates counts but no per-recording trail.
**Impact:** "I'm missing meeting X from May 3 — did sync see it?" — currently unanswerable.
**Fix:** `sync_job_items` table: `(sync_job_id, external_id, outcome enum, error_message, recording_id nullable)`.

### LOWER PRIORITY

#### F-16 — Source metadata accumulation on re-import
Re-import path doesn't merge old `routed_by_rule_id` audit trail. Forensic gap, not a bug.

#### F-17 — Folder-id resolution one-way
Routing rule resolves `folder_id`, but if folder deleted between resolution and insert, FK `ON DELETE SET NULL` saves it gracefully — no log of the degradation.

#### F-18 — Each connector has its own `RateLimiter` class
Found 2 copies already (Fathom sync, Zoom sync). DRY it.

#### F-19 — `participant_emails` parsed inconsistently
Pipeline doesn't normalize emails (lowercase, trim) at insert. Different sources may store `JOHN@FOO.COM` vs `john@foo.com`. Downstream Contact resolution then fails.
**Fix:** Normalize in `insertRecording`.

#### F-20 — No test fixtures for pipeline
Pipeline doesn't ship with a `__tests__/` fixture set covering: new insert, duplicate skip, re-import, cross-org routing, concurrent-insert race. Should before we 9x the surface area.

---

## 3. UPGRADED `ConnectorRecord` INTERFACE (FULL TYPE)

This is the proposed shape. Diff against lines 21–51 in `connector-pipeline.ts`:

```ts
export interface ConnectorRecord {
  // ───── identity ─────
  external_id: string;
  source_app: ConnectorSourceApp; // typed union below
  legacy_id_numeric?: number | null; // replaces hardcoded Fathom branch

  // ───── content ─────
  title: string;
  full_transcript: string | null; // ← was non-nullable; now nullable for async sources
  transcript_status?: 'ready' | 'pending' | 'failed' | 'unavailable';
  transcript_format?: 'vtt' | 'srt' | 'json' | 'plain'; // for re-parse later
  transcript_raw?: string | null; // raw text we can re-normalize
  summary?: string | null;

  // ───── media ─────
  audio_url?: string | null;
  video_url?: string | null;
  media_url_expires_at?: string;  // ISO

  // ───── timing ─────
  recording_start_time: string;
  recording_end_time?: string;
  duration?: number;  // seconds

  // ───── participants ─────
  recorded_by_email?: string | null;
  recorded_by_name?: string | null;
  participant_emails?: string[];  // normalized to lowercase before insert

  // ───── destination ─────
  organization_id?: string;
  workspace_id?: string;
  workspace_ids?: string[];  // multi-workspace landing
  folder_id?: string;

  // ───── source-specific opaque blob ─────
  source_metadata: Record<string, unknown>;
}

export type ConnectorSourceApp =
  | 'fathom' | 'zoom' | 'youtube' | 'file-upload'
  | 'fireflies' | 'grain' | 'tldv'
  | 'ringcentral' | 'mojo' | 'ghl' | 'teams' | 'plaud';
```

### Schema migrations required to support upgraded interface

```sql
-- 1) Allow nullable transcript + status
ALTER TABLE recordings
  ALTER COLUMN full_transcript DROP NOT NULL,
  ADD COLUMN transcript_status TEXT DEFAULT 'ready'
    CHECK (transcript_status IN ('ready','pending','failed','unavailable')),
  ADD COLUMN transcript_format TEXT,
  ADD COLUMN transcript_raw TEXT;

-- 2) Media URL TTL (audio_url + video_url already exist)
ALTER TABLE recordings
  ADD COLUMN media_url_expires_at TIMESTAMPTZ;

-- 3) Sync job items (audit trail)
CREATE TABLE sync_job_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_job_id UUID NOT NULL REFERENCES sync_jobs(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('synced','skipped','failed','retried')),
  error_message TEXT,
  recording_id UUID REFERENCES recordings(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_sync_job_items_sync_job_id ON sync_job_items(sync_job_id);
CREATE INDEX idx_sync_job_items_external_id ON sync_job_items(external_id);
```

---

## 4. PATCH LIST (PRIORITIZED)

| # | Issue | LOC | Severity | Effort | Blocks |
|---|-------|-----|----------|--------|--------|
| F-01 | Add media URL fields | ~10 | Critical | 0.5d | Zoom, Fathom, Grain, Teams, tl;dv re-architect |
| F-02 | Async transcript state + reconciler | ~80 | Critical | 1.5d | Teams, Fireflies, Plaud |
| F-03 | UNIQUE-violation graceful retry | ~15 | Critical | 0.5d | All webhook-driven connectors |
| F-04 | Move Fathom branch to per-connector field | ~5 | High | 0.25d | Code hygiene |
| F-05 | `_shared/webhook-verify.ts` | ~80 | High | 0.5d | Fireflies, Grain, GHL, RC, Teams |
| F-06 | `_shared/oauth-refresh.ts` | ~150 | High | 1d | All OAuth connectors |
| F-07 | Langfuse spans | ~30 | High | 0.5d | Observability |
| F-08 | Skip routing when no rules | ~20 | Medium-High | 0.25d | Perf |
| F-09 | `workspace_ids[]` multi-landing | ~40 | Medium | 0.5d | UX |
| F-10 | Org selector per connector | ~30 | Medium | 0.5d | Multi-org users |
| F-11 | HOME entry race | ~20 | Medium | 0.5d | UI |
| F-12 | Cross-org RPC return enum | ~50 | Medium | 1d | Forensics |
| F-13 | `backfill_until` cursor | ~20 | Medium | 0.5d | All polling connectors |
| F-14 | `_shared/transcript-normalizer.ts` | ~200 | Medium | 1d | Format unification |
| F-15 | `sync_job_items` table | ~60 | Medium | 0.5d | Support / forensics |
| F-16–F-20 | Minor cleanup | various | Low | 1d aggregate | Hygiene |

**Total pre-work before adding ANY new connector: ~5 dev-days.** Doing F-01 / F-02 / F-03 / F-05 / F-06 minimum (3 days) before platform integration starts saves rework on every single connector.

---

## 5. SUMMARY

The pipeline is solid bones. The fixes above turn it from "works for Fathom + Zoom + a couple of toys" into "scales to 10+ source platforms without each one being a custom snowflake." Without the fixes you'll write the same paper-cut code 8 times.

Do the 5 critical fixes (F-01 to F-05) **before** building Fireflies. After that, each new connector is mostly per-platform API mapping — not pipeline rework.
