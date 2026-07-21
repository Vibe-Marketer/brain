---
phase: 29-partial-success-retry
plan: 02
subsystem: ui
tags: [react, import, sync, banner, retry, vitest, tdd, remix-icons]

# Dependency graph
requires:
  - phase: 27-sync-status-banner (JOB-03)
    provides: SyncJobBanner — durable, sticky, no-timer job-status banner with onDismiss prop pattern
  - phase: 29-partial-success-retry (29-01, FAIL-01)
    provides: completed_with_errors breakdown "{synced} of {requested} imported, {failed} failed" + skipped distinction — the banner this plan adds the action to
  - phase: 28-skip-already-synced
    provides: failed_ids holds ONLY genuine errors (23505 dupes routed to skipped_count) — so retrying failed_ids IS retry-only-failures by construction
  - phase: 24-sync-status-foundation
    provides: org-scoped unique index (organization_id, source_app, source_call_id) — makes retry idempotent (no duplicate row)
provides:
  - "Retry failed (N)" action on partial (completed_with_errors) + failed banners, wired to the EXISTING single-call retry path
  - onRetry(sourceApp, failedIds) presentational prop on SyncJobBanner (mirrors onDismiss) — mutation owned by parent
  - ImportSurface handleRetryFailed: loops failed_ids through useRetryFailedImport -> retryFailedImport -> { singleCallId }
affects: [import-surface, sync-status, failed-imports]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Banner stays presentational: retry surfaced as an optional onRetry prop; the mutation lives in the parent (same shape as the existing onDismiss prop)"
    - "Retry reuses the existing per-call path (singleCallId) — no new import path, edge fn, or sync_jobs row; N failed ids fired as N idempotent single-call retries"

key-files:
  created:
    - src/components/import/__tests__/SyncJobBanner.retry.test.tsx
  modified:
    - src/components/import/SyncJobBanner.tsx
    - src/components/import/ImportSurface.tsx

key-decisions:
  - "onRetry is an optional presentational prop (sourceApp, failedIds) — banner never touches hooks/data; parent ImportSurface owns useRetryFailedImport (matches onDismiss)"
  - "Retry gated three ways: hidden when onRetry absent, hidden when failed_ids empty/null, disabled (with 'Retry unavailable' label + explanatory title) when canRetryFailedImport(source_app) is false"
  - "aria-label is always 'Retry failed (N)' even in the disabled state so the affordance is discoverable/testable regardless of visible label"
  - "failed_ids passed verbatim as opaque TEXT through { singleCallId } — no parseInt/Number (dual-ID rule)"

patterns-established:
  - "Count N derives from failed_ids.length only — no coercion; retry targets exactly failed_ids, never synced/skipped (skipped has no ids on the row)"
  - "Idempotency delegated to the Phase 24 unique index — the client fires a retry per failed id and lets the connector pipeline no-op already-imported calls"

requirements-completed: [FAIL-02]

# Metrics
duration: 9min
completed: 2026-06-30
---

# Phase 29 Plan 02: Retry Failed Action Summary

**The SyncJobBanner now offers a "Retry failed (N)" action on partial-success and failed banners that re-attempts ONLY the job's failed_ids — dispatched by ImportSurface through the EXISTING single-call retry path (useRetryFailedImport -> retryFailedImport -> { singleCallId }), idempotent by the Phase 24 unique index, org/IDOR-gated server-side, with zero new import machinery.**

This completes Phase 29 (Partial-Success & Retry) and the CallVault v2.1 milestone.

## Performance

- **Duration:** ~9 min
- **Tasks:** 2 (TDD: RED then GREEN)
- **Files:** 3 (1 created, 2 modified)

## Accomplishments
- "Retry failed (N)" affordance added to the completed_with_errors and failed banner branches (RiRefreshLine, hollow/bordered style matching FailedImportsSection), where N = failed_ids.length.
- Banner stays presentational: exposes an optional `onRetry(sourceApp, failedIds)` prop (mirrors `onDismiss`); the mutation lives in the parent.
- ImportSurface wires `handleRetryFailed` that loops `failed_ids` and fires the EXISTING per-call retry — `retryMutation.mutate({ sourceApp, failedExternalId: id })` — the same shape FailedImportsSection uses. No new import path, edge function, or sync_jobs row.
- Retry targets ONLY `failed_ids` (Phase 28 already excludes skipped/synced from that set), is idempotent (Phase 24 org-scoped unique index → retry of an actually-imported call is a no-op), and is org/IDOR-gated by the existing authenticated singleCallId path.
- Successful retries drop from the failed set as counts refresh via the existing useSyncJobs Realtime/poll + the mutation's onSuccess invalidations — no extra wiring.
- `canRetryFailedImport(source_app)` gates providers without a connector sync fn (file-upload): button renders disabled with "Retry unavailable".

