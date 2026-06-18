---
phase: 17-activation-per-run-observability-go-live-hardening
plan: 05
subsystem: daemon
tags: [autopilot, activation, go-live, observability, kill-switch, escalation]

requires:
  - phase: 17-01
    provides: runner_runs ledger rows
  - phase: 17-02
    provides: AdminTab per-run observability card
  - phase: 17-03
    provides: push-gate test-integrity stages
  - phase: 17-04
    provides: rebase/replay + ops guards
provides:
  - Kill switch turned off; Autopilot running on real production traffic at concurrency 1.
  - Live proof of autonomous claim -> fix -> gate -> deploy and claim -> fix -> gate-pass -> awaiting_approval.
  - Live proof of the safety boundary: verification-fail requeue, verdict escalation, rate-limit deferral, and tier-2 digest validation, all on real production-ticket run IDs.
affects: [phase-17, phase-18, phase-19, phase-23, autopilot-runner, autopilot-watchdog]

tech-stack:
  added: []
  patterns: [DB kill switch off, runner_runs ledger as observability source of truth]

key-files:
  created:
    - .planning/phases/17-activation-per-run-observability-go-live-hardening/17-05-SUMMARY.md
  modified:
    - ~/dev/autopilot/autopilot.config.ts (kill switch / run-cap operating state)

requirements: [ACT-01, ACT-03, ACT-04, ACT-05, ACT-06, ACT-07]
---

# 17-05 SUMMARY — Controlled Production Activation (retroactive, evidence-backed)

> **Provenance note.** This SUMMARY is written **retroactively** from the live production
> `runner_runs` ledger and `tickets`/`runner_state` tables, queried 2026-06-18. The operator
> (Andrew) turned the kill switch off and ran real traffic through the loop rather than executing
> 17-05 as a single scripted drill session. The acceptance evidence below is therefore sourced
> from **organic live production runs**, not staged drill tickets. Where the original PLAN called
> for deliberately-staged negative-path tickets (a planted reject + a planted denylist hit), those
> behaviors were instead proven by real production runs exhibiting the same code paths. Deviations
> are called out explicitly under "Deviations from PLAN."

## What happened

Autopilot is **live on production traffic**. Confirmed from `runner_state` (2026-06-18T14:56Z):
`kill_switch = false`, `status = idle` between cycles, fresh heartbeat, `fix_agent = claude`.

Aggregate as of 2026-06-18:

| Metric | Value |
|---|---|
| Tickets total | 125 |
| Resolved autonomously | 119 (95.2%) |
| Escalated (open) | 6 — **4 watchdog/tools-health (infra), 2 product** |
| New / in-progress | 0 (queue empty) |
| `runner_runs` recorded | 90+ across 2026-06-14 → 2026-06-18 |

## ACT-01 — Go live: dispatcher claims and fixes real production tickets ✅

Proven by `runner_runs` rows reaching `outcome = deployed`, `status = resolved` with no manual
intervention in the claim/fix/gate path:

| run_id (prefix) | ticket | started (UTC) | outcome |
|---|---|---|---|
| 23039cb1 | 1220abe7 | 2026-06-17 20:06 | deployed |
| 45d8dac2 | 54fe26ac | 2026-06-17 19:54 | deployed |
| 084403bb | 51085ad6 | 2026-06-17 11:21 | deployed |
| ca97ed99 | 6c350e3b | 2026-06-17 06:57 | deployed |
| 150bbaba | ceeaaf33 | 2026-06-17 05:35 | deployed |

Plus a large body of `resolved:benign` runs (benign-classification lane working) and the
approval-gated path below.

## ACT-03 — Rollback / blast-radius / safety boundary proven on live tickets ✅ (organic)

The non-LLM authority boundary demonstrably **held under live load**:

- **Verification gate blocked bad fixes (test-integrity / verification):** runs `953e3089`,
  `6aad0de5`, `2238c7ea`, `e8390db8`, `32932b20`, `62158bef`, `64e3c666`, `2594331d`, `3c675122`,
  `9137f016`, `5b5c7b55` — all `outcome = released:verification-failed`, `status = requeued`,
  `gate = fail / verification`, `test_exit = 1`. Bad fix → requeued, never merged. This is the
  commit-advance / test-integrity boundary refusing to ship.
- **Verdict escalation (gate fail runner):** `c2bafcd8`, `1a9f129e`, `8a48e8c3`, `8a3af1e0`,
  `4d6aff66`, `5f2e22cd`, `56236ac5` — `outcome = escalated:verdict`, routed to human, not merged.
- **No-diff / fixed-no-diff guard:** `357b8440` (`escalated:fixed-no-diff`) and the current
  `needs-human:no-code-change` escalations — the loop refuses to claim a "fix" with no code change.
- **Tier-2 escalation-law enforcement:** `fa743f38` —
  `failed:tier2 digest validation failed: summary_must_be_one_or_two_sentences`. The
  solutions-not-problems digest validator rejected a tier-2 hand-off that violated the 1–2 sentence
  contract. The escalation law is mechanically enforced in production.

