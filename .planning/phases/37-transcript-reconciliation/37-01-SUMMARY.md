---
phase: 37-transcript-reconciliation
plan: 01
subsystem: database
tags: [postgres, rls, security-definer, supabase, transcript-reconciliation]

# Dependency graph
requires:
  - phase: 35-speaker-resolution-across-sources
    provides: deriveAbsoluteInterval/intervalsOverlapWithTolerance interval-alignment primitives, speaker_resolution_decisions ledger precedent
  - phase: 31-event-resolution-shadow-mode
    provides: event_match_decisions ledger shape, append-only-ledger + FORCE RLS + SECURITY DEFINER conventions
provides:
  - reconciled_transcript_segments table (derived, non-destructive, full delete+rebuild per event)
  - user_can_view_event_reconciliation SECURITY DEFINER helper (first client-readable ledger RLS gate in the v2.2 milestone)
  - Locked schema/RLS/gating-condition decisions for Plans 02-05
affects: [37-02-token-reconciler-pure-module, 37-03-reconcile-transcripts-edge-function, 37-04-reconciled-ui-tab, 37-05-prod-apply]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "First client-readable ledger table in this milestone: SECURITY DEFINER RLS helper mirrors the underlying recordings SELECT-policy predicate (owner/org-admin/workspace-membership) plus events' own participation grant, rather than inventing a new/weaker predicate"

key-files:
  created:
    - supabase/migrations/20260910000000_create_reconciled_transcript_segments.sql
  modified:
    - src/types/supabase.ts
    - src/test/rls-regression.test.ts

key-decisions:
  - "Task 1 reversibility gate auto-resolved to the RESEARCH-recommended default (option-a) under config.json workflow.auto_advance=true (gate=blocking-human=false, schema-design decision applied to TEST only this plan, prod apply gated to Plan 05) -- not a manual pause"
  - "Column shape: id, event_id (ON DELETE CASCADE, not SET NULL -- pure derived cache, not an audit trail), segment_text, start_time, end_time, source_recording_ids UUID[], agreeing_recording_ids UUID[] (both sorted ascending by recording UUID for reproducible regeneration), signals JSONB, organization_id, created_at -- no UNIQUE constraint (full delete+rebuild write path per RESEARCH Pitfall 5)"
  - "RLS: user_can_view_event_reconciliation(p_event_id) SECURITY DEFINER helper checks the SAME three predicates recordings' own SELECT policy uses (owner_user_id, is_organization_admin_or_owner, workspace_entries+workspace_memberships) plus user_participates_in_event -- a subset-of-recordings-access check, not an independently invented one, satisfying the plan's no-widening prohibition by construction"
  - "Reconciliation-eligibility gating (governs Plan 02's edge-function query, not this migration): option-a -- gate on event_match_decisions.decision='merge_applied' alone. Speaker resolution is NOT a hard gate (speaker_resolution_decisions only records positive resolutions and would permanently exclude the dominant all-already-named event shape per RESEARCH Pitfall 3)"
  - "Interval-primitive reuse: deriveAbsoluteInterval is already exported from speaker-resolver.ts and will be imported verbatim by Plan 02/03. intervalsOverlapWithTolerance/CLOCK_DRIFT_TOLERANCE_MS are currently private -- Plan 02 must export them additively rather than duplicating the DP"
  - "fastest-levenshtein alignment path: independently re-verified via node_modules/fastest-levenshtein's .d.ts (exposes only distance()/closest(), no alignment/edit-script output) -- confirms RESEARCH Assumption A1 as fact, not assumption. A hand-rolled Wagner-Fischer DP is required for Plan 02's token-level disagreement detection"

patterns-established:
  - "Client-facing ledger RLS pattern: gate through a SECURITY DEFINER helper that re-derives the SAME access predicate the underlying source table's own SELECT policy uses, rather than adding a parallel/independent check -- reusable for any future derived/client-readable table in this milestone"

requirements-completed: [RECON-04, RECON-05, RECON-06]

# Metrics
duration: ~55min
completed: 2026-09-10
---

