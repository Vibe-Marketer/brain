# Phase 13: Dispatcher + Mechanical Safety - Research

**Researched:** 2026-06-11
**Domain:** Autonomous fix dispatcher (bun+TS daemon pack at `~/dev/autopilot/`, launchd, Supabase ticket queue, git worktrees, deterministic push-gate, codex review gate)
**Confidence:** HIGH (all primary findings verified against live repo, dead-branch reference code, spike artifacts, and ISA criteria in this session)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Queue, priority, and urgency (Andrew, 2026-06-11)
- New migration: `tickets.priority` integer (default 0) + `tickets.urgent` boolean (default false). Claim order: `urgent DESC, priority DESC, severity rank, created_at ASC`.
- **URGENT lane:** an urgent ticket is claimed next regardless of anything else; if a non-urgent run is in flight, the dispatcher does NOT kill it (in-flight work completes or times out) but skips any queue cooldown and takes the urgent ticket immediately after. Admin sets urgent via the UI (Phase 14) or directly (column is admin-writable via RLS).
- Admin can reorder the queue by editing `priority` (Phase 14 exposes drag/quick-set; RLS: only ADMIN may update priority/urgent).

#### Runner status visibility (Andrew, 2026-06-11)
- New table `runner_state` (single row or per-runner): status idle|claiming|running|awaiting_gate, current_ticket_id, run_started_at, last_heartbeat, last_result, kill_switch boolean. Dispatcher updates it every poll cycle and at run transitions.
- Phase 14 renders it as a live status card in AdminTab; heartbeat staleness ⇒ visible "runner offline" state. Until Phase 14 lands, status is readable via the table directly.

