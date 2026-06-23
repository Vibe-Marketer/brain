---
phase: 27-observable-jobs
plan: 03
subsystem: ui
tags: [react, import-surface, banner, chip, sync-status, tdd]

requires:
  - phase: 27-observable-jobs
    plan: 01
    provides: "useSyncJobs({ sourceApp, organizationId }) → { activeJobs, terminalJobs } : SyncJob[] (string-id arrays, no 8s auto-dismiss)"
  - phase: 26-unified-import-surface
    provides: "shared <ImportSurface sourceApp organizationId> (both Import + Sync tabs); results + importedIds in scope; clean Phase-27 seams"
provides:
  - "src/components/import/SyncJobBanner.tsx — durable, status-driven job banner; sticky failures/partial-success (no timer); local onDismiss(jobId)"
  - "src/components/import/PerProviderSyncChip.tsx — persistent 'Last synced X · N new · M failed' pill per provider (label from adapter registry)"
  - "ImportSurface mount: useSyncJobs consumed; chip in connected-status toolbar; banners at the :474 seam with a local dismissed-ids Set"
affects:
  - "28 ('Sync all from provider') — the chip's N-new + the banner progress are the live feedback for the sync-all job"
  - "29 (partial success) — completed_with_errors banner already renders synced/failed split"

tech-stack:
  added: []
  patterns:
    - "Presentational banner/chip driven entirely off the shared useSyncJobs hook — zero DB/realtime logic in the components"
    - "Local 'I've seen it' dismissal: a useState<Set<string>> of terminal job ids filters terminalJobs — never a DB delete, never a timer; active jobs are never dismissable"
    - "N new available derived from data already in scope (results.length − importedIds.size) — the chip runs no query (LOCKED)"

key-files:
  created:
    - src/components/import/SyncJobBanner.tsx
    - src/components/import/PerProviderSyncChip.tsx
    - src/components/import/__tests__/SyncJobBanner.test.tsx
    - src/components/import/__tests__/PerProviderSyncChip.test.tsx
  modified:
    - src/components/import/ImportSurface.tsx

key-decisions:
  - "Failures and completed_with_errors are STICKY: the banner has NO setTimeout at all — terminal banners leave the DOM only via the user's dismiss control (JOB-03 regression class closed)"
  - "Chip provider label comes from getConnectorAdapter(sourceApp).metadata.label (try/catch fallback to the raw slug) — never a hardcoded provider name"
  - "lastCompletedJob = terminalJobs[0] (hook orders created_at DESC) drives the chip's 'Last synced' + 'M failed'; clean completed is dismissible but not auto-faded (kept simple, no motion/react needed)"
  - "Counts use string[] .length only (synced_ids/failed_ids) — no parseInt/Number coercion (dual-ID rule)"

requirements-completed: [JOB-03, JOB-05]

metrics:
  duration: ~7min
  completed: 2026-06-23
  tasks: 2
  files: 5
---

# Phase 27 Plan 03: Durable SyncJobBanner + PerProviderSyncChip Summary

**A status-driven, sticky-on-failure `SyncJobBanner` (no timer) plus a persistent per-provider `PerProviderSyncChip` ("Last synced X · N new · M failed"), both mounted at the clean Phase-26 seams in `<ImportSurface>` and fed entirely by the shared `useSyncJobs` hook — giving every import surface always-on, refresh-surviving sync visibility.**

## Performance

- **Duration:** ~7 min
- **Completed:** 2026-06-23
- **Tasks:** 2 (TDD: RED then GREEN)
- **Files:** 5 (4 created, 1 modified)

## Accomplishments

- **JOB-03:** `SyncJobBanner` renders directly off the `sync_jobs` row's `status` — `processing`/`pending` → progress (`progress_current/progress_total` + spinner), `completed` → success, `completed_with_errors` → "{synced} synced, {failed} failed", `failed` → `job.error`. Failures and partial-success banners are **sticky** — there is no `setTimeout` anywhere in the component; they leave the DOM only when the user clicks dismiss (`onDismiss(job.id)`).
- **JOB-05:** `PerProviderSyncChip` renders a persistent "Last synced X · N new · M failed" pill, per provider. The provider label is derived from the adapter registry (`getConnectorAdapter(sourceApp).metadata.label`), never a literal provider name. "N new available" = `results.length − importedIds.size` (LOCKED — no new query); "M failed" = `lastCompletedJob.failed_ids.length`.
- **Mount:** `ImportSurface` now calls `useSyncJobs({ sourceApp, organizationId })`; the chip sits in the connected-status toolbar header; the banners render at the `:474` Phase-27 seam via `[...activeJobs, ...visibleTerminalJobs].map(...)`. Both Import and Sync tabs get them for free (one shared component).
- **Retired the regressions:** the PRESERVED `ActiveSyncJobsCard`/`SyncStatusIndicator` "Auto-dismissing…" copy and the client-side 5-minute "Appears Stuck" heuristic are gone — the reaper (Plan 27-02) owns stuck→failed; the UI never guesses.

## Task Commits

Each task committed atomically (TDD):

1. **Task 1: Wave 0 RED — banner + chip unit tests** — `6d659cf8` (test)
2. **Task 2: GREEN — implement + mount SyncJobBanner + PerProviderSyncChip** — `08fbf6af` (feat)

**Plan metadata:** (this commit) (docs: complete plan)

## Files Created/Modified

