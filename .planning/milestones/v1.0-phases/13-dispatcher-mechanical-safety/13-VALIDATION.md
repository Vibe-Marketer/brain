---
phase: 13
slug: dispatcher-mechanical-safety
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-11
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | bun test (daemon pack at `~/dev/autopilot/`); bash fixture harness (push-gate); vitest 4.x (in-worktree repo verification only) |
| **Config file** | none — Wave 0/1 scaffolds `~/dev/autopilot/` (does not exist yet) |
| **Quick run command** | `cd ~/dev/autopilot && bun test` |
| **Full suite command** | `cd ~/dev/autopilot && bun test && bash gate/push-gate-test.sh` |
| **Estimated runtime** | ~30 seconds (units + gate fixtures; excludes E2E proof) |

---

## Sampling Rate

- **After every task commit:** Run `cd ~/dev/autopilot && bun test`
- **After every plan wave:** Run `cd ~/dev/autopilot && bun test && bash gate/push-gate-test.sh`
- **Before `/gsd-verify-work`:** Full suite green AND E2E proof on real ticket 1deaa9b7 completed through the admin-approval checkpoint
- **Max feedback latency:** 60 seconds (units/fixtures); E2E proof is the phase gate, not a sampling step

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (filled by planner) | 01 | 1 | AUTO-01 | T-13-01 | Atomic claim — concurrent claims yield one winner | unit | `bun test src/lib/claim.test.ts` | ❌ W0 | ⬜ pending |
| (filled by planner) | 02 | 1/2 | AUTO-02 | T-13-02 | Run never touches `~/dev/brain`; worktree destroyed | integration | runner test + `git -C ~/dev/brain status --porcelain` empty delta | ❌ W0 | ⬜ pending |
| (filled by planner) | 0x | 2 | AUTO-03 | T-13-03 | Denylist diff → gate exit 1 regardless of agent output | fixture | `bash gate/push-gate-test.sh` | ❌ W0 | ⬜ pending |
| (filled by planner) | 0x | 2 | AUTO-04 | T-13-04 | Kill switch set → no claim next poll; gate exit 2 pre-push | fixture/integration | kill-switch fixture in `push-gate-test.sh` + claim test | ❌ W0 | ⬜ pending |
| (filled by planner) | 0x | 2 | AUTO-05 | T-13-05 | Stale heartbeat → user_notifications row + macOS notification | integration | watchdog run against frozen heartbeat | ❌ W0 | ⬜ pending |
| (filled by planner) | 0x | 3 | AUTO-06 | T-13-06 | Evidence message is service-role agent row; spoof attempt fails | E2E + RLS probe | E2E proof on ticket 1deaa9b7; authenticated INSERT with author_type='agent' rejected | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `~/dev/autopilot/` scaffold with `bun test` runnable (package.json, tsconfig) — prerequisite for all unit tests
- [ ] `gate/push-gate-test.sh` — fixture diffs (migration-touch, clean-src, kill-switch-set, no-commit-advance) covering AUTO-03/04
- [ ] Repo-side RLS probe (SQL or service-role script) for priority/urgent admin-only UPDATE + runner_state policies + agent-row spoof rejection

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Admin approval click on held fix | AUTO-03/AUTO-06 (E2E proof) | Approval is Andrew's explicit human checkpoint by design (v1 trust window — ISA ISC-66) | Ticket 1deaa9b7 reaches `awaiting_approval` with full evidence bundle; Andrew writes the approval event (Phase 14 UI or SQL); dispatcher then merges, pushes, and the deploy-SHA check passes |
| macOS notification visually arrives | AUTO-05 | Notification delivery is a GUI observation | Stop dispatcher; wait past staleness threshold; observe notification + `user_notifications` row |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
