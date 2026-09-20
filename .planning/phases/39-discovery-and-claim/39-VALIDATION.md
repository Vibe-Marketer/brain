---
phase: 39
slug: discovery-and-claim
status: draft
nyquist_compliant: false
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

| Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command / Proof | File Exists | Status |
|-------------|------------|-----------------|-----------|---------------------------|-------------|--------|
| DISCO-01 | T-39-01, T-39-02 | Only a confirmed primary email or active verified alias discovers confirmed-participation events; name, org, domain, calendar-only, and disconnected evidence never qualifies | real-DB integration | `VITEST_INTEGRATION_OK=true npx vitest run src/test/discovery-claim.integration.test.ts --maxWorkers=1` | ❌ W0 | ⬜ pending |
| DISCO-01 | T-39-03 | Count, pagination, action-first grouping, newest ordering, future matching, and disconnect revocation are consistent | service, component, integration | `npx vitest run src/services/__tests__/event-discovery.service.test.ts src/components/events --maxWorkers=1` plus focused integration | ❌ W0 | ⬜ pending |
| DISCO-02 | T-39-04, T-39-05 | Only the recording owner can invite the canonical eligible participant; one active invitation, seven-day resend, and optional one-time reminder are enforced server-side | real-DB Edge integration | `VITEST_INTEGRATION_OK=true npx vitest run supabase/functions/send-participation-claim/__tests__/send-participation-claim.integration.test.ts --maxWorkers=1` | ❌ W0 | ⬜ pending |
| DISCO-02 | T-39-06, T-39-07 | Hash-only token consumption is atomic and single-use; replay, parallel consume, expired, revoked, superseded, and email-conflict attempts return generic denial | real-DB Edge integration | `VITEST_INTEGRATION_OK=true npx vitest run supabase/functions/participation-claim/__tests__/participation-claim.integration.test.ts --maxWorkers=1` | ❌ W0 | ⬜ pending |
| DISCO-02 | T-39-08 | Claim survives password login, signup, OAuth/root return, completes automatically, scrubs the token, and opens Events | Playwright E2E | `npx playwright test playwright/discovery-claim.spec.ts --workers=1` | ❌ W0 | ⬜ pending |
| DISCO-03 | T-39-09 | Discovery exposes event existence and request action only; unreadable copies expose no title, owner, provider, transcript, summary, roster, source ID, or content | real-DB and component | Focused discovery integration plus `npx vitest run src/components/events --maxWorkers=1` | ❌ W0 | ⬜ pending |
| DISCO-03 | T-39-10 | Phase 38 webinar, participant-cap, anonymous-response, cooldown, direct-share, and content-RLS guarantees remain intact | regression integration | `VITEST_INTEGRATION_OK=true npx vitest run src/test/access-policy.integration.test.ts src/test/rls-regression.test.ts --maxWorkers=1` | ✅ existing; extend only where needed | ⬜ pending |

---

## Required Behavior Matrices

### Authorization and privacy

- Confirmed primary, active verified alias, disconnected alias, unverified alias, display-name match, organization membership, calendar-only invitee, confirmed speaker, organizer/host, recording owner, and email owned by another account.
- Test caller-scoped discovery RPCs and direct-table RLS separately. Existing organization-scoped People RPC response shapes must remain byte-compatible.
- Test readable and restricted copies, pending/approved/rejected/cooldown requests, webinar events, 49/50/51 confirmed participants, and mixed readable/restricted copies. Assert raw JSON keys and rendered DOM.

### Invitation and claim lifecycle

- First send, duplicate active send, reminder disabled/enabled, cancellation, resend before seven days denied, resend after seven days rotates the token, successful consume, replay, parallel consume, expired, revoked, superseded sibling, different signed-in primary, disconnect, and reconnect.
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
- [ ] `src/components/events/*.test.tsx` — privacy-safe cards, ordering, loading, empty, error, and request states.
- [ ] `src/components/call-detail/CallParticipantsTab.test.tsx` additions — eligibility, owner action, sent date, resend, and reminder state.
- [ ] `src/components/settings/AccountTab.test.tsx` additions — persistent count, View events, and disconnect confirmation/effect.
- [ ] `playwright/discovery-claim.spec.ts` — login, signup, OAuth/root return, automatic completion, URL scrubbing, and Events destination.

Historical `src/test/migrations/phase39-fathom-*` files use an older numbering scheme and are unrelated to this phase.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual hierarchy and responsive behavior | DISCO-01, DISCO-02, DISCO-03 | Screenshot review verifies layout and privacy-safe presentation beyond DOM assertions | Capture desktop and mobile Settings, Events, participant invitation, claim processing, empty/error, and disconnect states and compare with `39-UI-SPEC.md`. |
| Controlled email delivery and cancellation | DISCO-02 | Provider delivery, scheduled reminder, and cancellation require a deployed Resend configuration | On TEST, send to a controlled address, inspect the link without exposing its token, consume it once, verify any scheduled reminder is cancelled, and confirm replay fails generically. |
| Additive production rollout | DISCO-01, DISCO-02, DISCO-03 | Production database/function rollout is a guarded one-time operation | Record source commit and fingerprint, exact target project, pending migrations, TEST proof, production apply/deploy output, post-deploy schema/grant probes, and cleanup. Do not merge or push `main`. |

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

- [ ] Every phase requirement has an automated verification path.
- [ ] Sampling continuity prevents three consecutive tasks without an automated check.
- [ ] Wave 0 identifies every missing test fixture and suite.
- [ ] Commands contain no watch-mode flags.
- [ ] Targeted feedback latency is designed to stay under 60 seconds.
- [ ] `nyquist_compliant: true` is set after plan task IDs are mapped.
- [ ] Wave 0 suites and fixtures exist and pass.
- [ ] Full phase gate passes.

**Approval:** pending plan task mapping and execution.
