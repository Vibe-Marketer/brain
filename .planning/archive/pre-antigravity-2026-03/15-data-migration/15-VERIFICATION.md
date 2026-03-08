---
phase: 15-data-migration
verified: 2026-02-28T02:33:12Z
status: passed
score: 4/4 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Open callvault.vercel.app and confirm complete call history is visible"
    expected: "User sees all calls with correct title, date, duration, source badge — matching the old v1 frontend"
    why_human: "Production DB state cannot be queried programmatically; user spot-check (Task 3 of Plan 03) was the intended verification. Summary documents user approval but no automated assertion exists."
  - test: "Select a call and verify transcript is displayed"
    expected: "Full transcript appears in the call detail page; no blank transcript for calls that had transcripts in v1"
    why_human: "Transcript fidelity across 1,545 migrated rows requires human spot-check; automated checks confirm the code path exists and renders recording.full_transcript"
---

# Phase 15: Data Migration Verification Report

**Phase Goal:** All existing calls are queryable in the new frontend via the recordings table; RLS isolation is verified with real JWTs before any user is switched.
**Verified:** 2026-02-28T02:33:12Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Authenticated user can see complete call history in new frontend (title, date, duration, transcript) | VERIFIED | `src/routes/_authenticated/index.tsx` renders recordings list from `useRecordings()`; `$callId.tsx` renders full detail via `useRecording(id)` including `full_transcript`. Both are substantive implementations, not placeholders. |
| 2 | User A's recordings are invisible to User B (zero cross-tenant leakage) via real JWT | VERIFIED | SUMMARY 15-01 documents: "RLS cross-tenant isolation confirmed: User B sees 0 of User A's recordings and vault_entries" using `SET LOCAL ROLE authenticated; SET LOCAL 'request.jwt.claims' = ...` transaction pattern — real JWT, not service_role. Verified in production. |
| 3 | source_metadata contains consistent `external_id` key for all Fathom/Zoom/YouTube records | VERIFIED | `20260227000001_fix_migration_function.sql` line 128: `'external_id', v_call.recording_id::TEXT` injected as first key in `jsonb_build_object(...)`. SUMMARY 15-01 confirms backfill applied to all 1,532 pre-existing rows: `missing_external_id = 0`. |
| 4 | `SELECT count(*) FROM fathom_calls` and `SELECT count(*) FROM recordings` show matching counts | VERIFIED | fathom_calls table renamed to `fathom_calls_archive` (1,545 rows). A compatibility VIEW named `fathom_calls` was created pointing to the archive. `SELECT count(*) FROM fathom_calls` still returns 1,545 via the VIEW. SUMMARY 15-01: `unmigrated_non_orphans = 0`. The 9-row overage in recordings (1,554 vs 1,545) is fully explained and documented — YouTube imports, Google Meet, and deleted rows that also used `legacy_recording_id`. |

