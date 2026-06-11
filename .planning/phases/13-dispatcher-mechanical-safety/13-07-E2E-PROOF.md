# Phase 13 — E2E Proof (13-07)

**Run started:** 2026-06-11T17:45:59Z
**Operator:** autopilot daemon pack (`~/dev/autopilot/`), driven by 13-07 executor
**Scope of THIS document:** the unattended half of the pipeline — ticket → claim → fix → evidence → codex review → **held at `awaiting_approval`**. The run STOPS at Andrew's approval checkpoint. No merge, no approval event authored here (by design — v1 trust window, ISA ISC-66).

---

## Target ticket

| Field | Value |
|-------|-------|
| Ticket ID | `1deaa9b7-2bf4-4b13-bac8-19674233624e` |
| Severity | `low` |
| Type | `bug` |
| Source | `manual` (don-qa-crawler, prod) |
| Reported defect | navigation-cancelled fetches logged as ERRORs (`[useOnboarding]` profile fetch, contacts-for-filter) — `TypeError: Failed to fetch` on AbortError pollutes console + Sentry quota. **Fix: swallow AbortError in those handlers.** |
| Status at start | `new` (claimable) |

**Why this ticket (in-policy verification):** The likely fix surface is leaf-level frontend handlers. Confirmed live in `~/dev/brain`:
- `src/components/transcript-library/FilterBar.tsx:79` — `logger.error("Error fetching contacts for filter", fetchError)` (one of the two named sites, confirmed).
- The `[useOnboarding]` profile-fetch site (paraphrased name; agent locates the actual hook).

Neither surface matches any push-gate denylist pattern (no `supabase/migrations/**`, no `auth`/`oauth`/`polar`/`billing`, no `.github/`, no lockfile). **The push-gate would PASS this diff** — verified against `gate/denylist.txt`.

---

## Stage 0 — Pre-flight (baseline captured before any launch)

### 0.1 Target ticket exists + claimable
```
1deaa9b7-2bf4-4b13-bac8-19674233624e | status=new | severity=low | type=bug | priority=0 | urgent=false | attempts=0
```
RESEARCH assumption A1 holds — ticket is `new`/claimable, no reset needed. Reporter message present on thread (the AbortError defect description above). Only event so far: `created` (null→new) by Andrew (`ef054159-...`).

### 0.2 Baseline `git -C ~/dev/brain status --porcelain` (untouched-checkout baseline)
```
?? CODEX-MEANTIME-BRIEF.md
```
**Baseline delta note:** `CODEX-MEANTIME-BRIEF.md` is a PRE-EXISTING untracked file (not created by this run; present before launch). The untouched-checkout proof at the end compares against THIS exact baseline — the autopilot pipeline must not add/modify/delete anything in `~/dev/brain`.

- `~/dev/brain` HEAD: `9f0d56b5f78cb8302ada17aaf5440ac7b61c3b32`
- `~/dev/autopilot/clone` `origin/main` (fetched): `9f0d56b5f78cb8302ada17aaf5440ac7b61c3b32` — clone tracks brain HEAD.

### 0.3 launchd jobs live
```
-	0	com.callvault.autopilot-watchdog
-	0	com.callvault.autopilot
```
Both loaded, last exit 0.

### 0.4 Gate fixtures green (deterministic push-gate)
```
PASS  clean-src-fix (exit 0)
PASS  migration-touch (exit 1)
PASS  github-touch (exit 1)
PASS  lockfile-touch (exit 1)
PASS  kill-switch-flag (exit 2)
PASS  no-advance (exit 1)
PASS  multi-commit (exit 1)
ALL 7 FIXTURES PASS
```

### 0.5 Kill switch ON at baseline (AUTO-04 — pre-launch resting state)
`runner_state` row at baseline:
```json
{
  "status": "idle",
  "current_ticket_id": null,
  "last_heartbeat": "2026-06-11T17:42:57.677+00:00",
  "last_result": "kill switch: runner_state.kill_switch",
  "kill_switch": true
}
```
The dispatcher's most recent launchd cycle claimed nothing — `last_result = "kill switch: runner_state.kill_switch"`. This is the live kill-switch drill (AUTO-04): with `kill_switch=true`, a poll cycle halts claiming. **Recorded.**

---

## Stage 1 — Controlled launch (the unattended half)

