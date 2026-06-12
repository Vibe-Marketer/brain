---
phase: 13-dispatcher-mechanical-safety
plan: 06
subsystem: infra
tags: [claimer, poll-cycle, approval-merge, deploy-sha, launchd, kill-switch, autopilot]

requires:
  - phase: 13-02
    provides: daemon libs (db.ts, claim.ts ordering+sweep, agent.ts)
  - phase: 13-03
    provides: runner.ts per-ticket pipeline (processTicket entry)
  - phase: 13-04
    provides: gate/push-gate.sh deterministic authority boundary
provides:
  - "~/dev/autopilot/src/claimer.ts — single-pass poll cycle (heartbeat → kill switch → sweep → approval pass → budget → claim+run, urgent lane)"
  - "~/dev/autopilot/src/lib/approval.ts — admin approval recognition + gate re-run + ff-only merge/push + deploy-SHA verify"
  - "~/dev/autopilot/launchd/com.callvault.autopilot.plist — dispatcher schedule (loaded, armed-but-idle)"
affects: [13-07, 14-approval-ops-ui]

tech-stack:
  added: []
  patterns:
    - "fail-closed kill switch: DB unreachable OR row missing OR flag file present → halt claiming"
    - "approval qualifies ONLY on non-NULL actor_id AND user_roles role=ADMIN; NULL/non-admin never merge"
    - "deploy-SHA verify reads the Sentry-release commit SHA baked into the production bundle (no Vercel token)"
    - "lockdir (atomic mkdir) enforces concurrency 1 across overlapping launchd fires"
    - "urgent head-of-queue loops once more same invocation, bounded by maxRunsPerWindow"

key-files:
  created:
    - ~/dev/autopilot/src/claimer.ts
    - ~/dev/autopilot/src/lib/approval.ts
    - ~/dev/autopilot/src/lib/approval.test.ts
    - ~/dev/autopilot/launchd/com.callvault.autopilot.plist
  modified:
    - ~/dev/autopilot/src/types/runtime.d.ts (rmdirSync ambient decl — no new packages)

key-decisions:
  - "Deploy-SHA verification reads the production bundle's baked-in commit SHA. Discovery: production is Vercel; @sentry/vite-plugin sets release = VERCEL_GIT_COMMIT_SHA at build, so the served JS exposes the live deployed SHA. No Vercel CLI/token exists on this machine; gh deployments/commit-statuses are empty (Vercel GitHub integration does not post them). Bundle-grep is the robust, token-free, served-deploy-truthful mechanism."
  - "Admin role table is public.user_roles with (user_id, role); admin = role='ADMIN'. A user may hold multiple rows (Andrew has ADMIN + FREE), so the check is user_id=X AND role='ADMIN' (not a single-row fetch)."
  - "Budget guards count STARTED runs from autopilot.jsonl ts_start (spend guard counts launches, not just completions)."
  - "Fail-closed on DB-unreachable in the kill-switch check: proven live when a transient Supabase 521 hit a launchd fire — the cycle halted instead of claiming (correct AUTO-04 behavior)."

requirements-completed: [AUTO-01, AUTO-03, AUTO-04, AUTO-06]

duration: ~60min
completed: 2026-06-11
---

# Phase 13 Plan 06: Dispatcher + Approval-Merge Summary

**The daemon is wired together and armed-but-idle: the launchd-scheduled claimer runs the full seven-step poll cycle (heartbeat → kill switch → stale sweep → admin-approval merge pass → budget guards → urgent-lane claim+run) at concurrency 1, and the approval path turns a verified-admin approval row into a gate-re-run → ff-only merge → push → deploy-SHA-verified resolution — with the DB kill switch deliberately left ON so no real ticket is claimed before the 13-07 E2E.**

## What runs now

A single `bun src/claimer.ts` invocation (launchd fires it every 300s) executes:

1. **Heartbeat FIRST** — `runner_state.last_heartbeat = now`, status `claiming`, so the watchdog sees life even if later steps fail.
2. **Kill switch** — local flag file OR `runner_state.kill_switch`; fail-closed on DB-unreachable/missing-row. Set → idle + exit, claiming halts within one poll cycle (AUTO-04).
3. **Stale-claim sweep** — `sweepStaleClaims()` (13-02 lib).
4. **Approval-merge pass** — BEFORE new claims, exempt from quiet hours (approved work ships promptly).
5. **Budget guards** — quiet hours (01:00–07:00) OR `maxRunsPerWindow` (12/24h, counted from `autopilot.jsonl`) suppress NEW claims (merges already ran).
6. **Claim + run** — `selectNextTicket` (urgent DESC → priority DESC → severity rank → created_at ASC) → atomic `claimTicket` → `processTicket()` (13-03 pipeline); if the post-run head is urgent, loop once more this invocation (skips cooldown; in-flight work was never killed).
7. **Idle** with the cycle's `last_result`.

## Approval-merge path (the only route to production)

`findApprovals()` → `qualifyEvents()` (pure, unit-tested) → `executeApproval()`:

