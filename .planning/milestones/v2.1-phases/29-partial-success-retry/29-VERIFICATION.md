---
phase: 29-partial-success-retry
verified: 2026-07-01T00:19:46Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: null
gaps: []
---

# Phase 29: Partial-Success & Retry Verification Report

**Phase Goal:** After an import, the user sees exactly what happened and can retry only the failures — never a vanishing toast, never a full-batch replay.
**Verified:** 2026-07-01T00:19:46Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | After a partial-success import, banner shows "{synced} of {requested} imported, {failed} failed" from the job's own counts, where the import was triggered | ✓ VERIFIED | `SyncJobBanner.tsx:135-148` renders `{syncedCount} of {requestedCount} imported, {failedCount} failed` in the `completed_with_errors` branch. Counts from `synced_ids.length`, `failed_ids.length`, `progress_total` (`:66-73`). Banner mounts in `ImportSurface.tsx:604-611` at the toolbar where imports are triggered. Breakdown test asserts fixture 18/30/12 → "18 of 30 imported, 12 failed" (5/5 tests pass). |
| 2 | Skipped (already-synced dupes) shown as informational, never counted as failures; persists with no timer | ✓ VERIFIED | `SyncJobBanner.tsx:140-146` — skipped rendered only when `skippedCount > 0` as muted "· {n} already synced (skipped)", separate from `failedCount`. `grep -c setTimeout SyncJobBanner.tsx` = **0** (sticky). Component doc (`:22-25`) confirms no timer; leaves DOM only via `onDismiss`. |
| 3 | "Retry failed (N)" re-attempts ONLY failed_ids via the EXISTING single-call retry path — never synced/skipped, no new import path | ✓ VERIFIED | Banner button (`:224-253`) calls `onRetry(sourceApp, failedIds)` with `failedIds = job.failed_ids ?? []` (`:205`). `ImportSurface.tsx:411-422` `handleRetryFailed` loops `failedIds` → `retryFailedMutation.mutate({ sourceApp, failedExternalId })` via `useRetryFailedImport` (`:410`) → `retryFailedImport` → `supabase.functions.invoke(fnName, { body: { singleCallId } })` (`import-sources.service.ts:398-405`). Grep confirms **no `functions.invoke` in ImportSurface** (only a comment at `:402`) — no new edge fn. Retry test asserts `onRetry` called once with exact 12 failed_ids, not 30/18 (7/7 tests pass). |
| 4 | Retry idempotent — no dupes via Phase 24 constraint; successful retries drop from failed set via useSyncJobs | ✓ VERIFIED | singleCallId routes through `sync-meetings/index.ts:297` → shared `connector-pipeline.ts` `checkDuplicate()` (query by `source_call_id`, `:103`) guarded by org-scoped unique constraint on `organization_id + source_app + source_call_id` (`:582`). Reuses constrained path, NOT a raw insert. `useRetryFailedImport.onSuccess` invalidates `imports.failed/sources/counts` (`useImportSources.ts:187-190`); useSyncJobs refreshes counts. |
| 5 | Retry scoped to caller's own job/org — no IDOR | ✓ VERIFIED | Retry dispatches through `getConnectorSyncFunctionName(sourceApp)` connector fns that run `validateRequestedWorkspaceId` server-side (present in sync-meetings, zoom, fireflies, grain, read-ai fns). No org/workspace id taken from the banner — server resolves caller identity for the singleCallId import. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/import/SyncJobBanner.tsx` | Breakdown + retry action, presentational | ✓ VERIFIED | Renders precise breakdown w/ skipped distinction; `onRetry` prop; canRetry gate; 0 setTimeout; no coercion (only comment mentions parseInt) |
| `src/components/import/ImportSurface.tsx` | handleRetryFailed wired to existing path | ✓ VERIFIED | `useRetryFailedImport` imported+instantiated; `handleRetryFailed` loops failed_ids verbatim; passed as `onRetry` to banner |
| `src/components/import/__tests__/SyncJobBanner.breakdown.test.tsx` | RED-first breakdown/skipped/no-timer tests | ✓ VERIFIED | 5 tests pass |
| `src/components/import/__tests__/SyncJobBanner.retry.test.tsx` | Retry-only-failed_ids tests | ✓ VERIFIED | 7 tests pass; asserts exact ids, N=length, empty/null gating, no-onRetry graceful, file-upload disabled |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| SyncJobBanner | SyncJob counts | .length + numeric, no coercion | ✓ WIRED | `:66-73` |
| SyncJobBanner.onRetry | ImportSurface.handleRetryFailed | onRetry prop | ✓ WIRED | `ImportSurface.tsx:609` |
| ImportSurface | useRetryFailedImport → retryFailedImport → {singleCallId} | per-id mutate loop | ✓ WIRED | `:414-419` → service `:404` |
| connector fn | recordings (idempotent) | checkDuplicate + org unique constraint | ✓ WIRED | `connector-pipeline.ts:103,582` |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Breakdown + retry unit suites | `vitest run SyncJobBanner.retry + .breakdown` | 12 passed | ✓ PASS |
| Banner + ImportSurface + retry-service suites | `vitest run SyncJobBanner + ImportSurface(.test/.syncStatus) + import-sources.retry` | 17 passed | ✓ PASS |
| Production build | `npm run build` | ✓ built in 8.98s (pre-existing chunk-size warning only) | ✓ PASS |
| No setTimeout in banner | `grep -c setTimeout SyncJobBanner.tsx` | 0 | ✓ PASS |
| No new edge fn in ImportSurface | `grep functions.invoke ImportSurface.tsx` | comment only | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| FAIL-01 | 29-01 | Partial-success surfaced where import triggered, from completed_with_errors/failed_ids, not vanishing toast | ✓ SATISFIED | Truths 1-2; breakdown suite |
| FAIL-02 | 29-02 | Retry only failures via existing single-call retry path | ✓ SATISFIED | Truths 3-5; retry suite |

### Anti-Patterns Found

None. No setTimeout, no id coercion (only doc-comment references to the dual-ID rule), no new edge function, no raw insert bypassing the constraint, no unreferenced debt markers in modified files.

### Human Verification Required

None. All truths verified programmatically against real code + passing tests + green build. Retry reuses the pre-existing authenticated connector path already exercised by FailedImportsSection; no new server surface to smoke-test.

### Gaps Summary

No gaps. All 5 must-haves verified. FAIL-01 and FAIL-02 satisfied. Phase 29 (final phase of the v2.1 Import/Sync Rebuild) achieves its goal: the banner shows the precise persistent partial-success breakdown where the import was triggered, distinguishes skipped from failed, and offers a "Retry failed (N)" action that re-attempts only failed_ids verbatim through the existing idempotent, org-scoped single-call retry path. Frontend-only, no new package, no backend change (batched to milestone-end deploy per v2.1 decision).

---

_Verified: 2026-07-01T00:19:46Z_
_Verifier: Claude (gsd-verifier)_
