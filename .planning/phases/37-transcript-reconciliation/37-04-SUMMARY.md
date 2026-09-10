---
phase: 37-transcript-reconciliation
plan: 04
subsystem: frontend
tags: [react, tanstack-query, shadcn, transcript-reconciliation, call-detail-dialog]

# Dependency graph
requires:
  - phase: 37-transcript-reconciliation
    plan: 01
    provides: "reconciled_transcript_segments table (RLS-gated client read via user_can_view_event_reconciliation)"
  - phase: 37-transcript-reconciliation
    plan: 03
    provides: "reconcile-transcripts edge function (populates the table this UI reads from)"
affects: [37-05-prod-apply]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Conditional tab trigger+content pattern: a new SelectionButton + TabsContent pair is only mounted when an eligibility hook resolves truthy — first precedent in CallDetailDialog for a genuinely absent (not disabled) tab, reusable for any future event-scoped tab."

key-files:
  created:
    - src/services/reconciledTranscript.service.ts
    - src/hooks/useReconciledTranscript.ts
    - src/components/call-detail/CallReconciledTranscriptTab.tsx
    - src/components/call-detail/ReconciledSegmentProvenanceBadge.tsx
  modified:
    - src/lib/query-config.ts
    - src/components/CallDetailDialog.tsx
    - src/components/call-detail/CallDetailHeader.tsx

key-decisions:
  - "Eligibility (tab visibility gate) is derived client-side from recordings.event_id + a same-event recordings count (>=2), not from event_match_decisions directly -- event_match_decisions is NOT client-readable (37-01-SUMMARY.md: reconciled_transcript_segments is 'the first client-readable ledger table in this milestone'), so re-deriving eligibility from a ledger the client can't read was not an option. Both reads (recordings.event_id lookup + same-event count) are RLS-gated by the existing recordings SELECT policy -- no new read surface, satisfying the plan's 'smallest additional read' instruction."
  - "Added getReconciliationEligibility + useReconciliationEligibility and getRecordingLabels + useRecordingLabels beyond the plan's Task-1-listed service/hook surface (getReconciledTranscript/useReconciledTranscript only) -- Rule 2 (missing critical functionality): Task 3's own action text explicitly authorizes 'the smallest additional read' for eligibility, and the UI-SPEC's popover copy contract requires listing 'agreeing source recording labels', which the segment row's agreeing_recording_ids (UUIDs only) cannot supply without a lookup."
  - "reconciledTranscript.recordingLabels query key sorts the recordingIds array before using it as a cache key (queryKeys.reconciledTranscript.recordingLabels) -- avoids cache-key thrash from array-order differences across renders for the same UUID set."

patterns-established:
  - "Eligibility-gated conditional tab: useReconciliationEligibility(recordingUuid, open) resolves {eventId, recordingCount} once via two RLS-gated reads, and both the SelectionButton and its TabsContent check the same boolean -- prevents the shown-then-empty disabled-tab anti-pattern UI-SPEC explicitly prohibited."

requirements-completed: [RECON-05, RECON-06]

# Metrics
duration: ~50min
completed: 2026-09-10
---

# Phase 37 Plan 04: Reconciled Transcript UI Tab Summary

**Added a read-only "Reconciled" tab to CallDetailDialog with per-segment consensus provenance badges (RiGitMergeLine, visible only for 2+ agreeing sources) and a CallDetailHeader "N recordings" affordance -- conditionally rendered so the tab is entirely absent, not disabled, on events with fewer than 2 resolved recordings, and per-recording transcript tabs remain completely untouched.**

## Performance

- **Duration:** ~50min
- **Tasks:** 3 (all auto, no checkpoints)
- **Files modified:** 7 (4 created, 3 modified)

## Accomplishments

