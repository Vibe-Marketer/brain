---
phase: 22
slug: recurrence-structural-fix
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-13
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

## Test Infrastructure
| Property | Value |
|----------|-------|
| **Framework** | brain: Vitest + guarded real Supabase integration tests; autopilot: repo-native npm tests + typecheck; Supabase linked schema push |
| **Quick run command** | `npm test -- src/test/migrations/phase22-ticket-classes.test.ts src/services/__tests__/admin-dashboard.recurrence.test.ts src/pages/admin/__tests__/DashboardSection.recurrence.test.tsx` |
| **Full suite command** | `npm test && npm run type-check && cd /Users/admin/dev/autopilot && npm test -- src/lib/tier2.test.ts src/lib/approval.test.ts src/tier2.test.ts src/claimer.test.ts && npm run typecheck` |

## Sampling Rate
- After every task commit: run the task's `<automated>` command.
- After Plan 01: linked schema push + type generation must complete before Plans 02-05 execute.
- Before verify: run the full suite above, plus `npm run build` in brain if UI/service/type changes remain in the final diff.

## Source Coverage Audit

| Source | ID | Feature / Requirement | Plan | Status | Notes |
|--------|----|-----------------------|------|--------|-------|
| GOAL | phase-22 | Detect recurring classes and escalate them to structural fixes that kill the class rather than patching instances | 01, 04, 05 | COVERED | Plan 01 creates DB class/task contract; Plans 04-05 wire structural tier-2 handling. |
| REQ | REC-01 | Recurring ticket classes are detected by fingerprint/category clustering across resolved tickets | 01, 05 | COVERED | Plan 01 owns rollup/schema; Plan 05 invokes rollup on existing tier-2 cadence. |
| REQ | REC-02 | A recurring class escalates to a structural-fix task targeting the class, not the instance | 01, 04, 05 | COVERED | Plan 01 creates idempotent internal task; Plan 04 creates class-root digest; Plan 05 keeps it out of tier-1 claims. |
| RESEARCH | durable-table | Use durable `ticket_classes`, not view-only detection | 01 | COVERED | Migration plan includes persisted state, linked structural ticket, baseline/post-fix anchors, and killed status. |
| RESEARCH | namespaced-fingerprint | Avoid QA/Sentry cross-source fingerprint collisions | 01 | COVERED | Migration tests and SQL require source/error/fingerprint namespacing. |
| RESEARCH | admin-rpc | Surface recurrence metrics via admin RPC, service, hook, and AdminTab | 01, 02, 03 | COVERED | DB metrics RPC, service/hook contract, and dashboard UI are separate dependent plans. |
| RESEARCH | tier2-solution | Structural fixes render as solution-shaped tier-2 digest with 2-3 options | 04 | COVERED | Autopilot digest tests and implementation enforce tier-2 validation. |
| RESEARCH | no-packages | Zero new npm packages / no queue engine / no volume raise | 01, 02, 03, 04, 05 | COVERED | Every threat model includes package gate; Plan 05 forbids new scheduler and run-cap changes. |
| CONTEXT | D-01 | Cluster resolved tickets into classes on fingerprint/category with default threshold >=3 in 30 days | 01, 05 | COVERED | Plan 01 implements threshold; Plan 05 refreshes it. |
| CONTEXT | D-02 | Escalate recurring class to structural-fix task targeting the class root | 01, 04, 05 | COVERED | DB task creation plus Autopilot digest and cadence wiring. |
| CONTEXT | D-03 | Structural fixes route tier-2/admin approval only and never autonomous auto-push | 01, 03, 04, 05 | COVERED | Task shape, UI copy/action constraints, approval override, and tier-1 exclusion all cite D-03. |
| CONTEXT | D-04 | Track per-class recurrence rate before/after and surface in AdminTab | 01, 02, 03, 05 | COVERED | DB fields/RPC, service/hook, UI, and cadence refresh all cover D-04. |

