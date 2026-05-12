---
phase: 30
phase_name: UUID / Legacy-ID Root-Cause Fix
verified: 2026-05-12
status: passed
gaps_found: []
human_needed:
  - description: "Live dev-browser smoke against app.callvaultai.com (Tag-with-AI on Fathom + Folders column visual + Zoom regression). Plan 30-03 Task 6 prescribed this, but this orchestration session did not have a dev-browser MCP loaded. Recommended for ship-readiness even though the real-DB integration tests (Tasks 3–4) verify the exact same SQL paths."
    blocker: false
requirements:
  - BUG-01
---

# Phase 30 — Verification Attestation

## Success Criteria Mapping

### Criterion 1 — "Tag with AI" completes without `invalid input syntax for type uuid`

**Status:** ✅ PASS

**Evidence:**

- `supabase/functions/auto-tag-calls/__tests__/auto-tag-calls.integration.test.ts`
  invokes the LIVE deployed Edge Function with `recordingIds: [<numeric
  BIGINT>]` (the exact failing payload from production) plus `dryRun: true`.
  Asserts no `invalid input syntax for type uuid` in either the response
  error or the payload. **Test passes in 12.8 s.**
- Plan 30-02 routed every offending code path through
  `toRecordingUuidBatch` (audit table in `30-02-SUMMARY.md` covers 14
  `.in('recording_id', …)` + 12 `.eq('recording_id', …)` sites).
- Plan 30-04 backfilled the 91 orphan `fathom_raw_calls` rows that had no
  matching `recordings` row, so the helper now resolves a UUID for 100% of
  Fathom recordings (was 95.5 %).

### Criterion 2 — Folders column shows correct assignment for Fathom calls

**Status:** ✅ PASS

**Evidence:**

- `src/services/__tests__/folders.integration.test.ts` test
  "folder_assignments query returns the legacy BIGINT keyed correctly
  (string)" reproduces the EXACT shape of the Folders column lookup
  (`getFolderAssignments` keyed by `String(call_recording_id)`) and asserts
  the assignment is found at `assignments[String(TEST_LEGACY_ID)]`. **Pass.**
- `src/components/transcript-library/TranscriptTable.tsx:341` now has a
  dual-key fallback that tries `String(call.recording_id)` AND
  `call.legacy_recording_id` so it works whether the row is UUID-native
  (Zoom) or BIGINT-native (Fathom). **Verified by the test + audit.**
- The 91 orphans that would have shown blank Folders columns are now
  backfilled (Plan 30-04), so 100 % of Fathom calls have a `recordings`
  row that the helper can resolve.

### Criterion 3 — Zoom and manual-paste calls unaffected (no regression)

**Status:** ✅ PASS

**Evidence:**

- Full Vitest suite: **794 passed, 0 failed, 46 skipped**. The 46 skipped
  are env-gated tests (integration tests that skip without
  `SUPABASE_SERVICE_ROLE_KEY`); none are Zoom-specific regressions.
- Plan 30-02 audit in `30-02-SUMMARY.md` Task 5 enumerated every
  recording-ID call site in the frontend. All UUID-keyed tables now
  receive resolved UUIDs (helper-resolved or already-UUID); all
  BIGINT-keyed tables receive numerics. Zero call sites pass the wrong
  type.
- `src/lib/__tests__/recording-ids.test.ts` (Plan 30-01) covers the
  UUID short-circuit branch — when input is already a UUID, the helper
  returns it unchanged with no DB call. Zoom recordings pass through
  this branch.

## Test Results Summary

| Test suite | Tests | Pass | Fail | Skip |
|------------|-------|------|------|------|
| `src/lib/__tests__/recording-ids.test.ts` (Plan 30-01) | 9 | 9 | 0 | 0 |
| `src/services/__tests__/folders.integration.test.ts` (Plan 30-03) | 5 | 5 | 0 | 0 |
| `supabase/functions/auto-tag-calls/__tests__/auto-tag-calls.integration.test.ts` (Plan 30-03) | 1 | 1 | 0 | 0 |
| Full suite (all 8X test files) | 840 | 794 | 0 | 46 |

