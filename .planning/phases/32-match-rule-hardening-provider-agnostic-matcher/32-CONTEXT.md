# Phase 32: Match-Rule Hardening + Provider-Agnostic Matcher - Context

**Gathered:** 2026-09-01
**Status:** Ready for planning
**Mode:** Infrastructure phase — smart discuss skipped (no new UI; matcher/precision work; spec already locks the design)

<domain>
## Phase Boundary

Close the live F5 false-merge bug (recurring meetings can false-merge via the current 2-of-3 weak-signal rule with no real time-overlap guard), make the matcher provider-agnostic (replace the Zoom-and-`zoom_raw_calls`-only `dedup-fingerprint.ts` path with one reading `recordings` + `call_participants` + `transcript_chunks`), and prove shadow precision (≤0.1% false-merge rate against a hand-labeled set) before SAFE-01 is enabled for any organization.

**Note on scope escalation:** unlike Phases 30-31 which shipped strictly inert, this phase's own success criterion #5 requires measuring real precision — which may require enabling the flag for at least one org (likely an internal/test org, not a real customer) to generate real shadow data to hand-label. This is a materially different category of action than "ships inert" and should be called out explicitly wherever the plan proposes it, regardless of routine-checkpoint auto-approval posture.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
Locked constraints from source spec + REQUIREMENTS.md:
- `checkMatch` gains a mandatory nonzero time-overlap guard — closes F5 inside the function, not at the caller (MATCH-04).
- Title similarity suppressed when the title appears in `recurring_call_titles` above an occurrence threshold (MATCH-05). `recurring_call_titles` already exists (F10 finding from the original spec).
- Metadata tier (time/participant/title) can only propose candidates for review — never auto-merges alone (MATCH-03). Only tier 1 (deterministic, Phase 31) and tier 2 (content-proof, Phase 33) can auto-attach.
- Thresholds asymmetric: high bar to merge, low bar to split (MATCH-08).
- `dedup_priority_mode`/`dedup_platform_order` in `user_settings` continue to work, now selecting display order under an event rather than which row survives — nothing discarded (MATCH-11).
- Kill switch reverts all auto-merges within a time range in one operation (SAFE-03).
- Cross-org false merges blocked at RLS — proven by a live cross-org isolation test against TEST, resolution must never widen either capture's readable audience (SAFE-04).
- Shadow precision measured against a hand-labeled set, false-merge rate ≤0.1% target, BEFORE SAFE-01 is enabled for any org (SAFE-06).
- Existing Zoom behavior preserved through the new path, not deleted (MATCH-06).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 31's `event-resolver.ts` (tier-1 deterministic matcher, now fixed post-CR-01), `event_match_decisions` ledger, `organization_feature_flags` table, apply/reverse RPC pair — all live in prod, inert.
- `dedup-fingerprint.ts` — the current Zoom-only matcher with the F5 bug (2-of-3 weak signals, no real time-overlap guard) — this phase replaces/hardens it, per MATCH-06 without deleting existing Zoom behavior.
- `recurring_call_titles` table — already exists, free fix for F5 per the original spec finding F10.

### Established Patterns
- Same TEST-then-prod guarded migration discipline as Phases 30-31.
- Same RLS FORCE + service-role-only pattern for any new backend-control tables (kill switch state, precision measurements) unless a legitimate client read need exists.

</code_context>

<specifics>
## Specific Ideas

None beyond the locked constraints. Continues on branch `v2.2-event-resolution`.

</specifics>

<deferred>
## Deferred Ideas

None — infrastructure-only, spec locked.

</deferred>
