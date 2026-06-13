---
phase: 18
slug: source-attribution
status: planned
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-13
updated: 2026-06-13
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x for brain unit/integration tests; Bun test + TypeScript typecheck for `~/dev/autopilot`; Supabase CLI for linked schema verification |
| **Config file** | `vitest.config.ts`; `/Users/admin/dev/autopilot/package.json`; Supabase linked project config |
| **Quick run command** | `npm test -- <targeted test files>` or `cd /Users/admin/dev/autopilot && bun test <targeted test files>` |
| **Full suite command** | `npm run type-check && npm run build`; autopilot full check: `cd /Users/admin/dev/autopilot && bun test && bun run typecheck` |
| **Estimated runtime** | Targeted tests < 60s; full frontend build/type-check depends on current repo state |

## Sampling Rate

- **After every task commit:** Run the task's `<verify><automated>` commands.
- **After every plan wave:** Run `npm run type-check`; after Wave 2 also run `cd /Users/admin/dev/autopilot && bun test && bun run typecheck`.
- **Before `/gsd-verify-work`:** Run `npm run type-check && npm run build`; run browser screenshots for `/admin/dashboard` and `/admin/tickets`; run linked Supabase enum/RPC smoke where credentials are available.
- **Max feedback latency:** No more than one task without a targeted automated check; no watch-mode commands.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 18-01-01 | 01 | 1 | SRC-01 | T-18-01 | Enum values are append-only and isolated before use | static SQL | `grep -v '^--' supabase/migrations/20260613180000_extend_ticket_source_enum.sql \| grep -E "ADD VALUE IF NOT EXISTS '(unknown\|nightly_qa\|internal)'"` | ✅ | ⬜ pending |
| 18-01-02 | 01 | 1 | SRC-01 | T-18-02 | Linked DB manual-ticket samples confirm conservative backfill predicates before UPDATE | linked schema | `supabase db query --linked "select id, source, reporter_id, context, title, created_at from public.tickets where source = 'manual' order by created_at desc limit 25"` | ✅ | ⬜ pending |
| 18-01-03 | 01 | 1 | SRC-01, SRC-03 | T-18-02/T-18-03 | Backfill is targeted; metrics RPC is SECURITY DEFINER with pinned search_path, internal ADMIN guard, PUBLIC/anon revoked, and authenticated execute granted | static SQL | `grep -v '^--' supabase/migrations/20260613180500_source_attribution_backfill_metrics.sql \| grep -E "ticket_source_metrics\|avg_cycle_time_hours\|public.has_role\\(auth.uid\\(\\), 'ADMIN'\\)\|SET search_path = public, pg_temp\|GRANT EXECUTE ON FUNCTION public.ticket_source_metrics\\(\\) TO authenticated"` | ✅ | ⬜ pending |
| 18-01-04 | 01 | 1 | SRC-01, SRC-03 | T-18-01/T-18-03 | Live schema and generated types agree | linked schema | `supabase db push --linked --include-all --yes && supabase gen types typescript --linked --schema public > src/types/supabase.ts` | ✅ | ⬜ pending |
| 18-02-01 | 02 | 2 | SRC-01 | T-18-05/T-18-06 | Browser clients cannot spoof ticket source | unit/static | `npm test -- supabase/functions/send-support-ticket/__tests__/source-stamping.test.ts` | ❌ W0 creates | ⬜ pending |
| 18-02-02 | 02 | 2 | SRC-01, SRC-02 | T-18-07 | Nullable system-ticket reporters do not break list reads | unit | `npm test -- src/services/__tests__/tickets.service.test.ts && npm run type-check` | ✅ | ⬜ pending |
| 18-03-01 | 03 | 2 | SRC-01 | T-18-08 | Watchdog tickets stamp internal | autopilot unit | `cd /Users/admin/dev/autopilot && bun test src/watchdog.test.ts && bun run typecheck` | ❌ W0 creates/extends | ⬜ pending |
| 18-03-02 | 03 | 2 | SRC-01 | T-18-09/T-18-10 | QA tickets stamp nightly QA and do not call person-report intake | autopilot unit/static | `cd /Users/admin/dev/autopilot && bun test qa/triage.test.ts && bun run typecheck` | ❌ W0 creates/extends | ⬜ pending |
| 18-04-01 | 04 | 2 | SRC-02 | T-18-12 | Source labels never expose raw enum values | unit/static | `npm test -- src/lib/__tests__/ticket-display.test.ts src/components/settings/__tests__/TicketTable.test.tsx && ! grep -RnE "nightly_qa\|in_app_user\|internal" src/pages/admin src/components/settings --include='*.tsx'` | ✅ | ✅ green |
| 18-04-02 | 04 | 2 | SRC-02 | T-18-13/T-18-14 | Tickets source controls filter/group without editing source | typecheck/unit | `npm run type-check` | ✅ | ✅ green |
| 18-05-01 | 05 | 3 | SRC-03 | T-18-15/T-18-18 | Metrics use aggregate RPC through service/hook separation and the authenticated admin browser RPC path succeeds while non-admin/anon are rejected | unit/typecheck/live RPC | `npm test -- src/services/__tests__/admin-dashboard.service.test.ts && npm run type-check && tsx scripts/qa/verify-ticket-source-metrics-rpc.ts` | ❌ W0 creates | ⬜ pending |
| 18-05-02 | 05 | 3 | SRC-03 | T-18-16 | Dashboard renders labeled per-source metrics | unit/typecheck | `npm test -- src/services/__tests__/admin-dashboard.service.test.ts && npm run type-check` | ✅ | ⬜ pending |
| 18-05-03 | 05 | 3 | SRC-02, SRC-03 | T-18-17 | Source metric buttons filter only; no source mutation | typecheck/unit | `npm run type-check && npm test -- src/services/__tests__/admin-dashboard.service.test.ts src/lib/__tests__/ticket-display.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

## Wave 0 Requirements

- [x] Existing Vitest, TypeScript, Supabase CLI, and autopilot Bun test/typecheck infrastructure cover execution.
- [x] Missing test files are created inside their implementation tasks, with each task's first run serving as the RED/W0 proof.
- [x] No package-manager install or new test framework is required.

## Source Coverage Audit

| Source | ID | Feature/Requirement | Plan | Status | Notes |
|--------|----|---------------------|------|--------|-------|
| GOAL | Phase 18 | Establish accurate per-origin attribution and fix QA `source:'manual'` mis-attribution | 01, 03, 04, 05 | COVERED | Schema, active intake paths, UI, and metrics all planned |
| REQ | SRC-01 | True source on every ticket; enum extended; watchdog internal; QA nightly; legacy unknown | 01, 02, 03 | COVERED | Includes append-only enum, server-side stamping, and spoofing regression |
| REQ | SRC-02 | AdminTab filters and groups tickets by source | 02, 04, 05 | COVERED | Filter support, labels, grouping, and source summary controls |
| REQ | SRC-03 | Per-source volume, fix rate, and cycle time | 01, 05 | COVERED | Admin-guarded RPC plus Dashboard/Tickets rendering |
| RESEARCH | R-01 | Separate enum-add migration before any use of new values | 01 | COVERED | 18-01 Task 1 is enum-only and committed before Task 2 |
| RESEARCH | R-02 | Do not trust browser source input; stamp source server-side | 02, 03 | COVERED | `send-support-ticket`, watchdog, and QA triage tasks own source stamps |
| RESEARCH | R-06 | Sample linked DB manual-ticket predicates before backfill | 01 | COVERED | 18-01 Task 2 runs read-only `supabase db query --linked` before UPDATE migration |
| RESEARCH | R-03 | Null-safe reporter lookup for system tickets | 02 | COVERED | Ticket service task filters nullable reporter IDs |
| RESEARCH | R-04 | Use lifecycle event for cycle time instead of `updated_at` only | 01, 05 | COVERED | Metrics RPC uses first resolved status-change event |
| RESEARCH | R-05 | Avoid Sentry/QA scope creep | 01, 03 | COVERED | Sentry stamp preserved; QA full ingest/flake work left to Phase 20 |
| CONTEXT | D-01 | Plain-English labels only; no raw enum UI | 04, 05 | COVERED | Label helper and source metrics rendering use locked labels |
| CONTEXT | D-02 | Preserve `manual` as Reported by a person | 01, 02, 04 | COVERED | Person reports stay `manual`; labels preserve meaning |
| CONTEXT | D-03 | Legacy/uncertain rows become unknown, never in-app user | 01 | COVERED | Linked DB sampling plus targeted conservative backfill only; no aggressive history rewrite |
| CONTEXT | D-04 | Fix active watchdog and QA mis-attribution | 02, 03 | COVERED | Brain spoofing guard plus autopilot source stamping |
| CONTEXT | D-05 | Sentry keeps dedicated source; no Sentry debug/resolve scope | 01 | COVERED | Migration preserves `sentry`; no Phase 21 work planned |
| CONTEXT | D-06 | Prefer grouping by source with summary | 04, 05 | COVERED | Grouping task plus source mix summary |
| CONTEXT | D-07 | Use simple filter/summary fallback if grouping detours | 04 | COVERED | D-07 fallback explicitly authorized in task action |
| CONTEXT | D-08 | Keep inside existing Admin Center Tickets surface | 04, 05 | COVERED | No new route/tab/page |
| CONTEXT | D-09 | Show metrics in Dashboard and Tickets | 05 | COVERED | Both locations planned |
| CONTEXT | D-10 | Metrics limited to volume, fix rate, cycle time | 01, 05 | COVERED | Phase 19 survival/autonomy explicitly excluded |

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Admin Dashboard and Tickets source metrics render without raw enum labels | SRC-02, SRC-03 | Visual layout, responsive wrapping, and no-overlap checks require browser inspection | Start `npm run dev`, visit `/admin/dashboard` and `/admin/tickets`, capture desktop and mobile screenshots, verify source labels and metric rows match 18-UI-SPEC |

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency target defined
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planned 2026-06-13
