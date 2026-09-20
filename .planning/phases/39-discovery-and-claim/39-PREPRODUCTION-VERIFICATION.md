---
phase: 39-discovery-and-claim
plan: "16"
status: stopped
verified_at: 2026-09-20
branch: v2.2-event-resolution
source_head: 5a5739c4f4f43d2473b5ac8ac7730bb4e15dd7ab
origin_main: cf63a53ea12ad9ed1628f43dfa41aa00257732b5
source_fingerprint: sha256:88ec19eab5606ea0fc476e4dfd2384fba94f1b907629c5e09a84b1c1aa25cc6b
---

# Phase 39 Preproduction Verification

## Gate result

**PREPRODUCTION-GATE: STOP**

**CONTROLLED-EMAIL-GATE: STOP**

The committed TEST, database, browser, security, build, catalog, cleanup, and release-isolation gates pass on the fingerprint above. The required real controlled-email round trip could not be started safely because this machine and the dedicated TEST project expose neither a Resend API credential nor an operator-controlled TEST recipient. TEST is configured for simulated provider success. No email was sent, no invitation was left active, and this STOP does not authorize Plan 17 or any production mutation.

### Operator decision — deferred

On 2026-09-20, the operator explicitly chose to defer the controlled-email test and keep the production rollout blocked. Plan 39-16 therefore remains incomplete, Plan 39-17 must not execute, and neither STOP marker may be changed to PASS without a future explicit decision to resume the real controlled-mailbox gate and complete it successfully. This deferral does not waive the gate.

## Immutable release boundary

| Check | Result |
| --- | --- |
| Branch | PASS — exact `v2.2-event-resolution` |
| Reviewed source HEAD | PASS — `5a5739c4f4f43d2473b5ac8ac7730bb4e15dd7ab` |
| Source fingerprint | PASS — `sha256:88ec19eab5606ea0fc476e4dfd2384fba94f1b907629c5e09a84b1c1aa25cc6b` |
| `origin/main` baseline | PASS — unchanged at `cf63a53ea12ad9ed1628f43dfa41aa00257732b5` |
| Production frontend/main | PASS — no push, merge, deployment, or mutation |
| Final workspace | PASS — clean |
| Supabase CLI link | PASS — restored to production ref |

The fingerprint is the SHA-256 of a committed `git archive` containing the app entry/config, package manifests, Playwright coverage, Phase 39 canary, `src`, Edge Functions, and migrations.

## TEST canary and deployed state

| Gate | Result |
| --- | --- |
| Guarded target | PASS — exact dedicated TEST ref; production confirmation path was not used |
| Manifest | PASS — mode `0600`, local temporary path, removed after cleanup |
| Provision | PASS — 3 marked synthetic auth users and one isolated graph |
| Verify | PASS — 12/12 behavior checks |
| Behavior coverage | PASS — non-consuming inspect, different-primary confirmation, caller-scoped discovery/RLS agreement, restricted projection, one claim winner, replay denial, one deduplicated notification, content denial, disconnect, participant preservation |
| Cleanup | PASS — 0 auth users, 0 graph rows, manifest absent |
| TEST migrations | PASS — `20260920000001`, `20260920000002`, `20260920000003` all applied |
| TEST functions | PASS — `share-call` v10, `send-participation-claim` v8, and `participation-claim` v4 ACTIVE |

## Automated matrix

| Command/gate | Result |
| --- | --- |
| Focused Phase 39 real database and canary | PASS — 4 files, 58 tests, 0 failed, 0 skipped |
| `npm test` | PASS — 290 files passed, 1 established integration-gated file skipped; 2,608 tests passed and 45 established gated tests skipped; no required Phase 39 assertion skipped |
| `npm run test:integration` | PASS — 36 files passed, 2 established external-credential suites skipped; 302 tests passed and 19 established gated tests skipped; no required Phase 39 or Phase 38 assertion skipped |
| Phase 38 access plus global RLS | PASS — 2 files, 170 tests, 0 failed, 0 skipped |
| `npm run type-check` | PASS — 0 new errors; registered baseline 300/300 |
| `npm run lint` | PASS — 0 errors; 131 existing warnings |
| `npm run build` | PASS — committed tree built in 7.15 seconds |
| Playwright Phase 39 | PASS — 13/13 tests with one worker and zero retries |
| Repeated token transport probe | PASS — 20/20 repetitions; no raw token in non-navigation URLs, headers, unauthorized bodies, history, storage, console, or DOM |

Playwright covered protected/public routing, password/signup/OAuth claim restoration, intended-account auto-consume, different-primary choices, account switching with an unconsumed claim, retry, terminal/replay/parallel behavior, desktop and mobile Events navigation, Settings count/notification/disconnect, WCAG axe checks, and reduced motion. The run produced the desktop and mobile Events screenshots under the ignored `test-results` directory.

## Privacy and security findings resolved during the gate

1. Same-origin asset requests could receive the claim credential in the referrer. The app and Vercel delivery policy now use `no-referrer`.
2. Sampled Sentry transaction or replay envelopes could observe the initial claim navigation. The credential is now captured and scrubbed before telemetry initializes, with secondary event, transaction, breadcrumb, and replay redaction.
3. Sidebar navigation exposed `listitem` roles without a list parent. The invalid roles were removed and the axe gate passes.
4. Hosted invitation eligibility cases exceeded Vitest's local default timeout. The real-network case now has an explicit 30-second budget.
5. The concurrent invitation test omitted the documented `202 delivery_pending` result. It now validates that outcome while preserving the single-active-invitation and privacy assertions.

No unresolved HIGH security finding remains in the automated matrix.

## Production isolation probe

The production dry run reported exactly these pending additive migrations, in order:

1. `20260920000001`
2. `20260920000002`
3. `20260920000003`

Production has zero deployed Phase 39 functions. No migration, function, frontend, data, email, branch, or deployment mutation was performed.

## Controlled-email automation attempt

| Probe | Result |
| --- | --- |
| Local TEST environment | Resend API credential absent; controlled recipient absent |
| Local production environment | No Resend or controlled-recipient value available to this execution |
| Dedicated TEST project secret inventory | Simulated participation-email success mode present; Resend API credential absent |
| Existing browser provider session | Resend opened at the login screen; no authenticated provider session was available |
| Provider delivery/event API | Not callable without a credential |
| Controlled mailbox | No operator-controlled recipient or authenticated mailbox surface available |
| Real send/open/claim/cancel evidence | Not attempted; unsafe to guess a recipient or borrow production delivery |

The simulated TEST provider behavior remains proven by integration tests, including initial delivery state, optional reminder scheduling, cancellation, replay denial, and cleanup. It does not satisfy the plan's requirement for a real provider delivery and controlled mailbox receipt/open.

## Safe resume condition

Resume Plan 39-16 only after the dedicated TEST path has both:

1. authenticated Resend delivery/event access suitable for TEST; and
2. an explicitly operator-controlled TEST recipient.

Then create one isolated marked invitation, obtain provider delivery evidence, use the human mailbox checkpoint only if API evidence cannot prove receipt/opening, complete the claim/replay/reminder-cancellation assertions, clean all fixtures, and replace both STOP lines with PASS only if every check succeeds on this same source fingerprint.
