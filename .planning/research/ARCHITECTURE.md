# Architecture Research — v2.0 Autonomous Operations (Self-Healing CallVault)

**Domain:** Self-healing autonomous-ops layer bolted onto a shipped B2B SaaS (Supabase + React + a Bun/launchd daemon)
**Researched:** 2026-06-12
**Confidence:** HIGH (grounded in the live daemon source at `~/dev/autopilot`, the deployed migrations, and the deployed Edge Functions — not training data)

> **Framing.** This is a SUBSEQUENT-milestone integration map, not a greenfield design. v1.0 already built and *armed* the machinery. The job of v2.0 is to **turn it on, raise the volume, broaden the sources, and close the human loop** — almost entirely by MODIFYING existing components and adding small, well-isolated NEW ones. Where I write "already exists," I read the actual file. The single most important finding: **far more is already built than the milestone brief implies** — nightly QA crawl+triage+ticket-filing is shipped and loaded in launchd; the on-demand QA poller is shipped; Sentry→ticket ingestion is shipped. The real v2.0 work is activation, attribution correctness, the Sentry-debug enrichment step, reporter comms, and feature-task intake.

---

## Standard Architecture

### System Overview (as-built, with v2.0 deltas marked)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  INTAKE SOURCES  (all converge on ONE tickets table)                       │
├──────────────────────────────────────────────────────────────────────────┤
│  in-app form        Sentry webhook       nightly QA crawl     watchdog     │
│  send-support-      sentry-webhook        qa/triage.ts          (tools-     │
│  ticket (EF)        (EF, HMAC-gated)      → send-support-       health)     │
│       │                   │                  ticket (EF)            │       │
│  source='manual'    source='sentry'       source='manual' ✗MIS-  source=   │
│                     ingest_sentry_         ATTRIBUTED (SRC gap) 'manual'    │
│                     ticket() RPC                                            │
└───────┬───────────────────┬──────────────────────┬─────────────────┬──────┘
        │                    │                       │                 │
        ▼                    ▼                       ▼                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  SUPABASE  (system of record — Postgres + RLS + Deno Edge Functions)       │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ tickets (status/severity/source enums, priority/urgent, attempts,   │  │
│  │   next_attempt_at, fingerprint UNIQUE, occurrence_count)            │  │
│  │ ticket_messages (thread)   ticket_events (append-only audit)        │  │
│  │ runner_state (singleton: kill_switch, heartbeat, current_ticket)    │  │
│  │ qa_runs (requested→running→completed/failed)   user_notifications   │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│  Edge Fns: send-support-ticket · sentry-webhook · ticket-approval          │
└───────┬─────────────────────────────────────────────────────────┬────────┘
        │ (service-role poll)                       (admin session) │
        ▼                                                           ▼
