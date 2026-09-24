# Phase 39 email resumption verification — September 24

**PREPRODUCTION-GATE: STOP**

**CONTROLLED-EMAIL-GATE: STOP**

Email preparation resumed at the operator's request. Plan 16 is incomplete; Plan 17 remains blocked. No production migration/function release, main push, or production frontend deployment occurred during this work.

## Reviewed source and deployment

- Source commit: `77fa7279b945d8a2d375a58a7878771fd8e4f55c`, pushed only to `v2.2-event-resolution`.
- SHA-256: `90538f66e129170edff4b98175d461bc382fdf2d24732dc316f7967ac0c5bb06`.
- Recipe: SHA-256 of `git archive 77fa7279b945d8a2d375a58a7878771fd8e4f55c -- src supabase/functions supabase/migrations scripts playwright index.html package.json package-lock.json vite.config.ts vercel.json playwright.config.ts vitest.config.ts`. This replaces the historical source fingerprint for this verification; documentation-only commits do not change the reviewed application tree.
- origin/main confirmed by fetch and ls-remote: `6bc482c634411240574c2006ba01c19baa999eaf`.
- Vercel Ready Preview: `4wrCGLHTbT8n8qCHiDARP4nzeKcD`, source `77fa727`, URL https://callvault-notasgsdv-ai-simple.vercel.app.
- Stable branch alias: https://callvault-git-v22-event-resolution-ai-simple.vercel.app.
- Vercel production remains listed at `6YyRVZwGbtAHjeXGN4JcWenfLxyD`, source `6bc482c`.

## Changes and observed configuration

