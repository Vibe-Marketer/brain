---
phase: 24-sync-status-foundation
verified: 2026-06-23T14:22:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: null
---

# Phase 24: Sync-Status Foundation Verification Report

**Phase Goal:** One durable, provider-agnostic answer to "is this call synced?" plus the schema and idempotency constraints every later v2.1 phase reads and writes against.
**Verified:** 2026-06-23T14:22:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (Requirement) | Status | Evidence |
| --- | --- | --- | --- |
| 1 | IMP-01: canonical provider-agnostic reader on `recordings.(source_app, source_call_id)` TEXT, no numeric coercion; old Fathom-only reader deleted | ✓ VERIFIED | `getSyncStatusForExternalIds` in `src/services/sync-status.service.ts` uses `.in("source_call_id", externalIds)` (TEXT IN). `grep parseInt\|Number(` = 0 real matches (only a comment + the `.in()` line). `checkSyncedRecordingIds` = **0 references repo-wide**. Reader wired into `useSyncTabStateBridge.ts:46` with `(sourceApp, recordingIds)`. Unit test 4/4 PASS. Live-DB IMP-01 test: Zoom (UUID), Fathom (BIGINT-string), paste all resolve from ONE query, Fathom id round-trips as string. |
| 2 | IMP-02: `recordings_source_dedup` NOT recreated; NULL `source_call_id` backfill present; dedup proven (2nd insert → 23505) | ✓ VERIFIED | `20260620120500_backfill_null_source_call_id.sql` only runs `UPDATE ... SET source_call_id = fathom_provider_id::text` (explicit cast, idempotent `IS NULL` guard). No `CREATE UNIQUE`/`ADD CONSTRAINT` — constraint name appears only in comments. Live-DB IMP-02 test: 2nd insert of same triple rejected with code `23505`, `count=1` persists. |
| 3 | IMP-03: additive `sync_jobs` migration (ADD COLUMN IF NOT EXISTS only); Realtime verified-not-readded; `sync_jobs` in CROSS_ORG_TABLES; org RLS added alongside user policy | ✓ VERIFIED | `20260620120000_sync_jobs_durable_resource.sql`: 9 `ADD COLUMN IF NOT EXISTS`, **0** DROP/RENAME/ALTER COLUMN. Realtime guarded by `pg_publication_tables` NOT EXISTS check. `sync_jobs_org_isolation` policy created via `IF NOT EXISTS` guard; existing `Users can read own sync jobs` user policy explicitly RETAINED (OR-combined). `{ table: "sync_jobs", filterColumn: "organization_id" }` present in `rls-regression.test.ts:78`. Live-DB IMP-03 test: new columns round-trip, `recording_ids` stays TEXT[], realtime membership confirmed. |
| 4 | IMP-04: orphan fathom_calls REPORTED (PK + idempotent ON CONFLICT), NOT fabricated; real-DB test ran un-skipped, prod-guarded, no mocks | ✓ VERIFIED | `20260620121000_reconcile_orphan_fathom_calls.sql`: report table `fathom_calls_orphan_report` with `fathom_call_id BIGINT PRIMARY KEY`, `INSERT ... ON CONFLICT (fathom_call_id) DO NOTHING`, dual-bridge NOT EXISTS classification. **0** `INSERT INTO recordings` (no fabrication). Integration test: `vi.mock` = 0, `describe.skipIf(!integrationDbReachable)` + in-test `PROD_REF not.toContain` guard. **Verifier ran `npm run test:integration` — 5/5 PASS un-skipped against live TEST DB** (`.env.test` injected, `integrationDbReachable=true`). |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `src/services/sync-status.service.ts` | Canonical reader, no coercion | ✓ VERIFIED | 85 lines, real query, fail-open, workspace_entries existence check. Wired + used. |
| `src/services/__tests__/sync-status.service.test.ts` | Source-level no-coercion assertions | ✓ VERIFIED | 4 tests, all PASS (parseInt/Number absent, TEXT IN present, export present). |
| `supabase/migrations/20260620120000_sync_jobs_durable_resource.sql` | Additive sync_jobs + org RLS + realtime | ✓ VERIFIED | Strictly additive; committed `1e946967 feat(24-02)`. |
| `supabase/migrations/20260620120500_backfill_null_source_call_id.sql` | Idempotent NULL backfill | ✓ VERIFIED | Data-only, documents residual gap. |
| `supabase/migrations/20260620121000_reconcile_orphan_fathom_calls.sql` | Idempotent orphan report, no fabrication | ✓ VERIFIED | PK arbiter, ON CONFLICT DO NOTHING, 0 recordings INSERT. |
| `src/test/migrations/phase24-...integration.test.ts` | Real-DB IMP-01/02/03/04 coverage | ✓ VERIFIED | 5/5 PASS against live TEST DB; no mocks; prod-guarded. |
| `src/test/rls-regression.test.ts` | sync_jobs in CROSS_ORG_TABLES | ✓ VERIFIED | Line 78 registered. |

