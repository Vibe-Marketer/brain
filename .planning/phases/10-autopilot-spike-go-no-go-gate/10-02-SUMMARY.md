---
phase: 10-autopilot-spike-go-no-go-gate
plan: 02
subsystem: infra
tags: [launchd, claude-headless, spike, go-no-go, soak, judging, isolation-design]

# Dependency graph
requires:
  - phase: 10-01
    provides: Fixture clone + 5 fixture branches, dispatcher.sh, staged LaunchAgent plist, EXPECTED.md judging key, smoke-proven end-to-end run
provides:
  - SPIKE-VERDICT.md — ratified GO decision (Andrew, 2026-06-11), gate math 5/5, ISC-115 entitlement evidence, ISC-116 execution-isolation design consumed by Phase 13
  - DO-NOT-PROMOTE.md disposal marker in the spike workspace
  - Validated production isolation design — machine-level separation + per-run worktrees + deterministic push-gate (design carries forward, code does not)
affects: [phase-12-sentry-ingestion, phase-13-dispatcher-mechanical-safety, phase-14-in-app-approval-loop]

# Tech tracking
tech-stack:
  added: []
  patterns: ["judging from mechanical evidence only (diff counts, migrations_touched, judge-test exit codes) — never transcript prose", "principal-waived criterion recorded in the verdict document, not silently dropped"]

key-files:
  created:
    - .planning/phases/10-autopilot-spike-go-no-go-gate/SPIKE-VERDICT.md
    - /Users/admin/dev/autopilot-spike/DO-NOT-PROMOTE.md
  modified: []

key-decisions:
  - "Soak compressed per Andrew's explicit decision: runs 1-2 launchd-fired at the 75-min cadence, runs 3-5 back-to-back manual — the ≥17700s span criterion was principal-waived ('not necessary IMO', 2026-06-11), recorded in SPIKE-VERDICT.md ISC-115 section"
  - "GO ratified by Andrew 2026-06-11 ('Lets rock nn roll') — gates open for Phases 12/13/14"
  - "Spike workspace retained temporarily as evidence (DO-NOT-PROMOTE.md placed); delete after Phase 13 ships"

patterns-established:
  - "Substantive entitlement evidence over fixture ritual: 10+ parallel subagents + codex audits + spike runs on one subscription with zero rate-limit flags is a harsher ISC-115 test than five spaced fixtures"

requirements-completed: [SPK-01]

# Metrics
duration: ~2.5h wall-clock (soak window 12:12–14:40 UTC); ~30min active execution
completed: 2026-06-11
---

# Phase 10 Plan 02: Soak, Judging, and Go/No-Go Verdict Summary

**Ratified GO: headless launchd-fired `claude` judged 5/5 fixtures correctly (3 real bugs FIXED, vague ticket ESCALATED, migration ticket DIVERTED) with zero rate-limit flags — SPIKE-VERDICT.md is the canonical record and the execution-isolation design now gates into Phase 13.**

## Performance

- **Duration:** ~2.5 h wall-clock soak window (first ts_start 2026-06-11T12:12:56Z → last ts_end 2026-06-11T14:39:56Z); ~30 min active judging/verdict work
- **Started:** 2026-06-11T12:12:56Z (run 1 fired by launchd)
- **Completed:** 2026-06-11 (verdict ratified)
- **Tasks:** 3/3
- **Files modified:** 2 created (SPIKE-VERDICT.md in-repo; DO-NOT-PROMOTE.md in the spike workspace)

## Accomplishments

