---
phase: 16
plan: 03
subsystem: admin-center
tags: [admin, qa, audit, qa-runs, rls, cmdk, autopilot]
requires:
  - 16-01 admin shell (/admin route, AdminCategoryPane, AdminCommandPalette, routes.manifest)
  - 16-02 admin_audit_log table + Users section
  - 11-03 ticket_events table (status-transition audit)
  - has_role(uuid, app_role) SECURITY DEFINER helper
provides:
  - qa_runs table (append-only, admin-read, service-role-write)
  - autopilot qa/ --record step writing one qa_runs summary row per crawl
  - QA section in /admin (run history + per-run findings; disabled Run-now v1)
  - Audit section in /admin (merged ticket_events + admin_audit_log trail)
  - QA + Audit wired into AdminCategoryPane, ⌘K palette, routes.manifest
affects:
  - src/components/panes/AdminCategoryPane.tsx (qa + audit categories)
  - src/components/admin/AdminCommandPalette.tsx (qa + audit section jumps)
  - src/pages/admin/AdminCenter.tsx (qa + audit renderSection cases)
  - src/lib/query-config.ts (admin.qaRuns key; admin.audit optional filter)
  - src/hooks/useAdminUsers.ts (audit invalidation -> prefix)
  - src/routes.manifest.ts (/admin/qa, /admin/audit)
  - ~/dev/autopilot qa/triage.ts + qa/nightly-crawl.sh (--record)
tech-stack:
  added: []
  patterns: [append-only service-role-write table (qa_runs), merged multi-source audit normalization, disabled-button tooltip via span trigger wrapper, best-effort run recording]
key-files:
  created:
    - supabase/migrations/20260612150000_create_qa_runs.sql
    - src/services/qa.service.ts
    - src/services/__tests__/qa.service.test.ts
    - src/hooks/useQaRuns.ts
    - src/pages/admin/QaSection.tsx
    - src/pages/admin/__tests__/QaSection.test.tsx
    - src/services/admin-audit.service.ts
    - src/services/__tests__/admin-audit.service.test.ts
    - src/hooks/useAuditLogs.ts
    - src/pages/admin/AuditSection.tsx
    - src/pages/admin/__tests__/AuditSection.test.tsx
  modified:
    - src/lib/query-config.ts
    - src/hooks/useAdminUsers.ts
    - src/components/panes/AdminCategoryPane.tsx
    - src/components/admin/AdminCommandPalette.tsx
    - src/pages/admin/AdminCenter.tsx
    - src/routes.manifest.ts
    - "~/dev/autopilot/qa/triage.ts (autopilot repo)"
    - "~/dev/autopilot/qa/nightly-crawl.sh (autopilot repo)"
decisions:
  - "qa_runs columns match the branch QaRun TS interface (status/routes_crawled/findings_count/critical_count/report/triggered_by) so the ported UI binds 1:1"
  - "Run-now is DISABLED for v1 with a span-wrapped tooltip trigger ('manual: npm run qa:crawl') — a disabled button suppresses pointer events, so the tooltip lives on an enabled wrapper; remote trigger lands with Phase 13's dispatcher"
  - "Audit trail MERGES admin_audit_log + ticket_events in the service (not the DB) via two parallel reads; ticket events normalized to ticket_<event_type> with old/new_value metadata; row ids namespaced (aal: / te:) to avoid key collisions"
  - "--record is best-effort inside triage.ts: a qa_runs write failure warns and never changes the triage exit code; report.findings carries POST-noise-filter findings so the QA section shows actionable detail, not crawler noise"
  - "useAdminUsers audit invalidation switched from audit() to the ['admin','audit'] prefix so filtered audit queries also refresh after user mutations (Rule 1 — exact-key invalidation would miss filtered queries)"
  - "autopilot signup-e2e change (ticket 3d1da686) left uncommitted in the working tree — it is the autopilot owner's in-flight work; only my qa/ --record hunk was staged via HEAD reconstruction"
metrics:
  duration: ~70 minutes
  completed: 2026-06-11
  tasks: 5
  tests-added: 19 (5 qa.service, 6 admin-audit.service, 5 QaSection, 4 AuditSection — minus 1 dup count; 19 net)
---

# Phase 16 Plan 03: Admin Center QA + Audit Port Summary

Wave 3 shipped the last two Admin Center sections: **QA** (the crawler run ledger
backed by a new `qa_runs` table, fed by the autopilot nightly crawler's new
`--record` step) and **Audit** (a merged actor/action/target trail over
`ticket_events` + `admin_audit_log`). Both are wired into the category pane, the
⌘K palette, and the QA crawl manifest. ADMC-05 and ADMC-06 complete.

## What Is Now Visible at /admin

