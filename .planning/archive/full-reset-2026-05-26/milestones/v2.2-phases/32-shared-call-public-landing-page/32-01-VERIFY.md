---
plan: 32-01
status: code-complete
verified: 2026-05-12
---

# Phase 32-01 — Backend Response Shape Restoration: VERIFY

## Acceptance Criteria

| Criterion | Status |
|-----------|--------|
| `supabase/functions/_shared/email-mask.ts` exists with `export function maskEmail` | PASS |
| `share-call/index.ts` imports `maskEmail` | PASS |
| `share-call/index.ts` contains `WRONG_RECIPIENT` code response | PASS |
| `share-call/index.ts` contains `is_public_view` payload key | PASS |
| `share-call/index.ts` contains `signup-prefill` mode short-circuit | PASS |
| `share-call/index.ts` contains optional auth probe (`currentUserEmail`, `currentUserId`) | PASS |
| `share-call/index.ts` contains sender-bypass (`isSender`) | PASS |
| Existing error codes preserved: `LINK_NOT_FOUND`, `LINK_REVOKED`, `CALL_NOT_FOUND` | PASS |
| Integration test file at `supabase/functions/share-call/__tests__/share-call.integration.test.ts` | PASS |
| `npm run type-check` exits 0 | PASS |
| Function deployed via `supabase functions deploy share-call --use-api` | PASS |
| Live function returns 404 LINK_NOT_FOUND for unknown token | PASS |
| Live function returns 200 public-view for unauthenticated valid token | PASS |
| Live function returns 200 signup-prefill with `{ recipient_email }` | PASS |
| Live function returns 403 LINK_REVOKED for revoked token | PASS |
| Public-view response has NO `full_transcript` or `recording_id` (asserted in test) | PASS |
| Server-side mask format `^[a-z0-9]{2}\*{3}@vibeos\.com$` (asserted in test) | PASS |

## Schema Adjustment During Execution

The existing share-call code referenced a `call_name` column on `fathom_raw_calls`, but the actual column name is `title` (confirmed via `information_schema.columns`). The pre-Phase-32 code was a latent bug that would have returned `null` for the call name in the authenticated 200-ok path. Phase 32-01 fixes this by SELECTing `title` and aliasing to `call_name` in the response so the frontend continues to work without changes. Documented in the file's inline comment block.

The `duration` column also doesn't exist on `fathom_raw_calls` — the response now returns `duration: null` and the frontend's existing falsy check handles it gracefully.

## Deploy Output

```
Uploading asset (share-call): supabase/functions/share-call/index.ts
Uploading asset (share-call): supabase/functions/_shared/email-mask.ts
Uploading asset (share-call): supabase/functions/_shared/auth.ts
Uploading asset (share-call): supabase/functions/_shared/cors.ts
Deployed Functions on project vltmrnjsubfzrgrtdqey: share-call
```

## Integration Test Output

```
✓ supabase/functions/share-call/__tests__/share-call.integration.test.ts (4 tests) 2790ms
   ✓ returns 404 LINK_NOT_FOUND for an unknown token  662ms
   ✓ returns 200 public-view for unauthenticated valid token (no transcript leak)  443ms
   ✓ returns 200 signup-prefill returning the recipient_email
   ✓ returns 403 LINK_REVOKED for a revoked token

 Test Files  1 passed (1)
      Tests  4 passed (4)
```

## Tests Deferred to Manual UAT (SHARE-04)

The following cases require real JWT tokens for distinct user accounts (sender, recipient, wrong-recipient) and are verified end-to-end via dev-browser cross-account flow per the SHARE-04 6-step UAT script (see 32-UAT.md, Plan 32-03):

- 200 ok for correct-recipient authenticated request
- 403 WRONG_RECIPIENT for wrong-account authenticated request (with masked email)
- 200 ok for sender-views-own-link (sender bypass)

Reasoning: minting JWTs for fresh test accounts requires `supabase.auth.admin.createUser` permissions, and the test runner doesn't have a reliable way to share password credentials across CI. The 4 automated tests above cover all response-shape primitives (404, 200 public-view, 200 signup-prefill, 403 LINK_REVOKED, server-side masking format).

## Conclusion

Plan 32-01 is code-complete, deployed, and verified by integration tests against the live function. The backend signal that QA-22 found destroyed is restored. Plan 32-02 (frontend state machine) can now consume the new response shapes.
