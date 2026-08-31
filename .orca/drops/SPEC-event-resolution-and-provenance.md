# SPEC: Event Resolution & Provenance (Conversation Event Model)

**Created:** 2026-08-30
**Repo:** github.com/Vibe-Marketer/brain @ main
**Status:** Draft for planning. Not locked — see Open Questions.
**Type:** Improvement to a live production system. **This is not a greenfield build.**

---

## What

### The reframe

> **A call is not a recording. A call is an event.**

CallVault currently models a recording. Users have events, each with several recordings. Zoom, Fathom, Fireflies, Plaud, Read.ai, Grain, Otter, a phone recorder, and another attendee's recorder all produce **records of the same underlying event**.

This spec inserts the missing layer:

> **One conversation. One event. Many independently-owned captures.**

### Terminology (locked)

Use these words in code, comments, tables, and UI. They were selected over alternatives ("iterations," "versions," "duplicates") because they carry the ownership and provenance distinction that the product depends on.

| Term | Meaning | Maps to in this codebase |
|---|---|---|
| **Event** | The real-world conversation. Happened once, at one time, among specific people. A shared fact. No owner. | **NEW** `events` table |
| **Capture** | One person's or system's recording of that event. Independently owned, independently permissioned. | **EXISTING** `recordings` row — do **not** rename the table |
| **Artifact** | Something a capture contributes: audio, video, transcript, summary, chapters, chat, notes | **EXISTING** `recordings` columns + `transcript_chunks` rows |
| **Identity** | A real person, resolved across emails, accounts, provider IDs, aliases | **NEW** `identities` table linking three existing tables |
| **Organization** | A durable, claimable company entity with aliases, domains, people, and events | **EXISTING** `organizations`, extended |
| **Access Grant** | Who may discover, view, request, or download a specific capture | **EXISTING** `call_share_links` + coach/team tables, extended |
| **Provenance** | The verifiable lineage of a capture: where it came from, who imported it, how it matched, what changed | **NEW** `capture_provenance` + `event_match_decisions` |

Critical naming note: the database table is `recordings` and 98 tables plus dozens of RPCs read it. **The word is "capture" in the UI and in new code; the table stays `recordings`.** Do not propose a rename. Renaming it is a separate milestone with its own risk surface.

### What gets added

- `events` — canonical event, UUID-keyed, not org-scoped
- `identities` + `identity_aliases` — the person graph
- `organization_aliases` + `organization_domains` — the company graph
- `event_match_decisions` — the merge/unmerge ledger
- `capture_provenance` — per-capture lineage
- `access_requests` — request/approve flow

### What gets modified (all additive, all nullable)

- `recordings` — add `event_id`, `content_visibility`, `existence_visibility`
- `call_participants` — add `event_id`, `identity_id`, `role`, `has_confirmed_speech`
- `speakers`, `contacts` — add nullable `identity_id`
- `organizations` — add `verified_domain`, `claimed_by`, `canonical_organization_id`
- `dedup-fingerprint.ts` — hardened and made provider-agnostic
- `call_share_links` — migrated from `call_recording_id: number` to the `recordings` UUID
- `copy_recording_to_org`, `route_recording_cross_org` — preserve `event_id`

### What is not touched

Connectors. All six provider adapters (Fathom, Zoom, Fireflies, Grain, Read.ai, Plaud) and the `listPage` contract stay as they are. Resolution hooks the existing `canonical-recording.ts` seam after `runPipeline`.

---

## Why

### The user problem

The same conversation appears five times — your Fathom transcript, Alex's Fireflies transcript, Sarah's Read.ai transcript, the Zoom cloud recording, your Plaud audio. Today CallVault stores five unrelated rows. It should store one event with five captures beneath it.

Separately: a user has calls under `me@gmail.com`, `me@company1.com`, and `me@company2.com`, and today those are three disconnected worlds.

Separately again: a client from eighteen months ago remembers the call and wants the recording. There is no path for them to find it.

### The moat

Not "we store everyone's calls." Storage is commodity. The defensible asset is a **permissioned conversation graph with cross-source reconciliation**: the system gets progressively better at knowing *this person is the same person, this company is the same company, these five recordings are the same meeting, this is where each version came from, and this viewer may see these specific artifacts.*

That compounds with every capture ingested and cannot be replicated by a single-source tool. Fathom only ever sees Fathom captures. Nobody who owns one source can dedupe against Plaud. **The aggregator position is the structurally defensible one**, and CallVault already ingests six providers.

### Current-state findings (verified against `main`, 2026-08-30)

