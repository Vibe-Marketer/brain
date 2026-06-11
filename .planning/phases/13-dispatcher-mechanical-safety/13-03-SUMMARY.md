---
phase: 13-dispatcher-mechanical-safety
plan: 03
subsystem: infra
tags: [bun, worktree, headless-claude, codex-review, evidence-bundle, autopilot]

requires:
  - phase: 13-01
    provides: live runner_state + tickets queue columns (RLS-proven)
  - phase: 13-02
    provides: daemon libs (db.ts, claim.ts, agent.ts argv-allowlist spawner)
provides:
  - "~/dev/autopilot/src/runner.ts — full per-ticket pipeline: worktree → claude → verify → codex review → commit → push → evidence → awaiting_approval"
  - "~/dev/autopilot/src/lib/brief.ts — investigation brief (containment policy + FIXED/ESCALATE/DIVERT vocabulary)"
  - "~/dev/autopilot/src/lib/evidence.ts — bundle assembly (7 sections) + spike-schema JSONL log + rate-limit detection"
  - "Dedicated clone at ~/dev/autopilot/clone (with origin; fetch per run)"
affects: [13-04, 13-06, 13-07, 14-approval-ops-ui]

tech-stack:
  added: []
  patterns: ["reset --hard + clean -fd BEFORE any ref op (spike learning #3)", "worktree remove --force in finally on every exit path", "Bun.spawnSync argv arrays — DB-sourced text never reaches a shell", "verdict = last VERDICT: line, substring fallback, NONE if absent"]

key-files:
  created:
    - ~/dev/autopilot/src/runner.ts
    - ~/dev/autopilot/src/lib/brief.ts
    - ~/dev/autopilot/src/lib/evidence.ts
    - ~/dev/autopilot/src/lib/evidence.test.ts
    - ~/dev/autopilot/clone/ (provisioned, gitignored)
  modified:
    - ~/dev/autopilot/src/types/runtime.d.ts (spawnSync/fs/import.meta ambient decls)

key-decisions:
  - "Worktrees live at ~/dev/autopilot/worktrees/autopilot-fix-<id8> (config knob from 13-02) rather than the plan's illustrative /tmp path — same ephemerality, all autopilot state under one root"
  - "ESCALATE/DIVERT/watchdog-kill are terminal status='escalated' UPDATEs (trigger logs transition); releaseClaim+backoff reserved for verification/commit failures"
  - "Gate invocation pre-push is 13-06 wiring; 13-03 runner pushes the held branch after its inline commit-advance assertion (v1 ships nothing from a branch regardless)"
  - "codex exec --sandbox read-only positional prompt worked as-is on first invocation (RESEARCH assumption A2 verified — no flag adaptation needed)"

requirements-completed: [AUTO-02, AUTO-06]

duration: ~45min
completed: 2026-06-11
---

# Phase 13 Plan 03: Worktree Runner Summary

**Per-run ephemeral-worktree fix engine proven live end-to-end: synthetic claimed ticket → headless claude (FIXED) → vitest+build green in-worktree → commit-advance assert → held branch pushed → codex REVIEW: APPROVE → 7-section evidence bundle on the ticket thread → awaiting_approval — with the worktree destroyed and ~/dev/brain untouched**

## Dry Pipeline Run (live proof, synthetic ticket f7d4935a)

Synthetic in_progress ticket (real micro-defect mirrored from open ticket bcdab6a1: missing aria-labels on DebugPanel buttons). `bun run src/runner.ts --ticket f7d4935a…` produced:

- Outcome `awaiting_approval`, runner exit 0
- Worktree created and destroyed (worktrees/ empty after; finally path exercised)
- JSONL line: `verdict=FIXED, claude_exit=0, changed_files=1, test_exit=0, fix_sha=f6d91d9b…, codex_review="REVIEW: APPROVE — tiny accessibility-only change, no security or scope concerns."`
- Evidence message on ticket (author_type='agent'): all sections present — Diff/Tests/Repro replay/Codex review/Revert/Deploy/Resolution note (probed live)
- Held branch `fix/ticket-f7d4935a` on origin at fix SHA; never main, never force
- ~/dev/brain untouched by the runner: live-checkout diffs observed during the window were unrelated parallel-session edits (different files; the ticket's target file unchanged in brain). All runner git activity confined to ~/dev/autopilot/{clone,worktrees}
- Cleanup after proof: synthetic ticket deleted (cascade), remote+local fix branch deleted, runner_state back to idle

## Five Outcome Paths

FIXED (proven live above); ESCALATE, DIVERT, NONE-no-diff → status 'escalated' + NOTES.md/reason posted via writeAgentMessage; watchdog-kill → 'escalated' with time-budget note; verification/commit-advance failures → releaseClaim with failure tail (backoff) until maxAttempts then escalated. In-worktree verification = `npm install` + `npx vitest run --silent` + `npm run build` — `rg "type-check" src/runner.ts` shows only negated references (NO_HOLLOW_GATE pass).

## Task Commits (autopilot repo)

| Task | Commit | Note |
|------|--------|------|
| 3 RED | b4727e1 | test(13-03) failing evidence tests |
| 1 | 7fb84d6 | brief.ts + clone provisioned |
| 2 | 7e2897d | runner.ts complete pipeline (+runtime.d.ts ambient decls) |
| 3 GREEN | cf99f28 | evidence.ts (5 tests, 32 expects green) |

## Deviations from Plan

**1. [Rule 3 - Blocking] ~/dev/autopilot/.env did not exist** — created from brain .env values (chmod 600, gitignored); initial copy carried the source file's quotes → REST 000, fixed by stripping quotes.
**2. [Rule 3 - Blocking] Ambient type decls missing for spawnSync/fs/import.meta** — extended runtime.d.ts (13-02's no-@types constraint holds). Commit 7e2897d.
**3. [Rule 1 - Bug] Invalid type expression in npm-install failure path** — fixed before commit.
**4. Tasks 1+2 runner code landed as one coherent commit (7e2897d)** — runner.ts is a single unit; brief/clone carried Task 1's commit.
**5. bun test path filters match clone/ files** — daemon tests must be invoked with explicit `./src/...` paths (clone/ is gitignored but scanned by bare filters). Documented here for 13-06/07.

## Self-Check: PASSED
All files on disk; commits b4727e1/7fb84d6/7e2897d/cf99f28 in autopilot history; evidence tests 5/5; tsc green; live probes above.
