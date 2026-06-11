# Phase 13: Dispatcher + Mechanical Safety - Context

**Gathered:** 2026-06-11
**Status:** Ready for planning

<domain>
## Phase Boundary

The production autonomous-fix loop: a daemon pack at `~/dev/autopilot/` (OUTSIDE this repo, bun+TS) that claims tickets from the live `tickets` table, runs headless `claude` fix runs in per-run git worktrees, writes evidence back to the ticket, and holds every change behind a deterministic non-LLM push-gate until an explicit admin approval event (or, later, an earned auto-ship rung). Requirements: AUTO-01..06. Spike verdict: GO, 5/5 (SPIKE-VERDICT.md). Phase 14 builds the approval/ops UI on the events this phase emits.

</domain>

<decisions>
## Implementation Decisions (all on record — sources cited)

### Queue, priority, and urgency (Andrew, 2026-06-11)
- New migration: `tickets.priority` integer (default 0) + `tickets.urgent` boolean (default false). Claim order: `urgent DESC, priority DESC, severity rank, created_at ASC`.
- **URGENT lane:** an urgent ticket is claimed next regardless of anything else; if a non-urgent run is in flight, the dispatcher does NOT kill it (in-flight work completes or times out) but skips any queue cooldown and takes the urgent ticket immediately after. Admin sets urgent via the UI (Phase 14) or directly (column is admin-writable via RLS).
- Admin can reorder the queue by editing `priority` (Phase 14 exposes drag/quick-set; RLS: only ADMIN may update priority/urgent).