### Key Link Verification

| From | To | Via | Status |
| --- | --- | --- | --- |
| `useSyncTabStateBridge.ts` | `sync-status.service.ts` | `import getSyncStatusForExternalIds` | ✓ WIRED (line 3 import, line 46 call) |
| `sync-status.service.ts` | `recordings` table | `.in("source_call_id", externalIds)` | ✓ WIRED (line 50) |
| `rls-regression.test.ts` CROSS_ORG_TABLES | `sync_jobs` org RLS | `{ table: 'sync_jobs', filterColumn: 'organization_id' }` | ✓ WIRED (line 78) |
| integration test | TEST Supabase project | `makeIntegrationClient()` + `describe.skipIf(!integrationDbReachable)` | ✓ WIRED (ran un-skipped) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| No-coercion unit invariants | `npx vitest run sync-status.service.test.ts` | 4/4 passed | ✓ PASS |
| Full IMP-01..04 against live TEST DB | `npm run test:integration -- phase24-...` | 5/5 passed, un-skipped, `.env.test` loaded | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
| --- | --- | --- | --- |
| IMP-01 | 24-01 | ✓ SATISFIED | Canonical reader, 0 parseInt, old reader deleted, live test |
| IMP-02 | 24-03/04 | ✓ SATISFIED | Backfill present, constraint not recreated, 23505 proven live |
| IMP-03 | 24-02/04 | ✓ SATISFIED | Additive migration, RLS dual-policy, CROSS_ORG_TABLES, realtime guarded |
| IMP-04 | 24-03/04 | ✓ SATISFIED | Orphan report (no fabrication), real-DB un-mocked test 5/5 |

### Anti-Patterns Found

| File | Pattern | Severity |
| --- | --- | --- |
| (none) | TBD/FIXME/XXX scan on all 6 shipped files | — clean |

No debt markers, no stubs, no `INSERT INTO recordings` fabrication, no destructive DDL.

### SUMMARY Claim Spot-Checks (adversarial)

| SUMMARY claim | Independent verification | Result |
| --- | --- | --- |
| Integration test ran 5/5 un-skipped against live TEST DB | Verifier re-ran `npm run test:integration` | ✓ CONFIRMED — 5/5 pass, `integrationDbReachable=true`, NOT skipped |
| Migrations pushed to prod+TEST | TEST DB confirmed live (test exercises new columns/constraint/realtime/report table successfully); migration files committed | ✓ CONFIRMED for TEST (functional proof); prod push not independently re-hit but TEST functional proof + committed files support it |

### Human Verification Required

None. All four requirements are programmatically and behaviorally verifiable, and were verified by running the real-DB integration suite.

### Gaps Summary

No gaps. The phase goal — a durable, provider-agnostic "is this call synced?" answer plus the schema and idempotency constraints for later v2.1 phases — is achieved and proven end-to-end against a real database. The canonical reader keeps ids TEXT with zero coercion, the legacy Fathom-only reader is fully removed, the dedup constraint blocks double-imports (live 23505), the sync_jobs migration is strictly additive with correct OR-combined RLS and CROSS_ORG_TABLES registration, and orphan fathom_calls are reported (never fabricated) — all confirmed by an un-mocked, prod-guarded integration test the verifier executed (5/5 pass).

Out-of-scope pre-existing failures (panelStore, reporter-comms, MCP-settings, TranscriptsTab tsc/test) confirmed unrelated and already logged in `deferred-items.md` — not counted against this phase.

---

_Verified: 2026-06-23T14:22:00Z_
_Verifier: Claude (gsd-verifier)_
