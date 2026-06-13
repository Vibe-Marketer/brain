---
phase: 17-activation-per-run-observability-go-live-hardening
plan: 03
type: execute
wave: 1
depends_on: []
files_modified:
  - ~/dev/autopilot/gate/push-gate.sh
  - ~/dev/autopilot/gate/push-gate-test.sh
  - ~/dev/autopilot/gate/test-integrity-gate.sh
autonomous: true
requirements: [ACT-05]
must_haves:
  truths:
    - "The deterministic push-gate mechanically blocks net test file deletion, test-case count decrease, assertion-count decrease, and additions of `.skip`, `.only`, `xit`, or `xdescribe`."
    - "The test-integrity check is non-LLM, default-deny, and has no automatic bypass flag."
    - "A gate-blocked run can surface `test_integrity` as the failing gate stage for AdminTab."
  artifacts:
    - path: "~/dev/autopilot/gate/push-gate.sh"
      provides: "Invokes test-integrity stage inside the authority boundary"
    - path: "~/dev/autopilot/gate/test-integrity-gate.sh"
      provides: "Deterministic weakening detector if separated from push-gate"
    - path: "~/dev/autopilot/gate/push-gate-test.sh"
      provides: "Fixtures proving blocked weakening cases"
  key_links:
    - from: "~/dev/autopilot/gate/push-gate.sh"
      to: "~/dev/autopilot/gate/test-integrity-gate.sh"
      via: "gate stage after commit-advance"
      pattern: "test_integrity"
---

<objective>
Add the go-live blocking test-integrity check to the deterministic push-gate.

Purpose: ACT-05 prevents the agent from "fixing" by defeating tests. The gate must stay mechanical and non-LLM per D-04 through D-06.
Output: shell gate logic plus fixture tests for all blocked behaviors.
</objective>

## Artifacts This Phase Produces

- Deterministic test-integrity gate logic in the push-gate boundary.
- Fixture coverage for deletion, `.skip`/`.only`, `xit`/`xdescribe`, test-case decrease, and assertion decrease.
- Gate output that names `test_integrity` for AdminTab observability.

<execution_context>
@$HOME/.codex/gsd-core/workflows/execute-plan.md
@$HOME/.codex/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/17-activation-per-run-observability-go-live-hardening/17-CONTEXT.md
@.planning/phases/17-activation-per-run-observability-go-live-hardening/17-RESEARCH.md
@.planning/phases/17-activation-per-run-observability-go-live-hardening/17-PATTERNS.md
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add fixture tests for every weakening behavior</name>
  <files>[autopilot] ~/dev/autopilot/gate/push-gate-test.sh</files>
  <read_first>~/dev/autopilot/gate/push-gate-test.sh, ~/dev/autopilot/gate/push-gate.sh, .planning/phases/17-activation-per-run-observability-go-live-hardening/17-CONTEXT.md</read_first>
  <behavior>
    - Deleting a test file exits non-zero.
    - Reducing test-case count exits non-zero.
    - Adding `.skip`, `.only`, `xit`, or `xdescribe` exits non-zero.
    - Reducing `expect(` assertion count in a touched test file exits non-zero.
    - Legitimate source-only changes still pass existing gate fixtures.
  </behavior>
  <action>Extend the existing temp-repo fixture harness before implementation so these cases fail red first. Keep fixtures offline using `PUSH_GATE_SKIP_DB=1` and temporary files only. Use grep gates carefully: do not count comments as proof; filter comments or construct exact files. Preserve existing kill-switch, commit-advance, and denylist fixture coverage.</action>
  <verify>
    <automated>cd ~/dev/autopilot && bash gate/push-gate-test.sh; test "$?" != "0"</automated>
  </verify>
  <acceptance_criteria>
    - New fixture labels exist for test file deletion, test-case decrease, skip/only variants, xit/xdescribe, and assertion decrease.
    - Fixture suite fails before Task 2 implementation.
    - No production bypass flag is introduced in tests.
  </acceptance_criteria>
  <done>Failing fixtures define ACT-05 behavior before gate implementation.</done>
</task>

