---
plan: 32-03
status: code-complete
verified: 2026-05-12
---

# Phase 32-03 — ShareCallDialog Cleanup + E2E UAT: VERIFY

## Acceptance Criteria

| Task | Criterion | Status |
|------|-----------|--------|
| T1 | `RiLinkM` removed (0 matches) | PASS |
| T1 | `RiLinksLine` present (4 matches: import + 3 usages) | PASS |
| T2 | `border-green-500`, `bg-green-500`, `text-green-600`, `text-green-500` all 0 matches | PASS |
| T2 | `ring-foreground/10` present (1 match) | PASS |
| T3 | `max-h-[calc(100vh-8rem)]` present (1 match) | PASS |
| T3 | `flex-1 min-h-0` present (3 matches) | PASS |
| T3 | `max-h-48` removed (0 matches) | PASS |
| T4 | Old copy strings (`Create New Share Link`, `Recipient email (optional)`, `Active Share Links`, `Revoked links will no longer work`, `CREATE`, `CLOSE`) all 0 matches | PASS |
| T4 | New copy strings (`Create link`, `Add recipient`, `Active share links`, `Add a recipient above to create one`, `Revoked links stop working immediately`, `Close`) all present | PASS |
| T5 | `npm run type-check` exits 0 | PASS |
| T5 | `npm run build` exits 0 | PASS |
| T5 | Phase 32 tests all pass (36 new automated tests) | PASS |
| T5 | No new test failures introduced by Phase 32 | PASS |
| T6 | `32-UAT.md` exists with 7-step end-to-end script | PASS |

## Pre-existing Test Failures (NOT Phase 32 regressions)

| Test File | Issue | Phase Origin |
|-----------|-------|--------------|
| `supabase/functions/save-pasted-transcript/__tests__/save-pasted-transcript.test.ts` | PASTE-01 setup issue (auth/workspace gates) | Pre-existing |
| `supabase/functions/auto-tag-calls/__tests__/auto-tag-calls.integration.test.ts` | BUG-01 fixture cleanup (Phase 30 known) | Pre-existing per Phase 31 VERIFICATION |
| `src/services/__tests__/setDefaultWorkspace.integration.test.ts` | BUG-02 atomic toggle (Phase 30 known) | Pre-existing |
| `src/components/import/__tests__/PasteTranscriptModal.test.tsx` | Vite transform error | Pre-existing |

## Phase 32 Test Pass Summary

```
✓ supabase/functions/share-call/__tests__/share-call.integration.test.ts (4 tests)
✓ src/hooks/__tests__/useSharing.test.ts (10 new Phase 32 tests)
✓ src/components/share/__tests__/PublicShareLanding.test.tsx (6 tests)
✓ src/components/share/__tests__/WrongAccountState.test.tsx (8 tests)
✓ src/pages/__tests__/SharedCallView.test.tsx (8 tests)
```

## Build Output

```
✓ built in 14.95s
dist/assets/index-B--SXbXd.js  3,320.52 kB │ gzip: 948.96 kB
```

## Conclusion

Plan 32-03 is code-complete. ShareCallDialog cleanup applied per UI-SPEC; SHARE-03 covered; SHARE-04 deferred to operator dev-browser UAT per the 32-UAT.md script.