┌────────────────────────────────────┐          ┌─────────────────────────────┐
│  AUTOPILOT DAEMON PACK              │          │  FRONTEND (React 18 + Vite)  │
│  ~/dev/autopilot (Bun/TS, launchd) │          │  AdminTab (/admin)           │
│  ┌──────────────────────────────┐  │          │   TicketsSection             │
│  │ claimer.ts  (7-step cycle)   │  │          │   QaSection                  │
│  │  → runner.ts (worktree+claude)│ │          │   TicketDetailDialog         │
│  │  → push-gate.sh (non-LLM)    │  │          │  hooks: useTickets,          │
│  │  → approval.ts (merge+deploy)│  │          │   useQaRuns, useTicketApproval│
│  ├──────────────────────────────┤  │          │  services/*.service.ts       │
│  │ watchdog.ts  (heartbeat page)│  │          └─────────────────────────────┘
│  │ qa-poller.ts (on-demand crawl)│ │
│  └──────────────────────────────┘  │   launchd jobs (ALL loaded, verified):
│  gate/ (denylist, nightly-crawl.sh)│   com.callvault.autopilot (300s)
│  qa/ (triage.ts, fingerprints)     │   com.callvault.autopilot-watchdog
└────────────────────────────────────┘   com.callvault.qa-poller (60s)
                                          com.callvault.qa-nightly (03:30 daily)
```

### Component Responsibilities (as-built)

| Component | Owns | Implementation (verified path) |
|-----------|------|--------------------------------|
| `claimer.ts` | The 7-step poll cycle: guards → heartbeat → kill switch → stale sweep → approval-merge → budget guards → claim+run | `~/dev/autopilot/src/claimer.ts`; launchd `StartInterval 300`, single-pass-per-fire, lockdir concurrency 1 |
| `runner.ts` | Per-ticket fix: ephemeral worktree off `origin/main` → headless `claude -p` → verdict parse → vitest+build verify → commit (base+1) → push branch → codex REVIEW → evidence bundle → `awaiting_approval` | `src/runner.ts`. Ships NOTHING to main itself |
| `push-gate.sh` | Deterministic non-LLM authority boundary: kill switch (flag+DB, fail-closed) → commit-advance → denylist | `gate/push-gate.sh`. Exit 0/1/2 |
| `approval.ts` | The ONLY path to main: recognizes admin-authored `approval` events → rebase→gate→ff-merge→push→deploy-SHA verify→`resolved` | `src/lib/approval.ts` |
| `watchdog.ts` | Independent liveness pager + tools-health → deduped ticket | `src/watchdog.ts`, separate launchd job |
| `qa-poller.ts` | On-demand QA crawl: claims `qa_runs` `requested` rows, runs report-only crawler, writes results back | `src/qa-poller.ts`, launchd 60s. **Kill-switch EXEMPT** (read-only) |
| `qa/triage.ts` | Nightly: noise-filter crawl findings, dedup by fingerprint, **file tickets via `send-support-ticket`**, record `qa_runs` row | `qa/triage.ts`, run by `gate/nightly-crawl.sh` at 03:30 |
| `sentry-webhook` (EF) | HMAC-gated Sentry ingest → `ingest_sentry_ticket()` RPC (atomic upsert + dedup + notify) | `supabase/functions/sentry-webhook/` |
| `send-support-ticket` (EF) | Authenticated in-app intake → ticket + message + event + Resend email side-effect | `supabase/functions/send-support-ticket/` |
| `ticket-approval` (EF) | Dual-client admin-verified writer of `approval`/`rejection` events the daemon polls | `supabase/functions/ticket-approval/` |

---

## Workstream-by-Workstream Integration Map

Each section answers: **NEW vs MODIFIED**, the **integration point**, and the **data-flow change**.

### WS1 — Throughput scale-up (concurrency 1 → ~25–30 fixes/day)

**Where the guards live today (verified):**
- `autopilot.config.ts`: `concurrency: 1` (typed as literal `1`), `maxRunsPerWindow: { windowHours: 24, maxRuns: 12 }`, `quietHours: 01:00–07:00`, `watchdogBudgetSec: 2400`, `maxAttempts: 4`, backoff `15min × 4^attempts`.
- `claimer.ts` STEP 5 enforces the budget by counting `ts_start` lines in `logs/autopilot.jsonl` within the rolling window (`countRunsInWindow`). It counts **started** runs (spend guard, not success guard).

**The critical architectural fact:** concurrency is **NOT** the throughput lever, and raising it is the wrong move. Concurrency 1 is load-bearing — the atomic claim UPDATE (`eq(status,'new')`) and the **per-run worktree off a single shared clone** (`config.paths.cloneDir`) assume one writer. `runner.ts` does `git reset --hard` + `clean -fd` on the shared clone before every run; two concurrent runners would corrupt each other's worktree base. **Keep concurrency 1.**

**The actual lever is throughput-per-day = (cycle frequency) × (runs-per-cycle) × (budget cap).** Three MODIFICATIONS, zero new components:

1. **Raise `maxRunsPerWindow.maxRuns`** from 12 → ~28–30 (config-only). This is the headline knob. The brief's "~25–30/day" maps directly here.
2. **Raise per-invocation loop ceiling** — `claimer.ts` STEP 6 currently only loops within one launchd fire when the head-of-queue is *urgent* (`needsImmediateNext`). To hit volume on a 300s `StartInterval`, EITHER (a) shorten `pollIntervalSec` to ~120–180s (faster cycles, the boring choice), OR (b) generalize the loop to drain N non-urgent tickets per fire up to a per-fire cap. **Recommend (a) plus a small per-fire cap (e.g. 3)** — keeps the urgent-skips-cooldown semantics intact and bounds a single fire from running the subscription dry.
3. **Tune quiet hours / backoff for sustained operation** — with 30/day the 01:00–07:00 quiet window plus `15min × 4^attempts` backoff may starve the queue. Re-derive both against the real arrival rate once live.

**Data-flow change:** none structural. Same claim→run→gate→branch→approval path, just more passes per day. The budget guard already reads from the JSONL; no schema change.

**Cost/observability gap (ACT-04):** today per-run cost is **not** captured. `runner.ts` logs `claude_exit`, verdict, `changed_files`, `test_exit`, `fix_sha`, `codex_review` to `autopilot.jsonl` and writes `ticket_events` + `runner_state.last_result`, but no token/cost field. **NEW (small):** add a `cost`/`tokens` field to the JSONL line and to the evidence bundle, and surface duration/cost in the AdminTab run view. Headless `claude -p` doesn't bill per-call (subscription), so "cost" here is runtime + subscription-window budget consumption, not dollars — frame ACT-04 as **runtime + budget-utilization observability**, not billing.

**Safety under load:** unchanged and mechanical — gate, denylist, kill switch, watchdog are all per-run and volume-independent. This is exactly why raising volume is low-risk (Key Decision ACT-02).

### WS2 — Sentry autonomous debug→fix

**What already exists (verified):** the **entire ingestion half**. `sentry-webhook` (HMAC over raw body, `verify_jwt=false`, 512KB guard, fingerprint from `issue_id`, level→severity) → `ingest_sentry_ticket()` RPC (race-safe `ON CONFLICT` upsert on `idx_tickets_fingerprint_unique`, `occurrence_count++`, audit event, admin notify on critical/high). Sentry tickets land with `source='sentry'`, `reporter_id=NULL` (admin-only-visible by RLS construction), rich `context.sentry` (issue_url, culprit, release, environment).

**What v2.0 adds (the SEN workstream):** the **debug-enrichment step** between intake and the generic fix runner, plus **resolution write-back**.

- **SEN-03 (gsd-debug + Honcho enrichment) — NEW step, MODIFIED runner branch.** Today `runner.ts` composes a brief from ticket + messages and hands it straight to `claude -p`. Sentry tickets carry a stack trace / issue URL but no reproduction. Two options:
  - **(Recommended) Source-aware brief.** In `runner.ts`/`lib/brief.ts`, when `ticket.source==='sentry'`, prepend a debug-discipline preamble that instructs the headless agent to run the gsd-debug systematic flow (reproduce → root-cause → fix) and pull the Sentry issue context from `context.sentry.issue_url`. This is a **brief modification**, not a new daemon component — lowest blast radius, keeps the single fix engine.
  - **(Heavier) Pre-claim triage runner.** A separate "debug session" pass that opens a Honcho memory session keyed by fingerprint, accumulates cross-occurrence context, and writes an enriched repro artifact onto the ticket before the fix runner claims it. Only justified if single-pass debugging proves insufficient on real Sentry tickets. **Defer until evidence demands it.**
  - **Honcho integration point:** Honcho MCP is connected. The natural seam is a per-fingerprint debug session so recurring errors accumulate context across occurrences (`occurrence_count` already tracks recurrence). Store the Honcho session ref in `context.sentry.honcho_session` so the next occurrence's run resumes it. **NEW, small, additive to `context`.**

- **SEN-04 (cycle-time + dedup hardening) — MODIFIED.** `occurrence_count`/`last_seen_at` already exist; fingerprint dedup is DB-enforced. Cycle-time tracking is a **metrics read** over `ticket_events` (`created` → `resolved` timestamps), surfaced in AdminTab. "Resolve ASAP" = give Sentry tickets a queue boost: set `urgent=true` or high `priority` at ingest for critical/high. **Integration point:** `ingest_sentry_ticket()` RPC — add a priority/urgent assignment by severity (MODIFIED migration/RPC).

- **SEN-05 (write-back to Sentry on merge) — NEW.** On `approval.ts` reaching `resolved`, if `ticket.source==='sentry'`, call the Sentry API to mark the issue resolved. This needs a **Sentry API auth token** (the one genuinely new credential — already flagged in the ISA as the single new secret). **Cleanest seam:** a small **NEW Edge Function** `sentry-resolve` (service-role, reads `context.sentry.issue_id`, holds the Sentry token server-side) that `approval.ts` calls after deploy-SHA verification. Keeping the token in an Edge Function (not the daemon `.env`) matches the "secrets in Supabase, not the daemon" posture and means the write-back survives even if invoked from elsewhere.

**Data-flow change:** `Sentry → sentry-webhook → ingest RPC (now sets priority) → ticket → claimer → runner (source-aware brief + Honcho) → gate → approval → sentry-resolve EF → Sentry "resolved"`. The middle (claim/gate/approval) is **unchanged**.

### WS3 — Nightly QA → tickets → resolution

**What already exists (verified — this is mostly DONE):**
- `gate/nightly-crawl.sh` runs `scripts/qa/qa-crawler.ts` (in the brain repo) against production at **03:30 daily** via loaded launchd job `com.callvault.qa-nightly`, plus a signup e2e Playwright project.
- `qa/triage.ts` filters known noise (Sentry envelope aborts, crawler-induced `net::ERR_ABORTED`), dedupes against `known-fingerprints.json`, **files each new finding as a ticket via `send-support-ticket`**, and records a `qa_runs` summary row (`--record`).
- `qa-poller.ts` (loaded, 60s) services the on-demand "Request scan" button (`qa_runs` `requested` rows), kill-switch-exempt.
- Frontend `QaSection.tsx` + `useQaRuns` already render runs.

**So where the QA runner lives is ANSWERED: a separate launchd job (`com.callvault.qa-nightly`) running `nightly-crawl.sh` → `triage.ts`.** Not an Edge Function cron, not GitHub Actions — and that's the right call (it needs a logged-in browser session + the brain dev/prod target + service-role, all of which live on this Mac). Don't move it.

**The actual v2.0 gaps (MODIFICATIONS, not new infra):**
1. **Attribution bug (overlaps WS5).** `triage.ts` files via `send-support-ticket`, which **hard-codes `source:'manual'`** and requires a JWT (it uses a password grant for the test account). So **every QA-sourced ticket is currently mis-attributed as a manual user ticket** with `reporter_id` = the test account. This is the central SRC-01 defect. **Fix:** give QA findings a real `source='nightly_qa'` (see WS5) — which means triage must write through a **source-aware path**, either a new RPC like `ingest_sentry_ticket` (recommended — call it `ingest_qa_ticket`, service-role, fingerprint-deduped, sets `source='nightly_qa'`, `reporter_id=NULL`) or a `source` param added to `send-support-ticket`. **Recommend the dedicated RPC** — it mirrors the proven Sentry pattern, moves QA dedup into the DB (retiring the fragile file-based `known-fingerprints.json`), and avoids loosening the authenticated in-app intake function.
2. **Repro evidence (QA-02).** Findings already carry route + selector + message. To make them autopilot-fixable with replayable repro (ISC-110/118), the crawler should attach a **replay artifact** (the route + click path, or a screenshot/console buffer into the `ticket-attachments` bucket that already exists). **MODIFIED crawler + triage.**
3. **Autopilot addresses them (QA-03).** Once QA tickets have a real fixable `source` and land as `status='new'`, the existing claimer picks them up with **zero daemon changes** — they flow through the identical fix pipeline. The only nuance: QA findings are often low-severity/flaky; gate them by severity so the queue isn't flooded with `interaction`/`low` noise (triage already assigns severity by class).

**Data-flow change:** `nightly-crawl.sh → crawler → triage → ingest_qa_ticket RPC (source='nightly_qa', deduped) → ticket(new) → claimer → ... → approval`. Replaces the current `triage → send-support-ticket (source='manual')` mis-attribution.

### WS4 — Ticket response handling (reporter comms)

**What exists:** `ticket_messages` thread, `user_notifications` table (used by watchdog/approval paging), `send-support-ticket` already integrates Resend, `TicketDetailDialog` renders the thread. `runner.ts`/`approval.ts` already write agent messages and a final resolution note into `ticket_messages`. **So the agent already "talks" in-thread** — what's missing is **pushing that to the reporter** (status + email) and the escalation comms.

**Where the trigger should fire — the key architectural decision.** Three candidate seams:
- **DB trigger on `tickets.status` change** — fires on every transition automatically, can't be forgotten, but a trigger can't safely make an outbound HTTP call to Resend (and shouldn't). Use it only to **enqueue** a notification row.
- **Daemon step** — couples comms to the daemon's cadence and skips reporter-comms for Sentry/QA tickets (which have `reporter_id=NULL` anyway, so no reporter to email — correct).
- **Edge Function on status change** — the right outbound seam (it already does Resend in `send-support-ticket`).

**Recommended pattern (NEW, small):** **`user_notifications` as an outbox + a notification Edge Function.** The existing `ticket_status_audit` trigger already writes a `ticket_events` row on every status transition. Extend the model: a **NEW trigger** (or extend the audit trigger) inserts a `user_notifications` row addressed to `tickets.reporter_id` when status enters a reporter-relevant state (`in_progress`, `resolved`, `escalated`) **and `reporter_id IS NOT NULL`**. Then a **NEW `notify-reporter` Edge Function** (invoked by the daemon's approval pass, or a lightweight cron) drains unsent `user_notifications` for ticket events and sends Resend email + marks them sent. This reuses Resend, respects RLS (reporter-only-visible), and naturally **no-ops for Sentry/QA tickets** (NULL reporter).
- **RSP-01 (status updates):** trigger-driven outbox rows on transition.
- **RSP-02 (resolution summary):** `approval.ts` already composes a plain-English resolution note into `ticket_messages` — surface it in the outbox email body.
- **RSP-03 (escalation comms):** `runner.ts escalate()` already posts a plain-English "handed off, nothing for you to do" message. Add the reporter email via the same outbox so escalation isn't silence.

**Data-flow change:** `status transition → trigger → user_notifications (outbox) → notify-reporter EF → Resend → reporter`. Additive; no change to the fix pipeline.

### WS5 — Accurate source attribution

**Current schema (verified):** `ticket_source` enum = `('manual','sentry')` only. `send-support-ticket` forces `'manual'`; `ingest_sentry_ticket` sets `'sentry'`; the **watchdog also inserts `source:'manual'`** with `context.origin='autopilot-watchdog'` as a workaround; **QA tickets are mis-stamped `'manual'`** (WS3 bug).

**The fix (MODIFIED schema + each intake path):**
1. **Extend the enum** (NEW migration): `ALTER TYPE public.ticket_source ADD VALUE 'nightly_qa'; ADD VALUE 'internal';` (Postgres enum values are append-only — safe, no churn). Keep `'manual'` and `'sentry'`.
2. **Stamp each path:**
   - in-app form → `'manual'` (unchanged).
   - `sentry-webhook`/`ingest_sentry_ticket` → `'sentry'` (unchanged).
   - QA → `'nightly_qa'` via the new `ingest_qa_ticket` RPC (WS3).
   - watchdog tools-health + any Andrew-queued task → `'internal'` (MODIFIED watchdog insert; also the feature-task intake in WS6).
3. **AdminTab filtering (SRC-02) — MODIFIED frontend.** `useTickets`/`TicketsSection` already query tickets; add a `source` filter/group control and a column. `tickets.service.ts` adds a `.eq('source', …)` filter. Pure UI + service change.
4. **Per-source metrics (SRC-03) — NEW read.** A metrics query/view over `tickets` × `ticket_events` grouped by `source` (volume, fix rate = resolved/total, cycle time = resolved_at − created_at). Surface in AdminTab. Can be a Postgres view or a service-layer aggregation.

**Why this precedes WS2/WS3 broadening:** if you broaden sources *before* attribution is correct, you can't measure which source is producing value, and you bury the QA/Sentry signal under "manual." Attribution is the measurement substrate for everything else. **Build it early.**

### WS6 — Autonomous feature dev

**What exists:** `ticket_type` enum already includes `'task'` (alongside `bug`/`suggestion`/`question`). The claimer's selection is type-agnostic — it claims any `status='new'` ticket. So **feature tasks can enter the SAME queue today** by inserting a `type='task'` (or `'suggestion'`) ticket.

**Isolation/risk differences from bug-fixes:**
- **Bigger blast radius.** Feature work touches more files and is more likely to hit the denylist (migrations, RLS, auth, billing). The push-gate already **mechanically diverts** denylist-touching diffs (exit 1) and the runner escalates `DIVERT` verdicts. So features that need schema changes route to human/agent handoff automatically — **no new safety needed**, the existing gate handles it.
- **Verification is weaker for net-new code.** Bug fixes have a repro to replay; features don't. This is the real gap → **FEAT-02 test-gen step.**

**FEAT-01/02/03 mapping:**
- **FEAT-03 (intake) — NEW, small.** "How Andrew queues a feature." Cleanest: a **NEW Edge Function `queue-task`** (admin-verified, dual-client like `ticket-approval`) that inserts a `type='task'`, `source='internal'` ticket with the feature spec in `context` + first `ticket_message`. Or simply an AdminTab "New task" form reusing `send-support-ticket` with `type='task'`. **Recommend the AdminTab form** — reuses intake, lowest new surface.
- **FEAT-01 (extend loop beyond bug-fix) — MODIFIED brief.** `lib/brief.ts` needs a **task-flavored brief** (build/optimize, not reproduce/fix) when `type==='task'`. The verdict vocabulary (`FIXED`/`ESCALATE`/`DIVERT`) generalizes (`FIXED` = "implemented"). Source-aware brief, same engine.
- **FEAT-02 (test-gen) — MODIFIED runner.** For tasks, require the agent to add tests; the existing `vitest + build` gate then verifies them. Strengthen: assert the diff includes new/changed test files for `type='task'` before allowing `awaiting_approval` (mirrors ISC-48's regression-test requirement for bugs). This is a **runner verification-rule addition**, not new infra.
- **Approval is unchanged** — features ship only via the same admin `approval` event → `approval.ts` merge path. Higher-risk work simply stays held until Andrew approves, which is exactly the v1 design intent for the suggestion lane.

**Data-flow change:** `AdminTab task form → ticket(type=task, source=internal, new) → claimer → runner (task brief + test-gen requirement) → gate (denylist diverts schema work) → awaiting_approval → admin approval → merge`. Reuses the entire spine.

---

## Recommended Project Structure (deltas only — most files exist)

```
~/dev/autopilot/                       # daemon pack — MODIFY, don't restructure
├── autopilot.config.ts                # MODIFY: maxRuns 12→~30, pollInterval, per-fire cap
├── src/
│   ├── claimer.ts                     # MODIFY: STEP 6 drain-N-per-fire cap (WS1)
│   ├── runner.ts                      # MODIFY: source/type-aware brief, cost log, test-gen rule
│   ├── lib/brief.ts                   # MODIFY: sentry-debug + task variants
│   ├── lib/approval.ts                # MODIFY: call sentry-resolve EF on resolve (WS2)
│   └── qa-poller.ts / watchdog.ts     # MODIFY watchdog source→'internal'
├── qa/triage.ts                       # MODIFY: file via ingest_qa_ticket RPC, attach repro
└── gate/nightly-crawl.sh              # keep (loaded launchd job)

~/dev/brain/supabase/
├── migrations/
│   ├── 2026…_extend_ticket_source.sql        # NEW: enum += nightly_qa, internal
│   ├── 2026…_ingest_qa_ticket_rpc.sql        # NEW: source-aware QA RPC (mirror sentry)
│   ├── 2026…_reporter_notify_outbox.sql      # NEW: status-change → user_notifications trigger
│   └── 2026…_sentry_priority_on_ingest.sql   # MODIFY ingest_sentry_ticket (priority/urgent)
└── functions/
    ├── sentry-resolve/                # NEW: write-back to Sentry on resolve (holds Sentry token)
    ├── notify-reporter/              # NEW: drain outbox → Resend (RSP)
    └── send-support-ticket/          # keep; maybe accept type=task from AdminTab

~/dev/brain/src/pages/admin/
├── TicketsSection.tsx                 # MODIFY: source filter/column, run cost/duration view
├── QaSection.tsx                      # keep
└── (new) TaskQueueForm                # NEW small: queue a feature task (FEAT-03)
```

---

## Architectural Patterns (the load-bearing ones to preserve)

### Pattern 1: One tickets table, many sources, daemon is source-agnostic
**What:** Every intake path (in-app, Sentry, QA, watchdog, feature task) converges on `tickets` with a `source` stamp; the claimer claims any `status='new'` row regardless of source.
**Why it matters:** broadening sources (WS2/3/6) requires **zero changes to the claim/gate/approval spine** — you only add an intake path that writes a correctly-stamped ticket. This is the single most important structural property; don't violate it by special-casing sources in the daemon core.
**Trade-off:** source-specific behavior (debug enrichment, task test-gen) must live in the **brief**, not in claim/gate logic.

### Pattern 2: Atomic conditional-UPDATE claim + concurrency 1 + shared clone
**What:** `update(status:'in_progress').eq('status','new')` is the atomicity boundary; one worktree off one shared clone.
**When to use:** unchanged. **Trade-off:** caps to one writer — which is why **throughput scales via budget/cadence, not concurrency.** Treat concurrency 1 as invariant.

### Pattern 3: Deterministic non-LLM gate as the only authority boundary
**What:** `push-gate.sh` (kill switch fail-closed → commit-advance → denylist) is the mechanical boundary; the agent can never push to main, only to a held branch; merge requires an admin-authored `approval` event with a non-NULL ADMIN `actor_id`.
**Why it matters for v2.0:** raising volume and adding sources does **not** weaken safety because the boundary is per-run and agent-independent. Feature work's larger blast radius is contained by the same denylist (schema/RLS/auth/billing diverts automatically).
**Trade-off:** anything touching denylisted paths can't auto-ship — accepted, it routes to human/agent handoff.

### Pattern 4: SECURITY DEFINER ingest RPC + DB-enforced fingerprint dedup
**What:** `ingest_sentry_ticket()` does upsert + audit + notify atomically, dedup via partial unique index + `ON CONFLICT`. **Reuse this for QA** (`ingest_qa_ticket`) instead of file-based `known-fingerprints.json`.
**Trade-off:** moves QA dedup state from a daemon file into the DB — more robust, slightly more migration work.

### Pattern 5: user_notifications as an outbox; Edge Function does outbound
**What:** triggers/daemon enqueue notification rows; an Edge Function drains them and calls Resend. Already the de-facto paging pattern (watchdog/approval). Generalize it for reporter comms.
**Trade-off:** eventual (poll-driven) delivery rather than synchronous — fine for support comms.

---

## Data Flow — the four new/changed end-to-end paths

```
WS2 Sentry self-heal:
  Sentry issue ─HMAC→ sentry-webhook ─→ ingest_sentry_ticket() [+priority]
    └→ tickets(source=sentry, NULL reporter, new)
       └→ claimer ─→ runner [source-aware brief + Honcho session by fingerprint]
          └→ vitest+build ─→ push-gate ─→ held branch ─→ awaiting_approval
             └→ admin approval ─→ approval.ts merge+deploy-SHA
                └→ sentry-resolve EF ─→ Sentry "resolved"

WS3 Nightly QA self-heal:
  03:30 launchd ─→ nightly-crawl.sh ─→ qa-crawler ─→ triage.ts
    └→ ingest_qa_ticket() [source=nightly_qa, fingerprint dedup, repro artifact]
       └→ tickets(new) ─→ [identical fix spine] ─→ approval

WS4 Reporter comms:
  tickets.status change ─→ audit/notify trigger ─→ user_notifications(outbox, if reporter_id NOT NULL)
    └→ notify-reporter EF (drain) ─→ Resend ─→ reporter email

WS6 Feature task:
  AdminTab task form ─→ ticket(type=task, source=internal, new)
    └→ claimer ─→ runner [task brief + REQUIRE test diff] ─→ gate [schema→DIVERT]
       └→ awaiting_approval ─→ admin approval ─→ merge
```

---

## Scalability Considerations

| Concern | At ~12/day (today) | At ~30/day (ACT-02 target) | Beyond |
|---|---|---|---|
| Subscription rate limits | budget cap 12, quiet hours | raise cap to ~30; watch `detectRateLimit` in transcripts; back off if rate-limit suspected | the hard ceiling — subscription, not concurrency, is the wall |
| Worktree/clone contention | concurrency 1, no contention | unchanged — keep concurrency 1; faster cadence not more writers | if ever needed, multiple clones (not multiple worktrees on one clone) |
| Approval bottleneck (Andrew) | manual approve in AdminTab | **this becomes the throttle at 30/day** — consider an auto-approve rung for low-risk categories (ui-copy) per the ISA ladder (ISC-100/111), promotion admin-gated | category autonomy ladder |
| QA ticket flood | nightly, deduped | severity-gate which QA findings enter the fix queue; keep `interaction/low` report-only | sample/prioritize routes |
| DB load | trivial | trivial — ticket volume is tiny vs the app's recording tables | n/a |

**The real scaling bottleneck at 30/day is human approval, not machinery.** Flag this for the roadmap: ACT-02's volume target will surface the approval throttle, which is the natural trigger for the ISA's category-autonomy ladder (out of scope to build now, but the metrics from WS5 are its prerequisite).

---

## Suggested BUILD ORDER (dependency-aware)

The brief's hypothesis — **safety/activation + attribution precede broadening** — is correct. Refined against the as-built reality (much is already done):

**Phase A — Activation & observability (WS1 + ACT-04).** Turn the loop on at low-but-real volume; add run cost/duration to the JSONL + evidence + AdminTab. *Why first:* proves safety on real traffic before raising volume; observability is needed to tune everything downstream. Pure config + small logging changes. **Depends on:** nothing.

**Phase B — Source attribution (WS5).** Extend the `ticket_source` enum (`nightly_qa`, `internal`), fix the watchdog stamp, add the AdminTab source filter + per-source metrics view. *Why second:* it's the measurement substrate. You cannot evaluate WS2/WS3/WS6 value without correct attribution, and the QA-attribution bug must be fixed before QA tickets can be told apart from manual ones. **Depends on:** A (so runs are observable) — but can largely parallelize with A.

**Phase C — Throughput scale-up to ~30/day (WS1 ACT-02/03).** Raise `maxRuns`, tune cadence/quiet-hours/backoff, prove rollback + blast-radius + denylist under sustained load. *Why third:* only raise volume once activation is proven (A) and you can attribute/measure the output (B). **Depends on:** A, B.

**Phase D — Nightly QA → fixable tickets (WS3).** Swap triage from `send-support-ticket`(manual) to `ingest_qa_ticket`(nightly_qa, deduped), attach repro artifacts, severity-gate which findings enter the fix queue. *Why here:* the crawl/triage/launchd infra already exists; this is mostly a re-attribution + RPC swap, unlocked by B's enum. **Depends on:** B (enum), C (volume headroom for QA tickets).

**Phase E — Sentry debug→fix→resolve (WS2).** Source-aware debug brief + Honcho session keying; `ingest_sentry_ticket` priority boost; NEW `sentry-resolve` EF for write-back (needs the Sentry API token). *Why here:* ingestion is already live; this is the enrichment + write-back layer. The one new credential is isolated to one new EF. **Depends on:** A/C (a working, observed fix loop), B (attribution to measure Sentry cycle-time).

**Phase F — Reporter comms (WS4).** Status-change outbox trigger + NEW `notify-reporter` EF (Resend). *Why later:* it closes the human loop but doesn't affect fix throughput; it benefits from real resolved tickets to send summaries about. No-ops cleanly for Sentry/QA (NULL reporter). **Depends on:** a steady stream of resolving tickets (C/D/E).

**Phase G — Autonomous feature dev (WS6).** AdminTab task intake (`type=task`, `source=internal`), task-flavored brief, test-gen requirement in the runner. *Why last:* highest blast radius, weakest auto-verification, and most dependent on the fix engine being trusted under load. The denylist already contains its risk; build it once the loop is demonstrably reliable. **Depends on:** A–C (trusted loop), B (internal attribution), F optional.

**Ordering rationale in one line:** *prove it works (A) → make it measurable (B) → make it fast (C) → point it at more bug sources (D, E) → close the human loop (F) → point it at feature work (G).* Safety is constant throughout because it's mechanical and per-run.

---

## Gaps / Open Questions for phase-level research

- **Subscription rate-limit ceiling at 30/day** is asserted, not measured. The Spike (ISC-115) validated the entitlement at low volume; Phase C must re-probe at target volume and may need to back the number down. **Flag Phase C for deeper research.**
- **gsd-debug invocation from headless `claude -p`** — whether the systematic debugger flow can be driven non-interactively inside the runner's single agent session, or needs a distinct pass, is unproven on real Sentry tickets. **Flag Phase E.**
- **Honcho session lifecycle** (creation, keying by fingerprint, resumption across occurrences, cleanup) needs a concrete design — MCP availability ≠ a worked-out memory schema. **Flag Phase E.**
- **Sentry API resolve scope/token** — exact endpoint, token scope, and project mapping (`context.sentry.project='call-vault'`) need verifying against the live Sentry org (`ai-simple.sentry.io`). **Flag Phase E.**
- **Approval-throttle / category ladder** — at 30/day Andrew's manual approval is the bottleneck; whether to introduce a low-risk auto-approve rung (and its safety design) is a real decision the WS5 metrics should inform. **Out of scope now; flag for a follow-on.**

## Sources

- Live daemon source (HIGH): `~/dev/autopilot/{autopilot.config.ts, src/claimer.ts, src/runner.ts, src/lib/claim.ts, src/lib/approval.ts, src/watchdog.ts, src/qa-poller.ts, qa/triage.ts, gate/push-gate.sh, gate/nightly-crawl.sh}`
- Live migrations (HIGH): `supabase/migrations/{20260611000002_create_ticket_tables, 20260611200000_autopilot_queue_runner_state, 20260612130000_sentry_ticket_ingestion, 20260613130000_qa_runs_request_queue}.sql`
- Live Edge Functions (HIGH): `supabase/functions/{send-support-ticket, sentry-webhook, ticket-approval}/index.ts`
- Loaded launchd jobs (HIGH, `launchctl list`): `com.callvault.{autopilot, autopilot-watchdog, qa-poller, qa-nightly}`
- Frontend surface (HIGH, file listing): `src/pages/admin/{TicketsSection, QaSection}.tsx`, `src/components/settings/TicketDetailDialog.tsx`, `src/{hooks,services}/*ticket*/*qa*`
- Planning context (HIGH): `.planning/PROJECT.md`, `~/.claude/PAI/MEMORY/WORK/20260610-autonomous-admin-center/ISA.md`