Read from the repo. The coding agent must treat these as ground truth over any assumption.

**What's missing**

| # | Finding | Evidence |
|---|---|---|
| F1 | `recordings` has no `event_id`, no access-policy column, no fingerprint columns. Real shape: `id`, `organization_id` (NOT NULL, FK), `owner_user_id`, `title`, `summary`, `full_transcript`, `transcript_segments` (JSONB), `source_app`, `source_call_id`, `source_metadata`, `share_token`, `fathom_provider_id`, `participant_count`, timing, AI caches. | `src/types/supabase.ts` |
| F2 | Dedup today = the org-scoped unique constraint `recordings_source_dedup (organization_id, source_app, source_call_id)`. Same-source idempotency only. Fathom and Plaud captures of one meeting are two unrelated rows and structurally always will be. | `20260730160000_fix_cross_org_copy_dedup.sql` |
| F3 | Fuzzy dedup columns (`meeting_fingerprint`, `is_primary`, `merged_from`, `fuzzy_match_score`, `source_platform`) live on **`fathom_calls`**, the legacy table — not on `recordings`. | `20260110000002_add_deduplication_fields.sql` |
| F4 | `dedup-fingerprint.ts` is Zoom-only by its own header, reads `zoom_raw_calls`, user-scoped. | file header; `zoom-webhook/index.ts` |
| F5 | **Live false-merge risk.** Match rule is *any two of three*: title ≥0.80 Levenshtein, time overlap ≥0.50, participants ≥0.60. Title + participants match with **zero** time overlap. Guarded only by a ±24h candidate window at the call site (`zoom-webhook/index.ts` L234–236), which does not protect a daily recurring meeting. | `dedup-fingerprint.ts` `checkMatch` |
| F6 | Cross-org copy creates a new `recordings` row. ~20 production duplicates resulted from the prior null-`source_call_id` workaround. | `20260730160000` header |

**What already exists — this materially reduces scope**

| # | Finding | Consequence |
|---|---|---|
| F7 | **`call_participants` exists**: `recording_id`, `organization_id`, `email`, `name`, `participant_type`, **`sources: string[]`** — it already records which providers asserted each participant. | ~80% of the participant layer is built. Extend it. Do not create a parallel table. |
| F8 | **`get_people_summary(p_organization_id)`** and **`get_recordings_for_person(p_email, p_name, p_organization_id)`** already ship. | The "vault of people" surface exists at org scope. Discovery extends these RPCs. |
| F9 | **Three overlapping person representations**: `speakers` (user-scoped, `UNIQUE(user_id, email)`), `contacts` (org-scoped, linked via `contact_call_appearances`), `call_participants` (recording-scoped). | Identity work is **consolidation across three scopes**, not a greenfield graph. Largest single risk in the milestone. |
| F10 | **`recurring_call_titles` exists**: `title`, `user_id`, `occurrence_count`, `first_occurrence`, `last_occurrence`. | Free fix for F5. A high-`occurrence_count` title carries zero matching information. |
| F11 | **`transcript_chunks` is a normalized segment layer**: `canonical_recording_id`, `chunk_index`, `chunk_text`, `speaker_name`, `speaker_email`, `timestamp_start/end`, `fts`, `entities`, `topics`, embeddings. | Content-shingle matching and reconciliation have a substrate. No JSONB parsing needed. Caveat: carries a legacy `recording_id: number` alongside the UUID. |
| F12 | **`split_recording_atomic`** ships. | Precedent and transactional pattern for atomic merge/unmerge. |
| F13 | Workspace membership is via **`workspace_entries`** (`recording_id`, `workspace_id`, `folder_id`). `recordings` has no `workspace_id`. | Event reads join through `workspace_entries`. |
| F14 | Sharing today: `recordings.share_token` **plus** `call_share_links`, which still keys on `call_recording_id: number` (legacy BIGINT). | Access work must fix this key before event-level access ships. |
| F15 | `organizations` has `cross_org_default`; `route_recording_cross_org` ships. | Cross-org routing is established with existing policy hooks. |

**Operational risk — read this before writing any migration**

| # | Finding | Consequence |
|---|---|---|
| F16 | **The migration folder is not the schema source of truth.** `recordings`, `organizations`, and `workspaces` are not created by any committed migration. `20260228000001` references `public.vaults`, which does not exist in the generated types (renamed to `workspaces`). | An agent planning migrations from `supabase/migrations/` alone will build against a fiction. |
| F17 | **`src/types/supabase.ts` is stale in the other direction.** `recordings.ai_generated_title` and `ai_title_generated_at` were added by `20260618160000` but are absent from the generated types. | Neither artifact is authoritative alone. Regenerate types from the live database and reconcile before authoring anything. |

