---
plan: 32-02
status: code-complete
verified: 2026-05-12
---

# Phase 32-02 — Frontend Public Landing + State Machine: VERIFY

## Acceptance Criteria

| Task | Criterion | Status |
|------|-----------|--------|
| T1 | `SharedCallStatus` discriminated union exported from `src/types/sharing.ts` with 7 variants | PASS |
| T2 | `useSharedCall` returns `{ data: SharedCallStatus; refetch }`, no-op `logAccess` removed, optional Authorization header attached when session present | PASS |
| T3 | `src/components/share/PublicShareLanding.tsx` created with locked copy, vibe-orange arrow, motion fade-in | PASS |
| T4 | `src/components/share/WrongAccountState.tsx` created with masked-email body, auto-focus on Sign out, loading-state disabling | PASS |
| T5 | `src/pages/SharedCallView.tsx` rewritten as state machine — no `navigate('/login')` redirect, sanitized v1 tokens, locked error copy | PASS |
| T6 | `src/pages/Login.tsx` extended with `?share={token}` branch — pre-filled locked email, Free tier path, polar-create-customer wiring | PASS |
| T7 | 10 new tests for `useSharedCall` discriminated union mapping — all pass | PASS |
| T8 | 6 + 8 tests for PublicShareLanding + WrongAccountState — all pass | PASS |
| T9 | 8 tests for SharedCallView state machine — all pass | PASS |
| All | `npm run type-check` exits 0 | PASS |
| All | `npm run build` exits 0 | PASS |

## Test Output

```
✓ src/hooks/__tests__/useSharing.test.ts (26 tests | 5 skipped) 895ms
   ✓ Phase 32 discriminated union: 10 new tests pass
✓ src/components/share/__tests__/PublicShareLanding.test.tsx (6 tests) 171ms
✓ src/components/share/__tests__/WrongAccountState.test.tsx (8 tests) 176ms
✓ src/pages/__tests__/SharedCallView.test.tsx (8 tests) 146ms
```

## Build Output

```
✓ built in 14.00s
dist/assets/index-B4s64Qfy.js  3,312.96 kB │ gzip: 946.82 kB
```

No new bundle warnings introduced by Phase 32.

## Files Modified

- `src/types/sharing.ts` — added `SharedCallStatus` discriminated union + `SharedCallPayload`
- `src/hooks/useSharing.ts` — refactored `useSharedCall` to return discriminated union
- `src/components/share/PublicShareLanding.tsx` (new) — public landing card
- `src/components/share/WrongAccountState.tsx` (new) — wrong-account state card
- `src/pages/SharedCallView.tsx` — state-machine rewrite, no /login redirect
- `src/pages/Login.tsx` — `?share={token}` signup branch with locked email + Free tier
- `src/hooks/__tests__/useSharing.test.ts` — 10 new tests for discriminated union
- `src/components/share/__tests__/PublicShareLanding.test.tsx` (new)
- `src/components/share/__tests__/WrongAccountState.test.tsx` (new)
- `src/pages/__tests__/SharedCallView.test.tsx` (new)

## Open Items Requiring Live UAT (SHARE-04)

Per CLAUDE.md HARD RULE, dev-browser verification is mandatory but the dev-browser MCP is unavailable in this orchestrator session. The full Phase 32 surface (public landing, wrong-account, free-tier signup, ShareCallDialog cleanup) is verified by automated tests and ready for operator dev-browser UAT on `app.callvaultai.com` after the next Vercel deploy. The 6-step UAT script is captured in Plan 32-03's `32-UAT.md` file.

## Open Assumption

The Phase 32 share-link signup path expects `VITE_POLAR_FREE_PRODUCT_ID` to be set in `.env.local` and on Vercel. When the env var is missing at runtime, the share-link signup still completes (auth.signUp succeeds) but skips the `polar-create-customer` call and logs a console warning — degrades gracefully rather than blocking. Documented in the Login.tsx inline comment.

## Conclusion

Plan 32-02 is code-complete and verified by 32 new automated tests (10 hook + 14 component + 8 state machine). The auto-redirect to `/login` is removed; recipients now see the Loom-style public landing first. SHARE-01 and SHARE-02 covered.