# Phase 37 Plan 01: Reversibility Gate + Derived Transcript Storage Layer Summary

**Locked Phase 37's five one-way-door decisions and landed `reconciled_transcript_segments` -- the first client-readable ledger table in the v2.2 milestone -- live on TEST with a SECURITY DEFINER RLS gate proven by adversarial cross-org tests.**

## Performance

- **Duration:** ~55min
- **Tasks:** 3 (1 checkpoint auto-resolved + 2 auto)
- **Files modified:** 3

## Accomplishments
- Authored and TEST-applied `reconciled_transcript_segments`: full delete+rebuild-per-event derived ledger, no UNIQUE conflict target, FORCE RLS, service-role write policy, and a NEW client-facing SELECT policy gated by `user_can_view_event_reconciliation` -- proven live via direct REST/OpenAPI introspection (all columns + COMMENT text confirmed on TEST).
- Designed the SECURITY DEFINER helper to check the exact same access predicates `recordings`' own SELECT policy uses (ownership, org admin/owner, workspace membership) plus event participation -- satisfying the "no widening through the derived layer" prohibition by construction rather than by review.
- Registered a bespoke cross-org isolation block in `rls-regression.test.ts` (not the generic deny-all registries, since this table has a real client policy): service-role existence proof, Org A positive read, Org B negative deny. Full suite green at 78/78 including the 3 new tests.
- Independently re-verified two RESEARCH assumptions rather than trusting them: `fastest-levenshtein`'s `.d.ts` confirmed no alignment-path export exists (hand-rolled DP required for Plan 02), and `deriveAbsoluteInterval` confirmed already exported from `speaker-resolver.ts` (directly importable, no duplication needed).
- Zero new TypeScript errors after splicing the table + RPC delta into `src/types/supabase.ts` by hand (321/321 baseline, matching the Plan 34-02/36-03 precedent of not regenerating the whole file).

## Task Commits

1. **Task 1: Reversibility gate** - auto-resolved (no commit; decision recorded in this SUMMARY + migration header comments per the acceptance criteria)
2. **Task 2: Author + TEST-apply the reconciled_transcript_segments migration with client-facing RLS** - `f216c55a` (feat)
3. **Task 3: Register reconciled_transcript_segments cross-org isolation in rls-regression.test.ts** - `a07f011a` (test)

**Plan metadata:** commit follows this SUMMARY

## Files Created/Modified
- `supabase/migrations/20260910000000_create_reconciled_transcript_segments.sql` - new table + `user_can_view_event_reconciliation` SECURITY DEFINER helper + FORCE RLS + 2 policies + dense comments recording all 5 Task-1 decisions
- `src/types/supabase.ts` - spliced `reconciled_transcript_segments` Row/Insert/Update/Relationships + `user_can_view_event_reconciliation` RPC entry
- `src/test/rls-regression.test.ts` - new `reconciledSegmentId` fixture (seeded 5i-2, reuses eventAId/recordingAId/orgAId), explicit afterAll cleanup, and a 3-test bespoke isolation block (existence proof, Org A read, Org B deny)

## Decisions Made
See `key-decisions` in frontmatter above -- all five Task 1 one-way-door decisions (column shape, RLS/SECURITY-DEFINER design, eligibility gating, interval-primitive reuse, fastest-levenshtein alignment-path finding) are recorded there and in the migration file's header comment for permanent traceability.

## Deviations from Plan

None - plan executed as written. Task 1's checkpoint was auto-resolved per this project's `config.json` `workflow.auto_advance=true` (the gate is `blocking-human=false` -- a schema-design decision applied to TEST only, with prod apply explicitly deferred to Plan 05 per the executor's own instructions), using the RESEARCH-recommended default (option-a) with no knob overrides.

## Threat Flags

None. The new client-facing read surface (T-37-01) was the plan's own explicitly anticipated threat, mitigated by `user_can_view_event_reconciliation` and proven by the new adversarial RLS test block -- not an undocumented surface.

## Known Stubs

None. This plan is schema-only; no UI or edge-function code that could stub data was created.
