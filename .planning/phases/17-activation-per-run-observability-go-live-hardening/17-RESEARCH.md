# Phase 17: Activation + Per-Run Observability + Go-Live Hardening - Research

**Researched:** 2026-06-13
**Domain:** Mac-hosted autonomous fix daemon, deterministic git push-gate, Supabase-backed Admin Center observability
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
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

### Deferred Ideas (OUT OF SCOPE)
## Deferred Ideas

- Raising `maxRuns` toward 25–30/day → Phase 19 (ACT-02).
- Per-category autonomy ladder / auto-approve, survival metric, canary re-test → Phase 19 (TRU-01/02/03).
- Any Sentry/QA/recurrence/comms work → Phases 18–23.

### Reviewed Todos (not folded)
- "Apply 15-min compliance posture fixes (GitHub + Vercel + Supabase + Cloudflare)" — score 0.2, unrelated to autopilot activation; remains in `.planning/todos/pending/`.
</user_constraints>

## Summary

Phase 17 should be planned as a two-repo hardening and activation phase: daemon mechanics live in `~/dev/autopilot`, while durable observability schema, service/hooks, and Admin Center rendering live in `/Users/admin/dev/brain`. [VERIFIED: `.planning/STATE.md`, `.planning/phases/17-activation-per-run-observability-go-live-hardening/17-CONTEXT.md`] The core rule is conservative activation: release the kill switch for real tickets at roughly 3-5 runs/day, keep concurrency exactly 1, and keep Andrew's AdminTab approval required for every merge. [VERIFIED: `17-CONTEXT.md`, `/Users/admin/dev/autopilot/autopilot.config.ts`]

The current system already has most of the spine: `runner_state`, Admin Center dashboard runner card, ticket detail evidence rendering, atomic claim/update, per-run worktrees, deterministic `push-gate.sh`, approval merge, deploy-SHA verification, watchdog paging, and JSONL evidence lines. [VERIFIED: `src/pages/admin/DashboardSection.tsx`, `src/components/admin/TicketEvidence.tsx`, `supabase/migrations/20260611200000_autopilot_queue_runner_state.sql`, `/Users/admin/dev/autopilot/src/{claimer.ts,runner.ts,watchdog.ts}`, `/Users/admin/dev/autopilot/src/lib/{approval.ts,evidence.ts}`] The missing pieces are explicit per-run persistence for AdminTab, a test-integrity gate inside `push-gate.sh`, rebase-conflict behavior that releases/requeues instead of manual-merge escalation, repro replay after rebase, and operational guards for stale worktrees/disk/sleep. [VERIFIED: codebase grep + direct source reads]

**Primary recommendation:** Plan four implementation tracks in this order: durable run observability schema/API/UI, deterministic gate hardening, approval/rebase/replay/requeue mechanics, then operational guards and live activation drills. [VERIFIED: source architecture + `17-CONTEXT.md`]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Run production fix loop at low volume | Daemon (`~/dev/autopilot`) | Supabase DB | `claimer.ts` owns poll, kill switch, budget, claim, run, and approval pass; tickets/runner_state are DB-backed. [VERIFIED: `/Users/admin/dev/autopilot/src/claimer.ts`] |
| Per-run observability | Database / Backend | Browser / Admin Center | Durable run rows should live in Supabase so AdminTab can read them; daemon emits, frontend renders. [VERIFIED: `runner_state` existing pattern in `20260611200000_autopilot_queue_runner_state.sql` and `admin-dashboard.service.ts`] |
| Test-integrity gate | Daemon gate shell | Git diff | `gate/push-gate.sh` is the locked authority boundary and already checks kill switch, commit advance, and denylist. [VERIFIED: `/Users/admin/dev/autopilot/gate/push-gate.sh`] |
| Rebase-before-push and serialized push | Daemon approval library | Git remote | `approval.ts` is the only route from held branch to `origin/main`; concurrency 1 plus approval pass serializes pushes. [VERIFIED: `/Users/admin/dev/autopilot/src/lib/approval.ts`] |
| Repro replay after rebase | Daemon runner/approval library | Ticket evidence | Current runner only records a referenced repro artifact and does not execute replay; Phase 17 must add an executable replay path and rerun it after rebase. [VERIFIED: `/Users/admin/dev/autopilot/src/runner.ts`] |
| Worktree reaper/disk guard/caffeinate | Daemon watchdog / launchd wrapper | macOS | Watchdog already owns separate heartbeat/pager checks; launchd plists schedule single-pass daemon jobs; `caffeinate` is installed locally. [VERIFIED: `/Users/admin/dev/autopilot/src/watchdog.ts`, `launchd/*.plist`, environment audit] |
| Admin approval and gate-block visibility | Browser / Admin Center | Supabase tickets/messages/events | `TicketDetailDialog` renders agent evidence and approval controls; blocked gates should surface through the same evidence/message path plus run rows. [VERIFIED: `src/components/settings/TicketDetailDialog.tsx`, `src/components/admin/TicketEvidence.tsx`] |

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ACT-01 | Kill switch off; dispatcher claims and fixes real production tickets through existing fix->gate->approve->merge spine. | Use `runner_state.kill_switch` + `/admin` RunnerOpsCard and `autopilot.config.ts` run cap; keep approval mandatory. [VERIFIED: `17-CONTEXT.md`, `DashboardSection.tsx`, `autopilot.config.ts`] |
| ACT-03 | Rollback + blast-radius safety proven on live tickets. | Use existing evidence `Revert` section, commit-advance gate, denylist, and approval path; add live drill tasks. [VERIFIED: `TicketEvidence.tsx`, `push-gate.sh`, `approval.ts`] |
| ACT-04 | Every run visible in AdminTab with status, diff, test result, gate verdict, duration, and cost. | Existing JSONL lacks duration/cost/gate fields; add DB-backed run records and extend Admin Center runner card and evidence bundle. [VERIFIED: `evidence.ts`, `DashboardSection.tsx`, `TicketEvidence.tsx`] |
| ACT-05 | Test-integrity gate blocks test deletion, assertion weakening, `.skip`/`.only`. | Add deterministic diff-based check to `push-gate.sh` and offline fixture tests. [VERIFIED: `push-gate.sh`, `push-gate-test.sh`] |
| ACT-06 | Rebase-before-push + serialized push + repro replay on rebased state. | `runApprovalMerge()` already rebases stale bases before gate but currently escalates conflicts and does not run repro replay post-rebase; adjust this behavior. [VERIFIED: `approval.ts`, `approval.test.ts`, `runner.ts`] |
| ACT-07 | Worktree reaper + disk guard + wake/caffeinate handling. | Add watchdog checks around `worktrees`, disk free space, stale locks, and launchd command wrapping/verification. [VERIFIED: `watchdog.ts`, environment audit, `launchd/*.plist`] |
</phase_requirements>