### 1.1 Stage the ticket head-of-queue (urgent lane live-exercise)
`2026-06-11T17:46Z` — set via service-role:
```
set urgent=true, priority=100 on 1deaa9b7
target now: {"status":"new","severity":"low","priority":100,"urgent":true,"attempts":0}
```
Setting `urgent=true` live-exercises the urgent-lane ordering (`urgent DESC → priority DESC → severity rank → created_at ASC`) — the target is claimed next regardless of the 40+ other open tickets.

### 1.2 Flip kill switch OFF + launch
`2026-06-11T17:46:48Z` — `runner_state.kill_switch -> false` (confirmed), no local `KILL` flag file present. Local time 13:46 — outside quiet hours (01:00–07:00), run permitted.

Launch: `bun run src/claimer.ts` (foreground, synchronous). Output:
```
[claimer] claimed 1deaa9b7-2bf4-4b13-bac8-19674233624e — running fix pipeline
[claimer] cycle complete: cycle:1deaa9b7-...:awaiting_approval (claims=1, merges=0)
=== CLAIMER EXIT: 0 ===
```

### 1.3 Flip kill switch back ON (demo containment)
`2026-06-11T17:53:21Z` — `runner_state.kill_switch -> true` immediately after the run. Resting state:
```json
{
  "status": "idle",
  "current_ticket_id": null,
  "run_started_at": "2026-06-11T17:47:04.223+00:00",
  "last_heartbeat": "2026-06-11T17:53:12.165+00:00",
  "last_result": "cycle: 1 claim(s), 0 merge(s), last=1deaa9b7-...:awaiting_approval",
  "kill_switch": true
}
```
**Kill switch ends ON.** Run duration ~6 min (17:47:04 → 17:53:12).

### 1.4 Events timeline (the run, reconstructed — ISC-77)
```
2026-06-11T13:01:18Z | created       | actor=ef054159(Andrew) | null->new
2026-06-11T17:47:04Z | status_change | actor=NULL(daemon)     | new->in_progress
2026-06-11T17:47:05Z | run_started   | actor=NULL(daemon)     | null->fix/ticket-1deaa9b7
2026-06-11T17:53:08Z | fix_prepared  | actor=NULL(daemon)     | null->fix/ticket-1deaa9b7
2026-06-11T17:53:09Z | status_change | actor=NULL(daemon)     | in_progress->awaiting_approval
```
Every daemon event has `actor_id = NULL` (service-role) — none of these can ever qualify as an approval (which requires non-NULL ADMIN actor).

### 1.5 Structured run record (`autopilot.jsonl`)
```json
{"ts_start":"2026-06-11T17:47:04.223Z","ts_end":"2026-06-11T17:53:09.206Z","claude_exit":0,
 "verdict":"FIXED","changed_files":4,"migrations_touched":false,"test_cmd":"vitest+build",
 "test_exit":0,"rate_limit_suspected":false,"ticket_id":"1deaa9b7-...","branch":"fix/ticket-1deaa9b7",
 "fix_sha":"9f9a596b1a66c86b46c5fca669dfd52d2f9ab21d",
 "codex_review":"REVIEW: REJECT — isAbortError suppresses non-abort fetch/network/security failures as if they were navigation cancels."}
```
Transcript: `~/dev/autopilot/logs/runs/1deaa9b7-1781200024.txt`; codex review: `~/dev/autopilot/logs/runs/1deaa9b7-codex-review.txt`.

---

## Stage 2 — Evidence bundle (held at `awaiting_approval`)

Ticket `1deaa9b7` status: **`awaiting_approval`**, attempts=1. Agent message posted to the thread (`author_type='agent'`, `2026-06-11T17:53:08Z`) contains the full bundle:

- **Branch:** `fix/ticket-1deaa9b7` — held (v1 ships nothing autonomously). Fix SHA `9f9a596b1a66c86b46c5fca669dfd52d2f9ab21d`.
- **Diff (4 files, +87/-3):**
  ```
  src/components/transcript-library/FilterBar.tsx |  7 ++++-
  src/hooks/useOnboarding.ts                      | 11 +++++--
  src/lib/__tests__/is-abort-error.test.ts        | 34 +++++++++++++
  src/lib/is-abort-error.ts                       | 38 +++++++++++++++
  ```
  Both reported sites addressed via a shared `isAbortError` guard. **No denylist files touched** (no migrations/auth/billing/RLS/.github/lockfile). `migrations_touched=false`.