## Task Commits

Each task committed atomically (TDD):

1. **Task 1: RED — retry-only-failures tests** - `b1aacec` (test)
2. **Task 2: GREEN — wire the Retry failed action to the existing path** - `3ede0e5` (feat)

## Files Created/Modified
- `src/components/import/__tests__/SyncJobBanner.retry.test.tsx` (created) — RED-first FAIL-02 tests: Retry failed (N) present with N == failed_ids.length; onRetry fires once with (source_app, exact failed_ids array) not synced/skipped; absent on empty/null failed_ids and missing onRetry; disabled for non-retryable provider; retry also present on the failed branch.
- `src/components/import/SyncJobBanner.tsx` (modified) — added optional `onRetry` prop; DismissibleBanner renders the gated "Retry failed (N)" button (RiRefreshLine); imports `canRetryFailedImport`; passes onRetry through both the failed and completed_with_errors branches; doc-comment updated. Zero setTimeout preserved.
- `src/components/import/ImportSurface.tsx` (modified) — imported/instantiated `useRetryFailedImport`; added `handleRetryFailed` callback looping failed_ids through the existing singleCallId path; passed it as `onRetry` to the mapped SyncJobBanner.

## Decisions Made
- **Presentational prop:** onRetry mirrors onDismiss so the banner stays hook-free; ImportSurface owns the mutation.
- **Three-way gating:** hidden when onRetry absent, hidden when failed_ids empty/null, disabled+labeled when the provider can't retry.
- **Stable aria-label:** always "Retry failed (N)" (even disabled) for discoverability/testability.
- **No coercion:** failed_ids passed verbatim as opaque TEXT through { singleCallId }.

## Deviations from Plan

None - plan executed exactly as written (RED then GREEN, no auto-fixes required).

## Threat Model Verification
- **T-29-03 (IDOR):** Mitigated — retry reuses the existing authenticated per-call path; no org/workspace id is taken from the banner. The server resolves the caller's own identity/org for the singleCallId import.
- **T-29-04 (duplication):** Mitigated — idempotent by the Phase 24 org-scoped unique index; retrying an actually-imported call is a no-op.
- **T-29-05 (id coercion):** Mitigated — failed_ids passed verbatim; grep confirms no parseInt/Number in the touched retry code.
- **T-29-SC (npm installs):** N/A — zero new packages (reused @remixicon/react + existing hooks).

## Verification
- `SyncJobBanner.retry.test.tsx` (7) + `SyncJobBanner.breakdown.test.tsx` (5) + `SyncJobBanner.test.tsx` (5) — all GREEN (17/17).
- ImportSurface suites (`.test.tsx`, `.capabilities`, `.syncStatus`, `.virtualization`) + FailedImportsSection.registry — all GREEN (18/18).
- Retry dispatches through useRetryFailedImport / retryFailedImport / { singleCallId } — grep confirms no new edge-function name introduced.
- setTimeout count in SyncJobBanner.tsx == 0 (verified against source).
- `tsc -p tsconfig.app.json --noEmit` — zero errors in SyncJobBanner.tsx + ImportSurface.tsx (filtered).
- `npm run build` — exit 0.

## Issues Encountered
- Repo-wide `tsc -p tsconfig.app.json` reports pre-existing errors in unrelated files (known-hollow root typecheck). Zero errors in the touched files. Out of scope; not fixed.

## User Setup Required
None — frontend-only change, no external service configuration, no new package, no DB/prod change (batched to milestone-end review per the v2.1 deploy decision).

## Next Phase Readiness
- Phase 29 complete (2/2). The partial-success loop is closed: display (FAIL-01, Plan 01) + retry action (FAIL-02, Plan 02).
- CallVault v2.1 milestone complete (Phase 29 was the final phase).
- No push to origin — batched to milestone-end review.
- No blockers.

## Self-Check: PASSED

- FOUND: src/components/import/SyncJobBanner.tsx
- FOUND: src/components/import/ImportSurface.tsx
- FOUND: src/components/import/__tests__/SyncJobBanner.retry.test.tsx
- FOUND: .planning/phases/29-partial-success-retry/29-02-SUMMARY.md
- FOUND commit: b1aacec (test — RED)
- FOUND commit: 3ede0e5 (feat — GREEN)

---
*Phase: 29-partial-success-retry*
*Completed: 2026-06-30*
