---
phase: 11
slug: ticket-foundation-flag-removal
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-10
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.0.16 |
| **Config file** | vitest.config.ts (integration tests excluded unless `VITEST_INTEGRATION_OK=true`) |
| **Quick run command** | `npx vitest run <touched test file>` |
| **Full suite command** | `npm test && npm run build` |
| **Estimated runtime** | ~60-120 seconds (unit + build) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <touched test files>` (or `npm run build` for type-only tasks)
- **After every plan wave:** Run `npm test && npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green; `npm run test:integration` where test-project env is configured (skips cleanly otherwise — CI gate covers it)
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 11-01-* | 01 | 1 | FLAG-01 | — | no dead flag refs | static + unit | `rg -n "useFeatureFlags\|isFeatureEnabled" src/ (0 hits)` + `npm test && npm run build` | ✅ | ⬜ pending |
| 11-02-* | 02 | 1 | TKT-01, TKT-04 | T-11-01..04 | RLS isolation + audit trigger | integration | `npx vitest run src/test/rls-regression.test.ts` (extended) | ❌ W0 | ⬜ pending |
| 11-03-* | 03 | 2 | TKT-01 | T-11-01, T-11-05 | reporter_id from JWT; email is side-effect | unit + contract | `npx vitest run src/services/__tests__/tickets.service.test.ts` | ❌ W0 | ⬜ pending |
| 11-04-* | 04 | 2 | TKT-02, TKT-03 | T-11-02 | admin-gated UI; filters/detail/submit | component | `npx vitest run src/components/settings/__tests__/` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/test/rls-regression.test.ts` — extend CROSS_ORG_TABLES (+ `reporter_id`/`ticket_id` filter columns) and fixtures for tickets/ticket_messages/ticket_events
- [ ] `src/services/__tests__/tickets.service.test.ts` — service unit tests (mocked supabase client)
- [ ] `src/components/settings/__tests__/TicketTable.test.tsx` — component test stubs
- [ ] Framework install: none — vitest present

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live `supabase db push` applied to linked project | TKT-01 | requires linked prod project + access token; build/types pass without it (false-positive vector) | run `supabase db push`; verify tables via `SELECT` against information_schema |
| Deployed Edge Function inserts ticket then emails | TKT-01 | needs deployed function + Resend env | submit support form on production/dev; verify tickets row exists and email arrives |
| AdminTab tickets view visual check | TKT-02 | rendering fidelity per UI-SPEC | dev-browser screenshot of Tickets section, filters, detail dialog |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
