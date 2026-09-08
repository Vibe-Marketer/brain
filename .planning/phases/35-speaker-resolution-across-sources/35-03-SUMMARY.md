---
phase: 35-speaker-resolution-across-sources
plan: 03
subsystem: backend
tags: [deno, edge-function, speaker-resolution, identity, rls, integration-test]

# Dependency graph
requires:
  - phase: 35-02
    provides: "propagateNamedLabel (IDENT-04), collapsePhantomSpeaker (IDENT-05), deriveAbsoluteInterval -- pure, DB-free, fail-closed"
  - phase: 35-01
    provides: "locked write-target Decision B2 (new speaker_resolution_decisions ledger, never an in-place transcript_chunks overwrite)"
provides:
  - "resolve-speakers edge function: forward-only, X-Reconcile-Secret-gated sweep delegating all matching to speaker-resolver.ts, wired for BOTH IDENT-04 propagation and IDENT-05 consensus collapse"
  - "speaker_resolution_decisions migration, applied TEST-only, FORCE RLS + service-role-only, registered in rls-regression.test.ts"
  - "src/test/integration/resolve-speakers.integration.test.ts -- real end-to-end proof against the TEST project (no deploy)"
affects: [35-04-prod-apply]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Deploy-deferred edge function integration testing: spawn the REAL index.ts under `deno run --allow-net --allow-env`, pointed at the TEST project via env vars (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY/RECONCILE_SECRET), drive it over real HTTP (Deno.serve's default :8000) -- proves the actual code path without deploying to Supabase Cloud. Reusable for any future deploy-deferred edge function integration proof."
    - "Two independent decision tiers sharing one ledger: tier='propagation' and tier='consensus_collapse' rows can both exist for the same target chunk (UNIQUE(target_recording_id, target_chunk_index, tier) lets them coexist without clobbering), because propagateNamedLabel and collapsePhantomSpeaker both fire on overlapping data independently -- this is intentional, not a bug."

key-files:
  created:
    - supabase/migrations/20260908120000_create_speaker_resolution_decisions.sql
    - src/test/integration/resolve-speakers.integration.test.ts
  modified:
    - supabase/functions/resolve-speakers/index.ts
    - src/test/rls-regression.test.ts

key-decisions:
  - "Consensus collapse (IDENT-05) wiring (this invocation, completing a prior invocation's deferral): for each donor's labeled span, every OTHER recording in the bucket is scanned for 2+ distinct anonymous speaker_name groups whose chunks are ALL wholly subsumed (within the 20s clock-drift tolerance) within the donor's span. collapsePhantomSpeaker is delegated the entire subsumption check -- zero matching logic in the edge function body. Written as tier='consensus_collapse', independent of and non-conflicting with tier='propagation' rows on the same chunk."
  - "Deploy-deferred integration proof via local `deno run` against real TEST-project creds, not a deployed Supabase Cloud function. The objective explicitly scoped this plan to 'edge function code change and test files' only -- deploying to TEST (even non-prod) would have introduced an out-of-scope operational artifact (a new TEST-only deployed function + a RECONCILE_SECRET project secret) for no proof benefit, since spawning the actual Deno module locally against the real TEST DB exercises the identical code path over real HTTP."
  - "Cleanup uses the cleanup_test_fixture_users RPC (per supabase/CLAUDE.md) for the two @callvault.test-domain users, cascading through recordings/transcript_chunks/call_participants/speaker_resolution_decisions, plus explicit best-effort deletes for identities (owner_user_id is ON DELETE SET NULL, not CASCADE) and events/organizations (no owner FK to auth.users at all)."

patterns-established:
  - "speaker_resolution_decisions mirrors event_match_decisions exactly: FORCE RLS, no client-reachable INSERT/UPDATE/DELETE policy, service-role-writes-only, registered in rls-regression.test.ts's BESPOKE_CLIENT_DENY_TABLES with its own seed/assert block (existence-proof-first, then deny-assert for both test orgs)."

requirements-completed: [IDENT-04, IDENT-05]

# Metrics
duration: ~90min (this invocation, completing collapse-wiring + Task 2 on top of a prior invocation's Task 1)
completed: 2026-09-08
---

# Phase 35 Plan 03: resolve-speakers Edge Function + Integration Proof Summary

Forward-only, shared-secret-gated `resolve-speakers` edge function wiring BOTH Plan 02 pure functions (`propagateNamedLabel` for IDENT-04, `collapsePhantomSpeaker` for IDENT-05) into a live-invokable sweep, proven end-to-end against real TEST-project data without deploying.

## What shipped

**Task 1 (prior invocation, commit `40ba3763`):** `supabase/functions/resolve-speakers/index.ts` -- X-Reconcile-Secret 401 gate before any DB work or body parse, Zod-validated `{mode:'forward', since?}`, service-role reads bucketed same-org-before-pairing (SAFE-04), donor derivation from `call_participants.identity_id` (never a bare name guess, Pitfall 3), propagation delegated entirely to `propagateNamedLabel`. `speaker_resolution_decisions` migration authored and applied TEST-only (FORCE RLS, service-role-only, mirrors `event_match_decisions`).

**This invocation:**
1. **Consensus-collapse wiring (IDENT-05).** The prior invocation left `collapsePhantomSpeaker` proven in Plan 02 but unwired. Added a second pass per org bucket: for each donor's labeled span, every other recording's chunks are grouped by raw `speaker_name` label; 2+ distinct anonymous groups whose combined intervals are wholly subsumed within the donor's span (delegated entirely to `collapsePhantomSpeaker`, which fails closed to a structural refusal the moment any chunk falls outside that span) are collapsed onto the donor's identity and written as `tier='consensus_collapse'` rows -- distinct from, and non-conflicting with, `tier='propagation'` rows on the same chunk (the ledger's `UNIQUE(target_recording_id, target_chunk_index, tier)` constraint lets both tiers coexist).
2. **Integration proof (`src/test/integration/resolve-speakers.integration.test.ts`).** Since deploy is deferred to Plan 04, the suite spawns the real `index.ts` under `deno run --allow-net --allow-env`, pointed at the TEST project via env vars, and drives it over real HTTP against Deno.serve's default `:8000`. Fixtures: one shared event, 4 recordings (Org A donor with a resolved-identity chunk; Org A propagation target with one overlapping anonymous chunk; Org A consensus-collapse target with two over-segmented anonymous chunks both subsumed in the donor's span; Org B adversarial recording with the identical overlapping interval, bucketed away structurally by org). All 5 assertions pass: 401-with-no-secret, 401-with-wrong-secret, propagation writes a ledger row (never overwrites `transcript_chunks`), consensus collapse writes 2 ledger rows for the over-segmented pair, and the cross-org chunk receives zero decisions.
3. **rls-regression registration.** `speaker_resolution_decisions` added to `CLIENT_DENY_TABLES` + `BESPOKE_CLIENT_DENY_TABLES`, with a seed/assert block mirroring `event_match_decisions` exactly (existence-proof via service role first, then deny-assert for both Org A and Org B JWTs). Full suite: 63/63 passing.

## Verification run

- `npm run test:integration -- resolve-speakers` (run in isolation via `vitest run src/test/integration/resolve-speakers.integration.test.ts`): 5/5 passed.
- `vitest run src/test/rls-regression.test.ts`: 63/63 passed (includes the 2 new speaker_resolution_decisions tests).
- `rtk vitest run` (full unit suite): 2309/2371 passed; the 12 failures are pre-existing and unrelated to this plan's files (`SupportTicketDialog.test.tsx`, `AuditSection.test.tsx`, `DashboardSection.recurrence.test.tsx`, `sec-jwt-fix.test.ts` -- Router-context and chunk-loading issues in frontend components this plan never touches). `supabase/functions/_shared/__tests__/speaker-resolver.test.ts` passes.
- Automated grep gate from the plan: `X-Reconcile-Secret` present, `speaker-resolver` imported, zero `transcript_chunks...update(` calls -- confirmed passing.

## Deviations from Plan

None beyond the objective's own explicit two-part scope (complete IDENT-05 wiring + Task 2). No Rule 1-4 deviations encountered.

## Threat Flags

None. The consensus-collapse wiring introduces no new trust boundary beyond what T-35-05 (same-org bucketing) and T-35-07 (never overwrite transcript_chunks) already cover in the plan's threat model -- both are enforced identically to the propagation path (same `orgRecordings` bucket, same ledger-only write target).

## User Setup Required

None. `resolve-speakers` remains inert-until-invoked (no cron wiring, no deploy) -- deploy + cron wiring is Plan 04's scope.

## Self-Check: PASSED

- `supabase/functions/resolve-speakers/index.ts` -- FOUND, contains `collapsePhantomSpeaker` wiring.
- `src/test/integration/resolve-speakers.integration.test.ts` -- FOUND, 5/5 tests passing.
- `src/test/rls-regression.test.ts` -- FOUND, `speaker_resolution_decisions` registered, 63/63 passing.
- Commits `f2cc4855` (collapse wiring + rls-regression registration) and `c12a06a4` (integration test) -- both FOUND in `git log`.