<task type="auto">
  <name>Task 2: Implement the deterministic test-integrity stage</name>
  <files>[autopilot] ~/dev/autopilot/gate/push-gate.sh, ~/dev/autopilot/gate/test-integrity-gate.sh, ~/dev/autopilot/gate/push-gate-test.sh</files>
  <read_first>~/dev/autopilot/gate/push-gate.sh, ~/dev/autopilot/gate/push-gate-test.sh, .planning/phases/17-activation-per-run-observability-go-live-hardening/17-PATTERNS.md</read_first>
  <action>Add a `test_integrity` stage inside `push-gate.sh` after commit-advance and before the final in-policy decision. Implement inline or in `gate/test-integrity-gate.sh`; if helper is used, accept `<worktree> <base_sha>` and print `GATE: OUT-OF-POLICY - test_integrity ...` on failure. Compare `BASE_SHA..HEAD` for touched test files. Fail closed on net test file count reduction, net test-case count reduction in touched test files, added `.skip`/`.only`/`xit`/`xdescribe`, and assertion-count decrease. Do not inspect agent prose or use an LLM. Do not add an automatic allow flag; per D-06 legitimate overrides are human approval outside the gate. Emit a machine-readable-ish stage name (`test_integrity`) so Plan 01/02 observability can display it.</action>
  <verify>
    <automated>cd ~/dev/autopilot && bash gate/push-gate-test.sh</automated>
  </verify>
  <acceptance_criteria>
    - All new and existing gate fixtures pass.
    - Gate output names `test_integrity` when this stage blocks.
    - `rg -n "LLM|claude|codex|allow|bypass" ~/dev/autopilot/gate/push-gate.sh ~/dev/autopilot/gate/test-integrity-gate.sh` shows no model or auto-bypass authority.
  </acceptance_criteria>
  <done>Push-gate mechanically blocks test weakening.</done>
</task>

<task type="auto">
  <name>Task 3: Prove blocked gate status reaches run evidence</name>
  <files>[autopilot] ~/dev/autopilot/src/runner.ts, ~/dev/autopilot/src/lib/evidence.ts, ~/dev/autopilot/src/lib/evidence.test.ts</files>
  <read_first>~/dev/autopilot/src/runner.ts, ~/dev/autopilot/src/lib/evidence.ts, ~/dev/autopilot/src/lib/evidence.test.ts, .planning/phases/17-activation-per-run-observability-go-live-hardening/17-PATTERNS.md</read_first>
  <action>Ensure the runner parses gate output and records `gate_verdict='fail'` and `gate_stage='test_integrity'` when this stage blocks. Write the stage into JSONL/evidence/runner_runs detail without changing the gate's authority. This implements D-06 visibility: Andrew sees a gate-blocked run in AdminTab, but the gate itself still hard-fails.</action>
  <verify>
    <automated>cd ~/dev/autopilot && bun test src/lib/evidence.test.ts && bash gate/push-gate-test.sh</automated>
  </verify>
  <acceptance_criteria>
    - Evidence tests cover parsing `test_integrity` from gate output.
    - Gate-blocked outcome remains non-zero and cannot advance to awaiting approval.
    - AdminTab can later display which gate failed from ledger detail.
  </acceptance_criteria>
  <done>Gate failures carry enough structured detail for ACT-04 UI without weakening ACT-05.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| agent-modified tests -> push-gate | untrusted code changes attempt to pass the authority boundary |
| push-gate output -> runner evidence | gate result becomes operator-visible data |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-17-08 | Tampering | test file deletion | mitigate | Compare base/head test files and fail on net reduction |
| T-17-09 | Tampering | skipped/disabled tests | mitigate | Block added `.skip`, `.only`, `xit`, `xdescribe` |
| T-17-10 | Tampering | assertion weakening | mitigate | Fail on assertion-count decrease in touched test files |
| T-17-11 | Elevation of Privilege | LLM gate override | mitigate | Gate is shell-only, non-LLM, no auto-bypass flag |
| T-17-SC | Tampering | package installs | mitigate | Zero package installs |
</threat_model>

<verification>
- `cd ~/dev/autopilot && bash gate/push-gate-test.sh` exits 0.
- `cd ~/dev/autopilot && bun test src/lib/evidence.test.ts` exits 0.
- Static check confirms no model-based or auto-bypass gate authority.
</verification>

<success_criteria>
ACT-05 is blocked into the deterministic push-gate and proven by fixtures.
</success_criteria>

<output>
Create `.planning/phases/17-activation-per-run-observability-go-live-hardening/17-03-SUMMARY.md` when done.
</output>
