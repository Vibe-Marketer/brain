---
phase: 21-sentry-debug-fix-resolve
plan: 05
subsystem: daemon-claiming
tags: [autopilot, sentry, debounce, fingerprint-cap, bun, supabase]

requires:
  - phase: 21-sentry-debug-fix-resolve
    provides: Plan 01 Sentry debounce RPC and sentry_fingerprint_cap schema
provides:
  - Sentry claim filtering that drops below-debounce tickets before queue ordering
  - Frozen Sentry fingerprint exclusion before claim selection
  - Unit proof that Sentry severity ordering is already covered by SEVERITY_RANK
affects: [phase-21, autopilot-claimer, sentry-debug-fix-resolve]

tech-stack:
  added: []
  patterns:
    - Client-side candidate filtering before pickNext, matching excludeSources precedent
    - Service-role DB/RPC checks over sentry_ticket_fixable and sentry_fingerprint_cap

key-files:
  created: []
  modified:
    - /Users/admin/dev/autopilot/src/lib/claim.ts
    - /Users/admin/dev/autopilot/src/lib/claim.test.ts

key-decisions:
  - "Severity boost is satisfied by the existing SEVERITY_RANK ordering at equal urgent and priority; no redundant priority bump was added."
  - "Sentry candidates fail closed when debounce RPC or frozen-fingerprint lookup is unavailable; non-Sentry candidates remain eligible."

patterns-established:
  - "Sentry claim dampening: filter Sentry candidates through DB debounce and per-fingerprint freeze checks before locked queue ordering."
  - "Frozen fingerprints are excluded by fingerprint only; no global source freeze or queue-wide disable was introduced."

requirements-completed: [SEN-04]

duration: 34min
completed: 2026-06-14T01:49:27Z
---

# Phase 21 Plan 05: Sentry Claim Debounce + Frozen Exclusion Summary

**Sentry claim selection now excludes below-debounce and frozen fingerprints before the locked queue ordering, while preserving non-Sentry selection and proving severity rank already satisfies SEN-04.**

## Performance

- **Duration:** 34 min
- **Started:** 2026-06-14T01:15:00Z
- **Completed:** 2026-06-14T01:49:27Z
- **Tasks:** 2
- **Files modified:** 2 in `/Users/admin/dev/autopilot`, plus this summary in `/Users/admin/dev/brain`

## Accomplishments

- Extended `selectNextTicket` to select `fingerprint`, call `sentry_ticket_fixable`, and read frozen fingerprints from `sentry_fingerprint_cap`.
- Filtered only Sentry candidates through debounce and frozen-fingerprint gates before `pickNext`; non-Sentry candidates are unaffected.
- Preserved the locked ordering contract: urgent DESC, priority DESC, severity rank, created_at ASC.
- Added Bun unit coverage for below-debounce drop, frozen exclusion, non-Sentry eligibility, all-eligible ordering preservation, and Sentry severity ordering.

## Task Commits

1. **Task 1: Debounce + frozen-fingerprint exclusion in selectNextTicket** - `8a59d7d` (`fix(21): filter unclaimable Sentry tickets`)
2. **Task 2: Verify severity to priority (A5)** - `ab90e58` (`test(21): prove Sentry severity ordering`)

## Files Created/Modified

- `/Users/admin/dev/autopilot/src/lib/claim.ts` - Adds Sentry-only claimability filtering via `sentry_ticket_fixable` and `sentry_fingerprint_cap` before queue ordering.
- `/Users/admin/dev/autopilot/src/lib/claim.test.ts` - Adds unit coverage for Sentry debounce/frozen behavior and severity rank proof.

## Decisions Made

- Reused the Plan 01 DB predicate `sentry_ticket_fixable` rather than reimplementing the 3 occurrences / 15 minute debounce window in TypeScript.
- Treated frozen-cap lookup/RPC failures as fail-closed for Sentry candidates to avoid claiming an unsafe Sentry issue; manual, QA, and other non-Sentry sources remain claimable.
- Did not add a severity-to-priority bump because the focused test proves `SEVERITY_RANK` already boosts ordering at equal urgent and priority.

## Deviations from Plan

None - plan executed as written.

## Issues Encountered

- The RED run failed as expected before implementation: `fingerprint` was not selected and unclaimable Sentry rows still won ordering. Implementation resolved both failures.
- `/Users/admin/dev/autopilot` had pre-existing dirty runtime files `qa/known-fingerprints.json` and `qa/runs.log`; they were not staged or modified by this plan.

## Verification

- `cd /Users/admin/dev/autopilot && bun test src/lib/claim.test.ts` - pass, 30 tests, 72 assertions.
- `cd /Users/admin/dev/autopilot && bun run typecheck` - pass.
- `cd /Users/admin/dev/autopilot && git diff --exit-code -- package.json bun.lock` - pass; no package changes.
- Manual read confirmed `compareTickets` ordering was not changed.

## Known Stubs

None.

## Threat Flags

None. The plan added no new network endpoint, auth path, file access surface, or schema; it only consumes the existing service-role DB/RPC surfaces from Plan 01.

## Next Phase Readiness

Plan 06 can rely on the claimer to exclude below-debounce Sentry rows and frozen fingerprints before a ticket is claimed. The cap lifecycle now has the claim-side closeout: create/increment/freeze in DB, then exclude from future Sentry claims.

## Self-Check: PASSED

- Found `.planning/phases/21-sentry-debug-fix-resolve/21-05-SUMMARY.md`.
- Found autopilot commit `8a59d7d`.
- Found autopilot commit `ab90e58`.

---
*Phase: 21-sentry-debug-fix-resolve*
*Completed: 2026-06-14*