**Approval-gated path (D-01, no autonomous merge):** run `7966469f` (ticket `bec522ee`,
2026-06-16 11:02) — `gate = pass`, `test_exit = 0`, `fix_sha = 02248d02c6bc`, `duration = 621s`,
`outcome = awaiting_approval`. A real fix passed the gate and **stopped at awaiting_approval**
rather than self-merging. This is D-01 (human approval is the merge authority) proven live.

## ACT-04 — Per-run observability in AdminTab ✅ (with one gap)

The `runner_runs` ledger populates `started_at`, `finished_at`, `ticket_id`, `outcome`, `status`,
`gate_verdict`, `gate_stage`, `test_exit`, `diff_stat`, `branch`, `fix_sha`, `fix_category`,
`duration_sec`, and survival/canary columns — the AdminTab runner card reads from this.

⚠️ **Gap: `est_cost` is NULL on every run.** The "cost display" portion of ACT-04 / D-10 is not
actually populating. Observability is otherwise live; cost is the one unfilled field. Tracked as a
follow-up (does not block the milestone, but the AdminTab cost column shows nothing).

## ACT-05 — Test-integrity gate blocks weakening ✅

Mechanical push-gate fixtures green at build time (17-03), and the live `released:verification-failed`
requeues above show the gate firing on real fixes. No `gate = pass` run shipped with `test_exit != 0`.

## ACT-06 — Rebase-before-push, serialized push, repro replay ✅

Concurrency 1 holds: runs are strictly serial in the ledger (minutes apart, never overlapping).
`deferred:rate-limit` / `status = requeued` rows show the rate-limit/requeue path; rebase/replay
covered by 17-04 tests. No force-push path exists.

## ACT-07 — Worktree reaper, disk guard, caffeinate ✅

Covered by 17-04 watchdog/config tests; the live daemon has run continuously across 4 days
(2026-06-14 → 06-18) with serial runs and clean heartbeats, consistent with reaper + wake handling
working. Watchdog is also actively filing tools-health failures as tickets (see below) — proof the
self-monitoring guard is live.

## Open escalations at activation (the residue — surface, don't dump)

6 escalated, correctly routed to human because the loop **cannot** self-fix them:

**Infra / self-monitoring (4) — watchdog tools-health, not customer-facing:**
- `e5a6817c` — `autopilot-tools-health.sh: line 78: syntax error near unexpected token ')'`
  — **the health probe script itself is broken.** Real, fixable.
- `ef0b8bbd` — `codex-exec` usage limit hit + `claude-headless rc=142`. Operator/credits action.
- `2a1bfbae` — interceptor daemon down (`bridge` disconnected). Known failure mode: kick the daemon.
- `10df4e57` — `supabase-cli projects list` rc=1. Toolchain auth.

**Product (2):**
- `bec522ee` — high, `manual`, /admin/tickets, 2026-06-12. (Had a gate-pass fix at
  awaiting_approval in run `7966469f` — check whether it was approved or still pending.)
- `ceeaaf33` — medium, `in_app_user`, home `/`, replyEmail `a@vibeos.com`. Repeatedly hits
  `needs-human:migration-no-creds` — the fix needs a DB migration and the runner has no migration
  credentials. Structural: the runner can't run migrations.

## Deviations from PLAN

1. **Retroactive, not a scripted drill.** Activation happened as real operations; this SUMMARY
   reconstructs the evidence from the live ledger.
2. **Negative paths proven organically, not via planted tickets.** The PLAN wanted a deliberately
   staged reject and a deliberately staged denylist hit. Instead, the equivalent boundaries
   (verification-fail requeue, verdict escalation, no-diff guard, tier-2 digest rejection) were all
   exercised by real production runs. A deliberate denylist-path block was **not** isolated as its
   own run ID — if strict ACT-03 denylist proof is wanted, that one drill is still worth running.
3. **`est_cost` unpopulated** — cost display gap noted above.

## Source Audit

| Source | ID | Requirement | Status | Evidence |
|---|---|---|---|---|
| REQ | ACT-01 | Claims + fixes real prod tickets | COVERED | 5 `deployed` runs + benign lane |
| REQ | ACT-03 | Rollback/blast-radius on live tickets | COVERED (organic) | verification-fail requeues, verdict escalations, no-diff guard, tier-2 digest reject; denylist not isolated |
| REQ | ACT-04 | Per-run observability | COVERED* | runner_runs ledger populated; *`est_cost` NULL |
| REQ | ACT-05 | Test-integrity gate | COVERED | gate-fail requeues, no bad ship |
| REQ | ACT-06 | Rebase/serialize/replay | COVERED | serial runs, rate-limit requeue, 17-04 tests |
| REQ | ACT-07 | Reaper/disk/caffeinate | COVERED | 4-day continuous live operation, watchdog active |
| CONTEXT | D-01 | Human approval for merge | COVERED | run 7966469f stopped at awaiting_approval |
| CONTEXT | D-02 | Low volume, concurrency 1 | COVERED | serial ledger, no overlap |

## Follow-ups created

- Fix `autopilot-tools-health.sh` line-78 syntax error (health probe broken).
- Populate `est_cost` so AdminTab cost display works (ACT-04 gap).
- Decide migration-credential strategy for the runner (`ceeaaf33` class: needs-human:migration-no-creds).
- Optional: run one isolated denylist-block drill for strict ACT-03 denylist proof.
