# Requirements: CallVault v2.2 — Event Resolution & Provenance

**Defined:** 2026-08-31
**Core Value:** A meeting is one event that happened once. CallVault holds the single canonical record of that event, assembled from every recording of it, with per-capture access control and auditable provenance.
**Full spec:** `.orca/drops/SPEC-event-resolution-and-provenance.md` and `.orca/drops/v2.2-REQUIREMENTS.md` — read for terminology, current-state findings (F1–F17), edge cases, legal posture, and open-decision history. This file is the GSD-native traceability surface for the same locked requirement set.

## v1 Requirements

Requirements for this milestone. Each maps to exactly one roadmap phase.

### Event model (EVT)

- [ ] **EVT-01**: An `events` table exists, UUID-keyed, storing canonical start, end, and resolution confidence. No content columns.
- [ ] **EVT-02**: `recordings.event_id` is nullable and additive. NULL means unresolved, never broken.
- [ ] **EVT-03**: `get_workspace_recordings`, `global_search`, chat, and MCP return byte-identical results when `event_id` is NULL across the board. Proven by test.
- [ ] **EVT-04**: `events` is not org-scoped. RLS grants visibility through participation or an owned capture, never through `organization_id`.
- [ ] **EVT-05**: `call_participants` is extended, not replaced — add `event_id`, a role value (organizer/invitee/attendee/speaker), and `has_confirmed_speech`. The existing `sources: string[]` column is the evidence trail and stays.
- [ ] **EVT-06**: `copy_recording_to_org` and `route_recording_cross_org` preserve `event_id` on the copy.
- [ ] **EVT-07**: Event-level reads join through `workspace_entries` for workspace scoping. No assumption of a `workspace_id` on `recordings`.

### Resolution engine (MATCH)

- [ ] **MATCH-01**: Deterministic tier first — shared conference identifier (Zoom meeting UUID, Meet conference ID, calendar UID), read from `source_metadata`. A hit resolves with no scoring.
- [ ] **MATCH-02**: Content-proof tier second — rare n-gram shingle overlap over `transcript_chunks`, aligned on relative offsets. High overlap is conclusive.
- [ ] **MATCH-03**: The metadata tier may only propose candidates. It can never auto-merge alone.
- [ ] **MATCH-04**: `checkMatch` gains a mandatory nonzero time-overlap guard, closing F5 inside the function rather than relying on the caller's window.
- [ ] **MATCH-05**: Title similarity is suppressed as a match signal when the title appears in `recurring_call_titles` above an occurrence threshold.
- [ ] **MATCH-06**: The matcher is provider-agnostic and reads `recordings` + `call_participants` + `transcript_chunks`, replacing the Zoom-and-`zoom_raw_calls`-only path. Existing Zoom behavior is preserved through the new path, not deleted.
- [ ] **MATCH-07**: A speaker-alibi constraint rejects candidates — an identity with confirmed speech in event A during interval T cannot be a speaker in a time-disjoint event B during T. Attendance is never an alibi, only `has_confirmed_speech`.
- [ ] **MATCH-08**: Thresholds are asymmetric — high bar to merge, low bar to split. A false merge is treated as a data-exposure incident.
- [ ] **MATCH-09**: Every decision writes to an `event_match_decisions` ledger — both recording IDs, tier, score, signal breakdown, decided_by (auto/user/admin), timestamp.
- [ ] **MATCH-10**: Every merge is reversible in one atomic operation, following the `split_recording_atomic` transactional pattern, with the reversal recorded in the same ledger.
- [ ] **MATCH-11**: `dedup_priority_mode` and `dedup_platform_order` in `user_settings` continue to work, now selecting which recording *displays first* under an event rather than which row survives. Nothing is discarded.

### Identity consolidation (IDENT)