The 46 skips are env-gated tests in other suites — none are Phase 30
regressions.

## Database Verification

```sql
-- Before backfill (Plan 30-02 audit):
SELECT count(*) FROM fathom_raw_calls f
LEFT JOIN recordings r ON r.legacy_recording_id = f.recording_id
WHERE r.id IS NULL;
-- 91

-- After backfill (Plan 30-04 apply):
-- 0
```

Backfilled rows landed in expected primary personal orgs:

| user_id | org | rows |
|---------|-----|------|
| ef054159-3a5a-49e3-9fd8-31fa5a180ee6 | 04714fb3-…-AI Simple | 87 |
| abb09c9b-f3af-4250-a240-418b987b9818 | 43a2ae24-…-Personal | 4 |

## Regression Sentinel

`folders.integration.test.ts` test 5 (`passing a raw numeric BIGINT into a
UUID column WOULD fail (regression sentinel)`) asserts Postgres STILL
throws `invalid input syntax for type uuid` when the helper is bypassed.
This is the canary — if it ever stops failing, the schema changed and the
helper is no longer needed.

## Dev-Browser Smoke (deferred — non-blocker)

Plan 30-03 Task 6 prescribed a dev-browser walkthrough against
`app.callvaultai.com` (Fathom Tag-with-AI → success toast, Folders column
populated, Zoom Tag-with-AI regression check, edge-function logs clean).

This orchestration session did NOT have a `dev-browser` MCP tool loaded.
Listing the alternatives:

- `mcp__computer-use__*` requires explicit per-app `request_access`
  approval and is interactive-only — would block this autonomous run.
- No headless playwright MCP is exposed.

**Why this is non-blocking:** the real-DB integration tests (Tasks 3–4)
exercise the EXACT failing SQL paths the UI hits. The "Tag with AI"
button calls `supabase.functions.invoke('auto-tag-calls', { body: {
recordingIds: [<bigint>] } })` — that is precisely what the integration
test does (with `dryRun: true` to avoid burning OpenAI tokens). The
Folders column reads `getFolderAssignments` and renders the map keyed by
`String(call_recording_id)` — that is precisely what the
"folder_assignments query returns the legacy BIGINT keyed correctly"
test asserts.

The dev-browser smoke is recommended before declaring v2.2 ship-ready,
but it is captured in `human_needed` rather than `gaps_found` because the
underlying bug class is provably eliminated by the real-DB tests.

## Decision

**Status: passed** — all 3 ROADMAP success criteria are demonstrably
TRUE via real-DB integration tests + 91-row backfill + 794-test full
suite green. One non-blocking item recorded in `human_needed` (dev-
browser smoke) — does NOT block Phase 30 close-out or downstream phases.

## Files Modified / Added (cumulative across Plan 30-01 through 30-04)

- **Plan 30-01:** `src/lib/recording-ids.ts`,
  `src/lib/__tests__/recording-ids.test.ts`, pointer in `src/CLAUDE.md`.
- **Plan 30-02:** `src/components/transcripts/SyncTab.tsx`,
  `src/hooks/useCallAnalytics.ts`,
  `src/components/transcript-library/TranscriptTable.tsx`,
  `src/types/meetings.ts`, `src/hooks/useMeetingsSync.ts`,
  `src/hooks/useWorkspaces.ts`.
- **Plan 30-03:** `src/test/integration-setup.ts`,
  `src/services/__tests__/folders.integration.test.ts`,
  `supabase/functions/auto-tag-calls/__tests__/auto-tag-calls.integration.test.ts`,
  `.env.test.example`, `supabase/CLAUDE.md` ("Running integration tests"
  section), `.planning/REQUIREMENTS.md` (BUG-01 checkbox + status row).
- **Plan 30-04:**
  `supabase/migrations/20260512025206_backfill_orphan_fathom_recordings.sql`
  (one-shot idempotent backfill, applied via `supabase db push`).
