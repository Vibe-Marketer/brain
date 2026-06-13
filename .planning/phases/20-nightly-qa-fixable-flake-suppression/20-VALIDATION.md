---
phase: 20
slug: nightly-qa-fixable-flake-suppression
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-13
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Brain: Vitest; Autopilot: Bun test + TypeScript; Supabase linked schema push/types |
| **Config file** | `vitest.config.ts`; `/Users/admin/dev/autopilot/package.json`; `supabase/config.toml` |
| **Quick run command** | `npm test -- src/services/__tests__/qa.service.test.ts src/pages/admin/__tests__/QaSection.test.tsx src/components/settings/__tests__/TicketTable.test.tsx`; `cd /Users/admin/dev/autopilot && bun test qa/triage.test.ts src/lib/claim.test.ts src/claimer.test.ts` |
| **Full suite command** | `npm test`; `cd /Users/admin/dev/autopilot && bun test && bun run typecheck`; `npm run test:integration -- qa-ticket-ingestion` when TEST env is available |
| **Estimated runtime** | Focused: ~60-120s; full local: ~5-10m plus linked Supabase push |

## Sampling Rate
- **After every task commit:** focused command listed in the task's `<verify><automated>` block
- **After every plan wave:** `npm test -- src/test/qa-ticket-ingestion.integration.test.ts src/services/__tests__/qa.service.test.ts src/pages/admin/__tests__/QaSection.test.tsx src/components/settings/__tests__/TicketTable.test.tsx` and `cd /Users/admin/dev/autopilot && bun test qa/triage.test.ts src/lib/claim.test.ts src/claimer.test.ts src/runner.test.ts`
- **Before `/gsd-verify-work`:** Full suite green
- **Max feedback latency:** No more than one task may land without a focused automated command; integration TEST env may SKIP but must be explicitly reported

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 20-01-01 | 01 | 1 | QA-02, QA-03 | T-20-01..06 | RPC stamps source server-side; qa_findings admin-only; dedup is DB-owned | migration + integration scaffold | `npm test -- src/test/qa-ticket-ingestion.integration.test.ts` | ❌ W0 | ⬜ pending |
| 20-01-02 | 01 | 1 | QA-02, QA-03 | T-20-01..06 | Real TEST DB proves source, dedup, evidence, RLS/admin read | integration | `npm run test:integration -- qa-ticket-ingestion` | ❌ W0 | ⬜ pending |
| 20-01-03 | 01 | 1 | QA-02, QA-03 | T-20-01..06 | Linked schema is live; generated types include RPC/table | schema push + typecheck | `SUPABASE_ACCESS_TOKEN=${SUPABASE_ACCESS_TOKEN:?required} supabase db push --linked && npm run type-check` | ✅ | ⬜ pending |
| 20-02-01 | 02 | 2 | QA-01, QA-02 | T-20-07..12 | QA filing uses RPC, not direct REST or send-support-ticket | unit + static | `cd /Users/admin/dev/autopilot && bun test qa/triage.test.ts` | ✅ | ⬜ pending |
| 20-02-02 | 02 | 2 | QA-03 | T-20-07..12 | N=2 rerun quarantine; qa_review/quarantine ledger; M=3 promotion | unit | `cd /Users/admin/dev/autopilot && bun test qa/triage.test.ts src/qa-poller.test.ts` | ❌ W0 | ⬜ pending |
| 20-02-03 | 02 | 2 | QA-01, QA-03 | T-20-07..12 | Nightly path keeps launchd and does not raise volume/concurrency | unit + static | `cd /Users/admin/dev/autopilot && bun test qa/triage.test.ts src/claimer.test.ts` | ✅ | ⬜ pending |
| 20-03-01 | 03 | 2 | QA-04 | T-20-13..18 | Claim selector can exclude QA while preserving ordering | unit | `cd /Users/admin/dev/autopilot && bun test src/lib/claim.test.ts` | ✅ | ⬜ pending |
| 20-03-02 | 03 | 2 | QA-04 | T-20-13..18 | QA <= 50% of current run cap; non-QA still claims | unit + typecheck | `cd /Users/admin/dev/autopilot && bun test src/claimer.test.ts src/lib/claim.test.ts && bun run typecheck` | ✅ | ⬜ pending |
| 20-03-03 | 03 | 2 | QA-03, QA-04 | T-20-13..18 | High/critical or failed QA routes to tier-2, not raw operator dump | unit | `cd /Users/admin/dev/autopilot && bun test src/runner.test.ts src/lib/tier2.test.ts src/lib/approval.test.ts` | ✅ | ⬜ pending |
| 20-04-01 | 04 | 2 | QA-03 | T-20-19..24 | Service/hook reads for qa_findings; no browser writes | unit + typecheck | `npm test -- src/services/__tests__/qa.service.test.ts && npm run type-check` | ✅ | ⬜ pending |
| 20-04-02 | 04 | 2 | QA-03 | T-20-19..24 | Existing QaSection shows review/quarantine/promoted audit state | component | `npm test -- src/pages/admin/__tests__/QaSection.test.tsx` | ✅ | ⬜ pending |
| 20-04-03 | 04 | 2 | QA-04 | T-20-19..24 | Fixable QA tickets still label/group by nightly QA source | component + typecheck | `npm test -- src/components/settings/__tests__/TicketTable.test.tsx src/lib/__tests__/ticket-display.test.ts && npm run type-check` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

## Wave 0 Requirements
- [ ] `src/test/qa-ticket-ingestion.integration.test.ts` must be created before RPC behavior can be verified against a TEST Supabase project.
- [ ] `/Users/admin/dev/autopilot/src/qa-poller.test.ts` must be created before on-demand QA poller behavior can be verified.

Existing Autopilot and Brain unit/component test files cover all other phase tasks after task-specific assertions are added.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live linked schema confirmation | QA-02, QA-03 | Requires Supabase linked project auth and `SUPABASE_ACCESS_TOKEN`; executor can automate if env is present, otherwise must mark BLOCKED/SKIPPED explicitly | Run `supabase db push --linked`, regenerate types, and record linked-project confirmation output in `20-01-SUMMARY.md` |

## Validation Sign-Off
- [x] All tasks have `<automated>` verify or Wave 0 deps
- [x] No 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] `nyquist_compliant: true` set

**Approval:** ready for plan-checker
