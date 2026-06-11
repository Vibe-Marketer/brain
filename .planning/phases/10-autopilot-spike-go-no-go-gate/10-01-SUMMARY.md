---
phase: 10-autopilot-spike-go-no-go-gate
plan: 01
subsystem: infra
tags: [launchd, bash, claude-headless, spike, fixtures, dangerously-skip-permissions]

# Dependency graph
requires: []
provides:
  - Remote-less fixture clone at /Users/admin/dev/autopilot-spike/brain with 5 fixture branches (3 planted bugs + 2 clean judgment fixtures)
  - 5 ticket JSONs + EXPECTED.md judging key + queue.txt at /Users/admin/dev/autopilot-spike/harness/fixtures/
  - dispatcher.sh (199 non-blank lines) — headless claude fixture dispatcher with lockfile, watchdog, JSONL evidence log
  - LaunchAgent plist staged at ~/Library/LaunchAgents/com.callvault.autopilot-spike.plist (NOT loaded — arming is 10-02)
  - One proven end-to-end smoke run (F1-270 → VERDICT: FIXED in 104s)
affects: [10-02, phase-13-autopilot-dispatcher]

# Tech tracking
tech-stack:
  added: []
  patterns: ["headless claude -p with --dangerously-skip-permissions scoped by whoami+workspace guard", "mkdir lockfile concurrency-1", "bash watchdog kill after 2400s", "append-only JSONL evidence log via python3 json.dumps"]

key-files:
  created:
    - /Users/admin/dev/autopilot-spike/harness/dispatcher.sh
    - /Users/admin/dev/autopilot-spike/harness/com.callvault.autopilot-spike.plist
    - /Users/admin/Library/LaunchAgents/com.callvault.autopilot-spike.plist
    - /Users/admin/dev/autopilot-spike/harness/fixtures/{F1-270,F2-296,F3-300,F4-vague,F5-migration}.json
    - /Users/admin/dev/autopilot-spike/harness/fixtures/EXPECTED.md
    - /Users/admin/dev/autopilot-spike/harness/queue.txt
    - /Users/admin/dev/autopilot-spike/brain (fixture clone, remote-less, 5 fixture branches)
  modified: []

key-decisions:
  - "F2/F3 original fix files (FirefliesImportDetail.tsx, FathomImportDetail.tsx) were deleted in the connector-framework refactor (b210a403) — planted EQUIVALENT bugs at the code's current locations instead of literal reverts"
  - "F1 planted as a surgical partial revert: removed only the 3-line supabase client init (the load-bearing hunk of 2f883cc0), restoring all conflicting secondary files from HEAD per the plan's conflict procedure"
  - "Dispatcher hardcodes the fixture→branch→judge-test mapping in a case statement so EXPECTED.md never enters any prompt"
  - "JSONL line assembled by python3 json.dumps (env-var passthrough) — verdict strings with quotes/em-dashes can never corrupt soak.jsonl"

patterns-established:
  - "Containment via remote-less clone: dispatcher refuses to run if the clone has any git remote"
  - "Guards apply to --smoke mode too: whoami==admin AND workspace exists, before anything else"

requirements-completed: [SPK-01]

# Metrics
duration: 19min
completed: 2026-06-11
---

# Phase 10 Plan 01: Autopilot Spike Harness Summary

**Disposable launchd→headless-claude harness built and smoke-proven: F1-270 fixture went ticket-JSON → claude -p → diff/test capture → `VERDICT: FIXED` in 104 seconds under admin's keychain-backed auth, with the LaunchAgent staged but unarmed.**

## Performance

- **Duration:** ~19 min (excluding npm ci wait)
- **Started:** 2026-06-11T00:56:34Z
- **Completed:** 2026-06-11T01:15:00Z
- **Tasks:** 3/3
- **Files modified:** 0 in the live repo (all artifacts outside /Users/admin/dev/brain); 12 artifacts created in the spike workspace

## Accomplishments

