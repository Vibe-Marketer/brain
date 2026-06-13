# Phase 17: Activation + Per-Run Observability + Go-Live Hardening - Research

**Researched:** 2026-06-13
**Domain:** Local Bun/TypeScript autonomous fix daemon + Supabase ticket ledger + React AdminTab observability
**Confidence:** HIGH for local architecture and existing code paths; MEDIUM for live-production cutover sequencing because it still requires a controlled real-ticket drill.

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

### the agent's Discretion
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

Phase 17 should be planned as a low-volume controlled production activation plus three mechanical hardening blockers, not as a throughput or autonomy expansion. The daemon is already armed-but-idle in `~/dev/autopilot`, with `concurrency: 1`, a kill-switch file/DB row, quiet hours, budget guard, ephemeral worktrees, held fix branches, and an AdminTab approval path. [VERIFIED: `~/dev/autopilot/autopilot.config.ts`, `~/dev/autopilot/src/claimer.ts`, `.planning/STATE.md`]

The biggest planning risk is assuming ACT-06 is already complete because `approval.ts` has rebase-before-gate ordering. Current code rebases stale held branches before the gate, but on rebase conflict it pages/escalates and leaves the fix held; the phase decision requires abort, destroy/release, requeue for a fresh attempt, cap retries, and only then escalate. Current repro replay is also "artifact referenced but replay not executed" rather than replay-on-rebased-state proof. [VERIFIED: `~/dev/autopilot/src/lib/approval.ts`, `~/dev/autopilot/src/runner.ts`]

ACT-04 should reuse AdminTab's existing `RunnerOpsCard`, `TicketDetailDialog`, and `TicketEvidence` surfaces. Add a DB-backed per-run ledger or verify/repair the existing generated `runner_runs` type mismatch first, then expose a compact run list off the runner card and per-ticket run detail inside the existing evidence bundle. [VERIFIED: `src/pages/admin/DashboardSection.tsx`, `src/components/settings/TicketDetailDialog.tsx`, `src/components/admin/TicketEvidence.tsx`, `src/types/supabase.ts`; MEDIUM because no `runner_runs` migration was found in this checkout]

**Primary recommendation:** Plan four narrow work packages in order: schema/run-ledger observability, push-gate test-integrity blocker, rebase/requeue/replay hardening, operational cutover drill with rollback/denylist/disk/sleep proof. [VERIFIED: phase context + source reads]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Kill-switch activation and low-volume claim cap | Daemon config | Supabase `runner_state` | `autopilot.config.ts` owns cadence/cap/quiet hours; `runner_state.kill_switch` is the operator-visible DB switch. [VERIFIED: `autopilot.config.ts`, `20260611200000_autopilot_queue_runner_state.sql`] |
| Per-run lifecycle capture | Daemon | Database | The daemon observes run start/end, gate output, tests, rebase, replay, duration, and cost; DB persistence is needed for AdminTab. [VERIFIED: `runner.ts`, `evidence.ts`; MEDIUM for target table] |
| Per-run visibility | Frontend | Database | AdminTab should read run rows through service+hook separation and render under the existing runner card and ticket dialog. [VERIFIED: `src/CLAUDE.md`, `admin-dashboard.service.ts`, `DashboardSection.tsx`] |
| Test-integrity enforcement | Push gate | Tests | The deterministic shell gate is the authority boundary; test fixtures prove blocked attempts. [VERIFIED: `gate/push-gate.sh`, `gate/push-gate-test.sh`] |
| Stale-main merge prevention | Daemon approval path | Git | `approval.ts` owns the only main merge path and already serializes through one claimer cycle; it must rebase, rerun replay, gate, and push main one at a time. [VERIFIED: `approval.ts`, `claimer.ts`] |
| Rebase conflict retry/requeue | Daemon claim logic | Supabase tickets | `releaseClaim()` already implements retryable defer shape; approval conflict handling should reuse or mirror it. [VERIFIED: `claim.ts`, `approval.ts`] |
| Worktree reaper and disk guard | Daemon/watchdog | launchd/macOS | Runner creates/removes worktrees; watchdog is the independent pager; disk and sleep checks belong there or as preflight guard scripts. [VERIFIED: `runner.ts`, `watchdog.ts`, launchd plists] |

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ACT-01 | Go live — the kill switch is turned off and the dispatcher claims and fixes real production tickets through the existing fix→gate→approve→merge spine. | Use existing `runner_state.kill_switch`, `claimer.ts`, `runner.ts`, `ticket-approval` and `approval.ts`; plan a 3-5/day cap and one controlled production ticket drill. [VERIFIED: `REQUIREMENTS.md`, daemon source] |
| ACT-03 | Rollback + blast-radius safety proven on live tickets. | Existing evidence bundle includes branch/fix/revert SHA; denylist gate exists; plan live proof for reject/delete branch, denylist block, and deploy-SHA-verified rollback/revert path. [VERIFIED: `evidence.ts`, `push-gate.sh`, `TicketEvidence.tsx`] |
| ACT-04 | Every autonomous run visible in AdminTab with status, diff, test result, gate verdict, duration, and cost. | Add/verify run ledger persistence; extend `RunnerOpsCard`; fold detailed evidence into `TicketDetailDialog`/`TicketEvidence`. [VERIFIED: AdminTab source; MEDIUM for `runner_runs`] |
| ACT-05 | Test-integrity push-gate blocks test deletion, assertion weakening, `.skip`/`.only`. | Extend `push-gate.sh` after commit-advance and before denylist or as a helper invoked there; add fixture coverage in `push-gate-test.sh`. [VERIFIED: gate source] |
| ACT-06 | Rebase-before-push, serialized push, repro replay on rebased state. | Existing approval path has rebase-before-gate ordering; plan gaps are replay execution after rebase, requeue-on-conflict behavior, retry cap, and serialized push proof. [VERIFIED: `approval.ts`, `approval.test.ts`] |
| ACT-07 | Worktree reaper, disk guard, wake/caffeinate handling. | Existing runner removes worktrees in `finally` and prunes before runs; plan adds age-based reaper, disk threshold fail-closed, and `caffeinate` launchd/process wrapping. [VERIFIED: `runner.ts`, `watchdog.ts`, environment probe] |
</phase_requirements>

