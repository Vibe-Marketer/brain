---
phase: 32
slug: match-rule-hardening-provider-agnostic-matcher
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-02
---

# Phase 32 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^4.0.16` |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run supabase/functions/_shared/dedup-fingerprint.test.ts` |
| **Full suite command** | `npm run test:integration` + `npx vitest run` |
| **Estimated runtime** | ~30-60s unit, ~2-3min integration |

---

## Sampling Rate

- **After every task commit:** `npx vitest run <changed test file>`
- **After every plan wave:** `npm run test:integration` + full `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite green, plus SAFE-06's precision proof recorded as evidence BEFORE any `organization_feature_flags` row is set `enabled=true` for any org beyond the explicitly-approved internal measurement org.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 32-01-01 | 01 | 1 | MATCH-04 | — | `checkMatch` rejects zero-time-overlap candidates even when title+participants meet threshold | unit | `npx vitest run supabase/functions/_shared/dedup-fingerprint.test.ts` | ❌ W0 | ⬜ pending |
| 32-01-02 | 01 | 1 | MATCH-05 | — | Title similarity suppressed above `recurring_call_titles` occurrence threshold | unit | `npx vitest run supabase/functions/_shared/__tests__/event-resolver.test.ts` | ⚠️ extend | ⬜ pending |
| 32-02-01 | 02 | 2 | MATCH-03, MATCH-06 | T-32-01 | Metadata tier proposes only (never merge_applied), reads recordings+call_participants, same-org-only, Zoom behavior preserved | unit + integration | new metadata-tier integration test | ❌ W0 | ⬜ pending |
| 32-02-02 | 02 | 2 | MATCH-08, MATCH-11 | — | Asymmetric thresholds; dedup_priority_mode/platform_order select display order only | unit | event-resolver test extension | ❌ W0 | ⬜ pending |
| 32-03-01 | 03 | 3 | SAFE-03 | T-32-02 | Kill switch reverts all merge_applied decisions in a time range, one operation | integration | new bulk-revert integration test | ❌ W0 | ⬜ pending |
| 32-03-02 | 03 | 3 | SAFE-04 | T-32-03 | Cross-org false merges blocked at RLS | integration (RLS) | extend `rls-regression.test.ts` events block | ⚠️ extend | ⬜ pending |
| 32-04-01 | 04 | 4 | SAFE-06 | — | Shadow precision ≤0.1% false-merge rate on hand-labeled set from Andrew's own org | manual + scripted | new precision-scoring script, human-reviewed labels | ❌ W0, not CI-automatable | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `supabase/functions/_shared/dedup-fingerprint.test.ts` — new, no existing test file for this module
- [ ] New metadata-tier test cases in `event-resolver.test.ts`
- [ ] New bespoke SAFE-04 block in `rls-regression.test.ts`
- [ ] New kill-switch bulk-reversal integration test
- [ ] New precision-scoring script for SAFE-06 (genuinely new tooling)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Precision measurement against hand-labeled shadow-mode proposals | SAFE-06 | Requires human judgment to build ground-truth labels — not CI-automatable by nature | Enable `event_resolution` flag for Andrew's own org only (explicitly approved), let the sweep run, hand-review proposed matches, score against ≤0.1% false-merge target |
| Migration applied cleanly to production | MATCH-*, SAFE-03/04 | One-time guarded action | Same TEST-then-prod guarded process as Phases 30-31 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity maintained
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
