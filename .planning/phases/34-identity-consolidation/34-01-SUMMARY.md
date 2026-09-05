---
phase: 34-identity-consolidation
plan: 01
subsystem: database
tags: [postgres, supabase, rls, identity-resolution, grep-sweep, reversibility-gate]

# Dependency graph
requires:
  - phase: 30-schema-reconciliation-event-model-foundation
    provides: non-org-scoped RLS precedent (events table, user_participates_in_event SECURITY DEFINER pattern, CR-01 fix) that Task 2's locked identities RLS design mirrors
provides:
  - Complete, classified inventory of every speakers/contacts/call_participants/call_speakers reader across src/, supabase/functions/, and supabase/migrations/ (64 call sites/functions enumerated)
  - Machine-readable reader-inventory.json (46 SELECT-bearing entries on speakers/contacts/call_participants) for Plan 02's noop test to verify coverage programmatically
  - Locked, human-approved identity spine design (identities/identity_aliases schema, non-org-scoped RLS pattern, custom-OTP email verification, redacted evidence RPC, lazy identity creation, edge-function resolver) carried verbatim into Plans 02/03/04
affects: [34-02-PLAN, 34-03-PLAN, 34-04-PLAN, 35-speaker-resolution, 39-discovery-and-claim]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reader-inventory-before-migration: a full grep sweep classifying every reader EXPLICIT-COLUMNS vs BARE-SELECT-STAR/NOARGS before authoring an additive schema change, producing both a prose artifact (reader-inventory.md) and a machine-readable one (reader-inventory.json) for downstream automated verification"

key-files:
  created:
    - .planning/phases/34-identity-consolidation/reader-inventory.md
    - .planning/phases/34-identity-consolidation/reader-inventory.json
    - .planning/phases/34-identity-consolidation/34-01-SUMMARY.md
  modified: []

key-decisions:
  - "Task 2 reversibility gate resolved as option-a, approved as-is, no knob changes (pre-resolved by Andrew outside this executor invocation)"
  - "identity_id (nullable UUID FK) is added to speakers, contacts, and call_participants only -- NOT call_speakers, which stays a legacy join table documented for context but unchanged"
  - "reader-inventory.json's table enum is scoped to exactly speakers|contacts|call_participants (the 3 tables gaining identity_id), matching the additional_requirement's schema literally -- call_speakers readers are fully documented in the .md but excluded from the JSON since call_speakers itself never gains the new column"

patterns-established:
  - "Pattern: JSON sidecar for a prose inventory artifact, so a later plan's automated test can assert coverage completeness (readers.length === total, every enumerated table in an allowed enum) rather than trusting prose alone"

requirements-completed: [IDENT-01]

# Metrics
duration: ~12min
completed: 2026-09-05
---

# Phase 34 Plan 01: Reader Inventory + Identity Spine Reversibility Gate Summary

**Full grep-sweep reader inventory (64 call sites/functions, 3 flagged REQUIRES-ATTENTION) plus a human-approved lock on the identities/identity_aliases schema, non-org-scoped RLS pattern, and custom-OTP email verification design for Phases 34-39**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-09-05T19:43:12Z
- **Completed:** 2026-09-05T19:55:31Z
- **Tasks:** 2 (1 auto, 1 checkpoint:decision)
- **Files modified:** 3 (2 new inventory artifacts + this summary)

## Accomplishments

