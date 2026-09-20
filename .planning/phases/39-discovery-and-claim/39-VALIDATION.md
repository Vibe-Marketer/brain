---
phase: 39
slug: discovery-and-claim
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-20
---

# Phase 39 — Validation Strategy

> Per-phase validation contract for verified-email event discovery, participation invitations, secure claims, and future-match notifications. Database integration tests use the dedicated TEST Supabase project and must reject production ref `vltmrnjsubfzrgrtdqey`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.16 for unit, component, and real-database integration; Playwright 1.57.0 for browser flows |
| **Config files** | `vite.config.ts`, `playwright.config.ts`, `src/test/setup.ts` |
| **Quick run command** | `npx vitest run <changed-test-files> --maxWorkers=1` |
| **Full suite command** | `npm test && npm run test:integration && npm run type-check && npm run lint && npm run build` |
| **Browser command** | `npx playwright test playwright/discovery-claim.spec.ts --workers=1` |
| **Estimated runtime** | Targeted checks under 60 seconds; full database and browser gates run at wave boundaries |

---

## Sampling Rate

- **After every database or Edge task:** Run its focused real-database integration file with `VITEST_INTEGRATION_OK=true` and one worker.
- **After every service, hook, or component task:** Run the changed Vitest files with one worker.
- **After every plan wave:** Run `npm test`, focused Phase 39 integration tests, Phase 38 access regressions, and `src/test/rls-regression.test.ts`.
- **Before `$gsd-verify-work`:** Run the full unit and integration suites, type-check, lint, build, focused Playwright claim flow, TEST deployed-function probes, and a controlled invitation email round trip.
- **Max feedback latency:** 60 seconds for targeted checks; longer real-database and browser suites are wave gates.

---

## Per-Requirement Verification Map

