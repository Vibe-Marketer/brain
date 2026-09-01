---
phase: 31
slug: deterministic-resolution-shadow-mode-only
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-01
---

# Phase 31 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (repo-wide) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run supabase/functions/_shared/event-resolver.test.ts` |
| **Full suite command** | `npm run test` (unit) / `npm run test:integration` (integration, requires `VITEST_INTEGRATION_OK=true` + TEST project env) |
| **Estimated runtime** | ~30-60s unit, ~2-3min integration |

---

## Sampling Rate

- **After every task commit:** `npx vitest run supabase/functions/_shared/event-resolver.test.ts` (fast, no DB).
- **After every plan wave:** `npm run test:integration` against TEST.
- **Before `/gsd-verify-work`:** Full suite green, plus manual confirmation `recordings.event_id` is still NULL across prod after any migration apply (mirrors Phase 30's discipline).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 31-01-01 | 01 | 1 | MATCH-01 | — | `extractTier1Signal` returns correct field per provider, null when absent, never `zoom_numeric_id` | unit | `npx vitest run supabase/functions/_shared/event-resolver.test.ts` | ❌ W0 | ⬜ pending |
| 31-01-02 | 01 | 1 | MATCH-01, MATCH-09 | — | Matching tier-1 signal produces a ledger row with full field shape; non-matching produces none | integration | `npm run test:integration -- event-resolution-shadow.integration.test.ts` | ❌ W0 | ⬜ pending |
| 31-02-01 | 02 | 2 | MATCH-10 | T-31-01 | apply/reverse RPC round-trips `recordings.event_id` correctly, both logged | integration | `src/test/event-match-apply-reverse.integration.test.ts` | ❌ W0 | ⬜ pending |
| 31-02-02 | 02 | 2 | SAFE-01, SAFE-02 | T-31-02 | Flag-off org writes zero rows; flag-on writes rows; `event_id` stays NULL across the board post-sweep | integration | `event-resolution-shadow.integration.test.ts` | ❌ W0 | ⬜ pending |
| 31-03-01 | 03 | 3 | (isolation) | T-31-03 | `event_match_decisions` unreadable by any authenticated JWT | integration (RLS) | `CLIENT_DENY_TABLES` entry in `rls-regression.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `supabase/functions/_shared/event-resolver.ts` + `event-resolver.test.ts` — new
- [ ] `src/test/event-resolution-shadow.integration.test.ts` — new (template: `src/test/event-schema-noop.integration.test.ts`)
- [ ] `src/test/event-match-apply-reverse.integration.test.ts` — new
- [ ] `event_match_decisions` entry in `CLIENT_DENY_TABLES` (`src/test/rls-regression.test.ts`) — new array entry
- [ ] Migrations: `organization_feature_flags`, `event_match_decisions`, apply/reverse RPCs, cron schedule — this phase creates all of them

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Migration applied cleanly to production | SAFE-01, SAFE-02, MATCH-09, MATCH-10 | Prod DDL apply is a one-time guarded action, not CI-repeated | Same guarded TEST-then-prod process as Phase 30; verify prod ref before connecting |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