- [ ] **IDENT-01**: A single identity graph reconciles `speakers` (user-scoped), `contacts` (org-scoped), and `call_participants` (recording-scoped) without deleting any of them. Each keeps its reader; each gains a nullable `identity_id`.
- [ ] **IDENT-02**: Identity resolution spans email aliases, provider participant IDs, and display-name variants.
- [ ] **IDENT-03**: A user can attach multiple owned, verified email addresses so calls recorded under any of them resolve to one person.
- [ ] **IDENT-04**: Where one recording of an event carries named speakers and another carries anonymous labels, names propagate onto the anonymous labels by timeline alignment across `transcript_chunks`.
- [ ] **IDENT-05**: Diarization over-segmentation is corrected by consensus — where a labeled source shows one speaker across an interval another source split in two, the labeled source wins and the phantom speaker collapses.
- [ ] **IDENT-08**: Every resolved speaker label carries its confidence and the evidence that produced it, visible on demand.

### Transcript reconciliation (RECON)

- [ ] **RECON-01**: Chunks from the recordings of one event align on a shared relative timeline, derived from content rather than wall-clock, because device clocks drift.
- [ ] **RECON-02**: Token-level disagreements resolve by weighted vote across source-accuracy priors, per-token confidence where exposed, and majority.
- [ ] **RECON-03**: A per-workspace entity lexicon, seeded from the existing `transcript_chunks.entities` column, breaks ties.
- [ ] **RECON-04**: The reconciled transcript is a derived layer. Source transcripts and chunks are never overwritten, and the reconciled view is regenerable.
- [ ] **RECON-05**: Each reconciled segment stores which recordings supplied and agreed on it.
- [ ] **RECON-06**: Coverage gaps are explicit. Intervals covered by a single recording are shown as single-source, not as consensus.
- [ ] **RECON-07**: Embedding and search behavior is unchanged for unresolved events. Reconciliation must not silently re-embed the corpus.

### Access and provenance (ACCESS)

- [ ] **ACCESS-01**: Access policy is a property of the recording — private, attendees, invitees, organization, link, public.
- [ ] **ACCESS-02**: Event existence metadata (that it happened, when, who participated) is visible to confirmed participants independent of any recording's content policy.
- [ ] **ACCESS-03**: Content is denied by default. Nothing becomes readable through the event layer that wasn't readable through a recording the user could already access.
- [ ] **ACCESS-04**: A participant can see that N other copies exist without seeing whose or what they contain.
- [ ] **ACCESS-05**: A participant can request access to a specific copy. The owner is notified and can grant or deny. Grants are revocable and logged.
- [ ] **ACCESS-06**: The setting UI states that the policy governs this copy only and cannot restrict other attendees' recordings.
- [ ] **ACCESS-07**: `call_share_links` is migrated from `call_recording_id: number` to the `recordings` UUID, or bridged, before event-level access ships.
- [ ] **ACCESS-08**: Existing share tokens, coach access, and team access continue to function unchanged and are not superseded.
- [ ] **ACCESS-09**: Participant-based existence visibility is capped by event size and type, so a 200-person webinar does not expose an attendee roster.

### Discovery and claim (DISCO)

- [ ] **DISCO-01**: `get_people_summary` and `get_recordings_for_person` gain an event-aware, cross-org variant scoped to the caller's own verified email addresses. Existing org-scoped signatures are preserved.
- [ ] **DISCO-02**: A non-user whose email appears in `call_participants` can be invited to claim their participation, verified by email ownership.
- [ ] **DISCO-03**: Claiming grants existence visibility and the ability to request access. It grants no content by default.

### Organizations (ORG)

- [ ] **ORG-01**: `organization_aliases` and `organization_domains` exist; an org can carry multiple names and domains.
- [ ] **ORG-02**: An org can be claimed and verified via domain ownership.
- [ ] **ORG-03**: Duplicate orgs can be merged non-destructively via `canonical_organization_id`, reversibly.
- [ ] **ORG-04**: Org association with an event confers no access to any capture of it. Enforced at RLS.

### Safety and rollout (SAFE)