- **Tests:** `vitest exit 0` — 218 files passed / 1868 tests passed (93 skipped). `build exit 0`.
- **Codex review (cross-vendor referee):** `REVIEW: REJECT — isAbortError suppresses non-abort fetch/network/security failures as if they were navigation cancels.` Advisory — recorded on the bundle; the deterministic push-gate + admin approval hold the keys.
- **Revert:** delete branch `fix/ticket-1deaa9b7`; base/revert SHA `9f0d56b5...`.
- **Deploy:** placeholder section — appended by the approval-merge path AFTER merge (ISC-112). Empty now (nothing merged).

> **Note on the codex REJECT:** This is the cross-vendor referee working as designed (Andrew's mandate: Claude writes, codex referees, the script holds the keys). The agent's `isAbortError` helper is broad enough that codex flags it may swallow genuine network/security failures, not just navigation cancels. The fix is **held** — Andrew sees this verdict before deciding. This is a legitimate quality signal, NOT a pipeline failure: the mechanical pipeline executed flawlessly end-to-end and correctly parked the change for human judgment. See "Andrew's decision" below.

---

## Stage 3 — Live-repo-untouched proof

| Check | Baseline (pre-run) | After run | Verdict |
|-------|--------------------|-----------|---------|
| `~/dev/brain` HEAD | `9f0d56b5` | `9f0d56b5` | unchanged |
| `~/dev/brain` working tree | `?? CODEX-MEANTIME-BRIEF.md` | `?? CODEX-MEANTIME-BRIEF.md` + `?? .planning/.../13-07-E2E-PROOF.md` | only this proof doc added; **zero source changes** |
| `origin/main` (clone) | `9f0d56b5` | `9f0d56b5` | unchanged — nothing merged |
| Held branch `fix/ticket-1deaa9b7` | absent | `9f9a596b` on origin | fix exists ONLY on held branch |
| `~/dev/autopilot/worktrees/` | empty | empty | per-run worktree destroyed after run |

The only delta in `~/dev/brain` is `13-07-E2E-PROOF.md` (this document, under `.planning/`) and the pre-existing untracked `CODEX-MEANTIME-BRIEF.md`. **No tracked source file was added, modified, or deleted by the autopilot pipeline.** The fix lives only on the held branch `fix/ticket-1deaa9b7` (SHA `9f9a596b`), which is NOT on `main`. **Live checkout pristine — proven.**

---

## Criterion-by-criterion evidence map

### ROADMAP success criteria (this run — unattended half)

| # | Criterion | Evidence | Status |
|---|-----------|----------|--------|
| 1 | Real ticket flows ticket→claim→fix→evidence→codex review | Stages 1.4, 1.5, 2 — `1deaa9b7` claimed, fixed, evidence + codex verdict on thread | DONE (unattended half) |
| 2 | Zero manual steps besides approval | Single `bun run src/claimer.ts` ran heartbeat→claim→fix→review→hold with no intervention | DONE |
| 3 | Live checkout untouched during run | Stage 3 table — brain HEAD + working tree pristine | DONE |
| 4 | Evidence bundle = diff + tests + codex verdict | Stage 2 — all three present on `ticket_messages` agent row | DONE |
| 5 | Approval is the single human checkpoint | Run parked at `awaiting_approval`; merge requires Andrew's approval event | **PENDING Andrew (this checkpoint)** |
| 6 | Merge→deploy-SHA verify after approval | Approval-merge path wired (13-06); fires on Andrew's approval | **PENDING Andrew → autonomous** |

### AUTO requirements

| Req | What it asserts | Evidence | Status |
|-----|-----------------|----------|--------|
| AUTO-01 | Daemon claims tickets from live queue | Stage 1.2 — atomic claim of `1deaa9b7` (new→in_progress) | DONE |
| AUTO-02 | Headless fix in ephemeral worktree, live checkout never used | Stage 3 — worktree destroyed, brain untouched; branch `fix/ticket-1deaa9b7` | DONE |
| AUTO-03 | Evidence written back to ticket | Stage 2 — agent message bundle on thread | DONE |
| AUTO-04 | Kill switch halts claiming within one cycle | Stage 0.5 (baseline drill) + 1.3 (re-armed); fail-closed proven 13-06 | DONE |
| AUTO-05 | Watchdog pages on heartbeat staleness | Watchdog job loaded (Stage 0.3); staleness-page drill deferred to post-approval Stage (13-07 Task 3) — NOT exercised in this checkpoint half | PENDING (post-approval) |
| AUTO-06 | Every change held behind explicit admin approval | Run stopped at `awaiting_approval`; nothing merged (origin/main unchanged) | DONE |

---

## Andrew's decision — the single human checkpoint (DO THIS)

The pipeline is parked at `awaiting_approval`. **Read the codex REJECT first** — the agent's `isAbortError` guard may be too broad (could swallow real network/security errors, not just navigation cancels). Your call:

- **If you want this fix shipped as-is:** approve. The next dispatcher cycle re-runs the gate, ff-merges to main, pushes, and deploy-SHA-verifies — autonomously.
- **If the codex concern matters (recommended given REJECT):** reject. The dispatcher deletes the held branch and posts the reason; the ticket can be re-queued for a tighter fix.

### (a) Primary path — in `/admin` (Phase 14 UI)
> **Note:** the in-app approval UI lands in **Phase 14** (`14-in-app-approval-loop`). It is **not yet built** as of this run. Until it ships, use the fallback SQL below. When Phase 14 is live, the one-line action is: open ticket `1deaa9b7` in /admin → click **Approve** (or **Reject**). `qualifyEvents` treats the Phase-14 event identically to the SQL below — only `actor_id` = your ADMIN id matters.

### (b) Fallback — service-role SQL (works today)
Run against the CallVault Supabase project with the **service-role** key (ticket_events INSERT is service-role/trigger-only by RLS policy 11-05). `actor_id` is **Andrew's verified ADMIN id** `ef054159-3a5a-49e3-9fd8-31fa5a180ee6` (confirmed live: holds `role='ADMIN'` in `public.user_roles`).

**To APPROVE (ships the fix):**
```sql
insert into ticket_events (ticket_id, actor_id, event_type, new_value)
values (
  '1deaa9b7-2bf4-4b13-bac8-19674233624e',
  'ef054159-3a5a-49e3-9fd8-31fa5a180ee6',  -- Andrew, role=ADMIN (verified live)
  'approval',
  'approved'
);
```

**To REJECT (discards the held branch — recommended given the codex REJECT):**
```sql
insert into ticket_events (ticket_id, actor_id, event_type, new_value)
values (
  '1deaa9b7-2bf4-4b13-bac8-19674233624e',
  'ef054159-3a5a-49e3-9fd8-31fa5a180ee6',
  'rejection',
  'rejected: codex flagged isAbortError too broad — re-queue for a narrower guard'
);
```

After authoring either event, the next dispatcher poll cycle (or a manual `bun run src/claimer.ts`) executes it — approval merges + deploy-SHA-verifies; rejection deletes the branch and posts the reason. **The kill switch must be flipped OFF for the cycle to run** (it is currently ON for demo containment); flip it back ON after.

---

## CHECKPOINT — STOP

**The executor stops here by design (13-07 Task 2 — `checkpoint:human-verify`, gate=blocking).** The approval event is Andrew's and Andrew's alone (v1 trust window, ISA ISC-66). The executor did NOT author any approval/rejection event. Stage 3-autonomous (merge + deploy-SHA verify + watchdog staleness drill + final criterion close-out) runs AFTER Andrew's decision.

---

## Self-Check: PASSED

- `13-07-E2E-PROOF.md` on disk — FOUND.
- Plan Task-1 automated verify: `grep -c awaiting_approval` = 9 (≠0) — PASS.
- Plan Task-3 automated verify: `grep -c AUTO-0[1-6]` = 8 (≠0) — PASS.
- Held branch `fix/ticket-1deaa9b7` on origin at `9f9a596b1a66c86b46c5fca669dfd52d2f9ab21d` — FOUND.
- Ticket `1deaa9b7` status `awaiting_approval` — confirmed.
- `origin/main` = `9f0d56b5` (unchanged) — nothing merged.
- `~/dev/brain` working tree: only `13-07-E2E-PROOF.md` + pre-existing `CODEX-MEANTIME-BRIEF.md` — zero source changes.
- Kill switch ends ON; no approval/rejection event authored by the executor.

---