## Project Constraints (from AGENTS.md)

- Direct-main workflow: commit and push to `origin/main`; no feature branches or PRs unless explicitly requested. [VERIFIED: `AGENTS.md`, `CLAUDE.md`]
- Use CodeGraph before broad grep for code relationships; use Graphify only as planning context and never as behavioral proof. [VERIFIED: `AGENTS.md`; CodeGraph status checked]
- Package manager in `~/dev/brain` is npm only; banned: pnpm, bun, yarn. Daemon repo `~/dev/autopilot` is Bun/TypeScript by design. [VERIFIED: `AGENTS.md`, `package.json`, autopilot `package.json`]
- Frontend stack is React 18 + Vite 5 + react-router-dom v6 + TanStack Query + Zustand v5 + Tailwind + shadcn/ui + Remix Icons + `motion/react`; do not add Lucide, FontAwesome, `framer-motion`, or new chart libraries. [VERIFIED: `src/CLAUDE.md`, `package.json`]
- Service + Hook separation is mandatory: services are pure async TS, hooks wrap them with TanStack Query, components do not call services directly. [VERIFIED: `CLAUDE.md`, `src/CLAUDE.md`]
- Backend uses Supabase Edge Functions and migrations; integration tests must use a real dedicated test DB, never mocked Supabase and never production fallbacks. [VERIFIED: `supabase/CLAUDE.md`]
- All AI/LLM/embedding belongs outside the frontend; Phase 17 frontend is observability only. [VERIFIED: `CLAUDE.md`]
- MCP server and recording-ID hard rules are not in Phase 17's direct path, but plans must avoid touching them unless required. [VERIFIED: `AGENTS.md`]
- Brand copy must say "AI-ready, not AI-powered"; do not use positive "AI-powered" UI copy. [VERIFIED: `AGENTS.md`, `CLAUDE.md`]
- Phase 17 daemon work targets `~/dev/autopilot`; migrations, Edge Functions, generated types, and AdminTab UI target `~/dev/brain`. [VERIFIED: `.planning/STATE.md`, `17-CONTEXT.md`]

## Standard Stack

### Core

| Library / Surface | Version | Purpose | Why Standard |
|-------------------|---------|---------|--------------|
| Bun | 1.3.14 | Runs the autopilot daemon and tests in `~/dev/autopilot`. | Existing daemon runtime; do not port to Node for Phase 17. [VERIFIED: environment probe, autopilot `package.json`] |
| TypeScript | daemon `^5.9.0`, brain `^5.8.3` | Shared implementation language. | Existing strict TS codebase. [VERIFIED: package files] |
| `@supabase/supabase-js` | brain `^2.84.0`, daemon `^2.84.0` | DB access from frontend services and daemon service-role client. | Already used by both repos; no new DB client. [VERIFIED: package files] |
| React | `^18.3.1` | AdminTab UI. | Existing frontend framework. [VERIFIED: brain `package.json`] |
| TanStack Query | `^5.90.10` | AdminTab polling for runner/runs. | Existing service+hook pattern. [VERIFIED: brain `package.json`, `useAdminDashboard.ts`] |
| Vitest | `^4.0.16` | Brain unit tests; daemon uses Bun test. | Existing unit test framework. [VERIFIED: brain `package.json`, autopilot tests] |
| launchd | macOS built-in | Schedules dispatcher, watchdog, QA jobs. | Existing loaded jobs; no cron/GitHub Actions. [VERIFIED: launchd plists, `launchctl list`] |
| `caffeinate` | macOS built-in | Prevents sleep during sustained operation or critical run windows. | Available locally; no package needed. [VERIFIED: environment probe] |

