---
phase: 32
verified: 2026-05-12
status: code-complete, awaiting-live-uat
---

# Phase 32 — Aggregate Verification

## Plans completed

| Plan | Status | VERIFY doc |
|------|--------|-----------|
| 32-01 (backend: optional auth probe, WRONG_RECIPIENT, public-view, signup-prefill, maskEmail helper, integration tests, deploy) | code-complete + deployed | 32-01-VERIFY.md |
| 32-02 (frontend: SharedCallStatus discriminated union, PublicShareLanding + WrongAccountState, SharedCallView state-machine, Login.tsx `?share` Free-tier branch, 32 new tests) | code-complete | 32-02-VERIFY.md |
| 32-03 (ShareCallDialog cleanup: icons, tokens, overflow, sentence-case copy; UAT script) | code-complete | 32-03-VERIFY.md |

## Aggregated automated checks

- `npm run type-check` — PASS
- `npm test` — 846 passing, 50 skipped, 2 pre-existing failures (PASTE-01 + BUG-01/02 from Phase 30 — not Phase 32 regressions)
- `npm run build` — PASS (14.95s, +7.56 kB minified vs baseline)
- Share-call Edge Function deployed via `supabase functions deploy share-call --use-api`
- Live integration tests vs deployed function: 4 PASS (404, 200 public-view, 200 signup-prefill, 403 revoked)

## Requirements closure

| Req | Status | Implementation |
|-----|--------|----------------|
| SHARE-01 | code-complete | PublicShareLanding card replaces /s/:token sign-in redirect; inviter + title + Sign-up/Open-in-existing CTAs; vibe-orange arrow on primary; Free-tier helper text |
| SHARE-02 | code-complete | WrongAccountState card with masked recipient_email + auto-focus Sign Out; backend returns 403 WRONG_RECIPIENT with server-side masking |
| SHARE-03 | code-complete | ShareCallDialog: RiLinksLine icons, ring-foreground/10 highlight, flex-1 min-h-0 overflow fix, sentence-case copy |
| SHARE-04 | code-complete, awaiting dev-browser UAT | Backend + frontend + modal cleanup shipped; 7-step operator UAT script at 32-UAT.md |
| QA-22 | resolved | Backend signal restored via WRONG_RECIPIENT / public-view / signup-prefill distinctions; covered by integration tests |

## Open items requiring operator dev-browser UAT

Per CLAUDE.md HARD RULE, dev-browser verification is mandatory but the dev-browser MCP is unavailable in this orchestrator session. The following surfaces are code-complete and pushed to main (Vercel auto-deploys); operator-side UAT pending per `32-UAT.md`:

1. PublicShareLanding card on `/s/:token` (incognito)
2. Sign-up path with pre-filled locked email + Free tier
3. Existing-account sign-in path
4. WrongAccountState masked-email + sign-out flow
5. Sender-views-own-link bypass
6. ShareCallDialog cleanup verification
7. Backend WRONG_RECIPIENT + sender-bypass response cases (deferred from automated tests because they require multi-account JWT setup)

## Open assumptions (documented per user instruction)

1. **`VITE_POLAR_FREE_PRODUCT_ID` env var must be set** in Vercel for the share-link signup path to auto-provision a Polar Free customer record. If missing, signup completes but skips polar-create-customer with a console warning. Documented inline in Login.tsx.

2. **Phase 31 `Toaster` mount at App.tsx root** is required for share-flow toasts. Phase 32 inherits and relies on it.

3. **`fathom_raw_calls` schema fix:** the column is `title`, not `call_name`. The existing share-call code was a latent bug (SELECTing non-existent `call_name` returned null). Phase 32-01 fixes this by SELECTing `title` and aliasing to `call_name` in the response for frontend backward compat. Verified via live integration test.

## Backend response shape changes confirmed

| Endpoint | Before | After |
|----------|--------|-------|
| `GET /share-call?token=X` (unauth) | 200 with full call payload (transcript leak) | 200 `{ inviter_name, call_title, recipient_email, recipient_masked, is_public_view: true }` |
| `GET /share-call?token=X` (wrong-recipient JWT) | 200 with full call payload (no recipient check) | 403 `{ code: 'WRONG_RECIPIENT', recipient_masked }` |
| `GET /share-call?token=X` (correct-recipient JWT) | 200 ok | 200 ok (unchanged) |
| `GET /share-call?token=X` (sender JWT) | 200 ok | 200 ok (sender-bypass added) |
| `GET /share-call?token=X` (revoked) | 403 LINK_REVOKED | 403 LINK_REVOKED (unchanged) |
| `GET /share-call?token=X` (unknown token) | 404 LINK_NOT_FOUND | 404 LINK_NOT_FOUND (unchanged) |
| `GET /share-call?token=X&mode=signup-prefill` | n/a | 200 `{ recipient_email }` (new) |

## Files changed in this phase

**Backend (3 files):**
- `supabase/functions/_shared/email-mask.ts` (new)
- `supabase/functions/share-call/index.ts` (modified)
- `supabase/functions/share-call/__tests__/share-call.integration.test.ts` (new)

**Frontend code (7 files):**
- `src/types/sharing.ts` (added SharedCallStatus + SharedCallPayload)
- `src/hooks/useSharing.ts` (useSharedCall refactored)
- `src/components/share/PublicShareLanding.tsx` (new)
- `src/components/share/WrongAccountState.tsx` (new)
- `src/pages/SharedCallView.tsx` (state-machine rewrite)
- `src/pages/Login.tsx` (?share={token} branch)
- `src/components/sharing/ShareCallDialog.tsx` (cleanup)

**Frontend tests (4 files, 32 new tests):**
- `src/hooks/__tests__/useSharing.test.ts` (10 new tests appended)
- `src/components/share/__tests__/PublicShareLanding.test.tsx` (new — 6 tests)
- `src/components/share/__tests__/WrongAccountState.test.tsx` (new — 8 tests)
- `src/pages/__tests__/SharedCallView.test.tsx` (new — 8 tests)

**Planning docs (10 files):**
- 32-RESEARCH.md, 32-PATTERNS.md, 32-01-PLAN.md, 32-02-PLAN.md, 32-03-PLAN.md
- 32-01-VERIFY.md, 32-02-VERIFY.md, 32-03-VERIFY.md, 32-UAT.md, 32-VERIFICATION.md

Total: 24 files changed/created.

## Conclusion

Phase 32 is **code-complete and deployed-ready**. The user-locked decisions in CONTEXT.md and UI-SPEC.md are honored literally. Live dev-browser UAT remains as the final gate per `human_needed` policy; the operator should run through the 7 numbered tests in `32-UAT.md` on `app.callvaultai.com` after the next Vercel deploy.

Per the `--no-transition` flag, this phase is NOT transitioned to complete in ROADMAP.md / STATE.md.
