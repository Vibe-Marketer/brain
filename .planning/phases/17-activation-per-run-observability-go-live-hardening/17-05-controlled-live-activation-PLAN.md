---
phase: 17-activation-per-run-observability-go-live-hardening
plan: 05
type: execute
wave: 3
depends_on:
  - 17-02-admin-run-observability
  - 17-04-rebase-replay-and-ops-guards
files_modified:
  - ~/dev/autopilot/KILL
  - ~/dev/autopilot/autopilot.config.ts
  - ~/dev/autopilot/logs/
  - .planning/phases/17-activation-per-run-observability-go-live-hardening/17-05-SUMMARY.md
autonomous: false
requirements: [ACT-01, ACT-03, ACT-04, ACT-05, ACT-06, ACT-07]
user_setup:
  - "Andrew approval in AdminTab is required for every Phase 17 merge; no autonomous merge is permitted."
must_haves:
  truths:
    - "Kill switch is turned off at low controlled volume; concurrency remains 1 and max runs remain 3-5/day."
    - "At least one real production ticket is claimed, fixed, gate-approved, Andrew-approved, merged, and deploy-SHA verified."
    - "Rollback/reject path, commit-advance-by-exactly-one, denylist, test-integrity block, rebase/replay, worktree reaper, disk guard, and caffeinate are demonstrated with evidence."
    - "The run is visible in AdminTab with status, diff, test result, gate verdict, duration, and cost display."
  artifacts:
    - path: "~/dev/autopilot/logs/"
      provides: "Live run JSONL/transcript evidence"
    - path: ".planning/phases/17-activation-per-run-observability-go-live-hardening/17-05-SUMMARY.md"
      provides: "Controlled activation evidence, commands, outputs, screenshots, and live URLs"
  key_links:
    - from: "~/dev/autopilot/KILL"
      to: "claimer"
      via: "kill switch flag removal/restoration"
      pattern: "KILL"
    - from: "AdminTab runner card"
      to: "public.runner_runs"
      via: "Plan 02 service/hook"
      pattern: "runner_runs"
---

<objective>
Run the controlled production activation drill for Phase 17.

Purpose: The phase is not complete until the loop fixes a real ticket under low volume and the hardening gates are proven with live/fixture evidence. Per D-01, "go live" means autonomous claim/fix; Andrew still approves every merge in AdminTab.
Output: activation summary with command output, run IDs, screenshots, deploy SHA verification, and safety-drill evidence.
</objective>

## Artifacts This Phase Produces

- A controlled production activation record for the first real autonomous ticket.
- AdminTab screenshot(s) showing per-run observability.
- Safety proof for rollback/reject, denylist, test-integrity, rebase/replay, reaper/disk/wake handling.
- Source audit proving all Phase 17 requirements and locked decisions are covered.

<execution_context>
@$HOME/.codex/gsd-core/workflows/execute-plan.md
@$HOME/.codex/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/17-activation-per-run-observability-go-live-hardening/17-CONTEXT.md
@.planning/phases/17-activation-per-run-observability-go-live-hardening/17-RESEARCH.md
@.planning/phases/17-activation-per-run-observability-go-live-hardening/17-VALIDATION.md
@CLAUDE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Preflight all automated gates before kill-switch cutover</name>
  <files>[brain] src/types/supabase.ts, [autopilot] ~/dev/autopilot/autopilot.config.ts, ~/dev/autopilot/gate/push-gate.sh, ~/dev/autopilot/src/lib/approval.ts, ~/dev/autopilot/src/watchdog.ts</files>
  <read_first>.planning/phases/17-activation-per-run-observability-go-live-hardening/17-01-SUMMARY.md, .planning/phases/17-activation-per-run-observability-go-live-hardening/17-02-SUMMARY.md, .planning/phases/17-activation-per-run-observability-go-live-hardening/17-03-SUMMARY.md, .planning/phases/17-activation-per-run-observability-go-live-hardening/17-04-SUMMARY.md, .planning/phases/17-activation-per-run-observability-go-live-hardening/17-VALIDATION.md</read_first>
  <action>Before turning off the kill switch, run all phase gates from the prior plans: live `runner_runs` schema query, brain targeted tests/build, autopilot gate fixtures, approval/evidence/watchdog tests, typecheck, static checks for `concurrency: 1`, max runs 3-5/day, no force-push/skip-rebase, and no package additions. Confirm AdminTab can load the runner card against live data. If any gate fails, stop; do not activate.</action>
  <verify>
    <automated>supabase db query "select to_regclass('public.runner_runs');" && npm test -- src/services/__tests__/admin-dashboard.service.test.ts src/components/settings/__tests__/TicketDetailDialog.test.tsx src/components/admin/__tests__/TicketEvidence.test.tsx && npm run build && cd ~/dev/autopilot && bash gate/push-gate-test.sh && bun test src/lib/approval.test.ts src/lib/claim.test.ts src/lib/evidence.test.ts src/watchdog.test.ts && bun run typecheck && node -e 'const fs = require("node:fs"); const s = fs.readFileSync("autopilot.config.ts", "utf8"); if (!/concurrency:\s*1\b/.test(s) || !/maxRunsPerWindow:\s*\{[^}]*maxRuns:\s*[345]\b/s.test(s)) process.exit(1);'</automated>
  </verify>
  <acceptance_criteria>
    - All automated gates exit 0 before activation.
    - Summary records exact commands and outputs.
    - Kill switch remains engaged until this task passes.
  </acceptance_criteria>
  <done>Activation preflight is green and recorded.</done>
