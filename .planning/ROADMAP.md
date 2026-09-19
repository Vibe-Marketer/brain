# Roadmap: CallVault

## Milestones

- ✅ **v1.0 Self-Serve Public Launch** — Phases 1-9 (shipped 2026-06-12)
- ✅ **v2.0 Autonomous Operations** — Phases 17-23 (shipped 2026-06-15)
- ✅ **v2.1 Import/Sync Rebuild** — Phases 24-29 (shipped 2026-07-21)
- 🚧 **v2.2 Event Resolution & Provenance** — Phases 30-39 (planning)

> **Branch discipline for v2.2 (informational — for whoever runs `/gsd-plan-phase 30`):** Per the PROJECT.md Key Decision (2026-08-31), Phase 30 onward executes on a **feature branch**, not direct-to-main. This milestone touches RLS on a live production system with real customer data (new `events` table, `identities` spine, `call_share_links` key migration). Cut the branch at the **start of Phase 30 planning, before any migration is authored** — do not let it get missed. Merge to main only once proven, tested, and Andrew is comfortable. This is the one milestone that overrides the repo's normal single-operator direct-main workflow.

> **Phase numbering note:** The source spec docs (`.orca/drops/*`) proposed starting at "Phase 29" on the assumption v2.1 ended at Phase 28. That assumption was wrong — v2.1 shipped as Phases 24-29 (Phase 29 = "Partial-Success & Retry", shipped 2026-07-21). Every source-doc phase number is shifted **+1** here: their Phase 29 → Phase 30, … their Phase 38 → Phase 39.

## Phases

<details>
<summary>✅ v1.0 Self-Serve Public Launch (24 phases, 113 plans) — SHIPPED 2026-06-12</summary>

- [x] Phase 1: Paste Pipeline Polish — completed 2026-05-27
- [x] Phase 2: MCP Monolith Refactor — completed 2026-05-28
- [x] Phase 3: Per-Workspace MCP Endpoints + Connectors Setup — completed 2026-05-28
- [x] Phase 4: MCP AI Write Tools — completed 2026-05-30
- [x] Phase 5: Connector Reliability + Per-Workspace Binding + Unified Sync Tab — completed 2026-05-31
- [x] Phase 6: Launch UX + Support + RLS Hygiene — completed 2026-06-01
- [x] Phase 6.1: MCP Subdomain Routing — completed 2026-06-10
- [x] Phase 6.2: CallVault REST API — completed 2026-06-09
- [x] Phase 6.3: Obsidian Sync Improvements — completed 2026-06-09
- [x] Phase 7: Recording ID and Folder Assignment Correctness — completed 2026-06-12
- [x] Phase 8: Full-Suite Test Recovery — completed 2026-06-10
- [x] Phase 08.1: Connector Transcript Normalization — completed 2026-06-10
- [x] Phase 9: Lint, Brand, and Documentation Hygiene — completed 2026-06-10

