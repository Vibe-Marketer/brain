---
phase: 13-dispatcher-mechanical-safety
plan: 05
subsystem: infra
tags: [watchdog, launchd, heartbeat, paging, user-notifications, autopilot]

requires:
  - phase: 13-01
    provides: runner_state.last_heartbeat (live)
  - phase: 13-02
    provides: db.ts service-role client + config knobs
provides:
  - "~/dev/autopilot/src/watchdog.ts — independent heartbeat monitor + dual-channel pager + tools-health ticket filer (ISC-109)"
  - "~/dev/autopilot/launchd/com.callvault.autopilot-watchdog.plist — loaded, StartInterval 300, RunAtLoad"
affects: [13-06, 13-07, 14-approval-ops-ui]

tech-stack:
  added: []
  patterns: ["injected WatchdogDeps for fully-mocked behavior tests", "DB-unreachable is itself a paging condition (fail loud)", "cooldown state file logs/.watchdog-last-page rate-limits pages", "volatile-token normalization in dedupe fingerprints"]

key-files:
  created:
    - ~/dev/autopilot/src/watchdog.ts
    - ~/dev/autopilot/src/watchdog.test.ts
    - ~/dev/autopilot/launchd/com.callvault.autopilot-watchdog.plist
  modified: []

key-decisions:
  - "Threshold = 2×pollIntervalSec + 600s margin (1200s); cooldown 3600s (one page/hour while down)"
  - "Admin user id pinned in watchdog.ts from live user_roles ADMIN lookup (ef054159…)"
  - "user_notifications live columns verified before insert (user_id/type/title/body/metadata); type='health_alert'"
  - "Fingerprints normalize digit/hex runs — live drill caught per-run Chrome tab ids defeating dedupe"

requirements-completed: [AUTO-05]

duration: ~20min
completed: 2026-06-11
---

# Phase 13 Plan 05: Independent Watchdog Summary

**Separate launchd job that pages Andrew on both channels (user_notifications INSERT + osascript) when the dispatcher heartbeat goes stale or the DB is unreachable, rate-limited by a cooldown file, with tools-health failures filed as fingerprint-deduped high tickets — drilled live**

## Behavior Tests (bun test, 6/6 green)

Fresh-heartbeat no-page; stale → page once naming age; DB-throws → "watchdog cannot reach DB" page; NULL heartbeat pages; cooldown suppresses inside window; re-pages after window.

## Live Staleness Drill Evidence

- Heartbeat staled to 2026-06-11T10:00:00Z (dispatcher does not exist until 13-06); plist installed + `launchctl load` → job fired on load (launchctl list shows label, last exit 0)
- Page delivered: `user_notifications` row live-probed — `{"title":"Autopilot watchdog","body":"Autopilot dispatcher heartbeat is stale: 25530s old (threshold 1200s)…"}` + osascript notification posted
- Cooldown verified: immediate second/third passes → `page suppressed by cooldown` (named the age, no new row)
- Tools-health: script found a REAL failure (interceptor-roundtrip bridge check) → high-severity ticket filed; consecutive run → "already ticketed (1 open) — skipping". Exactly one open watchdog ticket (12314489…) remains in the queue — a genuine finding, deliberately left for triage
- First launchd fire hit a transient Supabase 521 on the INSERT (osascript channel still fired); re-drill after the 521 cleared landed channel A — error path logs loudly, run does not crash
- Watchdog never writes last_heartbeat (no self-monitoring)

## Task Commits (autopilot repo)

| Task | Commit |
|------|--------|
| 1 RED | 2c083ec |
| 1 GREEN | d073b85 |
| 2 + fixes | 24e0d48 |

## Deviations from Plan

**1. [Rule 1 - Bug] Dedupe defeated by volatile tab ids in failing-check lines** — fingerprints differed every run, filing duplicate tickets (4 accumulated during the drill; 3 dupes deleted, oldest kept then superseded by the normalized-fingerprint ticket). Fixed: digit/hex normalization + server-side `context->>watchdog_fingerprint` eq filter instead of an unordered limited fetch. Commit 24e0d48.

## Operational Note

The watchdog is live and will correctly page ~1×/hour that the dispatcher is down until 13-06 arms it — that is true (the dispatcher IS down) and within the cooldown budget. DB kill_switch left ON.

## Self-Check: PASSED
Files on disk; commits in history; 6/6 tests; tsc green; plutil OK; launchctl shows the job; live drill rows probed above.