- `src/components/import/SyncJobBanner.tsx` — presentational, props `{ job: SyncJob; onDismiss: (jobId: string) => void }`. Status-switch renders progress / success / partial / error. Failure + partial banners use a shared `DismissibleBanner` with an explicit `RiCloseLine` dismiss button (`aria-label="Dismiss"`). No timer.
- `src/components/import/PerProviderSyncChip.tsx` — presentational, props `{ sourceApp; lastSyncedAt?; newCount; failedCount }`. `date-fns formatDistanceToNow` for "Last synced"; failed segment omitted when `failedCount===0`; "0 new" up-to-date state when `newCount===0`. Remix icons + semantic tokens.
- `src/components/import/ImportSurface.tsx` — added `useSyncJobs` call, `dismissedJobIds` `useState<Set<string>>` + `dismissJob` callback, `visibleTerminalJobs` memo, `lastCompletedJob`, `newAvailableCount`; mounted chip in the connected-status header and banners at the seam.
- `src/components/import/__tests__/SyncJobBanner.test.tsx` — 5 tests: sticky failure after 9000ms (fake timers), sticky partial-success after 9000ms, `onDismiss(jobId)` on click, progress render, no "Auto-dismissing" guard.
- `src/components/import/__tests__/PerProviderSyncChip.test.tsx` — 4 tests: full "Last synced/N new/M failed" copy, failed segment hidden at 0, 0-new no-crash, no "fathom" literal guard.

## Decisions Made

- **No timer at all in the banner.** The plan permitted an optional `motion/react` fade for clean `completed`; I kept it simple — clean completed is dismissible like the others, with zero `setTimeout`. This is the strongest form of the JOB-03 guarantee (the reviewer's preferred outcome: 0 `setTimeout`).
- **Provider label via the registry** with a `try/catch` fallback to the raw `sourceApp` slug — robust for any of the 7 providers, never a hardcoded name.
- **`lastCompletedJob = terminalJobs[0]`** (the hook orders `created_at` DESC) drives the chip's last-synced + failed counts.
- **Dismissal is local UI only** — a `Set<string>` of seen terminal ids; active/processing jobs are never filtered by it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Brittle RED test matchers (ambiguous digit/label regex)**
- **Found during:** Task 2 (GREEN), first chip test run.
- **Issue:** The RED `PerProviderSyncChip` test used `getByText(/3/)` and `getByText(/2/)`, which matched multiple nodes once `formatDistanceToNow` rendered a relative time containing digits ("about 2 minutes ago" overlapped the failed-count "2"). This is a test-matcher defect, not a component bug — the component rendered the correct copy.
- **Fix:** Tightened the assertion to check `container.textContent` against `/3\s*new/i` and `/2\s*failed/i`, which is unambiguous and order-aware.
- **Files modified:** src/components/import/__tests__/PerProviderSyncChip.test.tsx
- **Verification:** 4/4 chip tests + 5/5 banner tests green.
- **Committed in:** `08fbf6af` (Task 2 commit).

**2. [Rule 3 - Blocking] tsc: `string` not assignable to `ConnectorSourceApp`**
- **Found during:** Task 2 (GREEN), tsc gate.
- **Issue:** `let providerLabel = sourceApp` inferred the narrow `ConnectorSourceApp` type, so the later `providerLabel = adapter.metadata.label` (a `string`) failed `tsc -p tsconfig.app.json`.
- **Fix:** Explicitly typed `let providerLabel: string = sourceApp`.
- **Files modified:** src/components/import/PerProviderSyncChip.tsx
- **Verification:** zero tsc errors referencing the three touched files.
- **Committed in:** `08fbf6af` (Task 2 commit).

---

**Total deviations:** 2 auto-fixed (1 test-matcher bug, 1 blocking typing). No scope creep — component behaviour matches the plan contract exactly.

## Threat Model Compliance

- **T-27-03-I (cross-org / cross-provider leak):** both components are purely presentational and render ONLY what `useSyncJobs({ sourceApp, organizationId })` already scoped (Plan 27-01 RLS + client narrowing); neither issues its own query. The chip is per `sourceApp`; "N new" comes from the surface's own `results`/`importedIds`.
- **T-27-03-T (id coercion):** synced/failed counts use `.length` on the `string[]` arrays — no `parseInt`/`Number`.
- **T-27-03-D (auto-dismissing failures):** no `setTimeout` in `SyncJobBanner` at all; the sticky-after-9000ms tests assert failures + partial successes persist.

## Grep / Build Gates (verified)

- `grep -c "useSyncJobs(" ImportSurface.tsx` → 1; `<SyncJobBanner` → 1; `<PerProviderSyncChip` → 1.
- `grep -c 'fathom' SyncJobBanner.tsx PerProviderSyncChip.tsx` → 0.
- `grep -c 'Auto-dismissing' …` → 0; `grep -c 'setTimeout' SyncJobBanner.tsx` → 0.
- `tsc -p tsconfig.app.json --noEmit` → zero errors referencing the three touched files (pre-existing unrelated errors deferred per 26-04).
- `vitest run` → 9/9 new tests green; 17/17 existing ImportSurface tests still green (20/20 in the combined run).

## Self-Check: PASSED

- FOUND: src/components/import/SyncJobBanner.tsx
- FOUND: src/components/import/PerProviderSyncChip.tsx
- FOUND: src/components/import/__tests__/SyncJobBanner.test.tsx
- FOUND: src/components/import/__tests__/PerProviderSyncChip.test.tsx
- FOUND: .planning/phases/27-observable-jobs/27-03-SUMMARY.md
- FOUND commit: 6d659cf8 (RED)
- FOUND commit: 08fbf6af (GREEN)

---
*Phase: 27-observable-jobs*
*Completed: 2026-06-23*