---

## User Experience

### Library and search: one event, not five

```
Acme Discovery Call
Aug 30, 2026 · 2:00–2:47 PM · 3 people
5 captures · 3 transcripts · 2 you can open
```

Opening it shows the best capture the viewer is authorized to see, the canonical transcript, event-wide participants and summary, and a **Sources & Versions** panel listing each capture with its provider, owner, and access state.

### Merge review, not silent merging

High confidence attaches automatically. Uncertain matches go to a review queue:

> These appear to be the same conversation. **Merge · Keep separate · Not the same meeting · Always auto-merge Fathom + Plaud for me**

Every merge shows why:

```
Event match confidence: 99.4%
· Zoom meeting ID matches
· Start times within 43 seconds
· 3 of 3 participants overlap
· Transcript overlap: high
```

### Access settings: two dimensions, not one

The owner sets two things per capture, because revealing that a private recording exists can itself leak information.

**Content visibility** — who may open it.
**Existence visibility** — who may know it exists.

Copy at the point of setting must state: *This controls your capture only. Other attendees control their own recordings, and their settings may make this conversation accessible regardless of yours.*

### The three-person scenario

You, Bob, and Jane are on a call. Your Fathom capture is private. Bob's Zoom capture is attendees-only. Jane's Fireflies capture is public.

Bob searches and sees:

```
Acme Discovery Call · Aug 30, 2026 · 3 verified attendees
Available:   ✓ Jane's Fireflies transcript
             ✓ Your own Zoom recording
Restricted:  🔒 Another recording may be available — Request access
```

Bob cannot open your Fathom capture. If your existence visibility is "hidden," Bob sees no third row at all — not the owner, not the provider, not the fact that it exists.

### Request access

The owner receives: *Bob Smith requested access to your recording of "Acme Discovery Call."* Options: **Allow once · Allow permanently · Allow transcript only · Allow video · Deny**. Grants are revocable and logged.

### Multi-email onboarding

After linking a second verified email:

> We found 1,472 events associated with your verified identities.

This is the highest-leverage onboarding moment in the product.

### Search the user should be able to run

- "Every call I had with Jane Smith" — including the one where she used a personal Gmail
- "Calls with anyone from acme.com"
- "That pricing conversation with Mike sometime around 2023"
- "Calls I attended but don't own"

---

## Scope

### Domain model

```
Identity ──< identity_aliases (emails, provider IDs, phone)
   │
   ├──< event_participants (via call_participants, extended)
   │         │
   │      Event ──< Capture (= recordings row) ──< Artifacts
   │         │            │
   │         │            ├── capture_provenance
   │         │            └── access grants (content + existence)
   │         │
   │      event_match_decisions
   │
Organization ──< organization_aliases, organization_domains, memberships
```

### Event resolution: tiers, signals, confidence

Matching is tiered. Cheapest and most certain first. **The metadata tier can never auto-merge alone.**

| Tier | Signal | Strength | Action |
|---|---|---|---|
| 1 — Deterministic | Provider meeting ID (Zoom meeting UUID, Meet conference ID), calendar/iCal UID, meeting URL — read from `source_metadata` | Near-certain | Auto-attach, no scoring |
| 2 — Content proof | Rare n-gram shingle overlap across `transcript_chunks`, aligned on relative offsets | Near-certain | Auto-attach |
| 3 — Metadata | Start-time proximity, duration overlap, resolved-participant overlap | Candidate only | Score → review queue |
| 3 — Metadata (weak) | Title similarity, **suppressed entirely when the title appears in `recurring_call_titles` above threshold** | Weak | Contributes only alongside tier-3 signals |
| Constraint | Speaker alibi — an identity with confirmed speech in event A during interval T cannot be a speaker in a time-disjoint event B during T | Rejects only | Vetoes a candidate; never confirms one |
| Deferred | Audio fingerprinting | High | v2.3 — most connectors deliver no retrievable media |

**Confidence bands and actions**

| Band | Action |
|---|---|
| ≥ 0.95 or any tier-1/tier-2 hit | Auto-attach, logged, reversible |
| 0.70 – 0.95 | Review queue. Never silent. |
| < 0.70 | Keep separate. Recorded, not surfaced. |

**Asymmetric thresholds.** A false merge is a data-exposure incident. A false split is a cosmetic duplicate. Set the bar accordingly.