### Supporting

| Surface | Version / State | Purpose | When to Use |
|---------|-----------------|---------|-------------|
| `runner_state` table | Migration `20260611200000` | Singleton heartbeat/kill switch/current ticket. | Keep as at-a-glance card anchor. [VERIFIED: migration, service] |
| `ticket_messages` + `TicketEvidence` | Existing | Detailed evidence rendering. | Reuse for per-ticket run drill-down; do not create a separate evidence UI. [VERIFIED: `TicketEvidence.tsx`] |
| `runner_runs` | Generated type exists; migration not found | Candidate per-run ledger. | Verify schema source; if absent, add migration matching generated type or replace with a richer `autopilot_runs` table. [VERIFIED: `src/types/supabase.ts`; MEDIUM target due missing migration] |
| `push-gate.sh` | Existing | Deterministic authority boundary. | Add test-integrity check here or in a helper invoked here. [VERIFIED: gate source] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| DB-backed run ledger | Local JSONL only | JSONL already exists but AdminTab cannot reliably read local daemon disk from browser; DB row is required for ACT-04. [VERIFIED: `evidence.ts`; [ASSUMED] browser cannot access daemon disk directly] |
| Existing AdminTab surfaces | New top-level tab | Rejected by D-09 and One-Click/KISS-UX. [VERIFIED: `17-CONTEXT.md`] |
| `push-gate.sh` helper | Inline shell function | Both are acceptable; helper improves fixtureability if assertion counting grows complex. [VERIFIED: D-10] |
| Job queue engine | BullMQ/Temporal/Redis | Out of scope; Supabase atomic claim UPDATE is the queue and concurrency stays 1. [VERIFIED: `REQUIREMENTS.md`] |

**Installation:**

```bash
# No new packages for Phase 17.
# Brain repo remains npm-only; daemon repo remains Bun-based.
```

## Package Legitimacy Audit

No external packages should be installed for Phase 17. The phase is config, shell gate, daemon logic, migration/types, and AdminTab rendering. [VERIFIED: `17-CONTEXT.md`, `REQUIREMENTS.md`, package files]

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| none | n/a | n/a | n/a | n/a | n/a | No package install planned |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```text
AdminTab Runner Card
  │
  ├─ toggles runner_state.kill_switch ─────────────┐
  │                                                │
  ▼                                                ▼
Supabase runner_state + tickets + runner_runs   Autopilot claimer (launchd)
  ▲                                                │
  │                                                ▼
AdminTab run list/detail                    processTicket(ticket)
  ▲                                                │
  │                                                ├─ worktree create / claude / vitest / build
  │                                                ├─ push-gate test integrity + denylist
  │                                                ├─ evidence bundle + run ledger row
  │                                                ▼
TicketDetailDialog / TicketEvidence          awaiting_approval ticket
  ▲                                                │
  │                                                ▼
ticket-approval Edge Function ────────────── approval.ts merge pass
                                                   │
                                                   ├─ fetch origin/main
                                                   ├─ rebase fix onto latest main
                                                   ├─ replay repro on rebased state
                                                   ├─ push-gate re-run
                                                   ├─ ff-only merge + push main
                                                   └─ deploy-SHA verify / resolved
```

### Recommended Project Structure

```text
~/dev/autopilot/
├── gate/
│   ├── push-gate.sh                  # add deterministic test-integrity stage
│   ├── push-gate-test.sh             # add fixtures for deletion/skip/assert weakening
│   └── test-integrity-gate.*         # optional helper, only if shell gets too dense
├── src/
│   ├── runner.ts                     # emit run ledger, duration, gate/test outcomes
│   ├── claimer.ts                    # low maxRuns, conflict retry cap integration
│   ├── lib/
│   │   ├── approval.ts               # requeue conflict, replay after rebase, serialized push proof
│   │   ├── claim.ts                  # reuse release/defer shape
│   │   └── evidence.ts               # add duration/cost/gate fields
│   └── watchdog.ts                   # disk guard + reaper page path if centralized here
└── launchd/
    └── com.callvault.autopilot.plist # wrap critical runs with caffeinate or invoke wrapper

~/dev/brain/
├── supabase/migrations/
│   └── 20260613xxxxxx_create_or_extend_runner_runs.sql
├── src/services/
│   └── admin-dashboard.service.ts    # add run-list service or separate admin-runs.service.ts
├── src/hooks/
│   └── useAdminDashboard.ts          # add useRunnerRuns/useRunnerRunDetail
├── src/pages/admin/
│   └── DashboardSection.tsx          # extend RunnerOpsCard with per-run list/timeline
└── src/components/admin/
    └── TicketEvidence.tsx            # parse/display new gate/replay/cost detail
```

