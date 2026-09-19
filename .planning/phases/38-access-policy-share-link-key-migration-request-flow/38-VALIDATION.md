---
phase: 38
slug: access-policy-share-link-key-migration-request-flow
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-19
---

# Phase 38 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. All database integration tests use the dedicated test Supabase project with a hard rejection of production ref `vltmrnjsubfzrgrtdqey`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.16; Playwright 1.57.0; real Supabase integration tests |
| **Config file** | `vitest.config.ts`, `playwright.config.ts` |
| **Quick run command** | Unit/component: `npm test -- <target-test-files>`; real-DB integration: `npm run test:integration` (repository-supported serial runner) |
| **Full suite command** | `npm test && npm run test:integration && npm run type-check && npm run lint && npm run build` |
| **Browser command** | `npm run test:e2e -- <phase-38-spec>` |
| **Estimated runtime** | Targeted checks under 60 seconds; full gate varies with real database and browser suites |

---

## Sampling Rate

- **After every database task:** Run the migration static check and `npm run test:integration`; the package script intentionally owns integration discovery and serial execution.
- **After every service or hook task:** Run the targeted Vitest file.
- **After every UI task:** Run its targeted component test and focused Playwright state when applicable.
- **After every plan wave:** Run `npm run type-check` plus `npm run test:integration` for backend/database waves.
- **Before `$gsd-verify-work`:** Run the full unit and integration suites, type-check, lint, build, Phase 38 Playwright suite, migration introspection, and production-safe probes.
- **Max feedback latency:** 60 seconds for a targeted check; long real-database and browser gates run at wave boundaries.

---

## Per-Requirement Verification Map

| Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command / Proof | File Exists | Status |
|-------------|------------|-----------------|-----------|---------------------------|-------------|--------|
| ACCESS-01 | T-38-01 | Owner-only six-level policy; account default snapshots only future recordings | real-DB integration + unit | Targeted access-policy integration and component suites | ❌ W0 | ⬜ pending |
| ACCESS-02 | T-38-02 | Confirmed participants receive event-safe existence metadata only | real-DB RPC integration | Targeted discovery RPC suite | ❌ W0 | ⬜ pending |
| ACCESS-03 | T-38-02 | Event membership alone never returns recording content | RLS regression + integration | `npm run test:integration` plus targeted RLS cases | Extend existing | ⬜ pending |
| ACCESS-04 | T-38-03 | Anonymous rows contain no owner, provider, title, transcript, summary, or source identifier | RPC integration + Playwright | Discovery payload and DOM/accessibility-tree assertions | ❌ W0 | ⬜ pending |
| ACCESS-05 | T-38-04 | Request, notice, approval, denial, cooldown, revoke, and audit are owner-controlled and idempotent | real-DB lifecycle + Edge + browser | Targeted lifecycle, notification, and deep-link suites | ❌ W0 | ⬜ pending |
| ACCESS-06 | T-38-05 | Copy-only notice, inherited/custom state, reset, and Public confirmation match the UI contract | unit + Playwright | Desktop and mobile Phase 38 UI spec | ❌ W0 | ⬜ pending |
| ACCESS-07 | T-38-06 | Existing token remains valid; UUID-only recordings can create and revoke links | migration + Edge + MCP integration | Extend share-call and MCP suites | Extend existing | ⬜ pending |
| ACCESS-08 | T-38-07 | Team, coach, owner, admin, and share-token paths retain current outcomes | authorization matrix | Dedicated real-DB RLS/integration matrix | Extend existing | ⬜ pending |
| ACCESS-09 | T-38-08 | Invitee/org-only denied; any authoritative Zoom 5/6/9 signal and 50+ confirmed identities denied; unknown/malformed/non-Zoom evidence is neutral; unknown-only and non-webinar+unknown may pass for a verified confirmed participant under 50; direct share remains valid | RPC/RLS integration | Complete provider classification, positive-signal aggregation, participation, and cutoff matrix via `npm run test:integration` | ❌ W0 | ⬜ pending |
| EVT-06 | T-38-09 | All current copy/routing functions preserve exact `event_id` without coupling copy policies | real-DB integration | Extend data-movement dedup suite | Extend existing | ⬜ pending |

---

## Wave 0 Requirements

- [ ] Remove every integration-test fallback from test Supabase variables to production variables.
- [ ] Centralize an integration guard that rejects missing test credentials and production ref `vltmrnjsubfzrgrtdqey` before creating a client.
- [ ] Add deterministic event, recording, verified identity, participant, policy, request, grant, audit, and legacy share-link fixtures.
- [ ] Add a real `src/test/phase38-fixtures.integration.test.ts` smoke suite that executes two create/cleanup cycles against the dedicated test project and proves zero residue after each.
- [ ] Add checked-in provider fixtures for Zoom 1/2/3/4/5/6/7/8/9/99, null, malformed, and unknown future values; every other supported provider and internal source; explicit-webinar-wins and neutral-unknown aggregation; and independent 49/50 cases.
- [ ] Add access-policy trigger/RPC real-database integration coverage.
- [ ] Add discovery privacy, exact provider tri-state/positive-webinar aggregation, neutral-unknown passage, verified-participant denials, and independent 49/50 cutoff real-database integration coverage.
- [ ] Add request/grant/audit/notification lifecycle integration coverage.
- [ ] Extend share-call and MCP tests for the UUID bridge, legacy tokens, and UUID-only non-Fathom recordings.
- [ ] Extend `src/test/rls-regression.test.ts` for every new table and existing access route.
- [ ] Add migration-shape tests proving all three copy/routing signatures preserve `event_id` and the legacy share key remains during the bridge.
- [ ] Add Settings, Access panel, anonymous discovery row, request review, and Public-confirmation component tests.
- [ ] Add Phase 38 Playwright desktop, mobile, and authenticated deep-link coverage.