</task>

<task type="checkpoint:human-verify">
  <name>Task 2: Turn kill switch off and run one real-ticket fix through approval</name>
  <files>[autopilot] ~/dev/autopilot/KILL, ~/dev/autopilot/logs/, [brain] .planning/phases/17-activation-per-run-observability-go-live-hardening/17-05-SUMMARY.md</files>
  <read_first>~/dev/autopilot/autopilot.config.ts, ~/dev/autopilot/src/claimer.ts, ~/dev/autopilot/src/runner.ts, ~/dev/autopilot/src/lib/approval.ts, .planning/phases/17-activation-per-run-observability-go-live-hardening/17-CONTEXT.md</read_first>
  <action>With preflight green, turn off the local/DB kill switch at low controlled volume. Keep `maxRunsPerWindow.maxRuns` in the 3-5/day band and `concurrency: 1`. Let the daemon claim one eligible real production ticket from the existing backlog or net-new incoming queue, prepare the fix, run the push-gate, and land at `awaiting_approval`. Andrew must approve the merge in AdminTab per D-01. After approval, verify merge, push, and deploy SHA. If the daemon hits rate-limit, rebase conflict, denylist, test-integrity block, or disk guard, record the event and do not force progress manually.</action>
  <verify>
    <automated>cd ~/dev/autopilot && bun run src/claimer.ts && supabase db query "select id, ticket_id, status, outcome, gate_verdict, gate_stage, duration_sec, est_cost from public.runner_runs order by started_at desc limit 5;" && curl -fsS https://app.callvaultai.com >/tmp/callvault-prod.html</automated>
    <human-check>Andrew approves the awaiting_approval ticket in AdminTab; executor records the ticket id, branch, fix SHA, merged SHA, deployed SHA, and AdminTab screenshot.</human-check>
  </verify>
  <acceptance_criteria>
    - A real production ticket reaches `awaiting_approval` from an autonomous run.
    - Andrew approves the merge; no autonomous merge occurs.
    - Merged SHA is deploy-SHA verified against production.
    - AdminTab screenshot shows the run with status, diff/test/gate/duration/cost display.
  </acceptance_criteria>
  <done>ACT-01 and ACT-04 are proven on one real ticket at controlled volume.</done>
</task>

<task type="auto">
  <name>Task 3: Prove safety drills and restore guarded steady state</name>
  <files>[autopilot] ~/dev/autopilot/gate/push-gate-test.sh, ~/dev/autopilot/logs/, [brain] .planning/phases/17-activation-per-run-observability-go-live-hardening/17-05-SUMMARY.md</files>
  <read_first>.planning/phases/17-activation-per-run-observability-go-live-hardening/17-CONTEXT.md, .planning/phases/17-activation-per-run-observability-go-live-hardening/17-RESEARCH.md, .planning/phases/17-activation-per-run-observability-go-live-hardening/17-VALIDATION.md</read_first>
  <action>Run and record the required safety demonstrations: test-integrity fixture blocks weakening, denylist fixture blocks forbidden paths, commit-advance fixture proves exactly one commit past base, rebase/replay tests prove stale-main handling, reject/rollback path is demonstrated on a live or controlled ticket without shipping bad code, worktree reaper removes an aged dummy worktree, disk guard healthy path is recorded, and caffeinate/wake handling is visible from process/launchd config. Leave the daemon in the agreed Phase 17 steady state: kill switch off only if the first run succeeded and Andrew wants continued low-volume operation; otherwise re-engage the kill switch and record why.</action>
  <verify>
    <automated>cd ~/dev/autopilot && bash gate/push-gate-test.sh && bun test src/lib/approval.test.ts src/watchdog.test.ts && test -z "$(git -C /Users/admin/dev/brain status --short)"</automated>
  </verify>
  <acceptance_criteria>
    - Summary includes evidence for ACT-03, ACT-05, ACT-06, and ACT-07 safety proofs.
    - Live checkout has no unexpected uncommitted production-code edits from the daemon.
    - Final kill-switch/low-volume state is explicitly recorded.
  </acceptance_criteria>
  <done>Phase 17 safety proofs are recorded and the daemon is left in a known low-volume state.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| production tickets -> daemon | real user/internal reports drive agent behavior |