- Real TEST invitation delivery now requires a validated server-configured HTTPS origin. Only exact TEST backend accepts the override; production still uses its normal origin. Invalid routing returns generic 503 before invitation writes; cancellation remains available. Focused routing tests: 23/23; independent review found no concrete bugs.
- Five Vercel webhook proxies now require exact production host. Preview falls through to its SPA instead of proxying to production. Schema and host-match checks passed. Routing follows [Vercel host conditions](https://vercel.com/docs/project-configuration/vercel-json#rewrite-has-or-missing-object-definition).
- Saved branch-only Preview overrides: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY point to TEST `swjzxiddcrtaqixsfaac`; production scope explicitly excluded before save.
- Protected alias reaches login in authenticated Vercel Chrome. Unauthenticated HTTP redirects to Vercel sign-in: protection remains enabled.
- Preview Google sign-in visibly targeted TEST hostname, but Chrome showed ERR_BLOCKED_BY_CLIENT. This proves the selected backend destination only, not successful hosted authentication. No browser protection was bypassed. Source-view inspection was rejected by browser policy; verification used normal deployment/login UI instead.
- Preview GET `/api/webhook` served the app/login fallback. Other four routes have the same reviewed host condition but were not individually probed live.
- Resend domains API HTTP 200; `mail.callvaultai.com` verified. Existing credential reused; no new account/domain needed.
- TEST secrets configured: RESEND_API_KEY, RESEND_DOMAIN_VERIFIED, PARTICIPATION_CLAIM_TEST_APP_ORIGIN. Existing simulated participation delivery remains enabled; no real mail sent.
- TEST ALLOWED_ORIGINS preserves defaults and adds exact stable preview origin. Both claim endpoints answered OPTIONS 200 with that exact allow-origin.
- TEST send-participation-claim v10 ACTIVE after deploy; hosted integration exercises it. Other listed TEST versions: participation-claim v5, share-call v11.
- Read-only TEST catalog confirms all three Phase39 migrations, FORCE RLS on both new tables, and no anon/authenticated SELECT privilege on either table. Queried using [Supabase read-only SQL API](https://supabase.com/docs/reference/api/v1-read-only-query).
- Production dry-run exit 0 lists exactly 20260920000001/00002/00003. No apply. CLI link remains production resting ref.

## Verification this session

| Gate | Result |
| --- | --- |
| npm test | Exit 0; 2,631 passed, 45 established skips; 291 passed files, 1 gated file |
| npm run test:integration | Initial exit 1: 285 passed; 3 setup suites hit Supabase Auth rate limit; 19 established skips plus 17 blocked assertions |
| Exact failed-suite retry | Exit 0; recording-access, public-recording, unclaim-organization-domain: 17/17 passed, no skips. Combined coverage 302 passed; initial failed run retained, not relabeled successful |
| npm run type-check | Exit 0; zero new errors, 300 existing baseline |
| npm run lint | Exit 0; zero errors, 131 existing warnings |
| npm run build | Exit 0 on committed source; 17.35 seconds |
| Playwright discovery-claim | Exit 0; 13/13, one worker, zero retries; privacy/axe/mobile included |
| TEST canary | Provision/verify/cleanup exit 0; 12/12 checks; zero auth users and graph rows |
| Failed setup residue | Two exact Phase38 fixtures retained org/workspace/event/identity/alias rows after failed logins. Cleaned only their deterministic IDs after marker/default/membership checks; independent readback zero. No global sweep |

Rate-limit failures did not justify weakening assertions or production settings. Test-generated deno.lock changes were inspected and restored. Logs and private operator harness reside at `/tmp/callvault-phase39-sept24`; no tokens, recipients, or row payloads are copied into planning evidence.

## Remaining before PASS

1. Confirm saved-login address as controlled recipient (question pending in thread); no address has been sent to the provider for this test.
2. Review private controlled-email harness, confirm isolated hosted email/password sign-in, then create one synthetic TEST invitation. Never use production/customer rows.
3. Temporarily enable real TEST participation delivery only during this proof; restore simulated mode afterward. Prove real delivery and opening, nonconsuming inspection/account switching, explicit claim, reminder cancellation, generic replay, content denial, Events behavior, and zero residue.
4. Complete any required refreshed privacy/catalog checks and record actual source-bound email results. Only then may both gates become PASS and Plan 17 begin. No phase completion summary created.

Historical backfill remains separate Phase40 work. Read-only Clickable Impact inventory is recorded in `40-PILOT-INVENTORY.md`; no historical writes occurred.

## Controlled delivery checkpoint — September 24, 07:07 UTC

Operator explicitly supplied and confirmed their controlled recipient in the thread. The private harness was changed to use that exact address rather than assuming the saved-login value. No recipient, token, or provider ID is retained in this artifact.

- Source paths match reviewed77fa727 with no application drift.
- Provisioned one isolated TEST graph with three synthetic users, after exact target guard. Recipient preflight found no conflicting TEST aliases, invitations, or participants.
- Temporarily enabled real TEST participation delivery, invoked the deployed send handler once, and restored simulated success mode in a finally block.
- Real initial and scheduled reminder accepted. Retrieved message from Resend API; exact recipient, TEST preview origin, privacy-safe body and database token hash checked in-process. Token retained only in0600 private state.
- Resend delivery event: **delivered**, created2026-09-24 07:07:31.850000+00, observed2026-09-24T07:07:49.701Z.
- Authenticated inspect with two different synthetic accounts and return to first: PASS; invitation unchanged and confirmation required. This proves API account switching only, not live browser UI.
- Canceled the real scheduled reminder through the owner endpoint before waiting for mailbox opening. Resend status **canceled** verified. TEST simulation restored. No follow-up reminder remains scheduled.
- Human prompt pending: open the delivered invitation and click its button; stop at login, never share the link/token.
- The invitation is deliberately still unconsumed. Three marked synthetic users and their exact graph remain active for the checkpoint, with private recovery manifest `/tmp/callvault-phase39-sept24/manifest.json` and token state `email-state.json`. Previous zero-residue evidence belongs to earlier completed tests; final cleanup of this current fixture has NOT occurred.
- Both gates remain STOP: actual mailbox opening, live login/claim UI, consume/replay/content denial and final cleanup still required. No production or main release.

If work is abandoned, run the reviewed exact-fixture cleanup action; never global-sweep TEST. The reminder is already canceled. Do not resend without need: initial delivery is proven.
