---
status: resolved
trigger: "the fathom/sync logs for the calls are leaving stacks of green/failed/sync status bars - its unnecessary and wasteful to try to churn thru"
created: 2026-07-20
updated: 2026-07-21
---

# Debug: Fathom/sync banner clutter — RESOLVED

## Symptoms
- Every completed/failed/completed_with_errors sync job rendered as its own
  status banner (green/red/amber). They stacked and were wasteful to scroll.
- Observed live in a@vibeos.com Fathom connector: ~10 stacked terminal banners.

## Root Cause (confirmed by code read — deterministic)
`useSyncJobs` fetches ALL terminal sync_jobs (completed/failed/completed_with_errors)
for the user+surface with NO cap, NO recency bound, NO auto-expiry. `ImportSurface`
rendered `[...activeJobs, ...visibleTerminalJobs]` as one flat stack; the only
removal path was per-job manual dismiss. Phase 27 had *deliberately* removed
auto-dismiss ("sticky failures — no timer"), which over time produced the wall.

## Fix (chosen behavior: "Latest + auto-hide successes")
`src/components/import/ImportSurface.tsx`:
- Successful `completed` jobs NO LONGER render a persistent banner — the existing
  "Last synced" chip (PerProviderSyncChip off `lastCompletedJob`) already shows the
  newest success at a glance.
- Active (processing) jobs still always render (live progress).
- Failures + partial-failures (`failed` / `completed_with_errors`) persist because
  they're actionable, but collapsed behind a single `Collapsible`
  "N sync(s) need attention" disclosure instead of a stack (RiAlertLine, vibe-orange).
  Expanding shows the full SyncJobBanner(s) with the existing Retry affordance.

Files changed:
- src/components/import/ImportSurface.tsx (split terminal jobs; collapse failures)

## Verification (browser — repo hard rule)
Live in a@vibeos.com Fathom connector after HMR:
- greenCompletedBanners: 0 (was ~10 stacked)
- failures collapsed to a single "10 syncs need attention" disclosure
- expanding reveals the failed banners; retry affordance preserved
- tsc (tsconfig.app.json) clean for the file; eslint clean; 11 existing
  ImportSurface tests pass.