- Enumerated and classified every `speakers`/`contacts`/`call_participants`/`call_speakers` reader across `src/`, `supabase/functions/`, and live SQL in `supabase/migrations/` — 64 call sites/functions total, cross-checked against historical/superseded migration versions (e.g., `global_search` and `get_available_metadata` were each redefined 3-4 times; only the current live definition was classified).
- Produced both a prose artifact (`reader-inventory.md`, 159 lines) and a machine-readable sidecar (`reader-inventory.json`, 46 SELECT-bearing entries) so Plan 02's noop test can assert coverage completeness programmatically instead of trusting prose.
- Found and precisely located the only 3 REQUIRES-ATTENTION readers in the entire codebase: two in `src/hooks/useContacts.ts` (a bare `select("*")` at line 498 powering the main contacts list, and a bare no-arg `.select()` at line 663 on `createContactMutation`), and one test-infrastructure reader (`rls-regression.test.ts`'s generic `CROSS_ORG_TABLES` loop, which does `select("*")` but only checks row count/emptiness).
- Confirmed a pre-existing RLS-regression coverage gap (not fixed, out of scope): `contacts` and `speakers` are not registered in `CROSS_ORG_TABLES` at all, unlike `call_participants`/`call_speakers` — flagged for Plan 02's awareness of the current baseline before it registers `identities`/`identity_aliases`.
- Recorded the `contacts.org_id` vs `call_participants.organization_id` naming inconsistency and the `participant_type` vs `role` column distinction, plus a "Match sites for the resolver" table confirming no existing column on any of the three tables stores a provider-participant-ID signal (only `email`) — direct input to Plan 04's resolver design.
- Task 2's reversibility gate (identities/identity_aliases schema, RLS pattern, OTP mechanism) resolved and recorded per pre-existing human approval — no re-presentation needed, no knob changes.

## Task Commits

Each task was committed atomically:

1. **Task 1: Enumerate and classify every speakers/contacts/call_participants reader** - `a767dea0` (docs)
2. **Task 2: Reversibility gate — lock the identity spine schema, RLS pattern, and OTP mechanism** - no code/file commit (decision-only gate, `<files>none`); the resolution is recorded in this SUMMARY per the plan's own instruction ("Record the choice ... in this plan's SUMMARY")

**Plan metadata:** committed alongside this SUMMARY (docs: complete plan)

## Files Created/Modified

- `.planning/phases/34-identity-consolidation/reader-inventory.md` - Classified prose inventory of all 64 speakers/contacts/call_participants/call_speakers readers (SAFE vs REQUIRES-ATTENTION), naming-inconsistency facts, resolver match-site table, pre-existing-gap notes
- `.planning/phases/34-identity-consolidation/reader-inventory.json` - Machine-readable sidecar (46 entries) scoped to the 3 tables gaining `identity_id`, for Plan 02's automated noop-test coverage check

## Decisions Made

**Task 2 reversibility gate — RESOLVED: option-a, approved as-is, no knob changes.** Pre-resolved by Andrew outside this executor invocation (per this invocation's explicit instruction not to re-present the checkpoint). The locked design, carried verbatim into Plans 02/03/04:

- `identities`: `id UUID PK`; `owner_user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL` (nullable — an identity is "claimed" only when a user verifies an email against it); `display_name TEXT NULL`; `created_at`/`updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`. NO `organization_id` (non-org-scoped, mirroring `events`/EVT-04).
- `identities` RLS: ENABLE + FORCE; SELECT via a `user_can_view_identity(id, auth.uid())` SECURITY DEFINER helper = owner OR participation via `call_participants.identity_id` + `is_organization_member` OR `contacts.identity_id` + `is_organization_member`; owner-only UPDATE; service-role FOR ALL. Mirrors the audited `events` participation-RLS precedent (including its CR-01 fix), not the `contacts`/`call_participants` org-only pattern.
- `identity_aliases`: `id`; `identity_id` FK ON DELETE CASCADE; `alias_type` CHECK IN (`'email'`,`'provider_participant_id'`,`'display_name'`); `value` (normalized `lower(trim())` for email); `provider TEXT NULL`; `verified BOOLEAN NOT NULL DEFAULT false`; `verified_at`; `confidence NUMERIC NULL`; `evidence TEXT NOT NULL`; `created_at`. Partial `UNIQUE INDEX (alias_type, value) WHERE verified = true`.
- `identity_id`: nullable UUID FK -> `identities(id) ON DELETE SET NULL` added to `speakers`, `contacts`, AND `call_participants`. All additive, all nullable — this plan's reader inventory (Task 1) is the evidence that no existing reader breaks.
- Email verification (IDENT-03): `identity_alias_verifications` table (service-role-only) + `request-email-alias-verification` / `confirm-email-alias-verification` edge functions, reusing the existing Resend integration. 6-digit CSPRNG code, SHA-256 hashed at rest, 10-min expiry, 5-attempt cap, per-user request rate limit. Never touches `auth.users` or the session.
- `get_identity_evidence(p_identity_id)` SECURITY DEFINER RPC returns `(alias_type, confidence, evidence)` only — never raw `value` (email).
- Identity creation is LAZY: a row is created on first email verification (or first deterministic provider-id resolution), consistent with the milestone's forward-only philosophy.
- Resolver runs as a `resolve-identities` edge function mirroring `resolve-events`.

**Task 1 scope decision:** `reader-inventory.json`'s `table` enum was scoped to exactly `speakers|contacts|call_participants` per the additional_requirement's literal schema, rather than adding a 4th `call_speakers` value. This is correct, not a shortcut — `call_speakers` is a legacy join table that is NOT gaining an `identity_id` column under the locked Task 2 design, so it has no column-shape risk to track in the coverage JSON. Its readers are still fully documented in `reader-inventory.md`'s dedicated section for context.

## Deviations from Plan

None — plan executed exactly as written, with one additive enhancement per this invocation's explicit `<additional_requirement>`: `reader-inventory.json` was produced alongside `reader-inventory.md` (not originally specified in the PLAN.md `must_haves.artifacts`, which named only the `.md` file). This is documented here rather than as a Rule 1/2/3 auto-fix since it was an explicit, pre-authorized instruction from the invoking orchestrator, not a discovered bug or gap.

## Issues Encountered

- The `.select(` and `CREATE OR REPLACE FUNCTION` grep passes were initially rewritten transparently by this environment's RTK (Rust Token Killer) hook into a grouped/summarized form that truncated multi-match output (e.g., `"34 matches in 0 files: [+34 more]"`), which would have caused an incomplete sweep if trusted. Resolved by using `rtk proxy grep` for every pass that needed full line-by-line detail, ensuring the inventory's exhaustiveness claim is backed by actually-inspected output rather than a truncated summary.
- `get_people_summary` and `get_recordings_for_person` (both classified SAFE, explicit-columns) have no located live `.rpc()` caller in `src/`/`supabase/functions/` despite their own migration comments describing production use ("Powers the People tab"). Not investigated further — a read-only inventory task should not speculate on why a function appears unused; noted as a discrepancy in `reader-inventory.md` for whoever next touches the People tab or these RPCs.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02 (identities/identity_aliases DDL) can proceed immediately: the reversibility gate is resolved (option-a), the reader inventory proves IDENT-01's "existing readers unchanged" precondition is checkable, and the 3 REQUIRES-ATTENTION readers are precisely located for its noop test to exercise.
- Plan 02 should decide whether to also register `contacts`/`speakers` in `rls-regression.test.ts`'s `CROSS_ORG_TABLES` array while it's already touching that file to add `identities`/`identity_aliases` — flagged as a pre-existing gap, not a blocker.
- No blockers. No migration, no source file, and no RLS policy exists yet — Plan 02 starts from a clean, fully-inventoried baseline.

---
*Phase: 34-identity-consolidation*
*Completed: 2026-09-05*

## Self-Check: PASSED

- FOUND: `.planning/phases/34-identity-consolidation/reader-inventory.md`
- FOUND: `.planning/phases/34-identity-consolidation/reader-inventory.json`
- FOUND: `.planning/phases/34-identity-consolidation/34-01-SUMMARY.md`
- FOUND commit: `a767dea0`