- **Recognition (T-13-21):** an event qualifies for merge ONLY when `actor_id` is non-NULL **and** resolves to ADMIN in `public.user_roles` (role='ADMIN'). NULL-actor rows (triggers/service-role) and non-admin rows NEVER qualify. Newest qualifying event per ticket wins; a NULL-actor row cannot mask a valid admin approval beneath it.
- **Merge (T-13-22/23):** `push-gate.sh` re-run pre-merge with **no `PUSH_GATE_SKIP_DB`** (live kill-switch + denylist + commit-advance re-checked) → `git merge --ff-only` onto main in the dedicated clone → push. If main moved: rebase the single fix commit, re-run the FULL gate once, else escalate + page.
- **Deploy-SHA verify (T-13-25 / ISC-112):** poll production until the served bundle's baked-in commit SHA equals the pushed SHA; append the result to the ticket evidence (`## Deploy` section) and set status → resolved. Gate exit 1/2 → post gate output, leave `awaiting_approval`, page via `user_notifications`.
- **Rejection:** delete the remote branch, post the reason, status → rejected.

## Live probes

- **Dry-run full cycle (kill switch temporarily OFF, restored immediately):** heartbeat → kill-check passed → sweep → approval pass (none) → budget (not quiet hours, 1/12 runs) → selected `f569570a` (severity=high) over the medium-severity heads — ordering libs honored. No claim (dry-run). Kill switch restored ON and confirmed.
- **launchd-fired cycle (no --dry-run):** kickstarted via `launchctl kickstart -k`; `dispatcher.out.log` shows `kill switch engaged (runner_state.kill_switch) — claiming halted`; `last_heartbeat` advanced 17:31:25 → 17:32:56; lockdir released cleanly; launchctl exit 0.
- **Transient-521 fail-closed proof:** the first RunAtLoad fire hit a Supabase 521 on the kill-switch read; the cycle reported `kill switch engaged (DB unreachable (fail closed))` and claimed nothing — the correct AUTO-04 safety behavior, not a crash.
- **Deploy-SHA mechanism (live):** `verifyDeploySha(origin/main HEAD)` fetched the production bundle, extracted `60e60dc3d994…`, matched it to `origin/main` → `verified: true`.

## Admin approval SQL for the E2E (13-07)

`ticket_events` INSERT is service-role/trigger-only by policy (11-05) — there is no authenticated admin INSERT path yet (Phase 14 adds the Edge-Function UI). The documented v1 mechanism for Andrew to author an approval is a **service-role INSERT with `actor_id` set to his admin user id**:

```sql
-- v1 admin approval (service-role; Phase 14 replaces with an Edge-Function path).
-- The ticket must be status='awaiting_approval'. The recognition logic is identical.
insert into ticket_events (ticket_id, actor_id, event_type, new_value)
values (
  '<AWAITING_APPROVAL_TICKET_ID>',
  'ef054159-3a5a-49e3-9fd8-31fa5a180ee6',  -- Andrew, role=ADMIN (verified live)
  'approval',
  'approved'
);
-- Rejection instead: event_type='rejection'.
```

`qualifyEvents` treats this row identically to a future Phase-14-authored event — only `actor_id` non-NULL + ADMIN matters.

## Task Commits (autopilot repo)

| Task | Commit | Note |
|------|--------|------|
| 2 RED | 62d391e | failing approval-recognition tests (6 behaviors) |
| 2 GREEN | e0f7dd8 | approval.ts + rmdirSync ambient decl |
| 1 | f047702 | claimer.ts poll cycle |
| 3 | 5ef9668 | dispatcher launchd plist (installed + loaded) |

TDD gate sequence present in git log: `test(13-06)` (RED) → `feat(13-06)` (GREEN). REFACTOR not needed.

## Gates

- `bunx tsc --noEmit` → exit 0
- `bun test` (5 daemon test files, explicit `./src/` paths) → 42 pass / 0 fail / 121 expects
- `bash gate/push-gate-test.sh` → 7/7 fixtures pass (regression clean)
- `plutil -lint` dispatcher plist → OK; `launchctl list` shows both jobs at exit 0

## Deviations from Plan

**1. [Rule 3 - Blocking] `rmdirSync` missing from ambient decls** — `claimer.ts` releases its lockdir with `rmdirSync`, absent from the hand-rolled `runtime.d.ts`. Added one line (the no-new-package constraint from 13-02 holds; this is a runtime API bun executes natively). Commit e0f7dd8.

**2. [Deviation - Discovery] Deploy-SHA mechanism chosen via live discovery, not assumption** — the plan's discovery sub-step asked to check for an existing version/commit exposure before falling back to a deploy-provider API/CLI. Findings: no Vercel CLI installed, no Vercel token in env, `gh` deployments + commit-statuses + check-runs all empty for the live SHA. But the production bundle bakes in the Sentry-release commit SHA (`@sentry/vite-plugin` release = `VERCEL_GIT_COMMIT_SHA`). Chose bundle-grep — token-free and truthful to the actually-served deploy. Implemented as `verifyDeploySha` with injectable fetch/sleep for determinism.

**3. [Scope note] Pre-existing `qa/nightly-crawl.sh` + `qa/runs.log` modifications left untouched** — unrelated to this plan (qa harness state, likely from a watchdog tools-health run). Not staged, not committed.

## Known Stubs

None. The deploy-SHA path is fully wired and proven live; the approval recognition is unit-tested; the live merge exercise is intentionally deferred to 13-07 (the controlled first real run), which is the plan's stated scope boundary — not a stub.

## Self-Check: PASSED

- Files on disk: `src/claimer.ts`, `src/lib/approval.ts`, `src/lib/approval.test.ts`, `launchd/com.callvault.autopilot.plist`, `src/types/runtime.d.ts` (modified) — all present.
- Commits in autopilot history: 62d391e, e0f7dd8, f047702, 5ef9668 — all present.
- Tests 42/42; tsc exit 0; gate fixtures 7/7; plist linted + loaded; kill switch left ON (armed-but-idle).