**The alibi constraint is the differentiator.** A person cannot speak in two places at once. Confirmed speech in one event is an alibi that logically excludes speaking in a time-disjoint other event. That converts fuzzy similarity scoring into constraint satisfaction and lets the system *reject* with certainty rather than probability. Attendance is never an alibi — only `has_confirmed_speech`.

### Identity resolution

- `identities` is the spine. `speakers`, `contacts`, and `call_participants` each gain a nullable `identity_id`. None of the three tables moves or is deleted. Each keeps its existing reader.
- Aliases cover emails, provider participant IDs, display-name variants, and phone numbers.
- **Linkage must be explicit and consented.** OAuth, mailbox verification, domain ownership, or an accepted invitation. Never silent merging on name similarity. Suggested matches go to a review queue with a confidence label.
- Speaker naming propagates across captures of one event by timeline alignment: a capture with real names is ground truth for the intervals it covers, and those names attach to another capture's anonymous labels.
- Diarization over-segmentation is corrected by consensus — where a labeled source shows one speaker across an interval another source split in two, the labeled source wins and the phantom speaker collapses.
- Voiceprinting is out of scope for this milestone (see Decisions Made, #13). Speakers with no calendar data, no attendee list, and anonymous diarization stay unresolved rather than inferred.

### Organization resolution

This answers the original "make organizations live and singular" question.

An organization stops being a tenancy label and becomes a canonical entity with aliases ("Acme Inc.", "ACME LLC"), domains (acme.com, getacme.com), people, and events. It can be claimed and verified by domain ownership.

Explicit limit: **an organization's association with an event does not confer access to captures of that event.** Acme having three attendees on a call does not give Acme rights to your Fathom recording.

### Access and visibility

Two independent policies per capture.

| Policy | Existence visibility | Content access |
|---|---|---|
| Private | Hidden from everyone but the owner | Owner only |
| Private, requestable | Verified participants see a minimal stub with no owner or provider named | Requires owner approval |
| Attendees | Verified attendees | Verified attendees |
| Invitees | Calendar invitees | Calendar invitees |
| Organization | Members of the owning org | Members of the owning org |
| Link | Not searchable | Anyone with the link, per link settings |
| Public | Searchable if explicitly enabled | Anyone |
| Paid / membership | As configured | Requires entitlement — **out of scope for this milestone** |

Event-level visibility is an **aggregate**: the event may be discoverable if any capture's policy permits discovery, and the system reveals only the specific artifacts the current requester is authorized to see.

### Provenance

Every capture carries a lineage record: source provider, original source account, original external ID, original timestamp, who imported it, when CallVault received it, how it matched to its event and at what confidence, and every subsequent permission change.

**Language discipline.** Never use "certified original," "legal proof," or "chain of custody" in UI or marketing. Those claims require cryptographic integrity, consent capture, and legal process that this milestone does not build. Approved vocabulary: *source of record · host-originated recording · original platform artifact · imported copy · verified source · provenance verified · event match confidence.*

### Primary capture selection

"Primary" is a **display default, never a deletion**. It is contextual and per-viewer, resolved in order:

1. Explicit event-steward choice
2. Host or organization designated source of record
3. Verified native platform recording
4. Best available media quality
5. Most complete participant and calendar metadata
6. Best transcript confidence
7. The viewer's personal preferred source
8. Best capture this viewer is authorized to see

Different viewers legitimately see different defaults for the same event.

### Requirements

Each is falsifiable. Prefix IDs are stable and used in the roadmap traceability table.

**Event model (EVT)**

- **EVT-01** — `events` table exists, UUID-keyed, storing canonical start, end, resolution confidence. No content columns.
- **EVT-02** — `recordings.event_id` is nullable and additive. NULL means unresolved, never broken.
- **EVT-03** — `get_workspace_recordings`, `global_search`, chat, and MCP return byte-identical results when `event_id` is NULL across the board. Proven by test.
- **EVT-04** — `events` is not org-scoped. RLS grants visibility through participation or an owned capture, never through `organization_id`.
- **EVT-05** — `call_participants` is extended, not replaced: add `event_id`, `identity_id`, `role` (organizer/invitee/attendee/speaker), `has_confirmed_speech`. The existing `sources: string[]` column is the evidence trail and stays.
- **EVT-06** — `copy_recording_to_org` and `route_recording_cross_org` preserve `event_id` on the copy.
- **EVT-07** — Event reads join through `workspace_entries`. No assumption of `workspace_id` on `recordings`.

**Resolution (MATCH)**

- **MATCH-01** — Deterministic tier: provider meeting ID and calendar UID read from `source_metadata`. A hit resolves with no scoring.
- **MATCH-02** — Content-proof tier: rare n-gram shingle overlap over `transcript_chunks`, aligned on relative offsets.
- **MATCH-03** — The metadata tier may only propose candidates and can never auto-merge alone.
- **MATCH-04** — `checkMatch` gains a mandatory nonzero time-overlap guard, closing F5 inside the function rather than relying on the caller's window.
- **MATCH-05** — Title similarity is suppressed as a match signal when the title appears in `recurring_call_titles` above an occurrence threshold.
- **MATCH-06** — The matcher is provider-agnostic and reads `recordings` + `call_participants` + `transcript_chunks`, replacing the Zoom-and-`zoom_raw_calls`-only path. Existing Zoom behavior is preserved through the new path, not deleted.
- **MATCH-07** — Speaker-alibi constraint rejects candidates. Attendance is never an alibi — only `has_confirmed_speech`.
- **MATCH-08** — Thresholds are asymmetric: high bar to merge, low bar to split.
- **MATCH-09** — Every decision writes to `event_match_decisions`: both capture IDs, tier, score, signal breakdown, decided_by (auto/user/admin), timestamp.
- **MATCH-10** — Every merge is reversible in one atomic operation following the `split_recording_atomic` pattern, with the reversal recorded.
- **MATCH-11** — Confidence bands drive behavior: ≥0.95 auto, 0.70–0.95 review queue, <0.70 keep separate.
- **MATCH-12** — Users can set per-source-pair auto-merge preferences ("always merge my Fathom and Plaud").
- **MATCH-13** — `dedup_priority_mode` and `dedup_platform_order` in `user_settings` continue to work, now selecting which capture *displays first* rather than which row survives. Nothing is discarded.

**Identity (IDENT)**

- **IDENT-01** — An `identities` spine reconciles `speakers`, `contacts`, and `call_participants` without deleting any. Each gains a nullable `identity_id`.
- **IDENT-02** — Resolution spans email aliases, provider participant IDs, and display-name variants.
- **IDENT-03** — A user can attach multiple owned, **verified** email addresses. Verification is required; name similarity alone never links identities.
- **IDENT-04** — Suggested identity matches surface in a review queue with confidence, never auto-applied.
- **IDENT-05** — Speaker names propagate from a labeled capture onto another capture's anonymous labels by timeline alignment.
- **IDENT-06** — Diarization over-segmentation is corrected by consensus.
- **IDENT-09** — Every resolved speaker label carries its confidence and the evidence that produced it.

**Organizations (ORG)**

- **ORG-01** — `organization_aliases` and `organization_domains` exist; an org can carry multiple names and domains.
- **ORG-02** — An org can be claimed and verified via domain ownership.
- **ORG-03** — Duplicate orgs can be merged non-destructively via `canonical_organization_id`, reversibly.
- **ORG-04** — Org association with an event confers no access to any capture of it. Enforced at RLS.

**Reconciliation (RECON)**

- **RECON-01** — Chunks from the captures of one event align on a shared relative timeline derived from content, not wall-clock.
- **RECON-02** — Token disagreements resolve by weighted vote: source-accuracy priors, per-token confidence where exposed, majority.
- **RECON-03** — A per-workspace entity lexicon seeded from `transcript_chunks.entities` breaks ties. This is what produces "ChatGPT" over "ChatGBT."
- **RECON-04** — The reconciled transcript is derived. Source transcripts and chunks are never overwritten and the view is regenerable.
- **RECON-05** — Each reconciled segment stores which captures supplied and agreed on it.
- **RECON-06** — Coverage gaps are explicit. Single-source intervals are shown as single-source, not consensus.
- **RECON-07** — Embedding and search behavior is unchanged for unresolved events. Reconciliation must not silently re-embed the corpus.

**Access (ACCESS)**

- **ACCESS-01** — Content visibility and existence visibility are separate, independently settable per capture.
- **ACCESS-02** — Content is denied by default. Nothing becomes readable through the event layer that wasn't readable through a capture the user could already access.
- **ACCESS-03** — A capture set to hidden existence is invisible in every aggregate count, stub, and search result.
- **ACCESS-04** — A restricted stub reveals no owner, no provider name, no title, and no transcript snippet unless the disclosure policy permits it.
- **ACCESS-05** — Participants can request access to a specific capture. Owners can allow once, allow permanently, allow transcript only, allow video, or deny. Grants are revocable and logged.
- **ACCESS-06** — The settings UI states that the policy governs this capture only.
- **ACCESS-07** — `call_share_links` migrates from `call_recording_id: number` to the `recordings` UUID before event-level access ships.
- **ACCESS-08** — Existing share tokens, coach access, and team access continue to function unchanged.
- **ACCESS-09** — Participant-based existence visibility is capped by event size and type, so a 200-person webinar never exposes an attendee roster.

**Discovery (DISCO)**

- **DISCO-01** — `get_people_summary` and `get_recordings_for_person` gain event-aware, cross-org variants scoped to the caller's verified identities. Existing org-scoped signatures preserved.
- **DISCO-02** — A non-user whose email appears in `call_participants` can be invited to claim participation, verified by email ownership.
- **DISCO-03** — Claiming grants existence visibility and the ability to request access. No content by default.

**Safety (SAFE)**

- **SAFE-01** — All resolution runs behind a feature flag, off by default, enableable per organization.
- **SAFE-02** — Shadow mode computes and records proposed merges without applying them.
- **SAFE-03** — A kill switch reverts all auto-merges within a time range in one operation.
- **SAFE-04** — Cross-org false merges are blocked at RLS: resolution must never widen either capture's readable audience.
- **SAFE-05** — `events`, extended `call_participants`, and `event_match_decisions` are registered in the existing `CROSS_ORG_TABLES` CI gate.
- **SAFE-06** — Shadow precision is measured against a hand-labeled set before SAFE-01 is enabled for any org. Target: false-merge rate ≤ 0.1%.
- **SAFE-07** — Phase 29 begins by regenerating `src/types/supabase.ts` from the live database and reconciling against `supabase/migrations/`, resolving F16 and F17 before any new migration is authored.

### Out of scope

| Excluded | Reason |
|---|---|
| Attendance conferring automatic content access | No such right exists by default. Attendance grants discovery and a request path. |
| Paid / membership access to another person's capture | Monetizing access to content you don't own is a legal problem before it's a product. Phase 4 territory, with counsel. |
| A public global event index | Discovery is scoped to the caller's own verified participation. Public is an affirmative publishing action, never inferred from an import. |
| Audio fingerprinting | Most connectors deliver no retrievable media. Transcript shingles capture most of the value. v2.3. |
| Renaming `recordings` to `captures` | 98 tables and dozens of RPCs read it. Separate milestone. |
| Physically merging `speakers` / `contacts` / `call_participants` | Three different scopes. `identity_id` links them; consolidation is later. |
| Retiring `fathom_calls` / legacy BIGINT keys | Separate migration, except the `call_share_links` fix in ACCESS-07. |
| Automatic cross-org event merging | Highest blast radius. Gate behind explicit user action after single-org precision is proven. |
| Becoming a recording tool or media store | CallVault stores metadata, transcripts, and links. It is a provenance system. |

---

## Decisions Made

These are locked. Do not relitigate them in planning.

1. **A conversation event is not owned like a file.** It is a shared real-world occurrence with multiple relationships and claims.
2. **Captures are individually owned and permissioned.** The importer, their workspace, and applicable policy govern access.
3. **Never destructively deduplicate.** Resolve captures to a canonical event while preserving every source's content, history, and controls.
4. **Privacy defaults to private.** Do not expose participation, metadata, owners, provider names, or content beyond what each policy permits.
5. **Attendance does not equal access.** A person may be eligible to discover or request without receiving.
6. **Discovery and access are separate policies.** An event can be a visible stub while its captures stay protected.
7. **Every merge carries a confidence level and is reversible.** Users and admins can split incorrect merges and see why the link was made.
8. **Identity linkage must be verified and consented.** Never silent merging on name similarity.
9. **"Primary" is a display choice, not destruction of alternatives.**
10. **Provenance is transparent and practically immutable.** Origin, import history, match decisions, and permission changes are preserved.
11. **Ownership splits four ways**, and the code must keep them distinct: *organizer/host* (who scheduled it), *capture owner* (who imported it), *event participant* (who attended), *event steward* (who may maintain canonical event metadata). There is no single "call owner."
12. **The table stays `recordings`.** "Capture" is the word in UI and new code.
13. **Voiceprinting is out of scope for this milestone.** Not deferred internally as a later phase — cut entirely from v2.2's requirement set. IDENT-07/IDENT-08 (voiceprint embeddings, voiceprint-only speaker naming) and the former Phase 35 are removed. Speakers with no calendar data, no attendee list, and anonymous diarization simply stay unresolved rather than inferred. Revisit only as its own milestone, with a consent and retention posture in place before any code is written (BIPA, Texas CUBI, GDPR Art. 9 all apply to biometric voice data).

---

## Edge Cases

Each of these silently corrupts the graph if unhandled. All must have a test.

| Case | Handling |
|---|---|
| **Recurring meetings** — same title, same attendees, same time-of-day, different day | MATCH-04 nonzero-overlap guard plus MATCH-05 recurring-title suppression. This is the F5 bug. |
| **Breakout rooms** — one conference ID, several simultaneous distinct conversations | Tier 1 alone will falsely merge them. Content must confirm when a conference ID resolves to multiple disjoint transcripts. |
| **Partial captures** — someone joins 40 minutes late and records 20 minutes | Sub-interval containment, not window overlap. Union timeline with explicit coverage gaps (RECON-06). |
| **Clock skew** — Plaud, phone, laptop, and Zoom's server disagree by seconds to minutes | Align on content, derive the offset. Never trust absolute wall-clock across sources. |
| **Timezone and DST** | All storage in UTC; all matching on UTC instants. |
| **Large webinars** — 200 attendees | Attendee-set matching is useless and participant-based existence visibility becomes a privacy problem. ACCESS-09 caps it. |
| **Genuine double-booking** — silent presence in two calls | Common and real. Only `has_confirmed_speech` is an alibi (MATCH-07). |
| **Back-to-back calls** — same people, 3:00 and 3:30 | Nonzero-overlap guard plus duration bounds. |
| **Split recordings** — one event captured as two files by one tool | `split_recording_atomic` already exists; both parts attach to one event. |
| **Cross-org copies** — same event, two orgs | `event_id` preserved (EVT-06), but RLS must guarantee resolution never widens either capture's audience (SAFE-04). |
| **Zero-transcript captures** — audio only, not yet transcribed | Tier 2 unavailable. Falls to tier 1 or the review queue. Must not error. |
| **Identity collision** — two real people, same name, same company | Verified-linkage-only (IDENT-03) prevents it. Never auto-link on name. |

---

## Legal and compliance posture

**Confidence flag: this section is an unverified synthesis, not researched legal advice.** It was assembled from general principles and has not been checked against current statutes or case law. Nothing here should ship as user-facing legal copy, and the monetization and public-access phases require counsel review before design.

Three legally distinct questions get conflated by the phrase "who owns the call." Keep them separate in the data model.

**1. Copyright in the recording.** Generally attaches to whoever made the fixation (or their employer), not to whoever hosted the meeting. Three people running three recorders produce three independently owned works. **This is why the capture-level ownership model is the legally coherent one**, and it is the strongest argument for the architecture in this spec.

**2. Consent to record.** Varies by jurisdiction — one-party versus all-party consent regimes exist within the US, and further rules apply elsewhere. **Do not hardcode a jurisdiction list into application logic.** Instead: store the applicable jurisdiction as a data field on the capture where determinable, default to the more restrictive posture when unknown, and make "attendees" rather than "public" the safe default for sharing.

**3. A participant's right to access.** In the US there is generally no automatic right to a copy of someone else's recording — access flows from contract or permission, which is exactly the request/approve model specified here. Under GDPR-style regimes a participant is a data subject with a right of access to their own personal data, which can include their voice in a recording.

**Engineering implications, which are the actionable part:**

- Support a data-subject export and deletion path scoped to a requesting individual's own contributions.
- Store consent and jurisdiction metadata on captures where the provider supplies it.
- Default every new capture to the most restrictive policy.
- Public and paid access require an affirmative publishing action plus takedown, dispute, and retention processes — all out of scope here.

---

## Decisions Resolved (2026-08-31)

Previously open, now locked. Do not relitigate in planning.

1. **`events` lives in the same Postgres database as `recordings`** — same prod Supabase project (`vltmrnjsubfzrgrtdqey`), no physical separation. The only real change is that `events`' RLS policy grants visibility through participation or an owned capture, never through `organization_id` — the first non-org-scoped table in the schema, not a new database.
2. **Forward-only.** Resolution runs from a cutover date. No backfill of the historical corpus in this milestone. An opt-in per-org backfill may be considered later, after precision is proven.
3. **Unresolved is the default display state.** Captures show as they do today; the system surfaces "N possible copies of this call" as a prompt the user confirms.
4. **A new `identities` table is the spine.** `speakers`, `contacts`, and `call_participants` all gain a nullable `identity_id` referencing it; none moves first.
5. **No event steward in v1.** Canonical event metadata is system-derived and not user-editable until the ownership model is exercised in production.
6. **Voiceprinting is fully out of scope for this milestone** (see Decisions Made, #13) — not deferred to a later phase within v2.2, cut from the requirement set entirely. Revisit only as a separate, later milestone.

---

## Priority

Phases 29–31 are load-bearing and deliver the visible product win with **no fuzzy auto-merge running in production**. Everything after builds on a foundation that cannot corrupt data.

| Phase | Name | Requirements |
|---|---|---|
| 29 | Schema reconciliation + event model foundation | SAFE-07, EVT-01..05, EVT-07, SAFE-05 |
| 30 | Deterministic resolution, shadow mode only | MATCH-01, MATCH-09, MATCH-10, MATCH-11, SAFE-01, SAFE-02 |
| 31 | Match-rule hardening + provider-agnostic matcher | MATCH-03..06, MATCH-08, MATCH-12, MATCH-13, SAFE-03, SAFE-04, SAFE-06 |
| 32 | Content-proof matching + alibi constraint | MATCH-02, MATCH-07 |
| 33 | Identity consolidation | IDENT-01..04, IDENT-09 |
| 34 | Speaker resolution across captures | IDENT-05, IDENT-06 |
| 35 | Live organizations | ORG-01..04 |
| 36 | Transcript reconciliation | RECON-01..07 |
| 37 | Access policy, share-link key migration, request flow | ACCESS-01..09, EVT-06 |
| 38 | Discovery and claim | DISCO-01..03 |

**Coverage:** 60 requirements, 60 mapped, 0 unmapped. (Voiceprint requirements IDENT-07/IDENT-08 and the former Phase 35 removed 2026-08-31 — out of scope for this milestone.)

Product-level phasing, for sequencing conversations with users rather than the agent: **Phase A** unified personal vault (private-first, valuable with zero other CallVault users) → **Phase B** live organization vaults → **Phase C** verified attendee discovery and request → **Phase D** public/paid, only after the access model is mature.

### Metrics

- Merge precision (false-merge rate — the number that gates SAFE-01)
- Merge recall (% of true duplicate captures resolved)
- % of a user's captures unified across tools
- Events per user after multi-email linking versus before
- Request → grant rate, and time-to-find for a recovered old conversation

---

## Implementation Notes

**Before anything else.** Regenerate `src/types/supabase.ts` from the live database and diff it against `supabase/migrations/`. F16 and F17 mean neither is currently truthful. Any plan built on the migration folder alone is built on a fiction.

**Hook point.** Resolution runs after `runPipeline` at the `_shared/canonical-recording.ts` seam. `CanonicalRecording` already carries `transcriptTurns` with `providerSpeakerId`, `speakerName`, `speakerEmail`, and `startSeconds` — everything speaker resolution needs. No connector changes.

**Patterns to reuse rather than reinvent:**
- `COALESCE`-then-fallback reader pattern from `20260618160000_recordings_canonical_ai_title.sql` — this is the model for EVT-03
- `split_recording_atomic` transactional shape — the model for atomic merge/unmerge (MATCH-10)
- The `connector-sync-all` idempotency pattern (fast-path lookup, then `EXCEPTION WHEN unique_violation` fallback) — the model for concurrent resolution
- Existing `CROSS_ORG_TABLES` CI gate — extend, don't duplicate

**Migration discipline.** `IF NOT EXISTS` everywhere, every new column nullable, every existing RPC signature preserved. Nothing new keys on `fathom_provider_id`, `call_share_links.call_recording_id: number`, or `transcript_chunks.recording_id: number`.

**RLS is the boundary, not application code.** Every path where resolution could widen a readable audience is blocked in policy, and SAFE-04 is proven by a live cross-org isolation test against the TEST project, matching the Phase 24 precedent.

---

## Related Documentation

- `.planning/milestones/v2.2-REQUIREMENTS.md` — GSD-native requirements and traceability for this spec
- `docs/archive/specs-legacy/2026-02-11/SPEC-sharing-and-access-control.md` — the three-model sharing system this extends
- `supabase/functions/_shared/dedup-fingerprint.ts` — the matcher being hardened (F4, F5)
- `supabase/functions/_shared/canonical-recording.ts` — the ingest seam
- `supabase/RLS_POLICY_VERIFICATION.md` — not yet read; required reading before Phase 29
- `20260730160000_fix_cross_org_copy_dedup.sql` — the cross-org duplication history

---

*Spec drafted: 2026-08-30*
*Evidence base: full read of Vibe-Marketer/brain @ main — 288 migrations, `src/types/supabase.ts` (98 tables), `supabase/functions/_shared/`*