### Runner status visibility (Andrew, 2026-06-11)
- New table `runner_state` (single row or per-runner): status idle|claiming|running|awaiting_gate, current_ticket_id, run_started_at, last_heartbeat, last_result, kill_switch boolean. Dispatcher updates it every poll cycle and at run transitions.
- Phase 14 renders it as a live status card in AdminTab (port the dead branch's runner-heartbeat + "Needs You" patterns — see assessment report); heartbeat staleness ⇒ visible "runner offline" state. Until Phase 14 lands, status is readable via the table directly.

### Daemon pack (ISA ISC-104..120 as revised; Advisor + Cato reconciliation; SPIKE-VERDICT ISC-116)
- Four separated concerns at `~/dev/autopilot/`: (1) claimer/spawner, (2) per-run worktree runner, (3) deterministic push-gate script (non-LLM), (4) independent watchdog. launchd LaunchAgent in admin's gui session (proven in spike).
- Machine-level isolation per Andrew's explicit decision (no dedicated macOS user); per-run ephemeral `git worktree` from a dedicated clone — never `~/dev/brain` live checkout; worktree destroyed after run.
- Claim = conditional UPDATE (status eq guard) + attempts + next_attempt_at exponential backoff (15min × 4^attempts) + stale-claim sweep returning orphaned in_progress tickets (steal-list #3).
- Run protocol: `env -u CLAUDECODE claude -p <brief> --dangerously-skip-permissions`, 2400s watchdog kill, `git reset/clean BEFORE checkout` (spike learning #3). Ticket text is DATA — brief template instructs containment; mechanical gates are the real control.
- NOTES.md no-changes protocol: agent writes NOTES.md when it cannot fix → dispatcher maps to escalated/awaiting_user with notes posted to the thread (steal-list #4). ESCALATE/DIVERT verdict vocabulary from the spike dispatcher carries over.
- Commit-advance assertion in the gate: a fix exists only if HEAD advanced over base (steal-list #2). Argv-allowlist for any configurable agent command — tokenize, allowlist binaries, regex-validate flags, execFile (steal-list #1).

### Ship policy (v1 — trust window per Andrew's accepted recommendation)
- v1 ships NOTHING autonomously: every fix ends as a held branch + evidence bundle + status awaiting_approval. Approval = explicit admin-authored `approval` row in ticket_events (ISA ISC-66); only then does the dispatcher merge/push. Auto-ship rungs come later via the ladder with admin-gated promotion (ISC-111) — not in this phase.
- Push-gate denylist regardless of lane: supabase/migrations/**, RLS/auth/billing paths, .github/**, package-lock; gate re-checks kill switch immediately pre-push (ISC-107/108).
- Cross-vendor gate (Andrew's mandate, 2026-06-11): every fix diff gets a `codex exec --sandbox read-only` review before it can be approved-merged; review verdict attached to the evidence bundle. Claude writes, codex referees, the script holds the keys.

### Evidence bundle (per run, written to ticket_messages as author_type='agent')
- Diff summary, test output tail, repro-replay result where an artifact exists (ISC-110), codex review verdict, deploy-SHA check after any merge (ISC-112). Resolution note (symptom/root-cause/fix-commit) stored for the fingerprint — compounding knowledge base (steal-list #6, lightweight v1: a resolution_note column or message convention).

### Ops
- Kill switch: `runner_state.kill_switch` (DB) + local flag file — either halts claiming within one poll cycle; gate re-check covers in-flight pre-push.
- Watchdog: separate launchd job; pages on heartbeat staleness via `user_notifications` INSERT + macOS notification; also runs `/Users/admin/dev/autopilot-tools-health.sh` and reports failures as tickets.
- Subscription budget: configurable quiet hours + max-runs-per-window in autopilot config; concurrency 1.
- Sentry-sourced tickets (Phase 12) flow through the same queue once that phase executes (needs Andrew's Sentry token).

### Claude's Discretion
- TS structure of the daemon pack, config file shape, poll intervals, log format
- Exact worktree base management (dedicated clone location, fetch cadence)
- How the codex review is prompted (use the proven direct `codex exec` pattern, not the Cato wrapper)

</decisions>

<code_context>
## Existing Code Insights

### Reusable assets
- Live schema: tickets/ticket_messages/ticket_events with RLS + append-only events + audit trigger (11-02), hardened in 11-05 (author_type policy: 'agent' is service-role-only — the dispatcher writes messages via service-role, which is correct)
- Spike harness design (DESIGN only — DO-NOT-PROMOTE contract): dispatcher loop shape, soak.jsonl log schema, judging fields (verdict/changed_files/migrations_touched/test_exit/rate_limit_suspected)
- Dead-branch reference code (git show worktree-admin-center): atomic claim implementation, stale-claim sweep, NOTES.md protocol, change-class classifier, daily-digest aggregates — port patterns, rebind to live schema
- `/Users/admin/dev/autopilot-tools-health.sh` — watchdog subroutine
- PAI headless-claude spawn pattern; `gh` CLI authed as Vibe-Marketer

### Constraints
- Daemon pack: bun+TS allowed (outside repo). Repo-side artifacts (migration for priority/urgent/runner_state, RLS) follow npm/supabase conventions; `supabase db push` works again (history reconciled)
- `npm run type-check` is hollow (ticket 3d68d1cd) — gates must use vitest/build/eslint + scoped tsc
- ticket_events INSERT is service-role-only by policy for agent rows

### Integration points
- Phase 14 consumes: runner_state table, approval-event contract, evidence-bundle message format, priority/urgent columns
- Phase 12 (when token provided) feeds the same queue

</code_context>

<specifics>
## Specific Ideas

- First real workload is already queued: 11 open tickets incl. /people-class fixes, dead-code batch (092deb91), stale-deploy chunk recovery (5df3d2c3, high), type-check baseline (3d68d1cd)
- E2E proof for this phase: one REAL ticket (suggest 1deaa9b7, the AbortError console-noise low-risk fix) flows ticket→claim→fix→evidence→codex review→admin approval→merge→deploy-SHA verify with zero manual steps besides the approval click
- Realism note from spike: production tickets carry no fixture tells; do not calibrate difficulty off spike success

</specifics>

<deferred>
## Deferred Ideas

- Per-category autonomy ladder + auto-ship rungs (AP-V2-03 / ISA ISC-100..103) — after trust window
- resolution_notes as a first-class table feeding investigation briefs — v1 uses message convention
- Daily digest (port from dead branch) — Phase 14+
</deferred>
