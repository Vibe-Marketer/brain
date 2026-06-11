---
phase: 14-in-app-approval-loop
plan: 03
subsystem: ci
tags: [github-actions, auto-merge, invariant-test, autopilot]

# Dependency graph
requires:
  - phase: 13-dispatcher-mechanical-safety
    provides: dispatcher PR-opening contract (gh CLI authed as Vibe-Marketer; 'autopilot' label contract)
provides:
  - "auto-merge.yml job condition excludes agent PRs: NOT 'autopilot' label AND author != Vibe-Marketer, ANDed with the human 'auto-merge' trigger"
  - "src/__tests__/agent-pr-merge-invariant.test.ts — suite fails if the guard is removed or any other workflow gains a merge-capable command"
  - "Label contract for 13-04/13-05: dispatcher PRs MUST carry the 'autopilot' label"
affects: [13-04, 13-05, 13-07]

# Tech tracking
tech-stack:
  added: []
  patterns: ["static fs-based invariant tests pinning CI workflow conditions", "normalized-whitespace YAML assertions immune to folding"]

key-files:
  created:
    - src/__tests__/agent-pr-merge-invariant.test.ts
  modified:
    - .github/workflows/auto-merge.yml

key-decisions:
  - "Agent login verified live: gh api user → Vibe-Marketer (matches autopilot.config.ts repoRemote owner); author exclusion pinned to that login"
  - "Author exclusion also blocks human PRs authored by Vibe-Marketer from label auto-merge — acceptable: the label exclusion is the primary agent signal and Andrew pushes direct to main (repo workflow), so the auto-merge label path is for bot/agent PRs"
  - "Invariant test placed in src/__tests__/ (already in vitest include glob src/**/*.test.ts) — no config edit needed"

requirements-completed: [APPR-03]

# Metrics
duration: ~6min
completed: 2026-06-11
---

# Phase 14 Plan 03: Agent-PR Auto-Merge Exclusion + Invariant Test Summary

**Condition-gated auto-merge.yml so agent PRs (autopilot label or Vibe-Marketer author) can never auto-merge, and pinned the guard with a committed invariant test that fails the suite if the exclusion is removed or a second CI merge path appears**

## Performance

- **Duration:** ~6 min
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `auto-merge.yml` `if:` now requires ALL of: `github.event.label.name == 'auto-merge'` AND `!contains(github.event.pull_request.labels.*.name, 'autopilot')` AND `github.event.pull_request.user.login != 'Vibe-Marketer'` — either agent signal blocks the job (T-14-09); YAML comment block documents the invariant and names the pinning test
- 5 invariant tests: label exclusion present, author exclusion present, both ANDed (no `||`) inside the same condition as the trigger, human trigger + `gh pr merge --auto` intact (guard not satisfied by gutting the workflow), and a workflow-wide sweep asserting zero merge-capable commands (`gh pr merge`/`pulls.merge`/`merge_method`/`automerge`) outside auto-merge.yml (T-14-10)
- Negative check demonstrated: deleting the 'autopilot' exclusion → 2 test failures; restored → 5/5 (T-14-11)

## Workflow Survey (recorded per acceptance criteria)

Merge-capable command scan across `.github/workflows/` (ci.yml, claude.yml, deploy-edge-functions.yml, security.yml, sentry-autofix.yml, sentry-deploy.yml, uptime.yml, auto-merge.yml): **auto-merge.yml is the ONLY workflow containing any merge-capable command** (`pulls.createReview` + `gh pr merge --auto --squash`). sentry-autofix.yml opens PRs but cannot merge them.

## Label Contract (for Phase 13 executors)

Dispatcher-opened PRs MUST carry the **'autopilot'** label (13-04/13-05 had not locked a name; 'autopilot' is now the contract — the author exclusion provides defense in depth if labeling fails).

## Agent Identity Verification

- `gh api user --jq .login` → `Vibe-Marketer` (the gh CLI identity the dispatcher uses)
- `~/dev/autopilot/autopilot.config.ts` → `repoRemote: https://github.com/Vibe-Marketer/brain.git`

## Task Commits

1. **Task 1: auto-merge.yml guard** — `72d47127` feat(14-03): exclude agent PRs from auto-merge — label + author guard (APPR-03)
2. **Task 2: invariant test** — `7a67189b` test(14-03): invariant test — no merge-without-approval path in CI

## Deviations from Plan

None - plan executed exactly as written. (Note: the verified agent login Vibe-Marketer is also the repo owner, so human PRs from that account are likewise excluded from label auto-merge — documented above as a key decision, primary flow unaffected since the repo's workflow is direct-to-main.)

## Gates

- **Invariant test:** 5/5 pass; negative check demonstrated and restored
- **Full suite:** 1865 pass / 1 fail / 45 skipped — single failure is the pre-existing `rpc-type-smoke` (phases 06-12 offenders, logged in 13's deferred-items)
- **Build:** exit 0

## Threat Flags

None — T-14-09/10/11 all mitigated and regression-proofed by the committed test.

## Known Stubs

None.

## Next Phase Readiness

- 13-04/13-05: label contract ('autopilot') recorded and enforced by CI condition
- APPR-03 CI half complete; push-gate half is Phase 13's AUTO-03 scope

## Self-Check: PASSED