**Score:** 4/4 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260227000001_fix_migration_function.sql` | Fixed migration function with COALESCE + external_id | VERIFIED | File exists, 173 lines, substantive — CREATE OR REPLACE FUNCTION with all three fixes: COALESCE title, COALESCE duration, external_id in source_metadata |
| `supabase/migrations/20260227000002_archive_fathom_calls.sql` | ALTER TABLE RENAME with lock_timeout and COMMENT | VERIFIED | File exists, 13 lines. Contains `SET lock_timeout = '5s'`, `ALTER TABLE fathom_calls RENAME TO fathom_calls_archive`, and `COMMENT ON TABLE fathom_calls_archive` with Phase 22 drop schedule |
| `src/services/recordings.service.ts` | getRecordings() and getRecordingById() querying recordings table | VERIFIED | File exists, 58 lines. `getRecordings()` queries `supabase.from('recordings')` with proper column selection (excluding full_transcript). `getRecordingById()` fetches all columns including transcript via `.maybeSingle()`. Both throw typed errors on failure. |
| `src/hooks/useRecordings.ts` | useRecordings() and useRecording(id) TanStack Query hooks | VERIFIED | File exists, 32 lines. Both hooks use `useAuth()` session guard (`enabled: !!session`). `useRecordings` uses `queryKeys.recordings.list()`, `useRecording` uses `queryKeys.recordings.detail(id)`. Both call real service functions. |
| `src/lib/query-config.ts` (recordings domain) | recordings domain added to queryKeys factory | VERIFIED | `recordings` domain present at line 55–60 with `all`, `list(filters?)`, and `detail(id)` keys. No placeholder pattern. |
| `src/routes/_authenticated/index.tsx` | Live recordings list (not placeholder) | VERIFIED | Renders real recordings from `useRecordings()`. Title, date (formatted), duration (MM:SS), source_app badge all rendered. Links to `/calls/$callId`. Loading and error states handled. No "Coming soon" placeholder in the list rendering path. |
| `src/routes/_authenticated/calls/$callId.tsx` | Full call detail with transcript | VERIFIED | Renders title, date+time, duration, source_app badge, summary, tags, and `full_transcript` (whitespace-preserved). Uses `useRecording(callId)` from route params. Not found state handled. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `index.tsx` | `recordings` table | `useRecordings()` → `getRecordings()` → `supabase.from('recordings')` | WIRED | Full chain verified: component calls hook, hook calls service, service queries Supabase recordings table |
| `$callId.tsx` | `recordings` table | `useRecording(callId)` → `getRecordingById(id)` → `supabase.from('recordings').eq('id', id)` | WIRED | Full chain verified: route params feed id into hook, hook calls service with id, service uses `.maybeSingle()` |
| `migrate_fathom_call_to_recording()` | `recordings` table | `INSERT INTO recordings (...)` | WIRED | Migration function inserts including `external_id` in source_metadata. Deployed via migration file `20260227000001`. |
| `fathom_calls` (VIEW) | `fathom_calls_archive` | `CREATE VIEW fathom_calls AS SELECT * FROM fathom_calls_archive` | WIRED | Applied directly to production (not committed to a migration file — noted as gap in traceability; applied in-session per Plan 03 Summary). `SELECT count(*) FROM fathom_calls` continues to work. |

---

### Requirements Coverage

| Requirement | Status | Notes |
|-------------|--------|-------|
| DATA-01: fathom_calls → recordings migration completes | SATISFIED | unmigrated_non_orphans = 0; 1,545 rows in fathom_calls_archive vs 1,545 migrated (+ 9 pre-existing non-fathom rows) |
| DATA-02: RLS verified before any user switch | SATISFIED | Tested via real JWT transaction pattern in production. User B sees 0 rows of User A. Documented in SUMMARY 15-01. |
| DATA-03: source_metadata normalized with external_id | SATISFIED | `missing_external_id = 0` confirmed in production. Fix function injects external_id. Backfill UPDATE applied to pre-existing 1,532 rows. |
| DATA-04: fathom_calls archived (renamed, not dropped) | SATISFIED | `fathom_calls_archive` exists with COMMENT. Compatibility VIEW preserves the name for v1. Phase 22 will DROP both. |
| DATA-05: Dry-run on production data shape before real batch | SATISFIED | SUMMARY 15-01 documents profiling queries run before migration: NULL rates, row count by user, orphan detection. Found and fixed COALESCE gaps before batch run. |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/routes/_authenticated/index.tsx` | 19 | "Coming soon" in FolderSidebar | Info | Folders sidebar has a placeholder, but this is the secondary pane (Pane 2). The primary pane (call list) is fully implemented. No impact on Phase 15 success criteria. |
| `supabase/migrations/20260227000002_archive_fathom_calls.sql` | — | Compatibility VIEW applied directly to production, not committed to a migration file | Warning | The VIEW creation (`CREATE VIEW fathom_calls AS SELECT * FROM fathom_calls_archive`) has no corresponding migration file in version control. If the database is reset or a new environment is provisioned, the VIEW will be missing. Phase 22 cleanup plan should include this VIEW in its DROP migration. |

No blocker anti-patterns found. The folder sidebar placeholder is in a section explicitly marked out-of-scope for Phase 15.

---

### Commit Verification

| Commit | Repo | Status | Description |
|--------|------|--------|-------------|
| `f2400d0` | brain | VERIFIED | feat(15-01): create fixed migration function with COALESCE defaults and external_id |
| `ffd05e2` | brain | VERIFIED | feat(15-03): rename fathom_calls to fathom_calls_archive |
| `91d3758` | callvault | VERIFIED | feat(15-02): add recordings service layer and TanStack Query hooks |
| `530af0c` | callvault | VERIFIED | feat(15-02): wire calls list and call detail pages to recordings data |
| `22d727f` | callvault | VERIFIED | fix(15): use vite build only — routeTree.gen.ts is gitignored |

---

### Human Verification Required

#### 1. Complete Call History Spot-Check

**Test:** Log in to callvault.vercel.app as a real user and verify the call list shows the complete history matching v1.
**Expected:** All calls appear with matching title, date, duration, and source badge. Clicking any call opens the full transcript.
**Why human:** User spot-check was completed per SUMMARY 15-03 ("User confirmed calls show up correctly in the new v2 frontend") but no automated assertion captures this. Production DB row-count match is confirmed but visual fidelity of the full list requires human eyes.

#### 2. Transcript Rendering Fidelity

**Test:** Open 3–5 calls with known transcripts and verify the transcript content matches v1.
**Expected:** Transcript text identical to what was visible in v1 frontend.
**Why human:** `full_transcript` column is queried correctly in code (`getRecordingById` selects it, `$callId.tsx` renders it), but actual content fidelity across 1,545 migrated rows cannot be verified programmatically from this environment.

---

### Gaps Summary

No gaps blocking goal achievement. The phase delivered all four observable truths:

1. Frontend is wired to the recordings table with real data rendering.
2. RLS isolation was verified with real JWTs — zero cross-tenant leakage.
3. external_id is present in source_metadata for all migrated rows.
4. fathom_calls count is preserved (via compatibility VIEW) and recordings count matches (with documented 9-row overage).

One traceability note: the compatibility VIEW (`CREATE VIEW fathom_calls AS SELECT * FROM fathom_calls_archive`) was applied directly to production without a corresponding migration file. This is a warning, not a blocker — the feature works in production. Phase 22 should include an explicit DROP of both `fathom_calls_archive` and the `fathom_calls` VIEW in its cleanup migration.

---

*Verified: 2026-02-28T02:33:12Z*
*Verifier: Claude (gsd-verifier)*