| Requirement | Plan / Task | Threat Ref | Secure Behavior | Test Type | Automated Command / Proof | File Exists | Execution Status |
|-------------|-------------|------------|-----------------|-----------|---------------------------|-------------|------------------|
| DISCO-01 | 39-01 T1, 39-01 T2, 39-01 T3, 39-04 T1, 39-04 T2, 39-08 T1, 39-08 T2, 39-08 T3 | T-39-01, T-39-04, T-39-08 | Only confirmed primary or active verified alias evidence discovers confirmed-participation events; direct RLS and caller RPCs agree; name/org/domain/calendar/disconnected evidence never qualifies | real-DB integration | `VITEST_INTEGRATION_OK=true npx vitest run src/test/discovery-claim.integration.test.ts src/test/rls-regression.test.ts --maxWorkers=1 --reporter=verbose` | ❌ Wave 0 | ⬜ pending execution |
| DISCO-01 | 39-03 T1, 39-03 T2, 39-09 T1, 39-09 T2, 39-09 T3, 39-10 T1, 39-10 T2 | T-39-03, T-39-09, T-39-10 | Count, bounded pagination, action-first grouping, newest ordering, restricted projection, and cache invalidation are consistent | unit/component | `npx vitest run src/services/__tests__/event-discovery.service.test.ts src/hooks/__tests__/useEventDiscovery.test.ts src/pages/__tests__/Events.test.tsx --maxWorkers=1 --reporter=verbose` | ❌ Wave 0 | ⬜ pending execution |
| DISCO-01, DISCO-03 | 39-04 T2, 39-06 T1, 39-06 T2, 39-09 T2, 39-09 T3, 39-11 T1, 39-11 T2, 39-15 T1, 39-15 T2 | T-39-04, T-39-06, T-39-09, T-39-11, T-39-15 | Caller-pull notification sync is ledger-idempotent, historical baseline is silent, future events notify once, and disconnect revokes discovery/notification eligibility | real-DB + component | `VITEST_INTEGRATION_OK=true npx vitest run src/test/discovery-claim.integration.test.ts --maxWorkers=1 --reporter=verbose && npx vitest run src/components/settings/__tests__/AccountTab.discovery.test.tsx src/components/notifications/__tests__/NotificationBell.test.tsx --maxWorkers=1 --reporter=verbose` | ❌ Wave 0 | ⬜ pending execution |
| DISCO-02 | 39-02 T1, 39-05 T1, 39-07 T1, 39-12 T1, 39-12 T2 | T-39-02, T-39-05, T-39-07, T-39-12 | Only the recording owner can invite one canonical eligible participant; seven-day resend and optional single reminder are server-enforced | real-DB Edge + component | `VITEST_INTEGRATION_OK=true npx vitest run supabase/functions/send-participation-claim/__tests__/send-participation-claim.integration.test.ts --maxWorkers=1 --reporter=verbose && npx vitest run src/components/call-detail/__tests__/CallParticipantsTab.claim-invite.test.tsx --maxWorkers=1 --reporter=verbose` | ❌ Wave 0 | ⬜ pending execution |
| DISCO-02 | 39-02 T2, 39-05 T2, 39-07 T2 | T-39-02, T-39-05, T-39-07 | `inspect` is authenticated and non-consuming; `consume` is hash-only, atomic, single-use, replay/race safe, generic on terminal/conflict, and requires explicit different-primary confirmation | real-DB Edge integration | `VITEST_INTEGRATION_OK=true npx vitest run supabase/functions/participation-claim/__tests__/participation-claim.integration.test.ts --maxWorkers=1 --reporter=verbose` | ❌ Wave 0 | ⬜ pending execution |
| DISCO-02 | 39-03 T1, 39-03 T3, 39-09 T1, 39-09 T2, 39-09 T3, 39-13 T1, 39-13 T2 | T-39-03, T-39-09, T-39-13 | Service/hook/UI contract exposes only masked email plus confirmation flag; exact different-account choices control confirmed consume; Use another account preserves an unconsumed token | unit/component | `npx vitest run src/services/__tests__/event-discovery.service.test.ts src/hooks/__tests__/useEventDiscovery.test.ts src/pages/__tests__/ParticipationClaim.test.tsx src/pages/__tests__/OAuthCallback.participation-claim.test.tsx --maxWorkers=1 --reporter=verbose` | ❌ Wave 0 | ⬜ pending execution |
| DISCO-02 | 39-03 T3, 39-13 T2, 39-14 T1 | T-39-03, T-39-13, T-39-14 | Claim survives password, signup, OAuth callback/root, and Use another account; URL/token is scrubbed; intended or confirmed paths open Events | unit + Playwright E2E | `npx vitest run src/pages/__tests__/OAuthCallback.participation-claim.test.tsx --maxWorkers=1 --reporter=verbose && npx playwright test playwright/discovery-claim.spec.ts --workers=1` | ❌ Wave 0 | ⬜ pending execution |
| DISCO-03 | 39-01 T2, 39-01 T3, 39-04 T1, 39-09 T1, 39-09 T2, 39-10 T1 | T-39-01, T-39-04, T-39-09, T-39-10 | Discovery exposes event existence/action only; unreadable copies carry no title, owner, provider, transcript, summary, roster, source ID, or content | real-DB + parser/component | `VITEST_INTEGRATION_OK=true npx vitest run src/test/discovery-claim.integration.test.ts --maxWorkers=1 --reporter=verbose && npx vitest run src/services/__tests__/event-discovery.service.test.ts src/pages/__tests__/Events.test.tsx --maxWorkers=1 --reporter=verbose` | ❌ Wave 0 | ⬜ pending execution |
| DISCO-03 | 39-08 T2, 39-16 T1, 39-16 T2 | T-39-08, T-39-16 | Phase 38 webinar, participant-cap, anonymous-response, cooldown, direct-share, and content-RLS guarantees remain intact on real TEST database | regression integration | `VITEST_INTEGRATION_OK=true npx vitest run src/test/access-policy.integration.test.ts src/test/rls-regression.test.ts --maxWorkers=1 --reporter=verbose` | ✅ existing; extend where planned | ⬜ pending execution |
| DISCO-01, DISCO-02, DISCO-03 | 39-08 T1, 39-08 T2, 39-08 T3, 39-16 T1, 39-16 T2, 39-16 T3, 39-17 T1, 39-17 T2, 39-17 T3 | T-39-08, T-39-16, T-39-17 | Exact additive schema/function sequence passes TEST before guarded production server rollout; main/frontend remain unchanged | rollout evidence | `npm test && npm run test:integration && npm run type-check && npm run lint && npm run build && npx playwright test playwright/discovery-claim.spec.ts --workers=1` plus fingerprint/ref/introspection probes specified in Plans 08/16/17 | planned artifacts | ⬜ pending execution |

---

## Required Behavior Matrices

### Authorization and privacy

- Confirmed primary, active verified alias, disconnected alias, unverified alias, display-name match, organization membership, calendar-only invitee, confirmed speaker, organizer/host, recording owner, and email owned by another account.
- Test caller-scoped discovery RPCs and direct-table RLS separately. Existing organization-scoped People RPC response shapes must remain byte-compatible.
- Test readable and restricted copies, pending/approved/rejected/cooldown requests, webinar events, 49/50/51 confirmed participants, and mixed readable/restricted copies. Assert raw JSON keys and rendered DOM.

### Invitation and claim lifecycle

- First send, duplicate active send, reminder disabled/enabled, cancellation, resend before seven days denied, resend after seven days rotates the token, repeated/parallel non-consuming inspect, intended-account auto-consume, different-primary confirmation-required inspect, Add email and continue atomic consume, Use another account unconsumed preservation through auth, replay, parallel consume, expired, revoked, superseded sibling, disconnect, and reconnect.
- Assert high-entropy tokens are stored only as hashes, never logged, removed from the browser URL immediately, and never included in analytics or durable browser storage.

### Future discovery and notification