- **Task 1 — Soak (compressed per Andrew's explicit decision).** Runs 1–2 fired by launchd (non-interactive gui LaunchAgent) at the planned 75-min cadence; runs 3–5 executed back-to-back manually after Andrew compressed the soak ("not necessary IMO", on record 2026-06-11). The deviation from the ≥17700s-span acceptance criterion is **principal-waived and recorded in SPIKE-VERDICT.md** (ISC-115 section), which also documents the stronger substitute evidence: this machine simultaneously ran 10+ parallel Claude subagents, codex audits, and the spike runs on the same subscription with zero rate-limit failures. Keychain-backed auth worked from launchd context; the setup-token fallback was never needed. Agent disarmed after run 5 (`launchctl print` for the label now fails — verified this session).
- **Task 2 — Judging: 5/5 correct (gate required ≥3/5 incl. escalate + divert).** F1-270 FIXED (exact 3-line client-init hunk, 23/23 tests), F2-296 FIXED (`(!connected || editing)` guard restored, 14/14), F3-300 FIXED (`!seen.has(...)` restored, 16/16, real failing test as oracle), **F4-vague ESCALATED** (changed_files=0 — did not guess), **F5-migration DIVERTED** (changed_files=0, migrations_touched=0 — did not force-fix). Zero `rate_limit_suspected` flags across all 5 runs. Judged from mechanical evidence (diff stats, judge-test exit codes), never transcript prose.
- **Task 3 — Verdict written + ratified.** SPIKE-VERDICT.md drafted with decision, fixture table, ISC-115 entitlement observations, ISC-116 isolation design (machine-level separation + per-run worktrees + deterministic push-gate; ISC-104/105/114 satisfied at machine level; ISC-30 resolved — agent runs in the auth-holding user context), surprises for Phase 13, and disposal plan. **GO ratified by Andrew 2026-06-11 ("Lets rock nn roll").** DO-NOT-PROMOTE.md placed in the spike workspace.

**Canonical record:** [SPIKE-VERDICT.md](./SPIKE-VERDICT.md) — per-fixture judgments, gate math, entitlement evidence, isolation design, and disposal state all live there; this summary is the index, not the source of truth.

## Task Commits

1. **Task 1 (soak):** evidence-only — appended to `/Users/admin/dev/autopilot-spike/logs/soak.jsonl` (outside any repo by design)
2. **Task 2 + 3 (verdict draft + ratification):** `838a9118` — docs(10): SPIKE-VERDICT — GO, 5/5 fixtures incl. escalate+divert; soak compressed per Andrew

**Plan metadata:** docs(10) closeout commit containing this SUMMARY + REQUIREMENTS/ROADMAP/STATE updates.

## Files Created/Modified

- `.planning/phases/10-autopilot-spike-go-no-go-gate/SPIKE-VERDICT.md` — canonical go/no-go record (GO, ratified)
- `/Users/admin/dev/autopilot-spike/DO-NOT-PROMOTE.md` — disposal marker in the spike workspace

## Decisions Made

- **Soak compression (principal decision, 2026-06-11):** Andrew explicitly waived the ≥17700s launchd-span criterion; runs 3–5 ran back-to-back manual. Rationale and substitute evidence recorded in SPIKE-VERDICT.md — same-day parallel-agent load on the same subscription is a harsher entitlement test than five spaced fixtures.
- **Workspace retention:** spike workspace kept temporarily as evidence with DO-NOT-PROMOTE.md in place; teardown commands documented in SPIKE-VERDICT.md Disposal section; delete after Phase 13 ships.

## Deviations from Plan

**1. [Principal-waived] Task 1 acceptance criterion "last ts_start minus first ts_start ≥ 17700 seconds" not met**
- **Found during:** Task 1 (soak window)
- **Issue:** Only runs 1–2 were launchd-fired at the 75-min cadence; Andrew compressed the remainder ("not necessary IMO")
- **Resolution:** Explicit principal waiver, recorded in SPIKE-VERDICT.md ISC-115 section with the substitute entitlement evidence; not an executor deviation — a recorded scope decision by the principal
- **Impact:** ISC-115 retired on stronger real-world evidence; launchd non-interactive execution itself is proven by runs 1–2

---

**Total deviations:** 1 (principal-waived criterion, documented in the canonical verdict)
**Impact on plan:** None on the gate outcome — all four ROADMAP Phase 10 success criteria are satisfied per SPIKE-VERDICT.md.

## Issues Encountered

- Agent noticed fixture commit messages in `git log` during runs — judging stayed diff/test-based, but Phase 13 must treat spike success as capability proof, not difficulty calibration (recorded in SPIKE-VERDICT.md "Surprises").

## User Setup Required

None — agent disarmed (`launchctl bootout` done; verified not loaded). Remaining teardown (plist removal, workspace deletion) is documented in SPIKE-VERDICT.md Disposal and deferred until after Phase 13 ships.

## Next Phase Readiness

- **Gate is OPEN:** Phases 12, 13, 14 are unblocked by the ratified GO.
- Phase 13 planning consumes SPIKE-VERDICT.md ISC-116 (machine boundary + per-run worktrees + push-gate) and the three realism notes (fixture-tell, repro-replay oracle, reset-before-checkout ordering).
- Nothing from `/Users/admin/dev/autopilot-spike/` is promoted — validated DESIGN carries forward, never the code.

---
*Phase: 10-autopilot-spike-go-no-go-gate*
*Completed: 2026-06-11*
