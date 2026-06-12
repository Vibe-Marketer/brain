---
phase: 13-dispatcher-mechanical-safety
plan: 04
subsystem: infra
tags: [bash, push-gate, denylist, kill-switch, fixtures, autopilot]

requires:
  - phase: 13-01
    provides: runner_state.kill_switch (live, RLS-proven)
  - phase: 13-02
    provides: ~/dev/autopilot scaffold + .env convention
provides:
  - "~/dev/autopilot/gate/push-gate.sh — deterministic non-LLM authority boundary (exit 0/1/2)"
  - "~/dev/autopilot/gate/denylist.txt — blast-radius patterns with repo-verified concrete paths"
  - "~/dev/autopilot/gate/push-gate-test.sh — 7 offline fixtures, all exit codes proven"
affects: [13-06, 13-07]

tech-stack:
  added: []
  patterns: ["kill switch FIRST + fail closed (DB unreachable/missing env → exit 2)", "denylist read from gate/, never the worktree under review (T-13-17)", "PUSH_GATE_SKIP_DB=1 test-only hook skips DB half only — flag file always checked"]

key-files:
  created:
    - ~/dev/autopilot/gate/push-gate.sh
    - ~/dev/autopilot/gate/denylist.txt
    - ~/dev/autopilot/gate/push-gate-test.sh
  modified: []

key-decisions:
  - "Denylist concrete paths verified against the actual repo tree: _shared/{auth,oauth-*,polar-client}, polar-* functions, src/components/billing, BillingTab, usePolarCustomer, AuthContext, src/lib/auth*/oauth*, OAuth pages, mcp-oauth service"
  - "Keys read directly from .env file inside the script — never exported into child env"
  - "PUSH_GATE_KILL_FLAG env override added so fixtures never touch the real ~/dev/autopilot/KILL"

requirements-completed: [AUTO-03, AUTO-04]

duration: ~12min
completed: 2026-06-11
---

# Phase 13 Plan 04: Deterministic Push-Gate Summary

**Non-LLM exit-code authority boundary: kill switch (flag+DB, fail closed) → commit-advance (exactly base+1) → blast-radius denylist — 7/7 offline fixtures green and the live DB kill switch proven to flip the verdict**

## Gate Fixture Results (offline, synthetic git repos)

| Fixture | Expected | Result |
|---------|----------|--------|
| clean-src-fix | 0 | PASS |
| migration-touch | 1 | PASS |
| github-touch | 1 | PASS |
| lockfile-touch | 1 | PASS |
| kill-switch-flag | 2 | PASS (precedence over clean diff) |
| no-advance | 1 | PASS |
| multi-commit | 1 | PASS |

## Live Kill-Switch Probe

`UPDATE runner_state SET kill_switch=true` → gate on a clean one-commit fixture exits **2** ("runner_state.kill_switch=true"); reset to false → same fixture exits **0** ("IN-POLICY"). Fail-closed paths (missing .env, unreachable DB, unexpected response) all exit 2.

## Task Commits (autopilot repo)

| Task | Commit |
|------|--------|
| 1: gate + denylist | b027eff |
| 2: fixture harness | 750c711 |

## Deviations from Plan

**1. [Rule 1 - Bug] Fixture 5 wrote to a directory that vanished on branch switch** — kill-switch precedence was accidentally proven on a zero-commit branch; added mkdir -p so the fixture tests the intended clean-diff case. Commit 750c711.

## Self-Check: PASSED
Files on disk; commits in history; `bash gate/push-gate-test.sh` exits 0 with 7/7; live probe transcript above; kill_switch left **ON** at end of execution (13-06 arms the dispatcher).