- Activation silently seeds historical events; one new matching event creates one in-app notification; repeated sync and another copy of the same event create none.
- Disconnect prevents future discovery and notifications, immediately removes derived visibility, and never deletes or rewrites participant records.
- Reconnect resumes future matching without replaying previously ledgered notifications.

---

## Wave 0 Requirements

- [ ] `src/test/discovery-claim.integration.test.ts` — shared DISCO-01/DISCO-03 real-database fixtures, privacy matrix, disconnect, and legacy RPC regression.
- [ ] `supabase/functions/send-participation-claim/__tests__/send-participation-claim.integration.test.ts` — owner authorization and invitation lifecycle.
- [ ] `supabase/functions/participation-claim/__tests__/participation-claim.integration.test.ts` — token, alias ownership, atomicity, and generic failure behavior.
- [ ] `src/services/__tests__/event-discovery.service.test.ts` — response parsing, pagination, ordering, and failure mapping.
- [ ] `src/hooks/__tests__/useEventDiscovery.test.ts` — inspect/consume contract, mutation serialization, and full onSettled invalidation.
- [ ] `src/pages/__tests__/Events.test.tsx` — privacy-safe cards, ordering, loading, empty, error, pagination, and request states.
- [ ] `src/components/call-detail/__tests__/CallParticipantsTab.claim-invite.test.tsx` — eligibility, owner action, sent date, resend, and reminder state.
- [ ] `src/components/settings/__tests__/AccountTab.discovery.test.tsx` — persistent count, View events, and disconnect confirmation/effect.
- [ ] `src/pages/__tests__/ParticipationClaim.test.tsx` — non-consuming inspect, exact different-account choices, confirmed consume, generic failures, and token scrubbing.
- [ ] `src/pages/__tests__/OAuthCallback.participation-claim.test.tsx` — direct OAuth callback/root pending-claim restoration without token propagation or duplicate consume.
- [ ] `src/components/notifications/__tests__/NotificationBell.test.tsx` — safe notification metadata, dedupe, and Events navigation.
- [ ] `playwright/discovery-claim.spec.ts` — login, signup, OAuth/root return, automatic completion, URL scrubbing, and Events destination.

Historical `src/test/migrations/phase39-fathom-*` files use an older numbering scheme and are unrelated to this phase.

---

## Controlled Verification Gates

| Behavior | Requirement | Why Controlled | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual hierarchy and responsive behavior | DISCO-01, DISCO-02, DISCO-03 | Screenshot review verifies layout and privacy-safe presentation beyond DOM assertions | Capture desktop and mobile Settings, Events, participant invitation, claim processing, empty/error, and disconnect states and compare with `39-UI-SPEC.md`. |
| Controlled email delivery and cancellation | DISCO-02 | 39-16 T2 automated Resend/API evidence runs first; 39-16 T3 is conditional only if no controlled mailbox API can prove receipt/opening | On TEST only, open the operator-controlled invitation without exposing its token, prove inspect is non-consuming, complete the intended or explicitly confirmed path once, verify reminder cancellation, and confirm generic replay. This never authorizes production/customer-recipient mail. |
| Additive production rollout | DISCO-01, DISCO-02, DISCO-03 | 39-17 T1-T3 is a guarded one-time server operation after 39-16 PASS | Record source commit/fingerprint, exact target ref, pending migrations, TEST proof, production apply/deploy output, post-deploy schema/grant probes, canary cleanup, and unchanged `main`. |

---

## Security and Release Gates

- SECURITY DEFINER functions use `search_path=''`, fully qualified objects, explicit revoke/grant, bounded pagination, and authenticated caller identity derived from JWT.
- Invitation endpoints derive recording owner, participant, and recipient email from authoritative rows; they never trust caller-supplied user IDs or email addresses.
- Direct `events` RLS and caller-scoped RPCs agree; neither leaks restricted fields, counts, or roster information.
- Notification ledger uniqueness prevents duplicate future-event notifications and historical floods.
- Integration tests use real TEST Supabase and fail closed if credentials point to production. No Supabase mocks.
- Every migration is additive, applies to TEST first, and includes post-apply RLS, function grant, index, and constraint introspection.
- Frontend remains on `v2.2-event-resolution`; production frontend is unchanged until the deliberate milestone merge to `main`.

---

## Validation Sign-Off

- [x] Every phase requirement has an automated verification path mapped to exact plan/task IDs.
- [x] Every implementation task has an `<automated>` command; no three consecutive tasks rely on manual proof.
- [x] Wave 0 identifies every missing fixture/suite at the exact planned path.
- [x] Commands contain no watch-mode flags.
- [x] Targeted feedback latency is designed to stay under 60 seconds; full integration/browser runs are explicit wave gates.
- [x] Planning is Nyquist compliant (`nyquist_compliant: true`).
- [ ] Wave 0 suites and fixtures exist and pass.
- [ ] Full phase gate passes.

**Planning approval:** complete. **Execution approval:** pending Wave 0 creation, real TEST runs, browser proof, and the full preproduction gate; `wave_0_complete` remains `false` until those suites exist and pass.