## Per-Task Verification Map
| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 22-01-01 | 01 | 1 | REC-01, REC-02 | T-22-01, T-22-02, T-22-03, T-22-04 | Migration contract proves RLS/grants, namespaced class keys, service-role rollup, and structural task shape | migration unit | `npm test -- src/test/migrations/phase22-ticket-classes.test.ts` | no, Wave 1 creates | pending |
| 22-01-02 | 01 | 1 | REC-01, REC-02 | T-22-01, T-22-03, T-22-04 | SQL implements threshold clustering, idempotent structural task creation, and rate fields | migration unit | `npm test -- src/test/migrations/phase22-ticket-classes.test.ts` | no, Wave 1 creates | pending |
| 22-01-03 | 01 | 1 | REC-01, REC-02 | T-22-01, T-22-02 | Real DB proves source-namespaced collisions and idempotent rollup; generated types include table/RPCs | integration | `supabase db push --linked --include-all && supabase gen types typescript --linked --schema public > src/types/supabase.ts && npm test -- src/test/migrations/phase22-ticket-classes.test.ts src/test/ticket-classes.integration.test.ts` | no, Wave 1 creates | pending |
| 22-02-01 | 02 | 2 | REC-01, REC-02 | T-22-05, T-22-06 | Admin recurrence metrics are read only through typed service RPC mapper | unit | `npm test -- src/services/__tests__/admin-dashboard.recurrence.test.ts` | no, Wave 2 creates | pending |
| 22-02-02 | 02 | 2 | REC-01, REC-02 | T-22-05, T-22-06 | Hook/query/display helpers expose recurrence data without component-side Supabase queries | unit | `npm test -- src/lib/__tests__/ticket-display.recurrence.test.ts src/services/__tests__/admin-dashboard.recurrence.test.ts` | no, Wave 2 creates | pending |
| 22-03-01 | 03 | 3 | REC-01, REC-02 | T-22-08, T-22-09 | AdminTab tests pin loading/empty/error/recurring/open/killed states and no autopush copy | component | `npm test -- src/pages/admin/__tests__/DashboardSection.recurrence.test.tsx` | no, Wave 3 creates | pending |
| 22-03-02 | 03 | 3 | REC-01, REC-02 | T-22-08, T-22-09, T-22-10 | AdminTab displays bounded recurrence metrics and structural task review link only | component | `npm test -- src/pages/admin/__tests__/DashboardSection.recurrence.test.tsx` | no, Wave 3 creates | pending |
| 22-03-03 | 03 | 3 | REC-01, REC-02 | T-22-08 | UI type-check and optional screenshot evidence captured or explicitly skipped | component + typecheck | `npm test -- src/pages/admin/__tests__/DashboardSection.recurrence.test.tsx && npm run type-check` | yes | pending |
| 22-04-01 | 04 | 2 | REC-02 | T-22-11, T-22-12, T-22-13 | Autopilot tests prove structural digest is solution-shaped and manual-only | unit | `cd /Users/admin/dev/autopilot && npm test -- src/lib/tier2.test.ts src/lib/approval.test.ts` | no, Wave 2 creates | pending |
| 22-04-02 | 04 | 2 | REC-02 | T-22-11, T-22-12, T-22-13 | Autopilot implementation forces tier-2/admin approval regardless of trust rung | unit + typecheck | `cd /Users/admin/dev/autopilot && npm test -- src/lib/tier2.test.ts src/lib/approval.test.ts && npm run typecheck` | yes | pending |
| 22-05-01 | 05 | 3 | REC-01, REC-02 | T-22-14, T-22-15 | Tests prove recurrence rollup runs on tier-2 cadence and structural tasks are excluded from tier-1 claims | unit | `cd /Users/admin/dev/autopilot && npm test -- src/tier2.test.ts src/claimer.test.ts` | no, Wave 3 creates | pending |
| 22-05-02 | 05 | 3 | REC-01, REC-02 | T-22-14, T-22-15, T-22-16 | Existing cadence invokes rollup and tier-1 claimer cannot run structural fixes | unit + typecheck | `cd /Users/admin/dev/autopilot && npm test -- src/tier2.test.ts src/claimer.test.ts && npm run typecheck` | yes | pending |

*Status: pending · green · red · flaky*

## Wave 0 Requirements
- Existing infrastructure covers all phase requirements at planning time. The phase creates missing tests in Wave 1/2/3 as part of each TDD task; no separate Wave 0 scaffold is required.

## Manual-Only Verifications
| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Structural fix recommendation quality | REC-02 | final recommendation usefulness is operator judgment, but shape is automated | Review one generated tier-2 digest and confirm it states the class, recurrence reason, proposed fix, and 2-3 options with one recommendation. |
| AdminTab screenshot | REC-01, REC-02 | requires authenticated admin browser state if not available in execution context | Capture `/admin` DashboardSection screenshot after seeded metrics, or mark SKIPPED with reason. |

## Validation Sign-Off
- [x] All tasks have `<automated>` verify or create their own TDD test first.
- [x] `nyquist_compliant: true` set.

**Approval:** planning-ready
