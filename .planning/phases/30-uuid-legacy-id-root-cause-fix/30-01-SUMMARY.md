---
phase: 30
plan: 01
title: Build recording-ids helper + codebase audit
status: complete
completed: 2026-05-11
requirements:
  - BUG-01
---

# Plan 30-01 — SUMMARY

## Outcome

Created the canonical `src/lib/recording-ids.ts` boundary module with four exported helpers
(`isLegacyId`, `isRecordingUuid`, `toRecordingUuid`, `toRecordingUuidBatch`) and locked the
dual-ID rule into TypeScript at one verified module. Ships with 18 Vitest unit tests (all
green) covering UUID short-circuit, numeric resolution, orphan-row null returns, orgId
scoping, mixed-input batching, and pure-UUID / pure-numeric single-query paths. Added a
"Common Pitfalls" pointer in `src/CLAUDE.md` so future contributors land on the helper.

## Key Files

### key-files.created
- `src/lib/recording-ids.ts` — canonical helper module (179 lines, 4 exports + 1 interface + 1 type)
- `src/lib/__tests__/recording-ids.test.ts` — unit test suite (18 cases)

### key-files.modified
- `src/CLAUDE.md` — added "COMMON PITFALLS → Recording IDs" section pointing at the helper

## Verification

| Check | Result |
|-------|--------|
| `npm run type-check` | PASS (zero errors) |
| `npm test src/lib/__tests__/recording-ids.test.ts` | PASS (18/18) |
| `grep "recording-ids" src/CLAUDE.md` | PASS (pointer present) |
| `grep "from '@/lib/recording-ids'" src/` | PASS (zero consumers — expected, wired in 30-02) |

## Deviations

- Plan asked for 9 test cases; delivered 18 to cover edge cases the plan implied but didn't
  enumerate (case-insensitive UUIDs, numeric-string inputs, non-finite numbers, orgId scoping,
  unrecognized input rejection). All tests pass, all are aligned with plan intent — no
  scope creep beyond the helper itself.
- Used `Promise<{ data, error }>` typing instead of trying to type the supabase
  PostgrestBuilder return directly — the builder's chain types resist parametrization here.
  The runtime behavior is identical to the inline TranscriptsTab pattern that already works.

## Self-Check: PASSED

- `src/lib/recording-ids.ts` exists with all four exports.
- `src/lib/__tests__/recording-ids.test.ts` exists; all 18 tests pass.
- Type-check passes.
- `src/CLAUDE.md` has the pointer.
- No existing call sites modified (that's Plan 30-02).