---

## Required Behavior Matrices

### Authorization and privacy

- Test owner, unrelated user, organization member, organization admin, workspace/team member, coach, verified confirmed attendee, invitee-only user, active-grant user, revoked-grant user, token recipient, and anonymous identities across all six policy values.
- Prove team, coach, and token access still works when a recording policy is Private.
- Prove event membership and discovery eligibility never grant transcript, summary, media, or recording-content access by themselves.
- Prove direct clients cannot forge requests, grants, audit entries, or notifications.

### Migration and compatibility

- Create a legacy-only share row before migration and confirm the same row ID, token, status, recipient, and access logs remain after UUID backfill.
- Leave ambiguous or unmapped rows unresolved and reported; never select an arbitrary recording.
- Verify the old `/s/<token>` route before and after migration and exercise a UUID-only non-Fathom recording.
- Assert table types, constraints, indexes, RLS flags and policies, security-definer search paths, and function grants after applying migrations to the dedicated test project.

### Lifecycle and edge cases

- Exercise all recording insert paths so the database trigger proves account-default snapshot behavior independent of the caller.
- Exercise request retries, concurrent owner decisions, email failure with retryable delivery, approval, denial, exact 30-day cooldown, revocation, and immutable audit history.
- Classify Zoom 5/6/9 as `webinar`, Zoom 1/2/3/4/7/8/99 as `non_webinar`, and null/non-integer/unrecognized Zoom plus Fathom, Fireflies, Read.ai, Grain, Plaud, YouTube, file-upload, paste-transcript, and manual-mcp-import as `unknown`.
- Suppress when any event-linked copy is authoritatively `webinar`, including webinar+unknown and webinar+non_webinar; explicit webinar wins every conflict.
- Treat `unknown` as neutral: it does not suppress and does not assert non_webinar. Prove unknown-only and non_webinar+unknown pass the provider gate, then still deny unverified, invitee-only, organization-only, or otherwise unconfirmed requesters.
- Exercise confirmed-participant counts at 49 and 50 for unknown-only and explicit-non_webinar events, and preserve direct-link access for every discovery-suppressed event.
- Exercise null and non-null `event_id`, dedup/retry paths, and independent destination policy in all three copy/routing functions.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual hierarchy and responsive fit of Settings, desktop Popover, and mobile Dialog | ACCESS-06 | Screenshot review verifies presentation beyond DOM assertions | Capture desktop and mobile screenshots for inherited, custom, pending, grant, cooldown, and Public-confirmation states; compare against `38-UI-SPEC.md`. |
| Production additive deployment proof | ACCESS-07, ACCESS-08, EVT-06 | Uses live migration history and endpoints under the authorized production policy | Record verified source commit/fingerprint, target ref, pending migrations, pre-existing token response, deploy output, post-deploy introspection, old/UUID token probes, auth rejection, and orphan/duplicate checks. Do not push `main` or deploy the frontend. |

---

## Static and Release Gates

- `rg` finds no recording-identity `parseInt()` or `Number()` in Phase 38 sharing paths.
- Generated Supabase types contain every new table, column, and RPC and pass strict TypeScript.
- MCP share results retain `content[].text` markdown and the real `/s/<token>` route.
- Lint adds no warnings above the recorded baseline; existing unrelated warnings are reported accurately.
- Before production database work: record the verified application source commit and non-planning source fingerprint, Supabase target ref, migration history, and exact pending set; allow only later `.planning/` evidence/summary commits whose recomputed fingerprint matches.
- After production database work: re-run migration history and SQL introspection, probe old and UUID-native tokens, and run read-only orphan, unresolved, duplicate-active-grant, RLS, and function-grant checks.
- Production frontend remains unchanged until the deliberate milestone merge to `main`.

---

## Validation Sign-Off

- [x] Every phase requirement has an automated verification path.
- [x] Sampling continuity prevents three consecutive tasks without an automated check.
- [x] Wave 0 identifies every missing test fixture and suite.
- [x] Commands contain no watch-mode flags.
- [x] Targeted feedback latency is designed to stay under 60 seconds.
- [x] `nyquist_compliant: true` is set in frontmatter.
- [ ] Wave 0 suites and fixtures exist and pass.
- [ ] Full phase gate passes.

**Approval:** strategy approved for planning 2026-09-19; execution evidence pending