| daemon -> origin/main | approved fix moves toward production deploy |
| AdminTab approval -> merge | human approval is the Phase 17 merge authority |
| production deploy -> verification | public app response proves deployment reached users |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-17-17 | Elevation of Privilege | autonomous merge | mitigate | D-01: every merge requires Andrew approval in AdminTab; no auto-approve |
| T-17-18 | Tampering | gate bypass during live pressure | mitigate | Preflight and safety drills run deterministic gates; no manual force-push |
| T-17-19 | Repudiation | unproven production claim | mitigate | Record run id, ticket id, branch, fix SHA, merged SHA, deployed SHA, screenshot, and command outputs |
| T-17-20 | Denial of Service | runaway low-volume activation | mitigate | max runs 3-5/day, quiet hours, concurrency 1, kill switch remains available |
| T-17-SC | Tampering | package installs | mitigate | Static package diff check; zero new packages |
</threat_model>

<verification>
- Full preflight command exits 0 before activation.
- One real production ticket completes claim -> fix -> gate -> awaiting_approval -> Andrew approval -> merge -> deploy-SHA verification.
- AdminTab screenshot proves run visibility.
- Safety drills for ACT-03/05/06/07 recorded in `17-05-SUMMARY.md`.
</verification>

<success_criteria>
All Phase 17 roadmap success criteria are demonstrated at low controlled volume, with no autonomous merge and concurrency fixed at 1.
</success_criteria>

## Source Audit

| Source | ID | Feature/Requirement | Plan | Status | Notes |
|--------|----|---------------------|------|--------|-------|
| GOAL | - | Kill switch off on real production tickets at low controlled volume with full per-run visibility and go-live blockers closed | 05 | COVERED | Activation drill after hardening |
| REQ | ACT-01 | Go live: dispatcher claims and fixes real production tickets | 01, 05 | COVERED | Ledger plus live run |
| REQ | ACT-03 | Rollback/blast-radius safety proven on live tickets | 04, 05 | COVERED | Denylist, rollback/reject, commit-advance proof |
| REQ | ACT-04 | Per-run observability in AdminTab | 01, 02, 05 | COVERED | DB ledger, UI, screenshot |
| REQ | ACT-05 | Test-integrity gate blocks weakening | 03, 05 | COVERED | Push-gate fixtures and live visibility |
| REQ | ACT-06 | Rebase-before-push, serialized push, repro replay | 04, 05 | COVERED | Approval tests and live drill |
| REQ | ACT-07 | Worktree reaper, disk guard, caffeinate | 04, 05 | COVERED | Watchdog/config tests and ops proof |
| RESEARCH | - | Verify `runner_runs` live schema instead of trusting generated types | 01 | COVERED | Blocking schema push |
| RESEARCH | - | Rebase conflict should requeue before escalation | 04 | COVERED | Retryable defer with cap |
| RESEARCH | - | Existing AdminTab surfaces should be extended | 02 | COVERED | No new tab |
| RESEARCH | - | No new packages or queue engine | 01, 02, 03, 04, 05 | COVERED | Static/package checks |
| CONTEXT | D-01 | Human approval required for every Phase 17 merge | 05 | COVERED | Human checkpoint and no auto-merge |
| CONTEXT | D-02 | Low controlled volume 3-5/day, concurrency 1 | 04, 05 | COVERED | Config/static checks |
| CONTEXT | D-03 | No extra category allow-list; use existing denylist | 05 | COVERED | Denylist proof, no allow-list task |
| CONTEXT | D-04 | Test-integrity gate is mechanical and non-LLM | 03 | COVERED | Shell gate |
| CONTEXT | D-05 | Gate trips on deletion, skip/only, test/assertion decrease | 03 | COVERED | Fixture coverage |
| CONTEXT | D-06 | Gate-blocked run surfaces in AdminTab; no auto bypass | 03, 02 | COVERED | Stage recorded and displayed |
| CONTEXT | D-07 | Rebase before gate and replay on rebased state | 04 | COVERED | Approval path |
| CONTEXT | D-08 | Rebase conflict requeues, cap then page; never force-push | 04 | COVERED | Tests/static check |
| CONTEXT | D-09 | Extend existing AdminTab, no new tab | 02 | COVERED | Runner card/dialog |
| CONTEXT | D-10 | At-a-glance status/gate/duration/cost, drill-down diff/tests/replay | 02 | COVERED | UI tasks |

<output>
Create `.planning/phases/17-activation-per-run-observability-go-live-hardening/17-05-SUMMARY.md` when done.
</output>
