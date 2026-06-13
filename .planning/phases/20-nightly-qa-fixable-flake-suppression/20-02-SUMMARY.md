---
phase: 20-nightly-qa-fixable-flake-suppression
plan: 02
subsystem: qa
tags: [autopilot, nightly-qa, triage, flakes, supabase-rpc]
requires:
  - phase: 20-01
    provides: qa_findings ledger and ingest_qa_ticket RPC
provides:
  - RPC-owned nightly QA ticket filing in Autopilot
  - Rerun-quarantine and recurrence promotion behavior
  - On-demand QA poller non-filing guardrails
  - Nightly launch flags for N=2 reruns and M=3 recurrence
affects: [autopilot, nightly-qa, qa_findings, ingest_qa_ticket]
tech-stack:
  added: []
  patterns:
    - service-role RPC filing through ingest_qa_ticket
    - qa_findings quarantine/review/promoted ledger lanes
    - route-scoped crawler rerun evidence
key-files:
  created:
    - /Users/admin/dev/autopilot/src/qa-poller.test.ts
  modified:
    - /Users/admin/dev/autopilot/qa/triage.ts
    - /Users/admin/dev/autopilot/qa/triage.test.ts
    - /Users/admin/dev/autopilot/qa/nightly-crawl.sh
key-decisions:
  - "On-demand admin QA scans remain observational and do not invoke triage or ingest_qa_ticket."
  - "High/critical QA findings route to qa_review instead of autonomous ticket filing."
  - "Recurring quarantined low/medium findings promote at the configured nightly threshold."
patterns-established:
  - "Nightly QA ticketing is server-source-stamped by ingest_qa_ticket only."
  - "Suppressed findings remain auditable in qa_findings instead of known-fingerprints.json."
requirements-completed: [QA-01, QA-02, QA-03]
duration: 70 min
completed: 2026-06-13
---

# Phase 20 Plan 02: Nightly QA Fixable Tickets + Flake Suppression Summary

**Autopilot nightly QA now files only reproduced low/medium findings through `ingest_qa_ticket`, while suppressed and review findings remain auditable in `qa_findings`.**

## Performance

- **Duration:** 70 min
- **Started:** 2026-06-13T22:10:00Z
- **Completed:** 2026-06-13T23:20:01Z
- **Tasks:** 3 completed
- **Files modified:** 4

## Accomplishments

- Replaced direct QA ticket/table writes with service-role RPC filing through `ingest_qa_ticket`.
- Added rerun-quarantine, `qa_review`, ignored-noise, and recurrence-promotion behavior in `qa/triage.ts`.
- Kept Admin Center requested scans observational by adding `src/qa-poller.test.ts` assertions that the poller does not call triage or the ticket RPC.
- Wired nightly launch defaults with `--repro-reruns 2`, `--recurrence-threshold 3`, and existing `--record`.

## Task Commits

Each task was committed in `/Users/admin/dev/autopilot`:

1. **Task 20-02-01: Replace direct ticket inserts with RPC-owned QA filing** - `5e8ec0b` (`feat(20)`)
2. **Task 20-02-02: Implement rerun-quarantine and recurrence promotion** - `dda4d16` (`test(20)`) plus core triage behavior in `5e8ec0b`
3. **Task 20-02-03: Wire nightly launch path without raising volume** - `856abc0` (`feat(20)`)
4. **Typecheck repair:** `fecd17f` (`fix(20)`)

## Files Created/Modified

- `/Users/admin/dev/autopilot/qa/triage.ts` - RPC filing, rerun evidence, qa_findings ledger writes, recurrence promotion, review-lane classification.
- `/Users/admin/dev/autopilot/qa/triage.test.ts` - Source-spoofing, no direct ticketing, quarantine, promotion, review, and nightly invariant tests.
- `/Users/admin/dev/autopilot/src/qa-poller.test.ts` - On-demand scan parsing and non-filing/static safety assertions.
- `/Users/admin/dev/autopilot/qa/nightly-crawl.sh` - Explicit N=2/M=3 triage flags while preserving the existing launchd path and qa_runs recording.

## Decisions Made

On-demand admin scans remain ledger-only/observational for now. They do not count toward recurrence and do not file tickets, avoiding accidental ticket floods from the Admin Center request button.

High and critical QA findings are routed to `qa_review` even when reproduced. This keeps the autonomous loop to low/medium findings and preserves the tier-2 lane for higher blast-radius findings.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added a typecheck-safe qa-poller test read**
- **Found during:** Plan-level `bun run typecheck`
- **Issue:** `new URL(..., import.meta.url)` in the new Bun test was not covered by the repo's TypeScript libs.
- **Fix:** Changed the static source read to `readFileSync("src/qa-poller.ts", "utf8")`.
- **Files modified:** `/Users/admin/dev/autopilot/src/qa-poller.test.ts`
- **Verification:** `bun run typecheck`
- **Committed in:** `fecd17f`

---

**Total deviations:** 1 auto-fixed (Rule 3)
**Impact on plan:** No scope change; the fix keeps the required poller assertion compatible with the existing TS config.

## Issues Encountered

- `src/qa-poller.test.ts` did not exist before this plan; it was created to cover the required on-demand alignment.
- `src/types/supabase.ts` regenerated from the linked live project with no diff because the remote schema was already current.

## Verification

- `cd /Users/admin/dev/autopilot && bun test qa/triage.test.ts` — 8 pass.
- `cd /Users/admin/dev/autopilot && ! rg 'postRestRows\("tickets"|send-support-ticket|source: "manual"' qa/triage.ts` — pass.
- `cd /Users/admin/dev/autopilot && bun test qa/triage.test.ts src/qa-poller.test.ts` — 10 pass.
- `cd /Users/admin/dev/autopilot && bun test qa/triage.test.ts src/claimer.test.ts` — 19 pass.
- `cd /Users/admin/dev/autopilot && test "$(node -e 'import("./autopilot.config.ts").then(m=>console.log(m.config.concurrency))')" = "1"` — pass.
- `cd /Users/admin/dev/autopilot && bun test qa/triage.test.ts src/qa-poller.test.ts src/claimer.test.ts` — 21 pass.
- `cd /Users/admin/dev/autopilot && bun run typecheck` — pass.
- `cd /Users/admin/dev/brain && supabase db push --linked` — remote database up to date.
- `cd /Users/admin/dev/brain && supabase gen types typescript --linked > src/types/supabase.ts` — pass, no generated diff.
- Live schema probe — `qa_findings` returned HTTP 200 with `limit=0`; invalid `ingest_qa_ticket` RPC probe returned HTTP 400 with `p_fingerprint is required`, confirming the live function exists without inserting data.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 20-02 is ready for the next Phase 20 plan. Autopilot changes are committed locally in `/Users/admin/dev/autopilot` only and were not pushed.

---
*Phase: 20-nightly-qa-fixable-flake-suppression*
*Completed: 2026-06-13*