- [ ] **SAFE-01**: All resolution runs behind a feature flag, off by default, enableable per organization.
- [ ] **SAFE-02**: Shadow mode computes and records proposed merges without applying them, so precision is measured on real data first.
- [ ] **SAFE-03**: A kill switch reverts all auto-merges within a time range in one operation.
- [ ] **SAFE-04**: Cross-org false merges are blocked at RLS — resolving two recordings to one event must never widen either recording's readable audience.
- [ ] **SAFE-05**: `events`, extended `call_participants`, and `event_match_decisions` are registered in the existing `CROSS_ORG_TABLES` CI gate.
- [ ] **SAFE-06**: Shadow precision is measured against a hand-labeled set before SAFE-01 is enabled for any org. Target: false-merge rate at or below 0.1%.
- [ ] **SAFE-07**: Phase 29 begins by regenerating `src/types/supabase.ts` from the live database and reconciling it against `supabase/migrations/`, resolving F16 and F17 before any new migration is authored.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Voiceprinting (speaker naming from voice embeddings alone) | Biometric data under BIPA, Texas CUBI, and GDPR Art. 9 — needs a consent/retention posture before any code is written. Not deferred internally as a later phase within v2.2; cut from the requirement set entirely. Revisit only as its own future milestone. |
| Attendance conferring automatic content rights | Recording ownership, two-party consent law, and GDPR all cut against it. Attendance grants existence visibility and a request path, nothing more. |
| Paid or membership-gated access to another person's recording | Monetizing access to content you don't own is a legal problem before it's a product. Revisit only with counsel. |
| A public global event index | Discovery is scoped to a user's own verified participation. Public is an affirmative publishing action, never inferred from an import. |
| Audio fingerprinting (Chromaprint) | Strong signal, but most connectors deliver transcripts without retrievable media. Transcript shingles over `transcript_chunks` get most of the value. Deferred to v2.3. |
| Retiring `fathom_calls` / `fathom_raw_calls` / legacy BIGINT keys | Separate migration with its own risk surface. This milestone must not depend on it, except for the `call_share_links` key fix in ACCESS-07. |
| Collapsing `speakers` / `contacts` / `call_participants` into one physical table | IDENT-01 links them with a shared `identity_id`. Physically merging three tables with three different scopes is a separate milestone. |
| Automatic cross-org event merging | Highest blast radius. Gate behind explicit user action after single-org precision is proven. |
| Historical backfill of existing recordings | Forward-only resolution from a cutover date. Batch-resolving the historical corpus is a real false-merge exposure; an opt-in per-org backfill may be considered later, after precision is proven. |

## Traceability

Populated by the roadmapper.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SAFE-07, EVT-01..07, SAFE-05 | TBD | Pending |
| MATCH-01, MATCH-09, MATCH-10, SAFE-01, SAFE-02 | TBD | Pending |
| MATCH-03..06, MATCH-08, MATCH-11, SAFE-03, SAFE-04, SAFE-06 | TBD | Pending |
| MATCH-02, MATCH-07 | TBD | Pending |
| IDENT-01..03, IDENT-08 | TBD | Pending |
| IDENT-04, IDENT-05 | TBD | Pending |
| ORG-01..04 | TBD | Pending |
| RECON-01..07 | TBD | Pending |
| ACCESS-01..09, EVT-06 | TBD | Pending |
| DISCO-01..03 | TBD | Pending |

**Coverage:**
- v1 requirements: 50 total
- Mapped to phases: 0 (pending roadmapper)
- Unmapped: 50 ⚠️ (resolved by roadmap creation, next step)

---
*Requirements defined: 2026-08-31*
*Source: `.orca/drops/SPEC-event-resolution-and-provenance.md` + `.orca/drops/v2.2-REQUIREMENTS.md`, both built from a full read of `Vibe-Marketer/brain @ main` (288 migrations, `src/types/supabase.ts` 98 tables, `supabase/functions/_shared/`). Voiceprint requirements (formerly IDENT-06/IDENT-07) removed 2026-08-31 per Andrew's decision — see PROJECT.md Key Decisions.*