- `reconciledTranscript.service.ts` + `useReconciledTranscript.ts`: pure async `getReconciledTranscript(eventId)` mirroring `identity-evidence.service.ts`'s throw+`?? []` convention, direct RLS-gated select against `reconciled_transcript_segments` ordered by `start_time` -- relies entirely on Plan 01's `user_can_view_event_reconciliation` SELECT policy, no new client read surface for segment data itself.
- `ReconciledSegmentProvenanceBadge.tsx`: copies `IdentityEvidenceBadge`'s popover-trigger structure verbatim (icon-only `h-5 w-5` trigger, `w-64 p-3` popover, Skeleton loading), swaps `RiShieldCheckLine` -> `RiGitMergeLine`, renders `null` for `agreeing_recording_ids.length < 2` (the Rules-of-Hooks-safe way: the data hook is always called, the early-return happens after, so single-source segments genuinely mount zero badge/popover scaffolding).
- `CallReconciledTranscriptTab.tsx`: memo'd `TabsContent(value="reconciled")`, `font-montserrat font-extrabold uppercase tracking-wide text-sm` heading per Typography contract, ScrollArea-wrapped segment list, and all three UI-SPEC copywriting-contract states verbatim (loading -> Skeleton, empty -> "Reconciliation pending" + spec body, error -> spec error copy referencing per-recording tabs as fallback).
- `CallDetailDialog.tsx`: extended the `activeTab` union with `"reconciled"`, added a conditionally-rendered `SelectionButton` (icon `RiGitMergeLine`, label "Reconciled") and conditionally-rendered `CallReconciledTranscriptTab` inside the existing `<Tabs>` -- both gated on the same `isReconciliationEligible` boolean derived from a new `useReconciliationEligibility` hook, so the tab is never shown-then-empty.
- `CallDetailHeader.tsx`: added an outline `Badge` reading "{N} recordings" (same visual weight/pattern as `RoutingTraceBadge`'s outline badge) rendered only when `isReconciliationEligible` is true -- informational, no click handler, no CTA.
- Zero new TypeScript errors: `tsc -p tsconfig.app.json` stayed at the pre-existing 321-error baseline (confirmed identical baseline count to 37-01-SUMMARY.md) across all three tasks. `vitest run` showed 12 pre-existing failures (AuditSection, DashboardSection.recurrence, SupportTicketDialog, mcp-server sec-jwt-fix) -- none touch `CallDetailDialog`/`CallDetailHeader`/`call-detail/` and none are new; the three test files that do import those components were unaffected.

## Task Commits

1. **Task 1: Service + hook + query key for reconciled segments** - `fc00a6cf` (feat)
2. **Task 2: CallReconciledTranscriptTab + ReconciledSegmentProvenanceBadge** - `3c9c6d32` (feat)
3. **Task 3: Wire the tab into CallDetailDialog + CallDetailHeader "N recordings" badge** - `c12e7f1b` (feat)

**Plan metadata:** commit follows this SUMMARY

## Files Created/Modified

- `src/services/reconciledTranscript.service.ts` - `getReconciledTranscript(eventId)`, `getReconciliationEligibility(recordingUuid)`, `getRecordingLabels(recordingIds)` -- all pure async, RLS-gated, throw+`?? []`/`?? {}` conventions
- `src/hooks/useReconciledTranscript.ts` - `useReconciledTranscript`, `useReconciliationEligibility`, `useRecordingLabels` -- all `useQuery`-wrapped, `enabled`-gated on caller-controlled open state
- `src/lib/query-config.ts` - `queryKeys.reconciledTranscript` factory (`detail`, `eligibility`, `recordingLabels`)
- `src/components/call-detail/CallReconciledTranscriptTab.tsx` - read-only reconciled-transcript tab, all UI-SPEC states
- `src/components/call-detail/ReconciledSegmentProvenanceBadge.tsx` - per-segment consensus popover badge
- `src/components/CallDetailDialog.tsx` - `activeTab` union extended, conditional tab wiring
- `src/components/call-detail/CallDetailHeader.tsx` - "N recordings" outline Badge

## Decisions Made

See `key-decisions` in frontmatter above -- eligibility-derivation rationale (event_match_decisions not client-readable), the Rule-2 additive eligibility/labels service+hook surface, and the sorted-array cache-key choice.

## Deviations from Plan

**1. [Rule 2 - Missing critical functionality] Added `getReconciliationEligibility`/`useReconciliationEligibility` and `getRecordingLabels`/`useRecordingLabels`, beyond Task 1's literal service/hook list**
- **Found during:** Task 3 (tab-visibility gating) and Task 2 (provenance popover body copy)
- **Issue:** Task 3's conditional-rendering requirement ("tab absent, not disabled, when <2 resolved recordings") and the UI-SPEC's popover copy contract ("body lists the agreeing source recording labels") both need data the plan's Task-1-listed `getReconciledTranscript`/`useReconciledTranscript` alone cannot supply -- `event_match_decisions` (the ledger that would normally answer "is this event resolved") is confirmed NOT client-readable per 37-01-SUMMARY.md, and `agreeing_recording_ids` on a segment row is UUIDs only, no titles.
- **Fix:** Added two additive functions/hooks in the same already-declared files (`reconciledTranscript.service.ts`, `useReconciledTranscript.ts`), both RLS-gated through the pre-existing `recordings` SELECT policy -- no new read surface, no schema change, no architectural decision requiring a checkpoint.
- **Files modified:** `src/services/reconciledTranscript.service.ts`, `src/hooks/useReconciledTranscript.ts`, `src/lib/query-config.ts`
- **Commits:** `fc00a6cf`, `3c9c6d32`

None else - Tasks 1-3 otherwise executed exactly as written.

## Threat Flags

None. The plan's own T-37-01 (client read path) and T-37-08 (single-source-as-consensus) were the only anticipated surfaces for this plan; the additive eligibility/label reads (Rule 2 deviation above) reuse the existing `recordings` SELECT policy rather than introducing a new one, so no undocumented new read surface exists.

## Known Stubs

None. All three tasks ship fully wired, non-mocked reads against live RLS-gated tables; loading/empty/error states are real query states, not hardcoded placeholders. The tab is conditionally absent by design (per UI-SPEC), not a stub.

## Self-Check: PASSED

- FOUND: src/services/reconciledTranscript.service.ts
- FOUND: src/hooks/useReconciledTranscript.ts
- FOUND: src/components/call-detail/CallReconciledTranscriptTab.tsx
- FOUND: src/components/call-detail/ReconciledSegmentProvenanceBadge.tsx
- FOUND: commit fc00a6cf (feat)
- FOUND: commit 3c9c6d32 (feat)
- FOUND: commit c12e7f1b (feat)
