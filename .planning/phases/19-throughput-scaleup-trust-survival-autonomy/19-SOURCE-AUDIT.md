# Phase 19 Source Audit

SOURCE | ID | Feature/Requirement | Plan | Status | Notes
--- | --- | --- | --- | --- | ---
GOAL | - | Raise fix throughput through cap/cadence without concurrency, and ship survival, autonomy ladder, canary reopen | 19-01, 19-03, 19-04, 19-05 | COVERED | Mechanism only; live raise remains gated behind Phase 17-05 activation.
REQ | ACT-02 | Daily throughput to ~25-30/day via `maxRunsPerWindow.maxRuns` + cadence, quiet-hours and rate-limit guards, concurrency 1 | 19-03, 19-04, 19-05 | COVERED | Config/test mechanism with conservative default; no live volume raise.
REQ | TRU-01 | 30-day fix survival per fix and per category as primary metric | 19-01, 19-02, 19-03, 19-04 | COVERED | Durable schema, RPC, dashboard, defer-safe denominator.
REQ | TRU-02 | Per-category manual -> eligible -> auto ladder with survival gate and explicit admin event | 19-01, 19-02, 19-04, 19-05 | COVERED | Explicit promotion Edge Function plus daemon enforcement and tier-2 gating.
REQ | TRU-03 | Canary re-test and regression attribution by reopening originating ticket | 19-01, 19-02, 19-05 | COVERED | Schema fields, dashboard surfacing, canary reopen logic.
RESEARCH | - | Brain owns schema/RLS/RPC/admin UI; Autopilot owns daemon behavior; shared seam is Supabase rows | 19-01, 19-02, 19-03, 19-04, 19-05 | COVERED | Files modified are tagged by repo in every plan.
RESEARCH | - | Extend `runner_runs`, add `autopilot_category_trust`, add `autopilot_trust_events` | 19-01 | COVERED | Includes linked schema push and regenerated types.
RESEARCH | - | Use admin-only SECURITY DEFINER RPC for trust rollups | 19-01, 19-02 | COVERED | RPC plus service/UI mapping.
RESEARCH | - | Use server-verified admin mutation for promotion/demotion | 19-02 | COVERED | `authenticateRequest`, service role, `has_role`, audit writes.
RESEARCH | - | Exclude defers, unmerged, and unmatured runs from survival denominator | 19-01, 19-03 | COVERED | Schema/RPC and runner defer branch.
RESEARCH | - | Preserve safe repro replay; never shell raw ticket text | 19-05 | COVERED | Canary uses `findReproReplay()`.
RESEARCH | - | No new queue engine, SDK, framework, or npm package | 19-03, 19-05 | COVERED | One-cycle launchd-style jobs and existing stack only.
RESEARCH | - | Tier-2 output must be solution-shaped, not raw problem dump | 19-05 | COVERED | Digest validator and ladder routing.
CONTEXT | D-01 | Throughput via run-cap + cadence only; concurrency stays 1; conservative tunable cap now | 19-03 | COVERED | Also referenced by validation manual re-probe gate.
CONTEXT | D-02 | 30-day fix survival is the primary metric | 19-01, 19-02 | COVERED | Schema/RPC and Dashboard prioritize survival.
CONTEXT | D-03 | Ladder manual -> eligible -> auto; auto needs survival gate and explicit admin event; auto-demote on drop | 19-01, 19-02, 19-04 | COVERED | DB state, admin mutation, daemon gate.
CONTEXT | D-04 | Canary re-test reopens originating ticket with attribution | 19-01, 19-05 | COVERED | `reopened_event_id`, ticket event, same-ticket reopen.
CONTEXT | D-05 | Rate-limit hit is retryable defer, never failed fix | 19-01, 19-03 | COVERED | RPC denominator plus runner/claim branch.
CONTEXT | D-06 | Tier-2 integrates with ladder and surfaces solutions not problems | 19-05 | COVERED | Tier-2 helper/digest and schedules.

## Deferred/Excluded

- Live volume raise and target-volume rate-limit re-probe: explicitly deferred by D-01 until Phase 17-05 activation.
- QA per-source budget: Phase 20.
- Sentry resolve-on-stable: Phase 21.
- Recurrence to structural fix: Phase 22.
- Customer reporter comms: Phase 23.

## Result

No missing source items found. Planning is complete.