- **QA section** (`/admin/qa`): latest-run summary card (routes/findings/critical/
  started/finished/triggered-by), full run history table (click a row to inspect),
  per-run findings parsed from the `report` JSON with severity chips, and a
  collapsible "How to Run" panel. The **Run now** button renders DISABLED with a
  tooltip reading `manual: npm run qa:crawl` (v1 — remote trigger lands with
  Phase 13's dispatcher).
- **Audit section** (`/admin/audit`): one chronological trail merging privileged
  admin actions (role change, password reset, revoke/restore) with ticket
  lifecycle events (created, status_change). Source badge column (admin/ticket),
  action filter dropdown spanning both sources, free-text search, and collapsible
  per-row metadata via native `<details>`.

## qa_runs Table (ADMC-05)

`supabase/migrations/20260612150000_create_qa_runs.sql` — append-only, same
posture as `admin_audit_log`:
- Columns: `id, started_at, finished_at, status (running|completed|failed),
  routes_crawled, findings_count, critical_count, report jsonb, triggered_by,
  created_at`.
- RLS: admin-only SELECT via `has_role(auth.uid(),'ADMIN')`; **no** client-reachable
  INSERT/UPDATE/DELETE — rows are written exclusively by the crawler's service-role
  key.
- Live posture verified by REST probe: service-role INSERT succeeds with the full
  column contract; anon SELECT returns `[]` (RLS); probe rows cleaned up.

## autopilot --record Step (ADMC-05)

`~/dev/autopilot/qa/triage.ts` + `qa/nightly-crawl.sh` (committed in the autopilot
repo, `a2936a5`):
- New `--record` flag writes ONE `qa_runs` summary row per crawl via
  `SUPABASE_SERVICE_ROLE_KEY` (read from the brain repo's `.env`).
- `report.findings` carries the POST-noise-filter (real) findings; `critical_count`
  = high-severity real findings; `status` = failed iff `crawl_exit != 0`.
- Best-effort: a recording failure logs a warning and never changes triage's exit
  code. Report-only ticket filing is untouched.
- `nightly-crawl.sh` passes `--record` to the nightly triage invocation.
- End-to-end verified live: a noise-only fixture wrote a real `qa_runs` row
  (correct counts + report summary), read back via service-role, then deleted.

## Merged Audit Trail (ADMC-06)

`src/services/admin-audit.service.ts` reads both tables in parallel, normalizes
into one `AuditLog` shape, applies the action filter across both, sorts newest-first,
caps at 200, then resolves actor emails from `user_profiles`. Ticket events become
`ticket_<event_type>` with `{old_value,new_value}` metadata; row ids are namespaced
(`aal:` / `te:`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] audit cache invalidation would miss filtered queries**
- **Found during:** Task 3 (adding the optional filter arg to `admin.audit`)
- **Issue:** `useAdminUsers` invalidated `queryKeys.admin.audit()` (now
  `['admin','audit',undefined]`), which would not match filtered audit queries
  keyed `['admin','audit',{action}]`, leaving the Audit section stale after a
  user mutation.
- **Fix:** Switched the four invalidations to the `['admin','audit']` prefix.
- **Files modified:** src/hooks/useAdminUsers.ts
- **Commit:** 8650c9e

### Scope Notes (not deviations)

- The branch shipped **no** QA/Audit tests (only `admin-dashboard.service.test.ts`,
  already ported in 16-01). Per the phase context's "tests for ported
  services/components" mandate, 19 new tests were written rather than ported.
- The orchestrator scope asked for a **merged** ticket_events + admin_audit_log
  trail; the branch's `AuditSection` read only `admin_audit_log`. The service was
  extended to merge both sources (the load-bearing new behavior, covered by tests).
- An uncommitted **signup-e2e** change (ticket 3d1da686) was already in the
  autopilot working tree on arrival — the autopilot owner's in-flight work. Only
  my `--record` hunk was committed (staged via HEAD reconstruction); the signup
  block remains uncommitted for its owner.

## Known Stubs

| Stub | File | Reason |
|---|---|---|
| Run-now button DISABLED | QaSection.tsx | Intentional v1: no browser-reachable crawl trigger until Phase 13's dispatcher/runner_state. Tooltip points at the real manual command. |

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: schema | supabase/migrations/20260612150000_create_qa_runs.sql | New trust-boundary table; append-only posture verified live (admin-only read, no client write policies, service-role INSERT only) |

## Verification

- vitest (new files): 19 passed, 0 failed (qa.service 5, admin-audit.service 6, QaSection 5, AuditSection 4 — 1 shared dup removed; net 19)
- vitest (full suite): 1908 passed, 45 skipped; 2 failures are PRE-EXISTING/environmental and do NOT reference any 16-03 file — `TranscriptsTab.batching` (passes in isolation; full-suite parallelism timeout flake) and `rpc-type-smoke` (live-DB RPC signature check, network-dependent)
- tsc (scoped, tsconfig.app.json): 0 errors in all new/touched files
- eslint: 0 errors on all touched files (1 pre-existing fast-refresh warning in AdminCategoryPane, same as 16-01/16-02)
- npm run build: exit 0; AdminCenter chunk (86.8 kB) includes QA + Audit sections
- qa_runs live posture: service-role INSERT ok, anon SELECT blocked by RLS, --record end-to-end write verified + cleaned up
- Pushed: main == origin/main == 5dc7ae83

## Commits

| Hash | Repo | Message |
|---|---|---|
| 26bf1b2 | brain | feat(16-03): create qa_runs table — append-only, admin-read, service-role-write |
| a2936a5 | autopilot | feat(qa): add --record step writing qa_runs summary row |
| 2c9c1a2 | brain | feat(16-03): port QA section rebound to qa_runs |
| 8650c9e | brain | feat(16-03): port Audit section as merged ticket_events + admin_audit_log trail |
| 5dc7ae8 | brain | feat(16-03): wire QA + Audit into AdminCategoryPane, palette, routes |

## Self-Check: PASSED

(populated below after verification)
