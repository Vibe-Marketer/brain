# Phase 17: Activation + Per-Run Observability + Go-Live Hardening - Context

**Gathered:** 2026-06-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Turn the Autopilot kill switch **off on real production tickets for the first time**, at low controlled volume, with full per-run observability in AdminTab and the three go-live hardening blockers landed *before* any volume increase.

**In scope:** ACT-01 (go live), ACT-03 (rollback/blast-radius proven on live tickets), ACT-04 (per-run observability), ACT-05 (test-integrity push-gate), ACT-06 (rebase-before-push + serialized push + repro-replay), ACT-07 (worktree reaper + disk guard + caffeinate).

**Explicitly NOT in this phase:** raising throughput toward 25–30/day (ACT-02 → Phase 19), the per-category autonomy ladder / auto-approve (TRU-02 → Phase 19), survival metric / canary (Phase 19). Phase 17 stays at human-approval-on-every-merge.

</domain>

<decisions>
## Implementation Decisions

### Go-Live Cutover Strategy
- **D-01:** Kill switch comes off, but **every merge still requires Andrew's approval in AdminTab** for all of Phase 17. This is the existing built behavior (agent fixes land at `awaiting_approval`; admin-approval merge pass promotes them). No autonomous merge in Phase 17 — auto-approve is Phase 19's autonomy ladder (TRU-02). "Going live" here means *the loop claims and fixes real tickets autonomously*, not *the loop merges to main autonomously*.
- **D-02:** "Low controlled volume" = keep `maxRunsPerWindow.maxRuns` LOW for this phase (~3–5/day), explicitly NOT the 25–30 target. Throughput scale-up is Phase 19. Concurrency stays 1 (invariant). Existing quiet hours (01:00–07:00) stand.
- **D-03:** No extra category allow-list gate — the existing blast-radius `denylist.txt` already diverts schema/RLS/auth/billing. First eligible tickets = the existing open ticket backlog + net-new incoming, all human-approved before merge.

### Test-Integrity Gate (ACT-05)
- **D-04:** Mechanical, **non-LLM**, default-deny. Lives in the deterministic push-gate (`gate/push-gate.sh`), the only authority boundary. No model judgment.
- **D-05:** Trips (hard-fails the gate) on: net reduction in test file count or test-case count; additions of `.skip` / `.only` / `xit` / `xdescribe`; net assertion-count decrease in touched test files. The agent cannot reach a green gate by defeating the tests.
- **D-06:** A gate-blocked run surfaces to Andrew in AdminTab. If the test change is *legitimately* part of the fix, Andrew approves it manually (the human-approval layer is the override — Phase 17 has no autonomous merge anyway). No automatic "allow with flag" bypass in the gate.

### Rebase-Conflict Handling (ACT-06)
- **D-07:** Before the push-gate, rebase the fix onto latest `origin/main` and re-run the repro replay on the rebased state; push is serialized (one at a time).
- **D-08:** On a real rebase conflict (main moved incompatibly): abort the rebase, destroy the worktree, release the claim, and requeue the ticket for a fresh attempt against the new base — same "retryable defer" shape as rate-limit handling. Retry cap ~2–3 attempts, then escalate to Andrew (mark needs-human / page via the watchdog channel). **Never force-push, never skip the rebase.**

### Per-Run Observability (ACT-04)
- **D-09:** Extend the existing AdminTab — **no new top-level tab** (One-Click / KISS-UX). A per-run list/timeline hangs off the existing `runner_state` card (the 16-01 live card); per-ticket run detail folds into the existing TicketDetailDialog evidence bundle.
- **D-10:** At-a-glance (visible without drilling in): run status, gate verdict (pass/fail + which gate), duration, cost, and overall pass/fail. Drill-down: full diff, test output, gate reasoning, rebase/replay outcome. Cost is the existing `est_cost` display field (subscription billing has no per-token meter — do not imply a dollar meter).

### Claude's Discretion
- Exact `maxRuns` value within the ~3–5/day band, the precise retry cap (2 vs 3), and the AdminTab component layout are left to the planner/implementer within the decisions above.
- Whether the test-integrity check is a new shell function inside `push-gate.sh` or a small invoked helper — implementation detail for the planner, as long as it stays deterministic/non-LLM and runs inside the gate boundary.