## Project Constraints (from AGENTS.md / CLAUDE.md)

- Direct-main workflow: commit and push `origin/main`; no feature branches/PRs unless explicitly asked. [VERIFIED: `AGENTS.md`, `CLAUDE.md`]
- Package manager in `brain` is npm only; banned: pnpm, bun, yarn, Lucide, FontAwesome, `framer-motion`; frontend icons are Remix Icons only. [VERIFIED: `AGENTS.md`, `src/CLAUDE.md`]
- Daemon repo `~/dev/autopilot` is Bun/TypeScript by existing implementation; do not import that package-manager rule back into `brain`. [VERIFIED: `/Users/admin/dev/autopilot/package.json`, `brain/package.json`]
- Service + hook separation is required: services are pure async TS, hooks wrap them with TanStack Query, components do not call services directly. [VERIFIED: `CLAUDE.md`, `.planning/codebase/ARCHITECTURE.md`]
- Backend auth in Edge Functions must use `authenticateRequest(req, supabase, corsHeaders)`; this phase should avoid new Edge Functions unless absolutely necessary. [VERIFIED: `AGENTS.md`, `supabase/CLAUDE.md`]
- Integration tests must use real Supabase test DB only and skip/throw when test env is missing; never mock Supabase for RLS/integration gates. [VERIFIED: `supabase/CLAUDE.md`]
- Admin UI must extend existing `/admin` surfaces, not create a new top-level tab. [VERIFIED: `17-CONTEXT.md`, `src/pages/admin/AdminCenter.tsx`]
- Brand copy: use "AI-ready, not AI-powered"; do not positively market "AI-powered" in UI copy. [VERIFIED: `AGENTS.md`, `CLAUDE.md`]
- Push-gate is deterministic and non-LLM; no model judgment belongs in ACT-05. [VERIFIED: `17-CONTEXT.md`, `/Users/admin/dev/autopilot/gate/push-gate.sh`]
- Graphify exists but is stale: built 2026-05-30, 324 hours old, 441 commits behind during this research; do not rely on it as current proof. [VERIFIED: `gsd-tools query graphify status`]

## Standard Stack

### Core