### Pattern 1: DB-Backed Run Ledger

**What:** Persist one row per autonomous run with ticket id, status, gate verdict, test result, diff stat, duration, cost display, branch, fix SHA, rebase/replay outcome, and failure reason. [VERIFIED: ACT-04 requirement; current JSONL lacks duration/cost]

**When to use:** Required before turning up volume or claiming ACT-04. [VERIFIED: `ROADMAP.md`]

**Example target row shape:**

```typescript
interface AutopilotRunRow {
  id: string;
  ticket_id: string | null;
  status: "started" | "awaiting_approval" | "gate_failed" | "requeued" | "escalated" | "merged" | "failed";
  started_at: string;
  finished_at: string | null;
  duration_sec: number | null;
  est_cost: string | null; // display field only; do not imply per-token billing
  gate_verdict: "pass" | "fail" | "skipped" | null;
  gate_stage: "kill_switch" | "commit_advance" | "test_integrity" | "denylist" | null;
  test_cmd: string | null;
  test_exit: number | null;
  diff_stat: string | null;
  branch: string | null;
  fix_sha: string | null;
  detail: Record<string, unknown>;
}
```

### Pattern 2: Deterministic Push-Gate Test Integrity

**What:** Compare `BASE_SHA..HEAD` for touched test files and fail if tests are removed, `.skip`/`.only`/`xit`/`xdescribe` are added, or assertion count decreases in touched test files. [VERIFIED: D-04/D-05]

**When to use:** Always inside `push-gate.sh`; never as an LLM review or advisory check. [VERIFIED: D-04]

**Implementation note:** Use `git diff --name-only`, `git show "$BASE_SHA:$file"` where the file exists, and `git -C "$WORKTREE" show HEAD:"$file"`/working tree content to compare old/new. Count test cases conservatively with known repo patterns (`it(`, `test(`, `describe(` may be metadata; the decision says test-case count, not suite count). Count assertions with `expect(` and common Testing Library assertions. Default-deny on parser ambiguity. [VERIFIED: local test style; [ASSUMED] assertion regex list is sufficient and should be validated by fixtures]

### Pattern 3: Rebase Conflict as Retryable Defer

**What:** On rebase conflict, abort, remove the held worktree/branch state, release/requeue the ticket for a fresh run on latest `origin/main`, and page/escalate only after retry cap. [VERIFIED: D-08]

**When to use:** Approval merge pass when held branch base is stale and rebase fails. [VERIFIED: `approval.ts`]

**Current gap:** `approval.ts` currently writes an escalation message and pages Andrew on rebase conflict. That contradicts D-08's first response. [VERIFIED: `approval.ts`]

### Pattern 4: AdminTab Extension, Not New Navigation

**What:** `RunnerOpsCard` gets a compact per-run list/timeline; `TicketDetailDialog` keeps the detailed evidence. [VERIFIED: D-09]

**When to use:** All ACT-04 UI work. [VERIFIED: `DashboardSection.tsx`, `TicketDetailDialog.tsx`]

**Data access:** Add a pure service read plus TanStack hook; keep components declarative. [VERIFIED: `src/CLAUDE.md`]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Queue engine | BullMQ, pg-boss, Temporal, Redis | Existing Supabase tickets + atomic claim update | Out of scope and duplicates current queue. [VERIFIED: `REQUIREMENTS.md`, `claim.ts`] |
| New dashboard app | Separate admin tab/app | Existing AdminTab runner card and ticket dialog | Locked by D-09. [VERIFIED: `17-CONTEXT.md`] |
| LLM gate | Prompt-based "did the agent weaken tests?" review | Shell push-gate test-integrity check | Gate must be deterministic/non-LLM. [VERIFIED: D-04] |
| Per-token billing meter | Token SDK or dollar-cost library | Existing `est_cost` display field / run budget counter | Subscription billing has no per-token meter in Phase 17. [VERIFIED: D-10] |
| New icon/chart library | Recharts, Chart.js, Lucide | Existing table/list UI + Remix Icons | Stack is locked; ACT-04 needs a readable list, not charts. [VERIFIED: `src/CLAUDE.md`] |
| New scheduler | cron or GitHub Actions | Existing launchd jobs | Launchd jobs already loaded; macOS sleep handling belongs here. [VERIFIED: launchd plists] |

**Key insight:** Phase 17 is about reducing unknowns in an already-built system. New infrastructure increases the number of things to trust during the first real-ticket run. [VERIFIED: research summary + source reads]

## Common Pitfalls