#### Daemon pack (ISA ISC-104..120 as revised; Advisor + Cato reconciliation; SPIKE-VERDICT ISC-116)
- Four separated concerns at `~/dev/autopilot/`: (1) claimer/spawner, (2) per-run worktree runner, (3) deterministic push-gate script (non-LLM), (4) independent watchdog. launchd LaunchAgent in admin's gui session (proven in spike).
- Machine-level isolation per Andrew's explicit decision (no dedicated macOS user); per-run ephemeral `git worktree` from a dedicated clone — never `~/dev/brain` live checkout; worktree destroyed after run.
- Claim = conditional UPDATE (status eq guard) + attempts + next_attempt_at exponential backoff (15min × 4^attempts) + stale-claim sweep returning orphaned in_progress tickets (steal-list #3).
- Run protocol: `env -u CLAUDECODE claude -p <brief> --dangerously-skip-permissions`, 2400s watchdog kill, `git reset/clean BEFORE checkout` (spike learning #3). Ticket text is DATA — brief template instructs containment; mechanical gates are the real control.
- NOTES.md no-changes protocol: agent writes NOTES.md when it cannot fix → dispatcher maps to escalated/awaiting_user with notes posted to the thread (steal-list #4). ESCALATE/DIVERT verdict vocabulary from the spike dispatcher carries over.
- Commit-advance assertion in the gate: a fix exists only if HEAD advanced over base (steal-list #2). Argv-allowlist for any configurable agent command — tokenize, allowlist binaries, regex-validate flags, execFile (steal-list #1).

#### Ship policy (v1 — trust window per Andrew's accepted recommendation)
- v1 ships NOTHING autonomously: every fix ends as a held branch + evidence bundle + status awaiting_approval. Approval = explicit admin-authored `approval` row in ticket_events (ISA ISC-66); only then does the dispatcher merge/push. Auto-ship rungs come later via the ladder with admin-gated promotion (ISC-111) — not in this phase.
- Push-gate denylist regardless of lane: supabase/migrations/**, RLS/auth/billing paths, .github/**, package-lock; gate re-checks kill switch immediately pre-push (ISC-107/108).
- Cross-vendor gate (Andrew's mandate, 2026-06-11): every fix diff gets a `codex exec --sandbox read-only` review before it can be approved-merged; review verdict attached to the evidence bundle. Claude writes, codex referees, the script holds the keys.

#### Evidence bundle (per run, written to ticket_messages as author_type='agent')
- Diff summary, test output tail, repro-replay result where an artifact exists (ISC-110), codex review verdict, deploy-SHA check after any merge (ISC-112). Resolution note (symptom/root-cause/fix-commit) stored for the fingerprint — compounding knowledge base (steal-list #6, lightweight v1: a resolution_note column or message convention).

#### Ops
- Kill switch: `runner_state.kill_switch` (DB) + local flag file — either halts claiming within one poll cycle; gate re-check covers in-flight pre-push.
- Watchdog: separate launchd job; pages on heartbeat staleness via `user_notifications` INSERT + macOS notification; also runs `/Users/admin/dev/autopilot-tools-health.sh` and reports failures as tickets.
- Subscription budget: configurable quiet hours + max-runs-per-window in autopilot config; concurrency 1.
- Sentry-sourced tickets (Phase 12) flow through the same queue once that phase executes (needs Andrew's Sentry token).

### Claude's Discretion
- TS structure of the daemon pack, config file shape, poll intervals, log format
- Exact worktree base management (dedicated clone location, fetch cadence)
- How the codex review is prompted (use the proven direct `codex exec` pattern, not the Cato wrapper)

### Deferred Ideas (OUT OF SCOPE)
- Per-category autonomy ladder + auto-ship rungs (AP-V2-03 / ISA ISC-100..103) — after trust window
- resolution_notes as a first-class table feeding investigation briefs — v1 uses message convention
- Daily digest (port from dead branch) — Phase 14+
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTO-01 | Dispatcher daemon (launchd) claims new tickets atomically, one headless subscription-billed `claude` run per ticket (concurrency 1, time-budget kill, heartbeat) | Atomic-claim pattern verified in dead-branch resolver (conditional UPDATE with `.eq("status", ...)` guard); launchd LaunchAgent + watchdog-kill + lockdir patterns verified in spike dispatcher.sh; headless `claude -p --dangerously-skip-permissions` from launchd gui domain proven in SPIKE-VERDICT ISC-115 |
| AUTO-02 | Every fix run in an ephemeral per-run `git worktree`, never live checkout, no access to primary credentials | Worktree create/destroy lifecycle verified in dead-branch resolver (`git worktree add/remove --force` with `finally` cleanup); machine-level isolation accepted per SPIKE-VERDICT ISC-116 — dedicated remote-less-by-default clone at `~/dev/autopilot/` discretion area |
| AUTO-03 | Deterministic non-LLM push-gate script with blast-radius denylist; in-policy → main, out-of-policy → branch/PR; v1 trust window: EVERYTHING held as branch pending approval | Denylist locked in CONTEXT (supabase/migrations/**, RLS/auth/billing, .github/**, package-lock); gate is a script judged by exit code (ISC-107); v1 PR-everything supersedes "in-policy push to main" until ladder phase |
| AUTO-04 | Kill switch (single flag) pauses all autonomous processing within one poll cycle, incl. in-flight pre-push | `runner_state.kill_switch` (DB) + local flag file, both checked at claim time and re-checked by the gate immediately pre-push (ISC-108) |
| AUTO-05 | Independent watchdog (separate process) pages admin when dispatcher heartbeat goes stale | Separate launchd job reads `runner_state.last_heartbeat`; pages via `user_notifications` INSERT + `osascript` macOS notification; also runs `/Users/admin/dev/autopilot-tools-health.sh` (verified to exist, exits non-zero on any failure) (ISC-109) |
| AUTO-06 | Evidence bundle per run: diff summary, test output, verification proof, deploy-SHA check | Evidence-pack event-writing pattern verified in dead-branch resolver (writeEvent sequence); v1 bundle written to ticket_messages as author_type='agent' (service-role-only per 20260611140000); deploy-SHA check pattern = match deployed version string to run SHA (ISC-112) |
</phase_requirements>

## Summary

Phase 13 builds the production autonomous-fix loop as a 4-process daemon pack at `~/dev/autopilot/` (OUTSIDE this repo, bun+TS) plus one repo-side migration. Every load-bearing pattern already exists in verified reference code: the dead branch (`worktree-admin-center`) provides the atomic claim, worktree lifecycle, argv-allowlist, commit-advance assertion, NOTES.md protocol, and evidence-pack event sequence; the spike (`/Users/admin/dev/autopilot-spike/harness/dispatcher.sh`, DESIGN-only per DO-NOT-PROMOTE contract) provides the launchd run protocol, lockdir concurrency, watchdog-kill, verdict vocabulary (FIXED/ESCALATE/DIVERT), reset-before-checkout ordering, and the JSONL evidence log shape. The live schema (migrations 20260611000002 + 20260611140000) provides tickets/ticket_messages/ticket_events with the exact status lifecycle and the service-role-only `author_type='agent'` write path the dispatcher needs.

The work is therefore PORT + REBIND, not invention: port dead-branch patterns onto the live `tickets` schema (status `new` → claim to `in_progress` → `awaiting_approval`/`escalated`/`awaiting_user`), add the queue-control migration (priority/urgent/runner_state + RLS), and wrap it in the mechanical-safety furniture the ISA demands (push-gate script, kill switch, watchdog, codex cross-vendor review). v1 ships NOTHING autonomously — every fix is a held branch + evidence bundle at `awaiting_approval` until an explicit admin approval event.

**Primary recommendation:** Build the daemon pack as four small bun+TS programs sharing one config module; copy mechanics from the dead-branch resolver verbatim where they apply (claim guard, worktree finally-cleanup, argv allowlist, commit-advance), and keep the push-gate as a standalone deterministic script with its own fixture tests — it is the authority boundary and must be testable without an LLM in the loop.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Queue columns (priority/urgent) + runner_state table + RLS | Database (repo-side migration) | — | Schema is the contract Phase 14 consumes; RLS must gate admin-only writes |
| Ticket claim / backoff / stale sweep | Daemon (claimer, `~/dev/autopilot/`) | Database (conditional UPDATE is the atomicity primitive) | Service-role client; atomicity comes from the status-guard UPDATE, not app locks |
| Headless fix run + worktree lifecycle | Daemon (runner) | — | Per-run `git worktree` from dedicated clone; never `~/dev/brain` |
| Push-gate (denylist, kill-switch recheck, commit-advance) | Standalone script (non-LLM) | — | Authority boundary judged by exit code, independent of agent output (ISC-107) |
| Codex cross-vendor review | Daemon (runner invokes `codex exec --sandbox read-only`) | — | Verdict attached to evidence bundle; advisory input to admin approval |
| Evidence bundle | Daemon → ticket_messages/ticket_events | Database (service-role-only agent rows) | author_type='agent' INSERT has no authenticated path by policy (11-05) |
| Approval-triggered merge/push | Daemon (claimer polls ticket_events for approval rows) | — | Phase 14 UI writes the approval event; dispatcher executes it |
| Kill switch | Database (`runner_state.kill_switch`) + local flag file | Push-gate (pre-push recheck) | Either source halts within one poll cycle |
| Watchdog / paging | Separate launchd job | Database (`user_notifications` INSERT) + macOS notification | Dispatcher never monitors itself (ISC-109) |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| bun | 1.3.14 [VERIFIED: `bun --version` on this machine] | Daemon-pack runtime + test runner | Andrew's directive for new modules; single binary, native TS |
| @supabase/supabase-js | ^2 (match repo's version) | Service-role DB client for claim/heartbeat/evidence | Already the project's DB client; dead-branch resolver uses identical patterns |
| claude CLI | installed at `/Users/admin/.local/bin/claude` [VERIFIED] | Headless fix runs (`claude -p ... --dangerously-skip-permissions`) | Subscription-billed; proven from launchd gui domain in spike (ISC-115) |
| codex CLI | 0.139.0 [VERIFIED: `codex --version`] | Cross-vendor read-only review of each fix diff | Andrew's mandate; direct `codex exec` pattern (not Cato wrapper) |
| launchd (LaunchAgent) | macOS built-in | Daemon + watchdog scheduling | Proven in spike; plist template exists on dead branch |
| git worktree | git built-in | Per-run ephemeral isolation | Proven in both spike (clone) and dead branch (worktree) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| supabase CLI | 2.101.0 [VERIFIED] | `supabase db push` for the repo-side migration | Migration history reconciled — push works again per CONTEXT |
| gh CLI | authed as Vibe-Marketer [VERIFIED: `gh auth status`] | PR creation for held fix branches | Held-branch + PR flow |
| osascript | macOS built-in | Watchdog local notification | `display notification` on heartbeat staleness |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| bun+TS daemon | bash (like spike) | Spike bash is DESIGN-only by contract; TS gives typed Supabase client, testable units |
| launchd StartInterval polling | pg_cron → Edge Function (dead-branch approach) | Edge Function cannot spawn local `claude`; local daemon is required — dead branch's cron migration is NOT portable |
| ticket_events approval polling | Supabase Realtime subscription | Polling at the existing cadence is simpler and crash-tolerant; Realtime adds a long-lived socket to a launchd job — not worth it for v1 |

**Installation:** `bun install @supabase/supabase-js dotenv` inside `~/dev/autopilot/` (only two runtime deps).

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| @supabase/supabase-js | npm | 5+ yrs | millions/wk | github.com/supabase/supabase-js | not run | Approved — already in repo package.json [VERIFIED: in-repo dependency] |
| dotenv | npm | 10+ yrs | tens of millions/wk | github.com/motdotla/dotenv | not run | Approved — already in repo [VERIFIED: dead-branch resolver imports it] |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none — both packages are existing repo dependencies, not new discoveries; slopcheck not run because no new package names are being introduced.

## Architecture Patterns

### System Architecture Diagram

```
                       ┌─────────────────────────────────────────────┐
                       │            Supabase (live schema)           │
                       │  tickets ── ticket_messages ── ticket_events │
                       │  + NEW: priority, urgent cols; runner_state │
                       └──────┬───────────────▲──────────────▲───────┘
                              │ claim (cond.  │ evidence     │ approval row
                              │ UPDATE)       │ (agent msgs) │ (admin, Ph14/SQL)
   launchd (gui domain)       ▼               │              │
  ┌────────────────────────────────────────────────────────────────────┐
  │ ~/dev/autopilot/ (bun+TS, OUTSIDE repo)                            │
  │                                                                    │
  │ [1] claimer/spawner ──poll──> pick urgent DESC, priority DESC,     │
  │      │   heartbeat→runner_state    severity rank, created_at ASC   │
  │      ▼                                                             │
  │ [2] runner: worktree add (from dedicated clone) → claude -p brief  │
  │      │  2400s watchdog kill → diff/test evidence → codex exec      │
  │      │  review → commit on fix branch → worktree remove            │
  │      ▼                                                             │
  │ [3] push-gate (deterministic script, non-LLM):                     │
  │      kill-switch recheck → denylist diff → commit-advance assert   │
  │      v1: ALWAYS hold as branch+PR → ticket awaiting_approval       │
  │      on approval event: merge/push → deploy-SHA verify             │
  │                                                                    │
  │ [4] watchdog (separate launchd job): heartbeat staleness → page    │
  │      (user_notifications INSERT + osascript) + tools-health.sh     │
  └────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure (Claude's discretion — planner may adjust)
```
~/dev/autopilot/
├── package.json            # bun, two deps
├── autopilot.config.ts     # poll interval, quiet hours, max-runs-per-window, paths, denylist source
├── .env                    # SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (chmod 600)
├── src/
│   ├── claimer.ts          # [1] poll loop entry: claim, spawn runner, heartbeat, approval-merge
│   ├── runner.ts           # [2] worktree lifecycle + claude spawn + evidence capture + codex review
│   ├── lib/
│   │   ├── db.ts           # service-role client + typed writers (events, messages, runner_state)
│   │   ├── claim.ts        # conditional UPDATE claim + backoff + stale sweep
│   │   ├── agent.ts        # argv-allowlist runAgent (ported verbatim from dead branch)
│   │   └── evidence.ts     # bundle assembly + ticket_messages writer
│   └── watchdog.ts         # [4] heartbeat staleness check + paging + tools-health
├── gate/
│   ├── push-gate.sh        # [3] deterministic non-LLM gate (denylist + kill-switch + commit-advance)
│   └── denylist.txt        # blast-radius path patterns
├── launchd/
│   ├── com.callvault.autopilot.plist
│   └── com.callvault.autopilot-watchdog.plist
├── clone/                  # dedicated clone of brain (worktree base) — never ~/dev/brain
└── logs/                   # runs/*.txt transcripts + autopilot.jsonl
```

### Pattern 1: Atomic claim (conditional UPDATE with status guard)
**What:** Claim = `UPDATE tickets SET status='in_progress', attempts=attempts+1 WHERE id=? AND status='new'` returning rows; empty result = lost the race.
**When to use:** Every claim. No advisory locks, no SELECT-then-UPDATE.
**Example:**
```typescript
// Source: git show worktree-admin-center:scripts/admin/autonomous-resolver.ts (verified this session)
const { data: claimed, error } = await db
  .from("tickets")
  .update({ status: "in_progress", attempts: ticket.attempts + 1 })
  .eq("id", ticket.id)
  .eq("status", "new")        // ← the atomicity guard
  .select("id");
if (error || !claimed || claimed.length === 0) return "lost-claim";
```
Note: live schema's `tickets` lacks `attempts`/`next_attempt_at` — the Phase 13 migration must add them (dead branch had them on `support_tickets`).

### Pattern 2: Backoff + stale-claim sweep
**What:** Released claims get `next_attempt_at = now + 15min × 4^attempts` (dead-branch `nextAttemptAt`). Stale sweep: at poll start, return any `in_progress` ticket whose claim is older than TTL (run_started_at vs watchdog budget + margin) to `new` — recovers orphans from crash/sleep (ISC-38).
**When to use:** Backoff on every release; sweep every poll cycle before claiming.

### Pattern 3: Per-run ephemeral worktree with finally-cleanup, reset-before-checkout
**What:** Worktree from the dedicated clone, destroyed in `finally`; the clone itself gets `git reset --hard && git clean -fd` BEFORE any checkout/fetch (spike learning #3 — survives dirty trees from crashed runs).
**Example:**
```typescript
// Source: dead-branch resolver (worktree) + spike dispatcher.sh L125-127 (reset ordering)
shSafe(`git worktree remove --force ${worktreePath}`, cloneRoot);  // clear leftovers
shSafe(`git branch -D ${branch}`, cloneRoot);
sh(`git -C ${cloneRoot} reset --hard && git -C ${cloneRoot} clean -fd`, cloneRoot);
sh(`git fetch origin main`, cloneRoot);
sh(`git worktree add ${worktreePath} -b ${branch} origin/main`, cloneRoot);
try { /* run */ } finally { shSafe(`git worktree remove --force ${worktreePath}`, cloneRoot); }
```

### Pattern 4: Headless claude spawn with watchdog kill
**What:** `env -u CLAUDECODE claude -p <brief> --dangerously-skip-permissions` backgrounded; a sibling timer kills TERM-then-KILL at 2400s; lockdir (`mkdir`) guarantees concurrency 1 even across overlapping launchd fires.
**When to use:** Every fix run. CLAUDECODE must be unset (nested-session block).
**Example:** spike dispatcher.sh L143-165 (verified) — DESIGN reference only, re-implement in TS (`Bun.spawn` with `timeout` option or manual timer + `proc.kill()`).

### Pattern 5: Verdict vocabulary + NOTES.md no-changes protocol
**What:** Brief instructs the agent to end with exactly one `VERDICT: FIXED|ESCALATE|DIVERT — <reason>` line, leave changes uncommitted, and write NOTES.md when it cannot fix. Dispatcher maps: FIXED+diff → gate path; ESCALATE → status `escalated`; DIVERT (schema/migration needed) → `escalated` with divert note; no-changes+NOTES.md → `awaiting_user`/`escalated` with NOTES.md body posted to thread.
**Source:** spike dispatcher.sh prompt (L132) + dead-branch resolver step 5 (NOTES.md filter in changed-entries check).

### Pattern 6: Deterministic push-gate (exit-code authority)
**What:** Standalone script: (1) re-read kill switch (DB + flag file) — exit nonzero if set; (2) `git diff --name-only base..HEAD` against denylist patterns — any hit = out-of-policy; (3) commit-advance assertion — `HEAD != base && HEAD~1 == base` (dead-branch step 7) or refuse; (4) v1: ALWAYS stop at held branch + PR (push branch, never main); merge/push to main happens only on the approval event path, which re-runs the same gate.
**When to use:** Between runner completion and any push, and again on approval-merge.

### Pattern 7: Evidence bundle write path
**What:** Bundle = diff summary (`git diff --stat`), test output tail, repro-replay result if artifact exists, codex review verdict, branch/SHA + revert SHA. Written as one `ticket_messages` row (author_type='agent', service-role — the ONLY allowed path per 20260611140000) plus granular `ticket_events` rows (event_type strings; live schema column is `event_type`, dead branch used `type` — rebind). Status transitions write their own events via the existing SECURITY DEFINER trigger — don't duplicate.

### Pattern 8: Codex cross-vendor review
**What:** After the fix commit, run `codex exec --sandbox read-only` in the worktree with a review prompt over the diff; capture verdict text; attach to evidence bundle. Advisory only — the script (gate) holds the keys, codex output never directly gates.
**When to use:** Every fix with a diff, before status → awaiting_approval.

### Anti-Patterns to Avoid
- **Promoting spike code:** `/Users/admin/dev/autopilot-spike/` is DO-NOT-PROMOTE by contract. Design carries; code does not.
- **pg_cron → Edge Function dispatch (dead branch's cron migration):** an Edge Function cannot spawn local headless `claude`. Do not port `20260610131220_autonomous_resolver_cron.sql`.
- **`npm run type-check` as a gate:** hollow (ticket 3d68d1cd). Use vitest + build + eslint + scoped tsc.
- **Shell-interpolating DB-sourced strings:** agent command/ticket text never reach a shell string — argv arrays + allowlist only.
- **Auto-ship of any class in v1:** dead branch had `auto_ship_classes`; v1 trust window holds EVERYTHING at awaiting_approval.
- **Dispatcher monitoring itself:** watchdog is a separate launchd job (ISC-109).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Claim atomicity | App-level mutex/lock table | Conditional UPDATE status guard | Postgres row-level atomicity is free and proven in reference code |
| Run isolation | chroot/containers | `git worktree` from dedicated clone | Proven in spike + dead branch; matches accepted machine-level isolation decision |
| Concurrency 1 | PID files with stale-PID logic | `mkdir` lockdir + trap cleanup (spike) or single-process poll loop | mkdir is atomic on APFS; spike-proven |
| Agent command validation | Ad-hoc sanitizing | Port dead-branch `runAgent` allowlist verbatim (binary set + `^[-a-zA-Z0-9_=.@/]+$` arg pattern + execFile) | Already reviewed code; closes shell-injection class |
| Status audit trail | Dispatcher-written status events | Existing `ticket_status_audit` SECURITY DEFINER trigger | Trigger fires on every status UPDATE incl. service-role; writing both duplicates |
| JSON escaping in logs | printf string building | `JSON.stringify` in TS | Spike needed a python3 heredoc for this in bash; TS gets it free |

**Key insight:** every hard sub-problem in this phase has working reference code on the dead branch or the spike — the risk is in REBINDING (schema names, status vocabulary, repo paths), not in inventing mechanics.

## Live Schema Rebind Map (dead branch → Phase 13)

| Dead branch (`support_tickets` world) | Live schema (Phase 13 target) |
|---|---|
| `support_tickets` | `tickets` |
| status `open` → claim `investigating` | status `new` → claim `in_progress` (enum already has all 8 values — no ALTER TYPE needed) |
| held-fix terminal: `needs_review` event | terminal status: `awaiting_approval` (+ evidence message) |
| `ticket_events.type` / `actor` text | `ticket_events.event_type` / `actor_id` UUID (NULL = service-role) |
| `attempts`, `next_attempt_at` columns existed (admin_center_v2) | MUST BE ADDED by Phase 13 migration alongside priority/urgent |
| `runner_runs` heartbeat table | `runner_state` (locked decision — richer: status, current_ticket_id, kill_switch) |
| `resolution_notes` table | v1 message convention (deferred as table) |
| `admin_automation_settings` DB settings row | `autopilot.config.ts` local config (Claude's discretion) + `runner_state.kill_switch` |
| severity order: `.order("severity", {ascending:false})` on TEXT | `severity` is an ENUM (`critical,high,medium,low`) — enum ordering ≠ semantic rank; claim query must map severity → rank explicitly (CASE expression or client-side sort) |

## Common Pitfalls

### Pitfall 1: Severity enum sort order
**What goes wrong:** `ORDER BY severity DESC` on the `ticket_severity` enum sorts by enum declaration order (`critical,high,medium,low` — critical is LOWEST), silently inverting the queue.
**Why it happens:** Dead-branch code ordered a TEXT column; live schema is an enum.
**How to avoid:** Explicit rank: `CASE severity WHEN 'critical' THEN 4 WHEN 'high' THEN 3 ... END DESC` via RPC, or fetch candidates and sort client-side (concurrency 1 makes client-side sort safe).
**Warning signs:** Low-severity tickets claimed before criticals in E2E.

### Pitfall 2: ticket_events INSERT blocked for the dispatcher
**What goes wrong:** Run-lifecycle event INSERTs fail silently if attempted with anything but service-role.
**Why it happens:** `ticket_events` deliberately has NO authenticated INSERT policy (append-only audit).
**How to avoid:** Daemon uses service-role key exclusively; never the anon key. Same for `ticket_messages` author_type='agent' (11-05 policy: no authenticated path exists).
**Warning signs:** Evidence bundle missing from ticket while runner logs claim success.

### Pitfall 3: launchd environment is not your shell
**What goes wrong:** `claude`/`bun`/`git` not found, or keychain auth unavailable, when fired by launchd.
**Why it happens:** gui LaunchAgent PATH is minimal; spike solved with explicit `export PATH="$HOME/.local/bin:/opt/homebrew/bin:..."` and `unset CLAUDECODE`.
**How to avoid:** Wrapper sets PATH explicitly; keep the spike's optional `~/.autopilot-spike-token`-style oauth-token fallback hook (was never needed — keychain worked, ISC-115).
**Warning signs:** Works in terminal, zero output from launchd fire; check stderr log path in plist.

### Pitfall 4: Dirty clone blocks next run
**What goes wrong:** Crashed/killed run leaves uncommitted changes or orphaned worktree metadata; next `git worktree add`/checkout fails.
**How to avoid:** Spike learning #3 ordering — `reset --hard` + `clean -fd` BEFORE checkout; plus `git worktree prune` and leftover `worktree remove --force` at run start (dead-branch step 2 does exactly this).
**Warning signs:** `fatal: '<path>' already exists` in run logs.

### Pitfall 5: Hollow verification gates
**What goes wrong:** Gate "passes" because `npm run type-check` checks nothing (ticket 3d68d1cd).
**How to avoid:** In-worktree verification = `npx vitest run` (scoped where possible) + `npm run build` + eslint + scoped `tsc --noEmit` on changed files. Treat type-check script as untrusted until that ticket is fixed.

### Pitfall 6: Heartbeat written by the thing being watched, read by itself
**What goes wrong:** Dispatcher hangs but its own monitor thread hangs with it.
**How to avoid:** Watchdog is a separate launchd job reading `runner_state.last_heartbeat` from the DB (ISC-109). Staleness threshold > 2 poll intervals. Watchdog must also handle "DB unreachable" as a paging condition, not a silent pass.

### Pitfall 7: Approval event spoofing
**What goes wrong:** Any `ticket_events` row that LOOKS like an approval triggers a merge.
**How to avoid:** Approval recognition must verify: `event_type='approval'` AND `actor_id` is a real admin user (join user_roles / has_role check via service-role query) AND ticket status is `awaiting_approval`. Events written by the trigger or service-role have NULL actor_id — NULL must never qualify as approval. (ISA ISC-66: explicit admin-authored approval row.)

### Pitfall 8: Realism calibration
**What goes wrong:** Expecting production tickets to behave like spike fixtures.
**How to avoid:** SPIKE-VERDICT surprise #1 — fixtures carried tells (commit messages); production tickets carry none. Expect more ESCALATE outcomes; that is correct behavior, not failure.

## Code Examples

### Claim-order query (urgent lane + priority + severity rank)
```typescript
// Locked claim order: urgent DESC, priority DESC, severity rank, created_at ASC
// severity is an enum — rank client-side (concurrency 1 makes this race-safe enough;
// the conditional-UPDATE claim is the real atomicity boundary).
const sevRank = { critical: 4, high: 3, medium: 2, low: 1 } as const;
const { data } = await db.from("tickets")
  .select("id, severity, urgent, priority, attempts, created_at, status")
  .eq("status", "new")
  .lt("attempts", cfg.maxAttempts)
  .or(`next_attempt_at.is.null,next_attempt_at.lt.${new Date().toISOString()}`)
  .limit(50);
const next = (data ?? []).sort((a, b) =>
  Number(b.urgent) - Number(a.urgent) ||
  b.priority - a.priority ||
  sevRank[b.severity] - sevRank[a.severity] ||
  a.created_at.localeCompare(b.created_at)
)[0];
```

### Argv-allowlist agent spawn (port verbatim, rebind to Bun)
```typescript
// Source: dead-branch resolver runAgent (verified this session)
const AGENT_BINARY_ALLOWLIST = new Set(["claude", "codex"]);
const AGENT_ARG_PATTERN = /^[-a-zA-Z0-9_=.@/]+$/;
// tokenize command, reject non-allowlisted binary, regex-validate every flag,
// then Bun.spawn([binary, ...flags, brief], { cwd, env: {...env, CLAUDECODE: undefined} })
// with a 2400s timer → proc.kill("SIGTERM") then SIGKILL after 10s.
```

### Push-gate denylist check (deterministic, exit-code judged)
```bash
# gate/push-gate.sh <worktree> <base-sha>  — exit 0 = in-policy, 1 = out-of-policy, 2 = killed
DENY='^supabase/migrations/|^supabase/functions/_shared/(auth|billing)|^\.github/|package-lock\.json$|^src/.*[Bb]illing|[Rr]ls'
kill_check || exit 2                       # DB runner_state.kill_switch OR flag file
git -C "$1" diff --name-only "$2"..HEAD | grep -E "$DENY" && exit 1
# commit-advance: HEAD must be exactly base+1 (dead-branch step 7 assertion)
[ "$(git -C "$1" rev-parse HEAD~1)" = "$2" ] || exit 1
exit 0
```
(Exact denylist patterns are a planning decision — the locked floor is migrations/**, RLS/auth/billing paths, .github/**, package-lock.)

### Codex review invocation (proven direct pattern)
```bash
cd "$WORKTREE" && codex exec --sandbox read-only \
  "Review the diff between $BASE_SHA and HEAD for correctness, security, and scope-creep. End with exactly one line: REVIEW: APPROVE — <reason> or REVIEW: REJECT — <reason>." \
  > "$LOGS/runs/$TICKET-codex-review.txt" 2>&1
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | bun test (daemon pack, `~/dev/autopilot/`); vitest 4.x (in-worktree repo verification); bash fixture harness (push-gate) |
| Config file | none yet — Wave 0 for daemon pack (`~/dev/autopilot/` does not exist) |
| Quick run command | `bun test` (daemon pack) / `bash gate/push-gate-test.sh` (gate fixtures) |
| Full suite command | `bun test && bash gate/push-gate-test.sh` + live E2E proof on ticket 1deaa9b7 |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTO-01 | Atomic claim, no double-claim; concurrency 1; heartbeat | unit + integration | `bun test src/lib/claim.test.ts` (two concurrent claims → one winner, mocked/local) | ❌ Wave 0 |
| AUTO-02 | Worktree per run, destroyed after; live checkout untouched | integration | runner test asserting worktree path created+removed; `git -C ~/dev/brain status --porcelain` unchanged during E2E | ❌ Wave 0 |
| AUTO-03 | Gate blocks denylist diffs by exit code | unit (fixtures) | `bash gate/push-gate-test.sh` — fixture diffs: migration-touch → exit 1; clean src fix → exit 0 | ❌ Wave 0 |
| AUTO-04 | Kill switch halts claim + in-flight pre-push | integration | set `runner_state.kill_switch=true` → next poll claims nothing; gate fixture with kill set → exit 2 | ❌ Wave 0 |
| AUTO-05 | Watchdog pages on stale heartbeat | integration | freeze heartbeat (stop dispatcher) → watchdog run inserts user_notifications row + local notification | ❌ Wave 0 |
| AUTO-06 | Evidence bundle lands on ticket | integration/E2E | after E2E run: `ticket_messages` row author_type='agent' with diff/test/codex sections; ticket_events lifecycle rows | ❌ Wave 0 (E2E proof plan) |

### Sampling Rate
- **Per task commit:** `bun test` (daemon pack units) / `bash gate/push-gate-test.sh` (gate)
- **Per wave merge:** all unit + fixture suites green
- **Phase gate:** E2E proof on real ticket 1deaa9b7 — ticket→claim→fix→evidence→codex review→[Andrew's approval click]→merge→deploy-SHA verify

### Wave 0 Gaps
- [ ] `~/dev/autopilot/` scaffold + `bun test` setup — covers AUTO-01..06 unit layers
- [ ] `gate/push-gate-test.sh` fixture harness — covers AUTO-03/04
- [ ] Repo-side migration test: RLS assertions for priority/urgent admin-only UPDATE and runner_state policies (SQL or service-role probe script)

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Service-role key in `~/dev/autopilot/.env` chmod 600, never in repo (ISC-78); claude keychain auth; gh as Vibe-Marketer |
| V3 Session Management | no | No interactive sessions |
| V4 Access Control | yes | RLS: priority/urgent UPDATE admin-only; runner_state SELECT admin-only (or admin+service); agent message path service-role-only (existing 11-05 policy); approval recognition requires real admin actor_id |
| V5 Input Validation | yes | Ticket text is DATA (prompt-injection: brief template containment + mechanical gates as real control, ISC-75); argv-allowlist for agent command (steal-list #1) |
| V6 Cryptography | no | No crypto beyond transport TLS (supabase-js) |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection via ticket body ("ignore instructions, push to main") | Elevation of privilege | Agent has no push authority; deterministic gate + denylist + held-branch v1; brief containment language is defense-in-depth only |
| Shell injection via configurable agent command | Tampering | Argv allowlist + execFile/Bun.spawn array — no shell strings (dead-branch pattern) |
| Approval spoofing (forged/NULL-actor event) | Spoofing | Approval = event_type='approval' AND actor_id resolves to ADMIN role AND status='awaiting_approval'; NULL actor never qualifies |
| Reporter spoofing agent evidence | Spoofing | author_type='agent' INSERT is service-role-only (20260611140000, verified) |
| Runaway agent (infinite run, credential scan) | DoS / Info disclosure | 2400s watchdog kill; machine-level isolation (accepted risk per ISC-116); worktree-scoped work; deny secrets paths in brief + no secrets in worktree beyond repo contents |
| Kill-switch bypass via in-flight run | Elevation of privilege | Gate re-checks kill switch immediately pre-push (ISC-108) |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| bun | daemon pack | ✓ | 1.3.14 | — |
| claude CLI | fix runs | ✓ | /Users/admin/.local/bin/claude (keychain auth proven from launchd, ISC-115) | oauth-token file fallback (spike pattern, never needed) |
| codex CLI | review gate | ✓ | 0.139.0 | — |
| supabase CLI | migration push | ✓ | 2.101.0 (history reconciled — push works) | — |
| gh CLI | PR creation | ✓ | authed as Vibe-Marketer | — |
| launchd | scheduling | ✓ | macOS built-in; no autopilot jobs currently loaded (clean slate) | — |
| `~/dev/autopilot/` | everything | ✗ does not exist | — | created in Wave 1 (expected) |
| `/Users/admin/dev/autopilot-tools-health.sh` | watchdog subroutine | ✓ | exits non-zero on any failure | — |
| Ticket 1deaa9b7 (E2E target) | E2E proof | not verified this session | — | any open low-risk ticket; verify at execution |

**Missing dependencies with no fallback:** none blocking — `~/dev/autopilot/` absence is the deliverable, not a blocker.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Ticket 1deaa9b7 exists, is open, and is the AbortError console-noise fix | E2E proof | Low — swap in another open low-risk ticket at execution |
| A2 | `codex exec --sandbox read-only` accepts a positional prompt and runs non-interactively in CI-like context (CLI v0.139.0 verified installed; exact flag behavior not exercised this session) | Codex review pattern | Medium — verify flag syntax in first runner test; CONTEXT says pattern is "proven direct `codex exec`" |
| A3 | `Bun.spawn` timeout/kill semantics suffice for the 2400s watchdog kill (vs. spike's bash sleep/kill pair) | Run protocol | Low — manual timer + SIGTERM/SIGKILL fallback is 10 lines |
| A4 | Deploy-SHA check can read the live bundle's commit (existing deploy exposes version/commit string per ISC-112 phrasing) | Evidence bundle | Medium — if no version endpoint exists, plan must add one or check Vercel/host deploy API |

## Open Questions (RESOLVED)

1. **Where does the approval-merge deploy-SHA verification read the live SHA from?**
   - RESOLVED: Plan 13-06 Task 2 includes the discovery sub-step — check for an existing version/commit exposure first; if none exists, verify via the deploy provider's API/CLI for the production deployment's source SHA. Either path satisfies ISC-112; the chosen mechanism is recorded in the 13-06 SUMMARY at execution.

2. **runner_state RLS shape** — single row keyed `id=1` vs per-runner rows.
   - RESOLVED: Single row (`id smallint primary key default 1 check (id=1)`), SELECT for admins (Phase 14 card), all writes service-role only; admin UPDATE allowed solely for `kill_switch`. Implemented in Plan 13-01 Task 1 exactly as recommended.

## Sources

### Primary (HIGH confidence — read in this session)
- `git show worktree-admin-center:scripts/admin/autonomous-resolver.ts` — claim, backoff, worktree, argv-allowlist, commit-advance, NOTES.md, evidence-pack patterns
- `git show worktree-admin-center:scripts/admin/com.callvault.admin-runner.plist` — launchd plist template
- `/Users/admin/dev/autopilot-spike/harness/dispatcher.sh` — run protocol, lockdir, watchdog kill, verdict vocabulary, reset-before-checkout (DESIGN only, DO-NOT-PROMOTE)
- `.planning/phases/10-autopilot-spike-go-no-go-gate/SPIKE-VERDICT.md` — GO 5/5, ISC-115/116 findings, realism notes
- `supabase/migrations/20260611000002_create_ticket_tables.sql` — live schema: enums, RLS, SECURITY DEFINER status audit trigger
- `supabase/migrations/20260611140000_tighten_ticket_messages_author_type.sql` — agent rows service-role-only
- `~/.claude/PAI/MEMORY/WORK/20260610-autonomous-admin-center/ISA.md` §D (ISC-28..38), §I (ISC-73..80), §M (ISC-104..114), §N (ISC-115..120, ISC-8.1)
- `.planning/REQUIREMENTS.md` AUTO-01..06, APPR-01..03
- Environment probes this session: bun 1.3.14, codex 0.139.0, supabase 2.101.0, gh auth, claude path, tools-health.sh, launchctl list

### Secondary (MEDIUM confidence)
- None needed — phase is fully grounded in first-party artifacts.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all binaries version-verified on the target machine this session
- Architecture: HIGH — every pattern has working first-party reference code
- Pitfalls: HIGH — sourced from spike learnings, dead-branch code, and live-schema reads (severity-enum pitfall verified against migration DDL)

**Research date:** 2026-06-11
**Valid until:** 2026-07-11 (stable domain; re-verify codex CLI flags if version bumps)