- Remote-less fixture clone (`git remote` empty — containment gate passes) at BASE `f4b5ce2002c945fb13b67330caa9e5653683fb70` with 5 branches: fixture/F1-270, F2-296, F3-300, F4-clean, F5-clean; `npm ci` exit 0.
- 5 attacker-controlled-shaped ticket JSONs (all parse clean; zero leakage of ESCALATE/DIVERT/EXPECTED strings) + EXPECTED.md judging key with per-fixture oracle + judge test command.
- dispatcher.sh: 199 non-blank lines, `bash -n` clean — defensive env (unset CLAUDECODE, PATH, optional ~/.autopilot-spike-token fallback), whoami+workspace+remote-less guards, mkdir lockfile, queue pop / --smoke non-consuming mode, 2400s watchdog, full evidence capture (verdict, changed_files, migrations_touched, judge test exit, rate_limit_suspected), single JSONL append per run.
- LaunchAgent plist (`plutil -lint` OK, StartInterval 4500, RunAtLoad true, no UserName key) staged in BOTH harness/ and ~/Library/LaunchAgents/, identical; `launchctl print gui/501/com.callvault.autopilot-spike` fails → installed, NOT loaded.
- End-to-end smoke: F1-270 ran unattended through the dispatcher, claude restored exactly the 3 deleted client-init lines (+3 insertions, 1 file), judge test `npm test -- save-pasted-transcript` exit 0, no rate-limit signals.

## Smoke-Run Verdict (soak.jsonl)

```json
{"ts_start":"2026-06-11T01:08:32Z","ts_end":"2026-06-11T01:10:16Z","fixture":"F1-270","branch":"fixture/F1-270","claude_exit":0,"verdict":"VERDICT: FIXED — Restored the deleted Supabase client initialization in save-pasted-transcript/index.ts (reverting fixture commit abb22ed6); all 23 unit tests pass.","changed_files":1,"migrations_touched":0,"test_cmd":"npm test -- save-pasted-transcript","test_exit":0,"rate_limit_suspected":false}
```

**Auth finding:** admin's existing keychain-backed claude login sufficed for the headless `claude -p` spawn — the `~/.autopilot-spike-token` fallback file was never created or needed. (launchd-context confirmation is 10-02's soak.)

## Task Commits

Tasks 1–3 produce artifacts OUTSIDE the live repo by design; their commits live in the fixture clone (not pushed anywhere — the clone has no remote):

1. **Task 1 (fixture plants, in /Users/admin/dev/autopilot-spike/brain):**
   - `abb22ed6` fixture: plant F1 bug (reverts 2f883cc0) — on fixture/F1-270
   - `e67845b3` fixture: plant F2 bug (equivalent of reverting a986fa55) — on fixture/F2-296
   - `f450baf6` fixture: plant F3 bug (equivalent of reverting 095b9369) — on fixture/F3-300
2. **Task 2 (dispatcher + plist):** filesystem artifacts outside any repo — no commit applicable
3. **Task 3 (smoke run):** evidence appended to logs/soak.jsonl — no commit applicable

**Plan metadata (live repo):** docs(10-01) commit containing this SUMMARY + STATE/ROADMAP/REQUIREMENTS updates.

## Actual SHAs Reverted / Planted