### Pitfall 1: Treating Activation as Auto-Merge
**What goes wrong:** The plan turns the kill switch off and allows autonomous merges. [VERIFIED: D-01 says no autonomous merge]
**Why it happens:** "Go live" sounds like full autonomy. [ASSUMED]
**How to avoid:** Define Phase 17 "live" as autonomous claim/fix only; every merge still goes through AdminTab approval. [VERIFIED: D-01]
**Warning signs:** Plan mentions auto-approve, autonomy ladder, survival metric, or 25-30/day volume. [VERIFIED: Deferred Ideas]

### Pitfall 2: Gate-First Rebase Regression
**What goes wrong:** The gate sees a stale branch parent and fails commit-advance before rebase can fix the base. [VERIFIED: `approval.test.ts` documents the prior bug]
**Why it happens:** `push-gate.sh` requires HEAD exactly one commit past the provided base. [VERIFIED: `push-gate.sh`]
**How to avoid:** Keep rebase-before-gate ordering and add tests for stale-base branch. [VERIFIED: `approval.test.ts`]
**Warning signs:** Gate exits with commit-advance while branch is otherwise clean and origin/main moved. [VERIFIED: gate behavior]

### Pitfall 3: Rebase Conflict Escalates Too Early
**What goes wrong:** A stale fix with a real conflict pages Andrew instead of getting a fresh autonomous attempt. [VERIFIED: current `approval.ts`; D-08 requires requeue first]
**Why it happens:** Current merge path maps conflict to `rebase-conflict` and pages. [VERIFIED: `approval.ts`]
**How to avoid:** Convert conflict to retryable defer: abort, delete/destroy, release claim, increment conflict-attempt metadata, requeue; escalate after cap. [VERIFIED: D-08; MEDIUM implementation detail]
**Warning signs:** `approval.ts` pageAdmin path still runs on first conflict. [VERIFIED: `approval.ts`]

### Pitfall 4: "Repro Replay" Is Only a Reference
**What goes wrong:** Evidence says a repro artifact exists but does not prove fail→pass on rebased state. [VERIFIED: `findReproArtifact()` returns "artifact referenced but replay not executed"]
**Why it happens:** v1 runner recorded artifact references but did not execute replay. [VERIFIED: `runner.ts`]
**How to avoid:** Add a replay command contract for ticket context/messages and run it after rebase before gate/merge. [MEDIUM: target contract needs implementation]
**Warning signs:** Evidence bundle says "replay not executed" for a Phase 17 success criterion. [VERIFIED: `evidence.ts`/`runner.ts`]

### Pitfall 5: `runner_runs` Type Without Migration
**What goes wrong:** Planner assumes `runner_runs` exists because generated types include it, then production migration/deploy fails or AdminTab reads a missing relation. [VERIFIED: `src/types/supabase.ts`; no migration found by `rg`]
**Why it happens:** Generated types may include a remote/prod table not represented in local migration history. [ASSUMED]
**How to avoid:** Wave 0 must verify the live and local schema; if no migration exists, add one before UI work. [VERIFIED: local search result]
**Warning signs:** `rg "runner_runs" supabase/migrations` returns nothing. [VERIFIED: command output]

### Pitfall 6: Test-Integrity Regex Is Too Naive
**What goes wrong:** Legitimate refactors are blocked or weakened assertions slip through. [ASSUMED]
**Why it happens:** JS/TS test syntax is flexible; regex counting can miss aliases or custom matchers. [ASSUMED]
**How to avoid:** Default-deny only for touched test files, fixture the exact blocked behaviors, and leave legitimate overrides to human approval outside the gate. [VERIFIED: D-06; MEDIUM for regex design]
**Warning signs:** Gate tries to understand product semantics or allows a flag bypass. [VERIFIED: D-04/D-06]

### Pitfall 7: Worktree Cleanup Only in Happy `finally`
**What goes wrong:** Sleep, SIGKILL, or launcher crash leaves old worktrees and fills disk. [VERIFIED: ACT-07 concern; runner removes in `finally` only]
**Why it happens:** `finally` does not run after hard process death. [VERIFIED: general runtime behavior [ASSUMED] but standard]
**How to avoid:** Add startup/cron-like reaper for aged `autopilot-fix-*` worktrees and `git worktree prune`, plus disk threshold guard before claim. [VERIFIED: current pre-clean/prune; MEDIUM target]
**Warning signs:** `~/dev/autopilot/worktrees` grows after failed runs. [ASSUMED]

## Code Examples

### Existing Gate Order to Preserve

```bash
# Source: ~/dev/autopilot/gate/push-gate.sh
# Current order is kill switch, commit-advance, denylist.
# Phase 17 adds test-integrity as another deterministic stage in this boundary.
bash "$GATE_SCRIPT" "$WORKTREE_OR_CLONE" "$BASE_SHA"
```

### Existing Approval Rebase Ordering

