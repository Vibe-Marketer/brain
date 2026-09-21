# Phase 40: Historical Backfill and Account Pilot

**Gathered:** 2026-09-21
**Status:** Scope accepted; research and executable planning pending
**Source:** Operator accepted the prior proposal: guarded opt-in backfill, preview first, own account as initial pilot. This file records that acceptance, not a completed implementation or production apply.

## Goal

Let the operator use the complete milestone on a protected branch preview before releasing the main frontend, including a bounded set of existing calls and a newly imported call.

## Locked decisions

- Work remains on `v2.2-event-resolution`. Main release remains a separate explicit decision.
- Historical processing starts with the operator's exact account and one explicitly selected organization. Login email and organization are pending. Do not infer ownership from an administrator role or a familiar organization name.
- Inventory/dry run first; show evidence and uncertainty. Metadata/name-only similarity cannot authorize event or identity merges. Preserve recurring-instance time guards, speaker alibi, and recording-content authorization.
- Apply only reviewed/high-confidence changes in a bounded manifest, with durable audit, interruption recovery, idempotency, and tested rollback. Reject stale manifests and rows changed since review.
- Preserve source recordings, raw transcripts, participant facts, and current content policies. Do not broaden access, send historical notification floods, or silently re-embed the corpus.
- Global customer backfill and automatic cross-org historical merging remain excluded.
- Real-account preview may use production Supabase after Phase 39 gates pass. Such a preview still writes production data; a separate hostname is not database isolation.
- TEST preview uses a separate TEST account/data. It cannot truthfully be described as the operator's existing production account.
- Deferred Phase 39 email proof remains outstanding. No Phase 39 deployment or production historical apply is authorized to bypass it.

## Required work sequence

1. Verify protected preview deployment, source commit, actual Supabase backend, webhook routing, auth/claim return URLs, and redirects. Avoid unrelated environment edits.
2. Confirm pilot identity/scope and inventory actual event links, transcript chunk coverage, participant evidence, existing decisions, and active processing/scheduling. Record aggregates without committing customer content or credentials.
3. Research existing event/identity/speaker/reconciliation paths; determine which are running, shadow-only, manual-only, or unscheduled. Produce executable plans and threat/validation coverage before write tooling.
4. Build a deterministic bounded dry-run report. Include singleton/unmatched calls and reasons historical rows cannot yet be resolved. A match report alone is not a backfill.
5. Implement reviewed application and rollback using transactional primitives where possible. Ensure replay/concurrency safety and avoid reverting legitimate later writes.
6. Prove behavior on real TEST data: unrelated org untouched; dry-run does not mutate membership; recurring false matches rejected; input drift rejected; retries converge; rollback preserves later work; content remains denied; historical notifications remain silent.
7. After Phase 39 PASS, run the specified account pilot with production evidence and before/after aggregates. Verify the same user's old and new calls, claim/access flows, identities/speakers/transcript provenance where supported, and activation/scheduling. Final release remains pending until independent verification and user acceptance.

## Known facts and open checks

- CodeGraph status on 2026-09-21 reports current index. `codegraph query resolve-event` located `supabase/functions/resolve-events/index.ts`.
- Direct source read: `resolve-events` accepts only `mode: shadow`, selects flagged organizations, and delegates to `runShadowSweep`; it is not an historical apply endpoint.
- Direct source read: `resolve-identities` uses a forward default date and service-secret auth. Do not invoke it with an earlier date as a substitute for bounded account-specific backfill.
- STATE records event cron failures from missing configuration and deliberately omitted transcript reconciliation scheduling. These are historical observations requiring fresh checks, not proof of current failure.
- September 20 Phase 39 research reports zero production events/identities. No fresh production count was run during this preparation.
- Vercel connector can list Ai Simple team, but listing saved project's deployments returns 403; deployment URL read also fails. Current preview backend and usability are unverified.

## Completion contract

BACK-01..06 must be proven and independently verified before completing this phase. No SUMMARY or completed requirement may be created solely for this scope document. Exact executable plan count is currently zero.