### Reviewed Todos (not folded)
- "Apply 15-min compliance posture fixes" (score 0.2) — unrelated to autopilot activation; left in pending/.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone planning
- `.planning/ROADMAP.md` §"Phase 17" — goal, success criteria, sequencing constraints
- `.planning/REQUIREMENTS.md` §"Loop Activation & Trust (ACT)" — ACT-01..07 full text
- `.planning/research/SUMMARY.md` §"Phase A" — converged build order + go-live blocker rationale
- `.planning/research/PITFALLS.md` — Pitfalls 1 (test-weakening), 4 (claim races / stale merges), 10 (worktree/disk exhaustion) drive ACT-05/06/07
- `.planning/research/ARCHITECTURE.md` — as-built daemon component map (which file each blocker modifies)

### Autopilot articulation (current-state authority)
- `~/.claude/PAI/MEMORY/WORK/20260610-autonomous-admin-center/ISA.md` — ISC-104..120 safety boundary; push-gate / kill switch / denylist / watchdog / repro-replay oracle. Phase 17 hardens this boundary for go-live.

### Daemon code (lives OUTSIDE this repo)
- `~/dev/autopilot/autopilot.config.ts` — `maxRunsPerWindow{24h,12}`, `pollIntervalSec:300`, `quietHours 01:00–07:00`, `concurrency:1`, `killSwitchFlagFile=${ROOT}/KILL`, `denylistFile=gate/denylist.txt`
- `~/dev/autopilot/gate/push-gate.sh` — the deterministic non-LLM authority boundary (ACT-05 adds the test-integrity check here); `gate/denylist.txt` blast-radius patterns
- `~/dev/autopilot/src/claimer.ts` — 7-step poll cycle (ACT-02 band lives here; ACT-06 requeue logic)
- `~/dev/autopilot/src/runner.ts` + `src/lib/approval.ts` — per-run fix + the only path to main (ACT-06 rebase/replay/serialized push)
- `~/dev/autopilot/src/lib/evidence.ts` — evidence bundle producer (ACT-04 surface)
- `~/dev/autopilot/src/watchdog.ts` — heartbeat/pager (ACT-06 escalation channel; ACT-07 disk guard)

### AdminTab (this repo)
- AdminTab `runner_state` card (16-01) and `TicketDetailDialog` evidence rendering — ACT-04 extends these, no new tab

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `runner_state` card in AdminTab (live typed status card from 16-01) — extend with a per-run list rather than building a new view.
- `TicketDetailDialog` evidence-bundle rendering — per-ticket run detail folds in here.
- `evidence.ts` JSONL run lines (`JsonlRunLine`) — the per-run data source for ACT-04 (note: research flagged it currently lacks explicit cost/duration fields; may need adding).
- `detectRateLimit()` + claim-release/back-off path — the template for ACT-06's rebase-conflict requeue ("retryable defer").
- `gate/push-gate.sh` deterministic boundary — ACT-05 test-integrity check slots in as another non-LLM gate stage.

### Established Patterns
- Concurrency 1 + atomic claim UPDATE + shared-clone worktree (`git reset --hard` per run) — the invariant ACT-06 must preserve (serialized push, no parallel writers).
- Non-LLM push-gate is the ONLY authority boundary; all hardening is mechanical, never prompt-based.
- Human-approval merge pass in `claimer.ts` — Phase 17 keeps this mandatory for every merge.

### Integration Points
- Daemon code in `~/dev/autopilot` (separate repo); migrations / Edge Functions / AdminTab UI in `~/dev/brain`. ACT-04 spans both: daemon emits run data, AdminTab renders it.
- Watchdog dual-channel pager (`user_notifications` INSERT + osascript) is the escalation sink for ACT-06 retry-cap-exceeded and ACT-07 disk/sleep guards.

</code_context>

<specifics>
## Specific Ideas

- The cutover is deliberately conservative: "kill switch off" ≠ "autonomous merge." Andrew approves every merge in Phase 17; the loop earns the right to auto-merge only in Phase 19 once survival data exists.
- Net-new footprint for Phase 17: zero new npm packages, zero new secrets (Sentry token is Phase 21). All changes are config + daemon logic + AdminTab rendering.

</specifics>

<deferred>
## Deferred Ideas

- Raising `maxRuns` toward 25–30/day → Phase 19 (ACT-02).
- Per-category autonomy ladder / auto-approve, survival metric, canary re-test → Phase 19 (TRU-01/02/03).
- Any Sentry/QA/recurrence/comms work → Phases 18–23.

### Reviewed Todos (not folded)
- "Apply 15-min compliance posture fixes (GitHub + Vercel + Supabase + Cloudflare)" — score 0.2, unrelated to autopilot activation; remains in `.planning/todos/pending/`.

</deferred>

---

*Phase: 17-activation-per-run-observability-go-live-hardening*
*Context gathered: 2026-06-13*