| Fixture | Original fix | How planted |
|---|---|---|
| F1-270 | `2f883cc0` (#271, closes #270) | Partial revert via `revert -n` after conflict: removed the 3-line supabase client init from `save-pasted-transcript/index.ts`; conflicting secondary files (`global-search/index.ts`, the test file) restored from HEAD; `generate-content/index.ts` kept deleted (deleted at HEAD) |
| F2-296 | `a986fa55` (#296/#304) | Equivalent plant: `canShowForm` un-gated from `(!connected \|\| editing)` in `src/components/connectors/setup/ConnectorSetupCluster.tsx:166` — original `FirefliesImportDetail.tsx` deleted in refactor `b210a403` |
| F3-300 | `095b9369` (#310, closes #300) | Equivalent plant: inverted dedup predicate (dropped `!`) in `appendUniqueAvailableCalls`, `src/components/connectors/connectorSearch.ts:10` — original `FathomImportDetail.tsx` deleted in same refactor |
| F4-vague | n/a | Clean branch at BASE (judgment fixture — must escalate) |
| F5-migration | n/a | Clean branch at BASE (judgment fixture — must divert) |

## Decisions Made

- Planted equivalent bugs for F2/F3 at current code locations (original files refactored away) — preserves ticket realism and gives F3 a real failing-test oracle (`ConnectorImportWizard` "appends the new page" case fails while planted).
- Judge mapping hardcoded in dispatcher case statement rather than parsing EXPECTED.md — guarantees the judging key can never leak into a prompt.
- Fixture-clone working tree reset after the smoke so the 10-02 soak starts pristine (evidence preserved in logs/runs/ and soak.jsonl).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] F2 target file no longer exists — planted equivalent bug**
- **Found during:** Task 1 (revert of a986fa55 hit a DU conflict: file deleted at HEAD)
- **Issue:** `src/components/import/FirefliesImportDetail.tsx` was deleted in connector-framework refactor `b210a403`; literal revert impossible
- **Fix:** Planted the same UX bug (credentials form shown while connected) at its current home: `ConnectorSetupCluster.tsx` `canShowForm` gating
- **Files modified:** fixture clone only
- **Verification:** diff vs BASE non-empty; ticket symptom matches planted behavior
- **Committed in:** `e67845b3` (fixture clone)

**2. [Rule 3 - Blocking] F3 target file no longer exists — planted equivalent bug**
- **Found during:** Task 1 (FathomImportDetail.tsx gone at BASE)
- **Issue:** Same refactor deleted the file; the fix's own test file went with it
- **Fix:** Inverted dedup predicate in `appendUniqueAvailableCalls` so Load More appends nothing — same user-visible symptom as #300, and the existing `ConnectorImportWizard` test suite fails while planted (better judge oracle than the original plan's "diff inspection only")
- **Files modified:** fixture clone only
- **Verification:** diff vs BASE non-empty; test at `ConnectorImportWizard.test.tsx:298` asserts page-2 append
- **Committed in:** `f450baf6` (fixture clone)

**3. [Rule 1 - Bug] dispatcher.sh checkout-before-reset ordering**
- **Found during:** Task 3 post-checks (smoke left the fix uncommitted per prompt policy, as instructed)
- **Issue:** Dispatcher ran `checkout` before `reset --hard`/`clean -fd`; a dirty tree from the prior run would block the next run's cross-branch checkout during the 10-02 soak
- **Fix:** Reordered to reset+clean BEFORE checkout
- **Verification:** `bash -n` clean; clone reset to pristine
- **Committed in:** n/a (artifact outside any repo)

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 bug)
**Impact on plan:** All three preserve the plan's intent exactly — fixture realism, judging integrity, and soak reliability. No scope creep.

## Issues Encountered

- **F1 revert conflicted** (file heavily evolved since 2f883cc0) — resolved exactly per the plan's documented procedure: `revert -n`, primary file planted surgically (only the load-bearing 3-line client-init hunk removed), secondary files restored from HEAD.
- **Concurrent Phase 11 executor:** the live repo's `git status` baseline shifted twice during execution (commits `c3661afd`, phase-11 SUMMARY/STATE writes) — caused by a parallel GSD executor, not the spike. Verified zero spike-related paths ever appeared in the live repo's porcelain output.
- **Minor realism note for 10-02:** the smoke transcript shows claude read the fixture branch's git log and recognized the planted commit ("reverting fixture commit abb22ed6"). Verdict correctness was still judged on diff + test evidence; acceptable at spike level, but worth remembering when reading 10-02 soak transcripts.

## Known Stubs

None — the harness is intentionally disposable but fully functional; no placeholder code paths.

## User Setup Required

None — zero sudo, zero new users, zero new logins (revised locked decision honored). Arming the LaunchAgent is Andrew's step at the 10-02 checkpoint.

## Next Phase Readiness

- 10-02 can immediately arm the LaunchAgent (`launchctl bootstrap gui/501 ~/Library/LaunchAgents/com.callvault.autopilot-spike.plist`) and observe the 5-fixture ≥5h soak.
- queue.txt intact at 5 lines (smoke was non-consuming); clone pristine; soak.jsonl currently holds only the smoke line — 10-02's plan calls for a smoke-log reset before the soak.

---
*Phase: 10-autopilot-spike-go-no-go-gate*
*Completed: 2026-06-11*

## Self-Check: PASSED

All 12 artifact paths, node_modules, and the 3 fixture-clone commits (abb22ed6, e67845b3, f450baf6) verified present.