```typescript
// Source: ~/dev/autopilot/src/lib/approval.ts
// Current pure merge mechanic already rebases stale branches before the gate.
if (currentMain !== branchParent) {
  const reb = r.git(["rebase", "origin/main", branch]);
  if (reb.code !== 0) {
    r.git(["rebase", "--abort"]);
    return { kind: "rebase-conflict", out: reb.out };
  }
}
const gate = r.gate(gateBase);
```

### Existing Admin Runner Card Hook

```typescript
// Source: src/hooks/useAdminDashboard.ts
export function useRunnerState() {
  return useQuery({
    queryKey: queryKeys.admin.runner(),
    queryFn: getRunnerState,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
```

### Existing Evidence Surface

```typescript
// Source: src/components/admin/TicketEvidence.tsx
// Evidence is rendered from agent-authored ticket_messages with no HTML injection.
const EVIDENCE_HEADER = "# Autopilot fix evidence";
const KNOWN_SECTIONS = ["Diff", "Tests", "Repro replay", "Codex review", "Revert", "Deploy"] as const;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Fixture-only / kill switch ON | Controlled real-ticket activation with human approval | Phase 17 target | Real production proof starts without auto-merge. [VERIFIED: `STATE.md`, D-01] |
| Local JSONL evidence only | DB-backed per-run observability | Phase 17 target | AdminTab can display every run. [VERIFIED: ACT-04; MEDIUM target] |
| Gate blocks kill switch, commit advance, denylist | Gate also blocks test deletion/weakening | Phase 17 target | Prevents agent "fixing" by defeating tests. [VERIFIED: ACT-05] |
| Rebase conflict pages immediately | Rebase conflict requeues fresh attempt first | Phase 17 target | Reduces Andrew load and avoids semantically stale merges. [VERIFIED: D-08] |
| Worktree cleanup in runner finally | Reaper + disk guard + caffeinate | Phase 17 target | Sustained operation cannot fill disk or stall on sleep. [VERIFIED: ACT-07] |

**Deprecated/outdated:**
- Treating `reproReplay.result` as proof when it says replay was not executed is not acceptable for ACT-06. [VERIFIED: `runner.ts`]
- Raising `maxRunsPerWindow.maxRuns` toward 25-30/day is explicitly Phase 19, not Phase 17. [VERIFIED: `17-CONTEXT.md`]

## Open Questions

1. **Does `runner_runs` actually exist in production/local DB, or is the generated type ahead of migrations?**
   - What we know: `src/types/supabase.ts` contains `runner_runs`; no migration file contains `runner_runs`. [VERIFIED: source search]
   - What's unclear: whether a migration was omitted from git, generated from remote state, or removed. [MEDIUM]
   - Recommendation: Wave 0 schema probe; if missing, add an explicit migration and regenerate types. [VERIFIED: planning need]

2. **What exact command format is a replayable repro artifact?**
   - What we know: `runner.ts` only detects references and records "replay not executed." [VERIFIED: source]
   - What's unclear: whether existing tickets have executable repro commands/scripts or only prose/screenshot artifacts. [MEDIUM]
   - Recommendation: define a minimal replay contract in ticket context, e.g. `{ "repro_cmd": "npm run test -- path -t name" }` or a stored script path, then replay after rebase. [ASSUMED]

3. **Should retry cap for rebase conflicts be 2 or 3?**
   - What we know: D-08 allows ~2-3 attempts. [VERIFIED: context]
   - What's unclear: the exact cap. [VERIFIED: discretionary decision]
   - Recommendation: Use 2 for Phase 17 low volume; escalate on the third conflict event. [ASSUMED]

4. **What is the correct `est_cost` display value?**
   - What we know: D-10 says cost is an existing display field and not a dollar/token meter. [VERIFIED: context]
   - What's unclear: no current daemon field was found named `est_cost`. [VERIFIED: source search]
   - Recommendation: display "1 run" / budget-window slot or coarse configured estimate, and label it as estimated run cost/budget use. [ASSUMED]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Brain build/tests | yes | v26.0.0 | none needed [VERIFIED: environment probe] |
| npm | Brain package manager | yes | 11.12.1 | none; npm only [VERIFIED: environment probe] |
| Bun | Autopilot daemon/tests | yes | 1.3.14 | none; daemon uses Bun [VERIFIED: environment probe] |
| Supabase CLI | migrations/types/deploy | yes | 2.101.0 | use SQL dashboard only if CLI blocked [VERIFIED: environment probe] |
| launchctl | daemon scheduling | yes | Darwin Bootstrapper 7.0.0 | none for Mac host [VERIFIED: environment probe] |
| caffeinate | sleep handling | yes | macOS built-in | launchd KeepAlive/RunAtLoad helps but does not replace it [VERIFIED: environment probe] |
| git | rebase/gate/merge | yes | 2.50.1 Apple Git | none [VERIFIED: environment probe] |
| gh | escalation/handoff paths | yes | 2.87.3 | not central to Phase 17 [VERIFIED: environment probe] |
| codex | advisory review | yes | codex-cli 0.139.0 | advisory only [VERIFIED: environment probe] |
| claude | headless fix engine | yes | 2.1.170 | none for live fix loop [VERIFIED: environment probe] |
| launchd jobs | daemon/watchdog/QA | loaded, no current PID shown | labels loaded | kickstart/load troubleshooting if not firing [VERIFIED: `launchctl list`] |
| Disk space | ACT-07 guard | yes | 174Gi free on target volume | fail-closed threshold should page before exhaustion [VERIFIED: `df`] |

**Missing dependencies with no fallback:** none found in this session. [VERIFIED: environment probe]

**Missing dependencies with fallback:** `classify-confidence` and `research-plan` commands named by the agent contract are absent in this GSD install; research used local source/codegraph/direct reads instead. [VERIFIED: CLI output]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Brain framework | Vitest 4.x + Testing Library; config `vitest.config.ts`. [VERIFIED: package/codebase testing docs] |
| Brain quick command | `npm test -- src/services/__tests__/admin-dashboard.service.test.ts src/components/settings/__tests__/TicketDetailDialog.test.tsx src/components/admin/__tests__/TicketEvidence.test.tsx` [VERIFIED: files exist] |
| Brain full command | `npm test` and `npm run build` before push. [VERIFIED: package scripts] |
| Integration command | `npm run test:integration` only with dedicated test env; skips/throws if unsafe. [VERIFIED: `supabase/CLAUDE.md`] |
| Autopilot framework | Bun test. [VERIFIED: autopilot package] |
| Autopilot quick command | `bun test src/lib/approval.test.ts src/lib/claim.test.ts src/lib/evidence.test.ts src/watchdog.test.ts && bash gate/push-gate-test.sh` [VERIFIED: files exist] |
| Autopilot full command | `bun test && bun run typecheck` [VERIFIED: autopilot package] |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| ACT-01 | Kill switch off at low cap, claim real ticket, awaits approval | live smoke/manual gated | `bun run src/claimer.ts --dry-run` then controlled live run | partial |
| ACT-03 | Denylist and rollback/reject paths demonstrated | shell/unit/live smoke | `bash gate/push-gate-test.sh`; add live ticket drill | yes, extend |
| ACT-04 | AdminTab shows run status/diff/tests/gate/duration/cost | unit/component + browser | add tests around service/hook/card/evidence | partial |
| ACT-05 | Test deletion/weakening/skip blocked | shell fixture | `bash gate/push-gate-test.sh` | yes, extend |
| ACT-06 | Rebase-before-push + replay + serialized push + requeue conflict | Bun unit + live git fixture | `bun test src/lib/approval.test.ts` | yes, extend |
| ACT-07 | Reaper/disk/caffeinate guards | unit + local smoke | add `watchdog`/reaper tests; `df`/temp worktree fixture | partial |

### Sampling Rate

- **Per daemon task commit:** `bun test <changed autopilot tests> && bash gate/push-gate-test.sh` in `~/dev/autopilot`. [VERIFIED: local scripts]
- **Per brain UI/schema task commit:** targeted Vitest for changed service/hook/component plus `npm run build`. [VERIFIED: package scripts]
- **Phase gate:** full `bun test && bun run typecheck` in autopilot, full relevant brain tests/build, controlled production ticket run, deploy-SHA verification, and AdminTab/browser screenshot. [VERIFIED: project verification rules; MEDIUM live proof requires execution]

### Wave 0 Gaps

- [ ] Verify or create `runner_runs` migration and RLS; generated type alone is not enough. [VERIFIED: search]
- [ ] Add run-ledger service/hook tests. [MEDIUM]
- [ ] Add push-gate fixtures for test deletion, `.skip`/`.only`/`xit`/`xdescribe`, and assertion decrease. [VERIFIED: current fixture harness]
- [ ] Add approval tests for requeue-on-conflict and replay-after-rebase behavior. [VERIFIED: existing approval test seam]
- [ ] Add reaper/disk guard tests around temp worktree directories. [MEDIUM]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes | Supabase Auth + ADMIN role checks for AdminTab and ticket approval. [VERIFIED: `ticket-approval.service.ts`, `ticket-approval` docs/comments] |
| V3 Session Management | yes | Existing Supabase session; no new auth mechanism. [VERIFIED: project stack] |
| V4 Access Control | yes | RLS: `runner_state` admin-readable, service-role writes; tickets admin/update policies; no reporter runner internals. [VERIFIED: migration] |
| V5 Input Validation | yes | Shell commands use argv arrays in daemon; gate must treat DB/ticket text as data. [VERIFIED: `runner.ts`, `approval.ts`] |
| V6 Cryptography | no new crypto | No new crypto in Phase 17; keep secrets out of repo. [VERIFIED: no new secret context] |
| V8 Data Protection | yes | Evidence/gate output may include paths/logs; render as text, avoid exposing to non-admins. [VERIFIED: `TicketEvidence.tsx`, RLS] |
| V10 Malicious Code | yes | Push gate blocks policy/test-integrity violations; no LLM gate authority. [VERIFIED: D-04/D-05] |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt-injected ticket tells agent to weaken tests | Tampering | Mechanical push-gate blocks test weakening independent of agent prose. [VERIFIED: ACT-05] |
| Reporter/non-admin reads runner internals | Information Disclosure | Admin-only `runner_state` and run-ledger RLS. [VERIFIED: migration; MEDIUM run-ledger target] |
| Agent shell injection through ticket text | Elevation/Tampering | Daemon uses argv arrays; do not pass DB text to shell. [VERIFIED: `runner.ts`, `approval.ts`] |
| Unauthorized approval event | Elevation | `ticket-approval` Edge Function/admin role path; daemon only qualifies non-null ADMIN actor rows. [VERIFIED: `approval.ts`, tests] |
| Semantically stale merge | Tampering | Rebase onto latest `origin/main`, replay repro, gate, ff-only merge, serialized push. [VERIFIED: ACT-06; partial current implementation] |
| Disk exhaustion from orphaned worktrees/logs | Denial of Service | Reaper + disk threshold fail-closed + watchdog page. [VERIFIED: ACT-07; target] |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Browser cannot directly read daemon JSONL, so DB run ledger is required. | Standard Stack / Alternatives | If there is an existing API bridge, planner may overbuild schema. |
| A2 | Assertion-count regex list can cover project tests if fixture-backed. | Architecture Patterns / Pitfalls | A weak gate can false-pass or false-block. |
| A3 | Retry cap should be 2 for Phase 17. | Open Questions | Too low may page Andrew unnecessarily; too high may churn. |
| A4 | `est_cost` should display run/budget use rather than dollars. | Open Questions | Copy may mislead if a real field exists elsewhere. |
| A5 | Old worktrees can accumulate after hard process death. | Pitfalls | If launchd cleanup already handles this externally, planner may duplicate. |

## Sources

### Primary (HIGH confidence)
- `.planning/phases/17-activation-per-run-observability-go-live-hardening/17-CONTEXT.md` — locked decisions and boundaries.
- `.planning/REQUIREMENTS.md` — ACT-01, ACT-03, ACT-04, ACT-05, ACT-06, ACT-07 definitions.
- `.planning/ROADMAP.md` and `.planning/STATE.md` — sequencing, invariants, and cross-repo boundary.
- `.planning/research/SUMMARY.md`, `.planning/research/ARCHITECTURE.md`, `.planning/research/PITFALLS.md` — converged build order and blocker rationale.
- `AGENTS.md`, `CLAUDE.md`, `src/CLAUDE.md`, `supabase/CLAUDE.md` — repo binding rules.
- `~/dev/autopilot/autopilot.config.ts`, `src/claimer.ts`, `src/runner.ts`, `src/lib/approval.ts`, `src/lib/claim.ts`, `src/lib/evidence.ts`, `src/watchdog.ts`, `gate/push-gate.sh`, `gate/push-gate-test.sh` — daemon implementation.
- `src/pages/admin/DashboardSection.tsx`, `src/services/admin-dashboard.service.ts`, `src/hooks/useAdminDashboard.ts`, `src/components/settings/TicketDetailDialog.tsx`, `src/components/admin/TicketEvidence.tsx`, `src/services/tickets.service.ts` — AdminTab and ticket UI implementation.
- `supabase/migrations/20260611200000_autopilot_queue_runner_state.sql`, `src/types/supabase.ts` — current DB schema/type surface.
- Environment probes: `node`, `npm`, `bun`, `supabase`, `launchctl`, `caffeinate`, `git`, `gh`, `codex`, `claude`, `df`, `launchctl list`.

### Secondary (MEDIUM confidence)
- CodeGraph context/status for repo orientation. CodeGraph was used for discovery only, not behavioral proof.
- Stale Graphify status: graph exists but is 441 commits behind, so not used as proof.

### Tertiary (LOW confidence)
- Assumptions listed above where exact run-ledger schema, replay artifact contract, and cost display semantics require implementation decisions.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all recommended surfaces are already installed and source-verified.
- Architecture: HIGH — grounded in local daemon and brain source; one MEDIUM gap around `runner_runs` migration provenance.
- Pitfalls: HIGH for ACT-05/06/07 blocker existence; MEDIUM for exact gate regex/replay contract details.
- External docs: not used; this phase is codebase-local and no new package/API adoption is recommended.

**Research date:** 2026-06-13
**Valid until:** 2026-07-13 for architecture; re-check live schema, daemon status, and package versions at planning/execution start.
