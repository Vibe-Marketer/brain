---
phase: 23
slug: reporter-comms-in-app
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-13
---

# Phase 23 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

## Test Infrastructure
| Property | Value |
|----------|-------|
| **Framework** | brain: Vitest 4.0.16 (+ real dedicated Supabase test project for integration); autopilot: Vitest with mock-DB helpers |
| **Quick run command** | `npm test -- src/lib/__tests__/ticket-display.test.ts src/lib/__tests__/reporter-comms-filter.test.ts supabase/functions/send-support-ticket/__tests__/source-stamping.test.ts` |
| **Full suite command** | `npm test` (brain) + `cd /Users/admin/dev/autopilot && npm test` (autopilot) |

## Sampling Rate
- After every task commit: targeted unit/source tests for the touched area (the quick command, scoped to the task's files).
- Per wave merge: quick command above; when autopilot files are touched, also `cd /Users/admin/dev/autopilot && npm test -- src/lib/reporter-comms-filter.test.ts src/lib/reporter-comms.test.ts src/lib/approval.test.ts`.
- Phase gate: full brain + autopilot suites green; `npm run test:integration -- src/test/reporter-comms.integration.test.ts` against the dedicated test project; browser screenshot of the notification panel.

## Per-Task Verification Map
| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 23-01-01 | 01 | 1 | RSP-01 | T-23-02 | additive enum, no manual backfill (append-only, fail-closed) | grep + build | `grep "ADD VALUE IF NOT EXISTS 'in_app_user'" supabase/migrations/20260614120000_*.sql; npm run build` | ❌ W0 | ⬜ pending |
| 23-01-02 | 01 | 1 | RSP-01 | T-23-01 | server stamps in_app_user; client cannot set source | unit | `npm test -- supabase/functions/send-support-ticket/__tests__/source-stamping.test.ts src/lib/__tests__/ticket-display.test.ts` | ✅ (update) / ✅ | ⬜ pending |
| 23-02-01 | 02 | 2 | RSP-01, RSP-03 | T-23-04, T-23-06, T-23-07 | only source=in_app_user gets comms; idempotent; resolved excluded | grep | `grep "source = 'in_app_user'" supabase/migrations/20260614130000_*.sql; grep "NOT EXISTS" ...` | ❌ W0 | ⬜ pending |
| 23-02-02 | 02 | 2 | RSP-01, RSP-03 | T-23-04, T-23-08 | fail-closed fan-out across all non-in-app sources | integration | `npm run test:integration -- src/test/reporter-comms.integration.test.ts` | ❌ W0 | ⬜ pending |
| 23-03-01 | 03 | 2 | RSP-02, RSP-03 | T-23-09, T-23-10 | default-deny filter: paths/SHAs/stacks/banned terms → fallback | unit (tdd) | `npm test -- src/lib/__tests__/reporter-comms-filter.test.ts` + `cd /Users/admin/dev/autopilot && npm test -- src/lib/reporter-comms-filter.test.ts` | ❌ W0 | ⬜ pending |
| 23-04-01 | 04 | 3 | RSP-02 | T-23-12, T-23-13 | helper gates on in_app_user; sanitized/fallback body | unit (tdd) | `cd /Users/admin/dev/autopilot && npm test -- src/lib/reporter-comms.test.ts` | ❌ W0 | ⬜ pending |
| 23-04-02 | 04 | 3 | RSP-02 | T-23-11, T-23-14 | resolution fires only on deploy.verified; failure non-fatal | unit | `cd /Users/admin/dev/autopilot && npm test -- src/lib/approval.test.ts` | ✅ (extend) | ⬜ pending |
| 23-05-01 | 05 | 3 | RSP-01 | T-23-15, T-23-17 | View report gated on in_app_user metadata; Remix Icons only | component | `npm test -- src/components/notifications/__tests__/NotificationBell.test.tsx` | ❌ W0 | ⬜ pending |
| 23-05-02 | 05 | 3 | RSP-01 | T-23-15, T-23-16 | badge thresholds; no admin/internal leak in reporter UI | component + grep | `npm test -- src/components/notifications/__tests__/NotificationBell.test.tsx; grep NotificationBell src/components/ui/sidebar-nav.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

## Wave 0 Requirements
Wave 0 (plan 01) creates the gate substrate every later wave depends on. New test/infra stubs created during the phase:
- [ ] `supabase/migrations/20260614120000_phase23_source_gate_in_app_user.sql` — additive in_app_user enum (no backfill).
- [ ] `supabase/migrations/20260614130000_phase23_reporter_lifecycle_notify.sql` — source-gated lifecycle trigger + idempotency.
- [ ] `src/test/reporter-comms.integration.test.ts` — real-DB source-gate fan-out + idempotency coverage.
- [ ] `src/lib/reporter-comms-filter.ts` + `src/lib/__tests__/reporter-comms-filter.test.ts` — default-deny filter (brain mirror).
- [ ] `/Users/admin/dev/autopilot/src/lib/reporter-comms-filter.ts` + `.test.ts` — default-deny filter (autopilot mirror).
- [ ] `/Users/admin/dev/autopilot/src/lib/reporter-comms.ts` + `.test.ts` — verified-stable resolution helper.
- [ ] `src/components/notifications/NotificationBell.tsx` + `__tests__/NotificationBell.test.tsx` — notification surface.

## Manual-Only Verifications
| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| In-app notification panel render + no-layout-shift bell | RSP-01 | visual | Open the app, expand/collapse the sidebar, open the panel, confirm reassuring copy with no internal terms; screenshot (plan 05 checkpoint) |

## Validation Sign-Off
- [x] Comms HARD-gated on source=in-app-user (Sentry/QA/internal silent) — tested fail-closed (plan 02 integration matrix + plan 04 helper tests)
- [x] Content filter default-deny (paths/SHAs/stacktraces/"agent" redacted) — tested (plan 03 mirrored TDD matrices)
- [x] `nyquist_compliant: true` set

**Approval:** pending
