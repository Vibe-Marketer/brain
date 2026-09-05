---
phase: 33
slug: content-proof-matching-alibi-constraint
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-05
---

# Phase 33 — Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Quick run command** | `npx vitest run supabase/functions/_shared/__tests__/event-resolver.test.ts` |
| **Full suite command** | `npm run test:integration` + `npx vitest run` |

## Sampling Rate

- Per task commit: unit tests for the changed module.
- Per wave: integration suite against TEST.
- Phase gate: full suite green before verify-work.

## Per-Task Verification Map

| Requirement | Behavior | Test Type | Notes |
|---|---|---|---|
| MATCH-02 | Shingle overlap over `transcript_chunks` conclusively attaches, aligned on `chunk_index` not wall-clock | unit + integration | Since `transcript_chunks` has zero real production rows, test against SEEDED synthetic fixtures on TEST (service-role insert) — this is the only way to prove the logic, per research finding that the table is dormant |
| MATCH-07 | Alibi constraint rejects a `has_confirmed_speech` identity from a time-disjoint event | unit | `has_confirmed_speech` is set by no live code path — test the constraint function directly with synthetic rows, not via any live population pipeline |
| SC-3 | Zero-transcript captures fall back without error | integration | THIS is the dominant real-world path today (no chunks exist) — must be exercised as a first-class case, not an edge case |

## Wave 0 Requirements

- [ ] New unit tests for shingle-overlap scoring (synthetic fixtures)
- [ ] New unit tests for the alibi constraint function
- [ ] New integration test proving the zero-transcript fallback path (the realistic case today)

## Manual-Only Verifications

None beyond the standard TEST-then-prod guarded apply.

## Validation Sign-Off

- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