| Library / Tool | Version | Purpose | Why Standard |
|----------------|---------|---------|--------------|
| React | 18.3.1 | Admin Center UI | Existing locked frontend stack. [VERIFIED: `package.json`, `src/CLAUDE.md`] |
| Vite | 5.4.19 | Frontend build | Existing locked build tool. [VERIFIED: `package.json`] |
| TanStack Query | 5.90.10 | Admin data fetching/cache | Existing service/hook pattern uses query keys and polling intervals. [VERIFIED: `package.json`, `useAdminDashboard.ts`] |
| Supabase JS | 2.84.0 | Browser DB reads and daemon service-role writes | Existing frontend and autopilot dependency; no new DB client. [VERIFIED: both `package.json` files] |
| Bun | 1.3.14 | Autopilot daemon runtime/tests | Existing daemon runtime and `bun test` runner. [VERIFIED: environment audit, `/Users/admin/dev/autopilot/package.json`] |
| Git | 2.50.1 (Apple Git-155) | worktrees, rebase, ff-only merge, push gate diffs | Existing daemon depends on git subprocesses; Git official docs define worktree/rebase behavior. [VERIFIED: environment audit; CITED: https://git-scm.com/docs/git-worktree, https://git-scm.com/docs/git-rebase] |
| launchd | Darwin Bootstrapper 7.0.0 | scheduled daemon/watchdog fires | Existing plists use `StartInterval` + `RunAtLoad`; Apple says `launchd.plist` is the job config source. [VERIFIED: environment audit, `launchd/*.plist`; CITED: https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html] |
| caffeinate | macOS `/usr/bin/caffeinate` | prevent idle sleep during long daemon jobs | Installed locally; use command wrapper for dispatcher/approval critical sections. [VERIFIED: environment audit; CITED: local `caffeinate -h`, https://www.unix.com/man_page/osx/8/caffeinate/] |

### Supporting

| Library / Tool | Version | Purpose | When to Use |
|----------------|---------|---------|-------------|
| Vitest | 4.0.16 | Brain unit/component tests | Admin service/hook/UI tests. [VERIFIED: `package.json`, `.planning/codebase/TESTING.md`] |
| Playwright | 1.57.0 | Admin UI smoke/screenshot | Verify `/admin` visual integration when UI changes land. [VERIFIED: `package.json`] |
| `codex exec` | 0.139.0 | Existing advisory post-fix review | Keep advisory only; never make it gate authority. [VERIFIED: environment audit, `runner.ts`] |
| Claude Code CLI | 2.1.170 | Existing headless fix engine | Existing daemon uses `claude -p`; no new agent engine in Phase 17. [VERIFIED: environment audit, `autopilot.config.ts`] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Supabase table for run observability | Read local JSONL directly from browser | Browser cannot safely read Mac local files in production; DB rows fit existing Admin Center pattern. [VERIFIED: existing Admin services read Supabase] |
| Deterministic shell gate | LLM review of test changes | Violates D-04; model judgment is not an authority boundary. [VERIFIED: `17-CONTEXT.md`] |
| Existing claim table | BullMQ / pg-boss / Temporal / Redis | Explicitly out of scope; Supabase conditional UPDATE is the queue. [VERIFIED: `REQUIREMENTS.md` Out of Scope] |
| New Admin tab | Extend `/admin/dashboard` + `TicketDetailDialog` | New top-level tab violates D-09 and One-Click/KISS-UX. [VERIFIED: `17-CONTEXT.md`] |

**Installation:** none. Phase 17 should install zero new packages and add zero new secrets. [VERIFIED: `17-CONTEXT.md`, `.planning/ROADMAP.md`]

## Package Legitimacy Audit

No external package installs are recommended for Phase 17. [VERIFIED: `17-CONTEXT.md`, `.planning/ROADMAP.md`]

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| none | — | — | — | — | OK | No install needed |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```text
Admin / real ticket
    |
    v
Supabase tickets (status='new', priority/urgent/attempts)
    |
    v
~/dev/autopilot/src/claimer.ts
  heartbeat -> kill switch -> stale sweep -> approval pass -> budget -> claim
    |
    v
~/dev/autopilot/src/runner.ts
  worktree -> headless claude -> vitest/build -> commit -> branch push -> evidence
    |
    +--> Supabase ticket_messages/ticket_events (evidence + lifecycle)
    +--> NEW/extended run observability rows (status, diff, tests, gate, duration, est_cost)
    |
    v
Admin Center (/admin/dashboard + /admin/tickets)
  RunnerOpsCard timeline + TicketDetailDialog evidence
    |
    v
Andrew approval event
    |
    v
~/dev/autopilot/src/lib/approval.ts
  fetch -> rebase onto origin/main -> repro replay -> push-gate -> ff-only merge -> push main -> deploy SHA verify
    |
    v
Supabase status resolved / blocked / requeued + Admin visibility
```

### Recommended Project Structure

```text
/Users/admin/dev/brain/
  supabase/migrations/
    20260613xxxxxx_create_autopilot_runs.sql   # durable per-run observability
  src/services/
    admin-runs.service.ts                       # pure Supabase reads for run timeline/details
  src/hooks/
    useAdminRuns.ts                             # TanStack Query polling wrappers
  src/pages/admin/
    DashboardSection.tsx                        # extend RunnerOpsCard with per-run list
  src/components/admin/
    TicketEvidence.tsx                          # parse/display new run metadata sections
  src/types/supabase.ts                         # regenerate after migration

/Users/admin/dev/autopilot/
  src/lib/evidence.ts                           # extend JsonlRunLine / bundle input
  src/lib/db.ts                                 # writeRun/updateRun helper(s)
  src/runner.ts                                 # emit run lifecycle, duration, est_cost, gate status
  src/lib/approval.ts                           # rebase conflict requeue + post-rebase replay + push serialization
  gate/push-gate.sh                             # test-integrity check inside deterministic gate
  gate/push-gate-test.sh                        # fixtures for test deletion/skip/assertion weakening
  src/watchdog.ts                               # worktree reaper, disk guard, sleep guard paging
  launchd/com.callvault.autopilot.plist         # caffeinate wrapper if implemented at launchd boundary
```

### Pattern 1: Durable Run Rows, Not Browser-Read JSONL

**What:** Create an admin-readable Supabase table, for example `autopilot_runs`, keyed by `run_id` and `ticket_id`, with status, timestamps, branch, fix SHA, changed files/diff stat, test command/exit/tail, gate verdict/stage/output tail, rebase/replay result, transcript path, and `est_cost`. [VERIFIED: existing `runner_state` and `qa_runs` patterns]

**When to use:** ACT-04 requires AdminTab visibility for every run, including failed gate runs and requeued conflicts. Local JSONL can remain as daemon forensic storage, but UI needs DB rows. [VERIFIED: `17-CONTEXT.md`]

**Example:**
```sql
-- Source: mirrors admin-only RLS shape in runner_state and qa_runs migrations.
create table public.autopilot_runs (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references public.tickets(id) on delete set null,
  status text not null,
  ts_start timestamptz not null default now(),
  ts_end timestamptz,
  duration_ms integer,
  est_cost text,
  branch text,
  fix_sha text,
  gate_verdict text,
  gate_stage text,
  test_exit integer,
  diff_stat text,
  rebase_result text,
  replay_result text,
  transcript_path text,
  created_at timestamptz not null default now()
);
alter table public.autopilot_runs enable row level security;
create policy "Admins can view autopilot runs"
  on public.autopilot_runs for select
  using (public.has_role(auth.uid(), 'ADMIN'));
```

### Pattern 2: Service + Hook + Component for Admin UI

**What:** Put Supabase reads in `src/services/admin-runs.service.ts`, query wrappers in `src/hooks/useAdminRuns.ts`, and render in `DashboardSection.tsx` and `TicketDetailDialog`. [VERIFIED: `CLAUDE.md`, `useAdminDashboard.ts`]

**When to use:** Any Admin Center run list/detail read. Components should not call Supabase directly. [VERIFIED: service/hook separation rule]

**Example:**
```typescript
// Source: follows src/services/admin-dashboard.service.ts + src/hooks/useAdminDashboard.ts.
export async function listRecentAutopilotRuns(limit = 10) {
  const { data, error } = await supabase
    .from("autopilot_runs")
    .select("*")
    .order("ts_start", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
```

### Pattern 3: Test-Integrity Gate as a `push-gate.sh` Stage

**What:** After commit-advance succeeds and before final pass, compute test-file/test-case/assertion deltas using `git diff --name-status`, `git diff --numstat`, and `git grep`/`grep` on base vs HEAD. Default-deny on unreadable inputs. [VERIFIED: `push-gate.sh` current style]

**When to use:** Every branch and approval merge gate invocation. Do not add a bypass flag for production. [VERIFIED: D-04/D-06]

**Implementation notes:** Count test files matching existing repo patterns (`*.test.ts`, `*.test.tsx`, `*.spec.ts`, `*.spec.tsx`, `__tests__/`) and assertions matching local Vitest/Testing Library idioms (`expect(`, `assert`, `toBe`, `toEqual`, etc.). [ASSUMED: exact assertion regex should be tuned during implementation against current test corpus]

### Pattern 4: Rebase Conflict Is Retryable Defer, Not Manual Merge

**What:** Change `approval.ts` so a real rebase conflict aborts, posts the reason, releases/requeues the ticket against current `origin/main`, deletes/destroys local worktree/branch state as needed, and pages only after retry cap. [VERIFIED: D-08, current `approval.ts` conflict path]

**When to use:** Approval merge path only. Runner branch preparation still produces one held branch and waits for human approval. [VERIFIED: `approval.ts`]

**Git source:** Git official docs define worktrees as separate working trees attached to one repo and rebase as replaying changes onto another base. [CITED: https://git-scm.com/docs/git-worktree, https://git-scm.com/docs/git-rebase]

### Pattern 5: Watchdog Owns Operational Guardrails

**What:** Extend `watchdog.ts` to check stale worktrees, lockdir age, free disk, logs/worktrees size, and launchd process/heartbeat health, then page through the existing user_notifications + osascript channel. [VERIFIED: `watchdog.ts`]

**When to use:** ACT-07 guard checks. Keep dispatcher single-pass; watchdog remains the independent monitor. [VERIFIED: `claimer.ts`, `watchdog.ts`]

### Anti-Patterns to Avoid

- **Adding a queue engine:** The DB claim UPDATE is the queue; new infra adds risk and violates roadmap constraints. [VERIFIED: `REQUIREMENTS.md`]
- **Letting test changes pass because the agent says they are legitimate:** Human approval is the override; gate remains mechanical default-deny. [VERIFIED: D-06]
- **Surfacing run cost as a dollar meter:** Use existing `est_cost` display field only; subscription billing has no per-token meter. [VERIFIED: D-10]
- **Changing concurrency:** Concurrency 1 is load-bearing because the shared clone/worktree base assumes one writer. [VERIFIED: `autopilot.config.ts`, `REQUIREMENTS.md`]
- **Adding a new Admin top-level tab:** Extend existing dashboard/ticket detail surfaces. [VERIFIED: D-09]
- **Force-pushing or skipping rebase:** Explicitly forbidden; use abort/requeue/escalate. [VERIFIED: D-08]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Queueing | Custom queue engine | Existing `tickets` conditional UPDATE + claim columns | Proven atomicity boundary; new engine is out of scope. [VERIFIED: `claim.ts`, `REQUIREMENTS.md`] |
| Admin polling | Bespoke intervals in components | TanStack Query `refetchInterval` in hooks | Existing Admin hooks use this pattern. [VERIFIED: `useAdminDashboard.ts`] |
| HTML rendering of evidence | Markdown-to-HTML or `dangerouslySetInnerHTML` | Existing text/pre renderer in `TicketEvidence` | Hostile ticket/repo content must stay inert text. [VERIFIED: `TicketEvidence.tsx`] |
| Git state management | String shell pipelines with ticket data | argv-array subprocesses and `git` primitives | Existing daemon avoids DB text reaching shells. [VERIFIED: `runner.ts`, `approval.ts`] |
| Sleep prevention | A custom sleep daemon | `caffeinate` around daemon critical command or launchd wrapper | macOS ships `caffeinate` for sleep assertions. [VERIFIED: environment audit; CITED: https://www.unix.com/man_page/osx/8/caffeinate/] |

**Key insight:** The safest plan is to harden the already-built mechanical boundary, not add smarter orchestration. [VERIFIED: project research summary + source reads]

## Common Pitfalls

### Pitfall 1: Run Visibility That Only Covers Success
**What goes wrong:** AdminTab shows prepared fixes but not failed gates, rebase conflicts, watchdog kills, or released claims. [VERIFIED: current evidence path only posts agent messages for certain outcomes]
**Why it happens:** Current `autopilot.jsonl` is local, and `TicketEvidence` is ticket-message based. [VERIFIED: `evidence.ts`, `TicketEvidence.tsx`]
**How to avoid:** Emit a DB run row at run start and update it at every terminal state, including gate-blocked, verification-failed, requeued, escalated, and resolved. [VERIFIED: ACT-04 requirement]
**Warning signs:** `runner_state.last_result` changes but no run row appears in AdminTab.

### Pitfall 2: Test Integrity Regex Too Narrow
**What goes wrong:** `.skip` is blocked but `describe.only`, `test.todo`, deleted files, or assertion count reductions slip through. [ASSUMED: exact repo test idioms need corpus-tuned regex]
**Why it happens:** Diff checks often only scan added lines for one string. [ASSUMED]
**How to avoid:** Gate on three independent deltas: test file count, test case count, assertion count; scan additions for `.skip`, `.only`, `xit`, `xdescribe`. [VERIFIED: D-05]
**Warning signs:** Fixture test only covers one forbidden token.

### Pitfall 3: Gate Uses Worktree-Controlled Config
**What goes wrong:** The agent edits the denylist/gate config in its branch and then passes. [VERIFIED: current gate intentionally reads denylist from `~/dev/autopilot/gate`, not worktree]
**Why it happens:** Review scripts accidentally read from the candidate worktree. [ASSUMED]
**How to avoid:** Keep all authority inputs in `~/dev/autopilot/gate`, and pass only worktree path/base SHA as inspected data. [VERIFIED: `push-gate.sh`]
**Warning signs:** Gate references `$WORKTREE/gate` or repo-local config.

### Pitfall 4: Rebase Happens But Repro Does Not Replay
**What goes wrong:** Branch rebases cleanly, tests pass, but the original repro is no longer proven against current main. [VERIFIED: ACT-06 requires replay after rebase; current `findReproArtifact()` records but does not execute replay]
**Why it happens:** Existing approval code fixed gate ordering but not replay semantics. [VERIFIED: `approval.ts`, `runner.ts`]
**How to avoid:** Make replay execution a reusable function that runner and approval path can call; after any rebase, rerun replay before gate/merge and write result to run row/evidence. [VERIFIED: ACT-06]
**Warning signs:** Run detail says "artifact referenced but replay not executed."

### Pitfall 5: Rebase Conflict Escalates Instead of Requeueing
**What goes wrong:** A stale but retryable ticket gets stuck waiting for manual merge. [VERIFIED: current `approval.ts` pages and returns `rebase-conflict`]
**Why it happens:** Current code predates D-08's "abort/destroy/release/requeue" decision. [VERIFIED: source + context]
**How to avoid:** Implement D-08 explicitly, with retry cap 2 or 3 and same defer shape as `releaseClaim()`. [VERIFIED: `17-CONTEXT.md`, `claim.ts`]
**Warning signs:** Ticket remains `awaiting_approval` after rebase conflict.

### Pitfall 6: Caffeinate Prevents Screen Lock Instead of Idle Sleep Only
**What goes wrong:** Using broad display assertions prevents expected lock/screen behavior. [ASSUMED: macOS assertion flags should be selected cautiously]
**Why it happens:** `caffeinate -d` targets display sleep; dispatcher needs idle/system/disk protection, not display wakefulness. [CITED: https://www.unix.com/man_page/osx/8/caffeinate/]
**How to avoid:** Prefer `caffeinate -i -m <command>` or process-scoped `-w <pid>` for runner critical sections; verify behavior on this Mac before activation. [VERIFIED: local `caffeinate -h` shows `-i`, `-m`, `-w`]
**Warning signs:** Screen never locks during quiet hours.

### Pitfall 7: Worktree Reaper Deletes Active Work
**What goes wrong:** Reaper removes the current run's worktree while the runner is still working. [ASSUMED]
**Why it happens:** Reaper uses directory age only. [ASSUMED]
**How to avoid:** Exclude `runner_state.current_ticket_id` derived path and lockdir owner; only reap paths older than watchdog budget + margin and not referenced by active state. [VERIFIED: `runner_state.current_ticket_id`, `staleClaimTtlSec` patterns]
**Warning signs:** Agent transcript ends with missing worktree/path errors.

## Code Examples

### Extend JSONL / Run Row Fields
```typescript
// Source: extend /Users/admin/dev/autopilot/src/lib/evidence.ts JsonlRunLine.
export interface JsonlRunLine {
  ts_start: string;
  ts_end: string;
  duration_ms: number;
  est_cost: string | null;
  gate_verdict: "pass" | "fail" | "skipped" | null;
  gate_stage: "kill_switch" | "commit_advance" | "test_integrity" | "denylist" | null;
  rebase_result: string | null;
  replay_result: string | null;
}
```

### Push-Gate Test Integrity Shape
```bash
# Source: add as a function inside /Users/admin/dev/autopilot/gate/push-gate.sh.
check_test_integrity() {
  local base="$1"
  local worktree="$2"
  local forbidden
  forbidden="$(git -C "$worktree" diff "$base"..HEAD -- '*test.*' '*spec.*' ':*__tests__*' \
    | grep -E '^\+.*(\.skip|\.only|xit\(|xdescribe\()' || true)"
  if [ -n "$forbidden" ]; then
    echo "GATE: OUT-OF-POLICY — test integrity failed: skip/only token added"
    echo "$forbidden" | sed 's/^/GATE:   /'
    return 1
  fi
}
```

### Admin Hook Pattern
```typescript
// Source: mirrors src/hooks/useAdminDashboard.ts.
export function useRecentAutopilotRuns() {
  return useQuery({
    queryKey: queryKeys.admin.autopilotRuns(),
    queryFn: () => listRecentAutopilotRuns(10),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed / Verified | Impact |
|--------------|------------------|--------------------------|--------|
| Fixture-only autopilot with kill switch on | Low-volume real-ticket activation, human approval still required | Phase 17 context, 2026-06-13 | Plan should include live drills, not only unit tests. [VERIFIED: `17-CONTEXT.md`] |
| Local JSONL and ticket-message evidence only | DB-backed per-run visibility plus evidence details | Required by ACT-04 | AdminTab can tune and trust runs. [VERIFIED: `REQUIREMENTS.md`] |
| Gate-first approval merge could trip stale-base commit-advance | Rebase stale branch before gate | Existing `approval.ts` and unit test | Preserve but extend with post-rebase replay and conflict requeue. [VERIFIED: `approval.ts`, `approval.test.ts`] |
| Rebase conflict pages/manual merge | Abort/destroy/release/requeue, retry cap then page | D-08 | Planner must update existing behavior. [VERIFIED: `17-CONTEXT.md`] |
| Watchdog only checks heartbeat/tools health | Add disk/worktree/sleep guards | Required by ACT-07 | Sustained operation does not exhaust disk or stall silently. [VERIFIED: `watchdog.ts`, `REQUIREMENTS.md`] |

**Deprecated/outdated:**
- Treating rebase conflict as immediate manual merge is outdated for Phase 17; D-08 supersedes it. [VERIFIED: `17-CONTEXT.md`]
- Reading run details only from local JSONL is insufficient for ACT-04. [VERIFIED: `REQUIREMENTS.md`]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Exact assertion-count regex should be tuned during implementation against current test corpus. | Pattern 3 / Pitfall 2 | Gate may block legitimate changes or miss weakening patterns. |
| A2 | Broad `caffeinate -d` can interfere with desired lock/display behavior; prefer idle/disk assertions. | Pitfall 6 | Wrong flags could keep display unlocked or fail to protect disk/system sleep. |
| A3 | Worktree reaper can delete active work if it only uses directory age. | Pitfall 7 | Bad guard could destroy an in-flight fix. |

## Open Questions

1. **Should run observability be a new `autopilot_runs` table or an extension of `ticket_events`?**
   - What we know: ACT-04 needs list/detail, metrics, and fields not naturally represented by ticket_events. [VERIFIED: requirements + current schemas]
   - What's unclear: Whether Andrew prefers fewer tables over cleaner run queries.
   - Recommendation: Use a dedicated `autopilot_runs` table; keep ticket_events for lifecycle audit. [VERIFIED: architecture fit]

2. **Exact retry cap: 2 or 3?**
   - What we know: Context leaves cap to planner/implementer within 2-3. [VERIFIED: D-08/discretion]
   - What's unclear: Desired balance between autonomy and noise.
   - Recommendation: Use 2 for rebase conflicts in Phase 17 because volume is low and repeated conflicts probably mean semantic drift. [ASSUMED]

3. **Exact `maxRuns` for activation: 3, 4, or 5/day?**
   - What we know: Context says low band ~3-5/day, not throughput target. [VERIFIED: D-02]
   - What's unclear: Current backlog size and Andrew's desired first-day blast radius.
   - Recommendation: Start at 3/day for first live day; raise to 5/day only after one deploy-SHA-verified ticket and gate-block fixture pass. [ASSUMED]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node | Brain build/tests/scripts | yes | v26.0.0 | — |
| npm | Brain package scripts | yes | 11.12.1 | — |
| Bun | Autopilot runtime/tests | yes | 1.3.14 | — |
| Git | Worktree/rebase/gate | yes | 2.50.1 Apple Git-155 | — |
| GitHub CLI (`gh`) | Existing escalation handoff | yes | 2.87.3 | Escalation still records in ticket if `gh` fails. [VERIFIED: `runner.ts`] |
| Supabase CLI | Migrations/deploy support | yes | 2.101.0 | Use SQL/apply path if CLI unavailable. |
| launchctl | Daemon scheduling | yes | Darwin Bootstrapper 7.0.0 | Manual `bun run` for local verification only. |
| caffeinate | Sleep guard | yes | `/usr/bin/caffeinate` usage available | `pmset`/manual Energy settings are not recommended for phase plan. [ASSUMED] |
| codex | Advisory review | yes | 0.139.0 | Advisory review can fail without blocking gate. [VERIFIED: `runner.ts`] |
| claude | Fix engine | yes | 2.1.170 | No fallback for live daemon claims. |
| osascript | Local watchdog page | yes | smoke returned `osascript-ok` | user_notifications remains primary page path. [VERIFIED: `watchdog.ts`] |
| Disk space | Worktrees/logs | yes | 174Gi free; autopilot worktrees 0B, logs 2.5M | Add disk guard threshold before activation. |
| launchd jobs | Dispatcher/watchdog/QA | yes | `com.callvault.autopilot`, watchdog, qa-poller, qa-nightly loaded | Reload plists after edits. |

**Missing dependencies with no fallback:** none found.

**Missing dependencies with fallback:** none found.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Brain framework | Vitest 4.0.16 + Testing Library + Playwright 1.57 [VERIFIED: `package.json`] |
| Brain config file | `vitest.config.ts`, `playwright.config.ts` |
| Brain quick run command | `npm test -- src/services/__tests__/admin-dashboard.service.test.ts src/components/admin/__tests__/TicketEvidence.test.ts src/components/settings/__tests__/TicketDetailDialog.test.tsx` |
| Brain full suite command | `npm test` then `npm run build` |
| Autopilot framework | `bun test` [VERIFIED: `/Users/admin/dev/autopilot/package.json`] |
| Autopilot quick run command | `bun test src/lib/approval.test.ts src/lib/evidence.test.ts src/watchdog.test.ts` |
| Autopilot gate fixture command | `bash gate/push-gate-test.sh` |
| Autopilot full suite command | `bun test && bun run typecheck` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| ACT-01 | Kill switch off claims real ticket at low run cap, still awaiting approval before merge | live smoke/manual + unit config | `bun run src/claimer.ts --dry-run` then controlled live run | Existing claimer; live fixture plan needed |
| ACT-03 | denylist, exact one-commit gate, rollback/revert evidence | shell fixture + live drill | `bash gate/push-gate-test.sh` | Existing, extend fixtures |
| ACT-04 | AdminTab displays status/diff/tests/gate/duration/cost for every run | service/hook/component tests + Playwright screenshot | `npm test -- src/pages/admin ...` | New files needed |
| ACT-05 | test deletion/skip/only/assertion weakening blocked | shell fixtures | `bash gate/push-gate-test.sh` | Existing harness, new cases needed |
| ACT-06 | stale-base rebase happens before gate; conflict requeues; replay reruns | bun unit + integration dry-run | `bun test src/lib/approval.test.ts` | Existing, extend tests |
| ACT-07 | stale worktree/disk/sleep guard pages and does not delete active run | bun unit + local smoke | `bun test src/watchdog.test.ts` | Existing, extend tests |

### Sampling Rate

- **Per task commit:** focused `bun test` or `npm test -- <changed tests>` plus `bash gate/push-gate-test.sh` for gate changes. [VERIFIED: repo scripts]
- **Per wave merge:** `bun test && bun run typecheck` in `~/dev/autopilot`; `npm test` in `brain` for UI/schema work. [VERIFIED: package scripts]
- **Phase gate:** `npm run build`, relevant Brain tests, full autopilot tests/typecheck, push-gate fixture, Admin Center Playwright/screenshot, and one controlled live ticket drill. [VERIFIED: project verification rules]

### Wave 0 Gaps

- [ ] `supabase/migrations/*_create_autopilot_runs.sql` — covers ACT-04 durable run visibility.
- [ ] `src/services/admin-runs.service.ts` and tests — covers ACT-04 UI data source.
- [ ] `src/hooks/useAdminRuns.ts` and query key — covers ACT-04 polling.
- [ ] `src/pages/admin/__tests__/DashboardSection.autopilot-runs.test.tsx` — covers runner card timeline.
- [ ] `gate/push-gate-test.sh` cases for test deletion, `.skip`, `.only`, `xit`, `xdescribe`, test-case decrease, assertion decrease — covers ACT-05.
- [ ] `/Users/admin/dev/autopilot/src/lib/approval.test.ts` cases for conflict requeue/retry-cap and post-rebase replay — covers ACT-06.
- [ ] `/Users/admin/dev/autopilot/src/watchdog.test.ts` cases for disk guard, stale worktree reaper, active worktree exemption — covers ACT-07.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes | Admin UI reads gated by Supabase Auth + `has_role(...,'ADMIN')`; Edge Functions use shared auth if added. [VERIFIED: `runner_state` RLS, `ticket-approval/index.ts`] |
| V3 Session Management | yes | Existing Supabase session; no new session mechanism. [VERIFIED: project stack] |
| V4 Access Control | yes | Admin-only RLS for run table; service-role daemon writes; no reporter visibility into runner internals. [VERIFIED: `runner_state` migration pattern] |
| V5 Input Validation | yes | Zod for Edge Function payloads if any; shell gates use deterministic parsing and argv arrays. [VERIFIED: `ticket-approval/index.ts`, `runner.ts`] |
| V6 Cryptography | no new crypto | Do not add crypto; use existing Supabase/JWT/auth stack. [VERIFIED: phase scope] |
| V8 Data Protection | yes | Do not expose transcript paths or raw local filesystem paths to reporters; Admin-only run rows. [VERIFIED: `TicketEvidence` admin context + RLS patterns] |
| V10 Malicious Code | yes | Push-gate blocks policy violations; no worktree-controlled gate inputs. [VERIFIED: `push-gate.sh`] |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Ticket text prompt-injects agent into weakening tests | Tampering / Elevation | Deterministic push-gate blocks test weakening independent of model output. [VERIFIED: ACT-05] |
| Candidate branch edits gate/denylist | Tampering | Gate reads denylist from `~/dev/autopilot/gate`, not candidate worktree. [VERIFIED: `push-gate.sh`] |
| Non-admin sees runner/run internals | Information Disclosure | Admin-only RLS on `runner_state` and new run table. [VERIFIED: migration pattern] |
| Browser calls service-role writes | Elevation | Service-role only in daemon/Edge Functions; browser uses anon session with RLS. [VERIFIED: `db.ts`, Supabase RLS docs in repo] |
| Shell injection from ticket content | Elevation / Tampering | Existing daemon uses argv arrays; do not pass DB-sourced text to shell. [VERIFIED: `runner.ts`, `approval.ts`] |
| Semantically stale merge | Tampering | Rebase onto latest `origin/main`, replay repro, gate, ff-only merge, serialized push. [VERIFIED: ACT-06, `approval.ts`] |

## Sources

### Primary (HIGH confidence)
- `.planning/phases/17-activation-per-run-observability-go-live-hardening/17-CONTEXT.md` — locked Phase 17 decisions.
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/research/SUMMARY.md` — requirements, sequencing, build order, constraints.
- `AGENTS.md`, `CLAUDE.md`, `src/CLAUDE.md`, `supabase/CLAUDE.md`, `docs/CLAUDE.md` — project binding rules.
- `src/pages/admin/{AdminCenter.tsx,DashboardSection.tsx,TicketsSection.tsx}`, `src/services/admin-dashboard.service.ts`, `src/hooks/useAdminDashboard.ts`, `src/components/settings/TicketDetailDialog.tsx`, `src/components/admin/TicketEvidence.tsx` — Admin Center and evidence surface.
- `supabase/migrations/20260611200000_autopilot_queue_runner_state.sql` — runner_state and queue-control contract.
- `/Users/admin/dev/autopilot/{autopilot.config.ts,gate/push-gate.sh,gate/push-gate-test.sh,src/claimer.ts,src/runner.ts,src/watchdog.ts,src/lib/{approval.ts,evidence.ts,claim.ts,db.ts}}` — daemon implementation.
- Local environment probes on 2026-06-13 — Node/npm/Bun/Git/gh/Supabase/launchctl/caffeinate/codex/claude/osascript, disk, loaded launchd jobs.

### Secondary (MEDIUM confidence)
- Git official docs: https://git-scm.com/docs/git-worktree and https://git-scm.com/docs/git-rebase — worktree/rebase behavior.
- Apple archived launchd guidance: https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html — launchd job config references.
- macOS caffeinate man-page mirror + local `caffeinate -h`: https://www.unix.com/man_page/osx/8/caffeinate/ — sleep assertion flags.

### Tertiary (LOW confidence)
- None used as a planning dependency. Assumptions are explicitly listed above.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions and repo constraints verified locally; no new packages recommended.
- Architecture: HIGH — direct source reads in both repos found current implementation seams.
- Pitfalls: HIGH for locked go-live blockers; MEDIUM for exact regex/caffeinate flag details until implementation tests tune them.

**Research date:** 2026-06-13
**Valid until:** 2026-07-13 for repo architecture; recheck CLI versions and live daemon state before activation.