Full detail: `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>✅ v2.0 Autonomous Operations (Phases 17-23, 35 plans) — SHIPPED 2026-06-15</summary>

- [x] Phase 17: Activation + Per-Run Observability + Go-Live Hardening — shipped partial; 17-05 live activation held/deferred by operator
- [x] Phase 18: Source Attribution — completed 2026-06-13
- [x] Phase 19: Throughput Scale-Up + Trust, Survival & Autonomy — completed 2026-06-13
- [x] Phase 20: Nightly QA → Fixable Tickets + Flake Suppression — completed 2026-06-14
- [x] Phase 21: Sentry Debug → Fix → Resolve — completed 2026-06-14
- [x] Phase 22: Recurrence → Structural Fix — completed 2026-06-14
- [x] Phase 23: Reporter Comms (In-App) — completed 2026-06-15

Full detail: `.planning/milestones/v2.0-ROADMAP.md`

</details>

<details>
<summary>✅ v2.1 Import/Sync Rebuild (Phases 24-29, 21 plans) — SHIPPED 2026-07-21</summary>

- [x] Phase 24: Sync-Status Foundation (4/4 plans)
- [x] Phase 25: Durable Selection (2/2 plans)
- [x] Phase 26: Unified Import Surface (4/4 plans) — completed 2026-06-23
- [x] Phase 27: Observable Jobs (4/4 plans) — completed 2026-06-25
- [x] Phase 28: Server-Side Sync-All (5/5 plans) — completed 2026-06-30
- [x] Phase 29: Partial-Success & Retry (2/2 plans) — completed 2026-07-01

Full detail: `.planning/milestones/v2.1-ROADMAP.md`. Accepted follow-ups: `.planning/V2.1-COMPLETION-FOLLOWUPS.md`.

</details>

### 🚧 v2.2 Event Resolution & Provenance (Phases 30-39) — PLANNING

**Milestone Goal:** A meeting is one event that happened once. CallVault holds the single canonical record of that event, assembled from every recording (capture) of it, with per-capture access control and auditable provenance. Load-bearing sequence: truthful schema + event key → deterministic matching in shadow mode (no auto-merge in prod) → hardened provider-agnostic matcher → content-proof + alibi → identity spine → speaker resolution → live orgs → transcript reconciliation → access/sharing → discovery.

- [x] **Phase 30: Schema Reconciliation + Event Model Foundation** — Make the schema truthful (F16/F17), add the `events` table and event key, zero behavior change while `event_id` is NULL. (completed 2026-09-01)
- [x] **Phase 31: Deterministic Resolution, Shadow Mode Only** — Deterministic-tier matches computed and logged behind a flag; nothing auto-merges in production. (completed 2026-09-02)
- [x] **Phase 32: Match-Rule Hardening + Provider-Agnostic Matcher** — Close the live F5 false-merge bug, make the matcher work across all providers, prove precision. (completed 2026-09-05)
- [x] **Phase 33: Content-Proof Matching + Alibi Constraint** — Transcript-shingle confirmation and the speaker-alibi veto. (completed 2026-09-05)
- [x] **Phase 34: Identity Consolidation** — One `identities` spine linking speakers, contacts, and participants; multi-verified-email attach. (completed 2026-09-07)
- [x] **Phase 35: Speaker Resolution Across Sources** — Named speakers propagate onto anonymous labels; diarization over-segmentation collapses by consensus. (completed 2026-09-08)
- [x] **Phase 36: Live Organizations** — Orgs become claimable canonical entities (aliases, domains, domain-verified claim) with no access leakage. (completed 2026-09-09)
- [x] **Phase 37: Transcript Reconciliation** — Derived, regenerable canonical transcript across an event's captures, provenance-carrying, source never overwritten. (completed 2026-09-10)
- [ ] **Phase 38: Access Policy, Share-Link Key Migration, Request Flow** — Independent content/existence visibility per capture, request/approve flow, `call_share_links` UUID migration.
- [ ] **Phase 39: Discovery and Claim** — Cross-org discovery scoped to a user's verified emails; non-user participation claim.

## Phase Details

### Phase 30: Schema Reconciliation + Event Model Foundation

**Goal**: The event layer exists in the schema — truthfully — and changes no current behavior. This is the load-bearing foundation; F16/F17 mean the schema must be made truthful before a single migration is authored.
**Depends on**: Nothing (first phase of v2.2; builds on shipped v2.1 import layer)
**Requirements**: SAFE-07, EVT-01, EVT-02, EVT-03, EVT-04, EVT-05, EVT-07, SAFE-05
**Success Criteria** (what must be TRUE):

  1. `src/types/supabase.ts` is regenerated from the live DB and reconciled against `supabase/migrations/`; F16 and F17 discrepancies are resolved and documented before any new migration exists.
  2. An `events` table (UUID-keyed; canonical start/end/resolution-confidence, no content columns) and a nullable, additive `recordings.event_id` exist — NULL means unresolved, never broken.
  3. `get_workspace_recordings`, `global_search`, chat, and MCP return byte-identical results while `event_id` is NULL across the board, proven by test; event-level reads join through `workspace_entries` (no assumed `workspace_id` on `recordings`).
  4. `call_participants` carries `event_id`, a role value (organizer/invitee/attendee/speaker), and `has_confirmed_speech`; existing readers are unchanged and the `sources[]` evidence trail is preserved.
  5. `events` and extended `call_participants` are registered in the `CROSS_ORG_TABLES` CI gate, and `events` RLS grants visibility only through participation or an owned capture — never through `organization_id`.

**Plans**: 4/4 plans executed — PASSED verification 2026-09-01 (6/6 must-haves, including a post-execution code-review gap closure for CR-01/WR-01/WR-02/WR-03; see 30-VERIFICATION.md)

Plans:
**Wave 1**

- [x] 30-01-PLAN.md — Schema truth reconciliation (SAFE-07): regenerate types from live DB, document F16 gap, fix gen:types script

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 30-02-PLAN.md — Event model migration (EVT-01/02/04/05/07): events table + participation/ownership RLS, recordings.event_id, call_participants role/event_id/has_confirmed_speech (reversibility gate) — complete 2026-08-31, applied to TEST (callvault-test caught up from 9-migration backlog); see 30-02-SUMMARY.md

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 30-03-PLAN.md — Isolation + byte-identical proof (EVT-03, EVT-04, SAFE-05)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 30-04-PLAN.md — Guarded prod apply + post-migration type re-sync

### Phase 31: Deterministic Resolution, Shadow Mode Only

**Goal**: Deterministic-tier matches are computed, recorded, and reversible — but nothing auto-merges in production. This is where the visible win (one call, several source badges) becomes possible with zero data-corruption risk.
**Depends on**: Phase 30
**Requirements**: MATCH-01, MATCH-09, MATCH-10, SAFE-01, SAFE-02
**Success Criteria** (what must be TRUE):

  1. A deterministic-tier hit (shared conference identifier — Zoom meeting UUID / Meet conference ID / calendar UID, read from `source_metadata`) resolves two captures to one event with no scoring.
  2. Shadow mode computes and records every proposed merge to an `event_match_decisions` ledger (both recording IDs, tier, score, signal breakdown, decided_by, timestamp) without applying it — production data is untouched.
  3. Every merge is reversible in one atomic operation following the `split_recording_atomic` pattern, with the reversal recorded in the same ledger.
  4. All resolution runs behind a per-organization feature flag, off by default.

**Plans**: 4 plans

Plans:
**Wave 1**

- [x] 31-01-PLAN.md — TRACER: end-to-end shadow-mode deterministic resolver (organization_feature_flags + event_match_decisions tables, event-resolver module, resolve-events edge fn, flag-gate + noop proof on TEST) + reversibility gate (checkpoint:decision)

**Wave 2** *(blocked on Wave 1)*

- [x] 31-02-PLAN.md — Reversibility mechanism: apply/reverse atomic RPC pair (MATCH-10, built but never wired to the sweep) + event-resolution-sweep pg_cron
- [x] 31-03-PLAN.md — Client-isolation CI gate: event_match_decisions + organization_feature_flags registered in CLIENT_DENY_TABLES (rls-regression)

**Wave 3** *(blocked on Wave 2)*

- [x] 31-04-PLAN.md — Guarded prod apply (4 migrations) + resolve-events deploy + type re-sync (checkpoint:human-verify)

### Phase 32: Match-Rule Hardening + Provider-Agnostic Matcher

**Goal**: Close the live F5 false-merge bug inside the matcher, make it provider-agnostic, and prove precision on real data before any org is enabled.
**Depends on**: Phase 31
**Requirements**: MATCH-03, MATCH-04, MATCH-05, MATCH-06, MATCH-08, MATCH-11, SAFE-03, SAFE-04, SAFE-06
**Success Criteria** (what must be TRUE):

  1. `checkMatch` rejects any candidate with zero time overlap, and title similarity is suppressed as a signal when the title appears in `recurring_call_titles` above the occurrence threshold — the F5 recurring-meeting false merge is closed by test inside the function, not at the caller.
  2. The matcher is provider-agnostic, reading `recordings` + `call_participants` (replacing the Zoom-and-`zoom_raw_calls`-only path); existing Zoom behavior is preserved through the new path, not deleted. `transcript_chunks` reading is MATCH-02's content-proof tier, intentionally scoped to Phase 33 per the original spec's own phase table (content-proof + alibi is a separate phase from metadata-tier hardening) — MATCH-06 is satisfied within Phase 32 by the architectural move off `zoom_raw_calls`, not by touching all three tables in one phase.
  3. The metadata tier can only propose candidates — never auto-merges alone — and thresholds are asymmetric (high bar to merge, low bar to split); `dedup_priority_mode`/`dedup_platform_order` now select display order under an event, discarding nothing.
  4. A kill switch reverts all auto-merges within a time range in one operation, and cross-org false merges are blocked at RLS (proven by a live cross-org isolation test against the TEST project) so resolution never widens either capture's readable audience.
  5. Shadow precision is measured against a hand-labeled set with a false-merge rate at or below 0.1% before SAFE-01 is enabled for any org.

**Plans**: 6 plans

Plans:
**Wave 1**

- [x] 32-01-PLAN.md — F5 fix: harden checkMatch (MATCH-04) + recurring-title suppression primitive + live view RLS verify (MATCH-05)
- [x] 32-03-PLAN.md — SAFE-03 kill-switch bulk-reversal RPC + SAFE-04 cross-org no-audience-widening RLS proof (TEST)

**Wave 2** *(blocked on 32-01)*

- [x] 32-02-PLAN.md — Provider-agnostic metadata tier: design gate (checkpoint:decision) + propose-only matcher reading recordings+call_participants (MATCH-03/06/08) + MATCH-11 preservation

**Wave 3** *(blocked on 32-01, 32-02, 32-03)*

- [x] 32-04-PLAN.md — Guarded prod apply: deploy hardened dedup-fingerprint + metadata tier + kill-switch migration, type re-sync (checkpoint:human-verify)

**Wave 4** *(blocked on 32-04)*

- [x] 32-05-PLAN.md — SAFE-06 shadow precision on Andrew's own org: read-only org id + light confirm (checkpoint:human-verify) + enable-for-one-org + hand-scored false-merge rate

### Phase 33: Content-Proof Matching + Alibi Constraint

**Goal**: Transcript content conclusively confirms matches, and the speaker-alibi constraint rejects physically impossible ones with certainty.
**Depends on**: Phase 32
**Requirements**: MATCH-02, MATCH-07
**Success Criteria** (what must be TRUE):

  1. Rare n-gram shingle overlap over `transcript_chunks`, aligned on relative offsets, conclusively attaches two captures of the same event (content-proof tier).
  2. An identity with `has_confirmed_speech` in event A during interval T is rejected as a speaker in a time-disjoint event B during T; attendance alone is never an alibi.
  3. Zero-transcript (audio-only) captures fall back to the deterministic tier or the review queue without error.

**Plans**: 3 plans

Plans:
**Wave 1**

- [x] 33-01-PLAN.md — Design gate (checkpoint) + additive apply_event_match_atomic `p_tier` migration + pure content-proof shingle scorer & speaker-alibi predicate with unit tests

**Wave 2** *(blocked on 33-01)*

- [x] 33-02-PLAN.md — Wire content-proof propose-only pass + alibi veto into runShadowSweep + seeded-fixture integration proof (attach, dominant zero-transcript fallback, alibi rejection, direct-call auto-attach capability)

**Wave 3** *(blocked on 33-02)*

- [x] 33-03-PLAN.md — Guarded prod apply (migration + resolve-events redeploy + type re-sync) proving the tier ships inert

### Phase 34: Identity Consolidation

**Goal**: One real person is one identity across the three existing person representations, linked by verified evidence, without moving or deleting any of them.
**Depends on**: Phase 30
**Requirements**: IDENT-01, IDENT-02, IDENT-03, IDENT-08
**Success Criteria** (what must be TRUE):

  1. An `identities` spine reconciles `speakers` (user-scoped), `contacts` (org-scoped), and `call_participants` (recording-scoped) via a nullable `identity_id` on each — none is moved or deleted, and each keeps its existing reader.
  2. Identity resolution spans email aliases, provider participant IDs, and display-name variants, and never auto-links on name similarity alone.
  3. A user can attach multiple owned, verified email addresses so calls recorded under any of them resolve to one person.
  4. Every resolved speaker label carries its confidence and the evidence that produced it, visible on demand.

**Plans**: 7 plans

Plans:
**Wave 1**

- [x] 34-01-PLAN.md — Reader-inventory grep sweep (mandatory first task) + reversibility gate (checkpoint) locking the identities/identity_aliases schema, non-org-scoped RLS pattern, and custom-OTP mechanism

**Wave 2** *(blocked on 34-01)*

- [x] 34-02-PLAN.md — Additive identity-spine migration (identities + identity_aliases + nullable identity_id on the three person tables) + participation RLS + redacted get_identity_evidence RPC + IDENT-01 noop / IDENT-08 evidence / cross-org isolation tests, applied to TEST

**Wave 3** *(blocked on 34-02)*

- [x] 34-03-PLAN.md — Email-alias OTP verification: identity_alias_verifications table (client-deny) + request/confirm edge functions reusing Resend (never Supabase Auth), brute-force-guarded (IDENT-03 backend)
- [x] 34-04-PLAN.md — Identity resolver: pure identity-resolver.ts (verified email + provider-id link; display-name NEVER links) + forward-only resolve-identities edge function (IDENT-02)
- [x] 34-05-PLAN.md — Confidence/evidence popover on resolved speaker labels (Radix + Remix Icons) over get_identity_evidence, identity_id threaded through callSpeakers (IDENT-08 UI)

**Wave 4** *(blocked on 34-03)*

- [x] 34-06-PLAN.md — "Verified Emails" section in AccountTab.tsx (Service+Hook over the two OTP functions) — add/verify emails, no new route (IDENT-03 UI)

**Wave 5** *(blocked on 34-02..06)*

- [x] 34-07-PLAN.md — Guarded prod apply (both migrations + three function deploys + type re-sync), forward-only-safety introspection, and a real add-email end-to-end round-trip (checkpoint)

**Gap closure** *(post-review, 2026-09-07)*

- [x] 34-GAPCLOSURE — Code-review findings CR-01 (get_identity_evidence had no caller-authorization check) and WR-02 (user_can_view_identity missing speakers.identity_id branch) fixed via one additive migration (20260906000001), TEST-then-prod guarded apply. See 34-GAPCLOSURE-SUMMARY.md.

**UI hint**: yes

### Phase 35: Speaker Resolution Across Sources

**Goal**: Named speakers from one capture fill in another capture's anonymous labels, and over-segmented diarization collapses to the truth.
**Depends on**: Phase 34
**Requirements**: IDENT-04, IDENT-05
**Success Criteria** (what must be TRUE):

  1. Where one recording of an event carries named speakers and another carries anonymous labels, names propagate onto the anonymous labels by timeline alignment across `transcript_chunks`.
  2. Diarization over-segmentation is corrected by consensus — where a labeled source shows one speaker across an interval another source split in two, the labeled source wins and the phantom speaker collapses.
  3. Speakers with no calendar data, no attendee list, and only anonymous diarization stay unresolved rather than guessed.

**Plans**: 4 plans
**Wave 1**

- [x] 35-01-PLAN.md — Reversibility gate: live-verify recordings timing schema, lock time-origin anchor + resolved-name write-target, pin contract types. Locked A1 (derived absolute instant via recording_start_time) + B2 (new speaker_resolution_decisions ledger) + operator-requested +/-15-30s clock-drift tolerance buffer. See 35-01-SUMMARY.md.

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 35-02-PLAN.md — Pure speaker-resolver module, test-first (adversarial unit suite: propagate / never-display-name / collapse / disagree / unresolved)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 35-03-PLAN.md — Forward-only, secret-gated resolve-speakers edge function + synthetic integration proof + cross-org isolation (conditional ledger migration, TEST-only)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 35-04-PLAN.md — Prod-apply gate: green-suite + TEST introspection proof, then blocking human-verify checkpoint (prod-ref guarded)

### Phase 36: Live Organizations

**Goal**: Organizations stop being a tenancy label and become claimable canonical entities — without ever conferring capture access.
**Depends on**: Phase 30
**Requirements**: ORG-01, ORG-02, ORG-03, ORG-04
**Success Criteria** (what must be TRUE):

  1. `organization_aliases` and `organization_domains` exist; an org can carry multiple names and multiple domains.
  2. An org can be claimed and verified via domain ownership.
  3. Duplicate orgs can be merged non-destructively and reversibly via `canonical_organization_id`.
  4. Org association with an event confers no access to any capture of it — enforced at RLS and proven by test.

**Plans**: 6 plans

Plans:
**Wave 1**

- [x] 36-01-PLAN.md — TRACER: reversibility gate + self-serve org-identity backend (organization_domains/aliases tables, claim/alias RPCs, CROSS_ORG registration, claim integration proof)

**Wave 2** *(blocked on Wave 1)*

- [x] 36-02-PLAN.md — Merge/unclaim schema + admin RPCs + ORG-04 canonical-no-leak proof (canonical_organization_id + chain trigger, merge/unclaim atomic RPCs, bespoke RLS isolation block)
- [x] 36-03-PLAN.md — Self-serve Organization Identity settings UI (service/hook, OrganizationIdentitySection, VerifiedDomainBadge)

**Wave 3** *(blocked on 36-02)*

- [x] 36-04-PLAN.md — Admin merge/unclaim edge functions (has_role-gated) + integration tests

**Wave 4** *(blocked on 36-03, 36-04)*

- [x] 36-05-PLAN.md — Admin Center Organizations UI (table, merge/unclaim dialogs, registration)

**Wave 5** *(blocked on all)*

- [x] 36-06-PLAN.md — Guarded prod apply (4 migrations + 2 edge functions) + type re-sync

**UI hint**: yes

### Phase 37: Transcript Reconciliation

**Goal**: A derived, regenerable canonical transcript across an event's captures, provenance-carrying, with source data never overwritten.
**Depends on**: Phase 33, Phase 35
**Requirements**: RECON-01, RECON-02, RECON-03, RECON-04, RECON-05, RECON-06, RECON-07
**Success Criteria** (what must be TRUE):

  1. Chunks from the recordings of one event align on a shared relative timeline derived from content rather than wall-clock (device clock drift is ignored).
  2. Token-level disagreements resolve by weighted vote across source-accuracy priors, per-token confidence where exposed, and majority; a per-workspace entity lexicon seeded from `transcript_chunks.entities` breaks ties ("ChatGPT" over "ChatGBT").
  3. The reconciled transcript is a derived, regenerable layer — source transcripts and chunks are never overwritten.
  4. Each reconciled segment records which recordings supplied and agreed on it, and single-source intervals are shown as single-source, not consensus.
  5. Embedding and search behavior is unchanged for unresolved events — reconciliation never silently re-embeds the corpus.

**Plans**: 5 plans
**Wave 1**

- [x] 37-01-PLAN.md — Reversibility gate + reconciled_transcript_segments schema/RLS (client-facing) + cross-org isolation proof

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 37-02-PLAN.md — Pure transcript-reconciler module (alignment + token weighted-vote + entity lexicon + provenance/coverage)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 37-03-PLAN.md — reconcile-transcripts edge function (gating, same-org bucketing, delete+rebuild, RECON-04/07 negative proofs)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 37-04-PLAN.md — Read-only Reconciled tab + provenance badge + hook/service (CallDetailDialog)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 37-05-PLAN.md — Guarded production apply (migration + edge function), introspection proof (apply-no-cron)

**Wave 6** *(gap closure after code review)*

- [x] 37-06-PLAN.md — Apply reviewed reconciliation fixes to production and independently verify the live version

**UI hint**: yes

### Phase 38: Access Policy, Share-Link Key Migration, Request Flow

**Goal**: Per-recording content access with privacy-safe, participant-qualified copy discovery and a request/approve flow — with existing sharing untouched.
**Depends on**: Phase 30, Phase 34
**Requirements**: ACCESS-01, ACCESS-02, ACCESS-03, ACCESS-04, ACCESS-05, ACCESS-06, ACCESS-07, ACCESS-08, ACCESS-09, EVT-06
**Success Criteria** (what must be TRUE):

  1. Access policy is a property of the recording (private, attendees, invitees, organization, link, public); content is denied by default and nothing becomes readable through the event layer that wasn't already readable through a recording the user could access.
  2. A confirmed participant can see that N other copies exist without seeing whose or what they contain, and participant-based existence visibility is capped by event size/type so a 200-person webinar never exposes an attendee roster.
  3. A participant can request access to a specific copy; the owner is notified and can grant or deny; grants are revocable and logged.
  4. `call_share_links` is migrated (or bridged) from `call_recording_id: number` to the `recordings` UUID before event-level access ships; existing share tokens, coach access, and team access keep functioning unchanged; `copy_recording_to_org` and `route_recording_cross_org` preserve `event_id` on the copy.
  5. The settings UI states that the policy governs this copy only and cannot restrict other attendees' recordings.

**Plans**: 16 plans

Plans:
- [ ] 38-01-PLAN.md — Establish production-ref hard stops, controlled fixtures, and legacy share-call compatibility tests.
- [ ] 38-02-PLAN.md — Define real-DB policy, discovery, request lifecycle, RLS, and event-copy acceptance tests.
- [ ] 38-03-PLAN.md — Define Edge, MCP, public endpoint, component, notification, and Playwright acceptance tests.
- [ ] 38-04-PLAN.md — Add recording/account policy schema, snapshot trigger, lifecycle tables, RLS, and RPCs.
- [ ] 38-05-PLAN.md — Add the non-destructive share-link UUID bridge and event_id-preserving copy functions.
- [ ] 38-06-PLAN.md — Apply and prove the additive migrations on the dedicated test Supabase project.
- [ ] 38-07-PLAN.md — Update share-call and MCP resolution for legacy and UUID-native share links.
- [ ] 38-08-PLAN.md — Add the allowlisted public recording Edge endpoint and frontend route.
- [ ] 38-09-PLAN.md — Implement policy/access service and hook contracts.
- [ ] 38-10-PLAN.md — Migrate sharing data access to services/hooks and canonical UUIDs without behavior regressions.
- [ ] 38-11-PLAN.md — Implement server-authorized request lifecycle, notification outbox, and email delivery.
- [ ] 38-12-PLAN.md — Add Privacy & Access account defaults and shared policy selection UI.
- [ ] 38-13-PLAN.md — Add per-recording Access management, grants, requests, confirmation, and reset states.
- [ ] 38-14-PLAN.md — Add anonymous copy requests and authenticated notification/email deep links.
- [ ] 38-15-PLAN.md — Run full committed-tree, real-DB, browser, security, and source-coverage verification.
- [ ] 38-16-PLAN.md — Apply and prove the authorized additive production Supabase rollout without deploying the frontend.
**UI hint**: yes

### Phase 39: Discovery and Claim

**Goal**: A user discovers every event across all their verified emails, and a non-user can claim their participation — existence and request-path only, never content by default.
**Depends on**: Phase 34, Phase 38
**Requirements**: DISCO-01, DISCO-02, DISCO-03
**Success Criteria** (what must be TRUE):

  1. `get_people_summary` and `get_recordings_for_person` gain an event-aware, cross-org variant scoped to the caller's own verified email addresses, with existing org-scoped signatures preserved.
  2. After linking a verified email, the user sees "we found N events associated with your identities."
  3. A non-user whose email appears in `call_participants` can be invited to claim their participation, verified by email ownership.
  4. Claiming grants existence visibility and the ability to request access — no content by default.

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:** Phases execute in numeric order: 30 → 31 → 32 → 33 → 34 → 35 → 36 → 37 → 38 → 39

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 30. Schema Reconciliation + Event Model Foundation | v2.2 | 5/4 | Complete    | 2026-09-01 |
| 31. Deterministic Resolution, Shadow Mode Only | v2.2 | 4/4 | Complete    | 2026-09-02 |
| 32. Match-Rule Hardening + Provider-Agnostic Matcher | v2.2 | 5/5 | Complete    | 2026-09-05 |
| 33. Content-Proof Matching + Alibi Constraint | v2.2 | 3/3 | Complete    | 2026-09-05 |
| 34. Identity Consolidation | v2.2 | 8/7 | Complete    | 2026-09-07 |
| 35. Speaker Resolution Across Sources | v2.2 | 4/4 | Complete    | 2026-09-08 |
| 36. Live Organizations | v2.2 | 6/6 | Complete    | 2026-09-09 |
| 37. Transcript Reconciliation | v2.2 | 6/6 | Complete    | 2026-09-12 |
| 38. Access Policy, Share-Link Key Migration, Request Flow | v2.2 | 0/TBD | Not started | - |
| 39. Discovery and Claim | v2.2 | 0/TBD | Not started | - |

---

*See `.planning/MILESTONES.md` for full shipped-milestone accomplishment summaries. Source spec: `.orca/drops/SPEC-event-resolution-and-provenance.md` + `.orca/drops/v2.2-REQUIREMENTS.md`.*
