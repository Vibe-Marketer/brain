# Roadmap: CallVault v2.0 — Autonomous Operations

**Milestone:** v2.0 Autonomous Operations — Self-Healing CallVault
**Created:** 2026-06-13
**Granularity:** standard
**Phases:** 7 (Phase 17 → Phase 23)
**Coverage:** 25/25 v1 requirements mapped

> v1.0 Self-Serve Public Launch shipped 2026-06-12 (real phases 1–16; the full record lives in `MILESTONES.md`). v2.0 continues phase numbering from there: **Phases 17–23.** FEAT-01..03 are deferred to v2.1 and intentionally have no phase here.

## Core Value

Take the armed-but-idle Autopilot from "proven on fixtures" to a live, trusted self-healing operation that drives ticket rate *down* and customer experience *up* — bugs/errors found, debugged, and fixed autonomously at volume, with the human loop closed and every source accurately tracked.

## Build Order (converged from research)

Prove → measure → scale → broaden (QA, then Sentry) → recurrence → close-loop. All four researchers independently produced the same A→G sequence; FEAT (G) is deferred to v2.1. Safety is mechanical and per-run, so it is constant throughout — ordering is driven by trust accrual and attribution dependency, not by safety gating. Hard invariants held across every phase: **concurrency stays 1** (never a throughput lever), **net-new footprint ~0 npm packages + 1 secret** (`SENTRY_AUTH_TOKEN`, scope `event:write`), **no new queue engine / SDK / framework**.

## Phases

- [ ] **Phase 17: Activation + Per-Run Observability + Go-Live Hardening** — Kill switch off at low controlled volume; real tickets fixed end-to-end; the three go-live blockers landed
- [ ] **Phase 18: Source Attribution** — Every ticket carries its true origin; the QA `source:'manual'` mis-attribution bug is killed; AdminTab filters and measures by source
- [ ] **Phase 19: Throughput Scale-Up + Trust, Survival & Autonomy** — ~25–30 fixes/day via run-cap + cadence; survival metric, autonomy ladder, and canary regression-reopen make that volume livable
- [ ] **Phase 20: Nightly QA → Fixable Tickets + Flake Suppression** — Nightly QA files deduped `nightly_qa` tickets the loop fixes, with rerun-quarantine flake suppression co-shipped
- [ ] **Phase 21: Sentry Debug → Fix → Resolve** — Sentry errors auto-debugged, fixed, and written back as resolved only on a SHA-matched verified-stable deploy
- [ ] **Phase 22: Recurrence → Structural Fix** — Recurring ticket classes detected and escalated to structural fixes that kill the class, not the instance
- [ ] **Phase 23: Reporter Comms (In-App)** — In-app reporters get status, resolution summaries, and escalation messages — gated hard on `source=in-app-user`

## Phase Details

### Phase 17: Activation + Per-Run Observability + Go-Live Hardening
**Goal**: Turn the kill switch off and prove the autonomous fix loop holds up on real production tickets at low, controlled volume — with full per-run visibility and the three go-live blockers closed before any volume increase.
**Depends on**: Nothing (first phase of the milestone; the v1.0 daemon spine already exists at `~/dev/autopilot`, armed-but-idle)
**Requirements**: ACT-01, ACT-03, ACT-04, ACT-05, ACT-06, ACT-07
**Success Criteria** (what must be TRUE):
  1. A real production ticket is autonomously claimed, fixed, gate-approved, merged, and deploy-SHA-verified — the first real ticket the loop has ever resolved (kill switch off at low volume), with the run visible in AdminTab.
  2. Every autonomous run is visible in AdminTab with status, diff, test result, gate verdict, duration, and cost.
  3. An agent attempt to "fix" by deleting a test, weakening an assertion, or adding `.skip`/`.only` is mechanically blocked by the push-gate and the run fails the gate (go-live blocker, Pitfall 1).
  4. A fix claimed while `main` moves underneath it is rebased onto latest `origin/main`, has its repro replay re-run on the rebased state, and pushes serialized — no semantically-stale merge lands (go-live blocker, Pitfall 4).
  5. Rollback, commit-advance-by-exactly-one, and the denylist are demonstrated on live tickets, and sustained operation neither exhausts disk nor stalls on sleep (worktree reaper + disk guard + caffeinate, Pitfall 10).
**Plans**: TBD

### Phase 18: Source Attribution
**Goal**: Establish accurate per-origin attribution as the measurement substrate for everything downstream, and fix the central data-integrity bug where QA tickets are mis-stamped as manual user submissions.
**Depends on**: Phase 17 (so runs are observable; largely parallelizable with 17 but sequenced after for clean numbering)
**Requirements**: SRC-01, SRC-02, SRC-03
**Success Criteria** (what must be TRUE):
  1. Every new ticket carries its true origin — the `ticket_source` enum includes `nightly_qa` and `internal`, each intake path stamps the correct source, and the QA `source:'manual'` mis-attribution is gone.
  2. Watchdog/internal tickets stamp `internal`, and legacy rows back-fill to `unknown` (never `in-app-user`), so no operational ticket can later be mistaken for a customer report (Pitfall 7).
  3. An operator can filter and group tickets by source in AdminTab.
  4. Per-source metrics — volume, fix rate, and cycle time — are visible per origin.
**Plans**: 5 plans
Plans:
- [x] 18-01-PLAN.md — Add source enum values, targeted backfill, metrics RPC, live schema push, and regenerated types
- [x] 18-02-PLAN.md — Harden brain support-ticket source stamping and nullable system-ticket list handling
- [x] 18-03-PLAN.md — Fix autopilot watchdog and QA triage source stamps in the external daemon repo
- [x] 18-04-PLAN.md — Add plain-English source labels, source filter options, and Tickets grouping
- [x] 18-05-PLAN.md — Render per-source metrics in Dashboard and Tickets source mix
**UI hint**: yes

### Phase 19: Throughput Scale-Up + Trust, Survival & Autonomy
**Goal**: Raise daily fix throughput to ~25–30/day without raising concurrency, and ship the trust mechanisms — survival metric, autonomy ladder, canary regression-reopen — that make that volume livable instead of a human-approval bottleneck.
**Depends on**: Phase 17 (proven activation) + Phase 18 (attribution to measure against)
**Requirements**: ACT-02, TRU-01, TRU-02, TRU-03
**Success Criteria** (what must be TRUE):
  1. Daily fix throughput sustains ~25–30/day driven by `maxRunsPerWindow.maxRuns` + tightened cadence, with concurrency held at 1 and hard quiet-hours reserving headroom for Andrew's interactive Claude.
  2. A 30-day fix-survival rate is tracked per fix and per category, and it — not closure speed — is the primary success metric that gates promotion.
  3. A fix in a category with a proven survival track record auto-approves; a risky category stays manual; promotion requires a survival-rate gate plus an explicit admin event.
  4. A recent fix that introduced a regression is caught by canary re-test, and the originating ticket is reopened with attribution rather than spawning an unlinked new ticket.
  5. A subscription rate-limit hit is treated as a retryable defer (release claim, destroy worktree, back off), never logged as a failed fix (Pitfall 2).
**Plans**: TBD

### Phase 20: Nightly QA → Fixable Tickets + Flake Suppression
**Goal**: Wire the existing nightly QA crawler into the fixable-ticket path with correct attribution, and co-ship the flake suppression that keeps a flaky nightly from flooding the queue with junk.
**Depends on**: Phase 18 (the `nightly_qa` enum value) + Phase 19 (volume headroom and per-source budgeting)
**Requirements**: QA-01, QA-02, QA-03, QA-04
**Success Criteria** (what must be TRUE):
  1. The scheduled nightly QA run files findings as tickets via a new `ingest_qa_ticket` RPC stamped `source='nightly_qa'`, DB-deduped, with repro/replay evidence attached — not via the old manual `send-support-ticket` path.
  2. A finding that fails fewer than N reruns never tickets (rerun-quarantine), and a non-deterministic finding is routed to a human-triage lane instead of the autonomous fix lane (Pitfall 5 — damping co-ships).
  3. Autopilot addresses QA-sourced tickets in the same loop, severity-gated.
  4. A burst of QA churn cannot starve user or Sentry tickets — a per-source budget holds.
**Plans**: TBD

### Phase 21: Sentry Debug → Fix → Resolve
**Goal**: Add the enrichment-and-write-back layer on top of v1.0 Sentry ingestion — auto-debug errors into the fix loop and mark them resolved in Sentry, safely, only on a verified-stable deploy.
**Depends on**: Phase 17/19 (a working, observed, volume-tuned fix loop) + Phase 18 (attribution to measure Sentry cycle-time)
**Requirements**: SEN-03, SEN-04, SEN-05
**Success Criteria** (what must be TRUE):
  1. A Sentry error is auto-debugged via a gsd-debug-disciplined + Honcho-memory brief (session keyed by fingerprint) and routed into the autopilot fix loop.
  2. Error→ticket→fix→resolve cycle time is tracked with a resolve-ASAP target, severity boosts priority, and fingerprint dedup + debounce prevents transient-spike ticket storms.
  3. A new `sentry-resolve` Edge Function (holding the one new secret, `SENTRY_AUTH_TOKEN`, scope `event:write`) marks an issue resolved only on a SHA-matched verified-stable deploy.
  4. A per-fingerprint fix cap freezes the category (never global) and pages on oscillation rather than self-feeding a regression loop (Pitfall 3).
**Plans**: TBD

### Phase 22: Recurrence → Structural Fix
**Goal**: Turn a history of resolved tickets into the primary lever for driving ticket rate down — detect recurring classes and escalate them to structural fixes that kill the class rather than patching each instance.
**Depends on**: Phase 18 (clean attribution to cluster on) + a history of resolved tickets accrued from Phases 19/20/21
**Requirements**: REC-01, REC-02
**Success Criteria** (what must be TRUE):
  1. Recurring ticket classes are detected via fingerprint/category clustering across resolved tickets.
  2. A recurring class escalates to a structural-fix task that targets the class, not the instance.
  3. After a structural fix lands, the recurrence rate for that class is observably driven down (the class stops generating fresh tickets).
**Plans**: TBD

### Phase 23: Reporter Comms (In-App)
**Goal**: Close the human loop — give in-app reporters status, resolution summaries, and escalation messages — without ever messaging a customer about an error they never reported.
**Depends on**: Phase 18 (SRC) landing and verified first (hard dependency — comms gate on `source=in-app-user`); benefits from a steady resolving-ticket stream from Phases 19/20/21
**Requirements**: RSP-01, RSP-02, RSP-03
**Success Criteria** (what must be TRUE):
  1. A reporter receives an in-app status update when their ticket moves (received / in-progress / resolved) — fired only when `source=in-app-user`, so Sentry/QA/internal tickets stay customer-silent.
  2. An auto-generated, plain-English resolution summary is posted in-app on verified-stable deploy, passed through a default-deny content filter that redacts file paths, SHAs, stack traces, and the word "agent".
  3. When autopilot can't fix a ticket, the reporter gets a human-readable in-app escalation status — not silence (Pitfall 6 — hard-gated on `source=in-app-user`).
**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 17. Activation + Observability + Hardening | 3/5 | In Progress|  |
| 18. Source Attribution | 5/5 | In Progress|  |
| 19. Throughput + Trust/Survival/Autonomy | 2/5 | In Progress|  |
| 20. Nightly QA → Tickets + Flake Suppression | 0/0 | Not started | - |
| 21. Sentry Debug → Fix → Resolve | 0/0 | Not started | - |
| 22. Recurrence → Structural Fix | 0/0 | Not started | - |
| 23. Reporter Comms (In-App) | 0/0 | Not started | - |

## Coverage

✓ All 25 v1 requirements mapped to exactly one phase
✓ No orphaned requirements
✓ FEAT-01..03 correctly deferred to v2.1 (not in this roadmap)

| Phase | Requirements |
|-------|--------------|
| 17 | ACT-01, ACT-03, ACT-04, ACT-05, ACT-06, ACT-07 |
| 18 | SRC-01, SRC-02, SRC-03 |
| 19 | ACT-02, TRU-01, TRU-02, TRU-03 |
| 20 | QA-01, QA-02, QA-03, QA-04 |
| 21 | SEN-03, SEN-04, SEN-05 |
| 22 | REC-01, REC-02 |
| 23 | RSP-01, RSP-02, RSP-03 |

## Sequencing Constraints (binding)

**Hard ordering:**

1. **Phase 18 (SRC) BEFORE Phase 23 (RSP).** Hard dependency, not preference — reporter comms gate on `source=in-app-user`; sending comms before attribution is trustworthy emails customers about errors they never reported (Pitfall 6/7). Legacy rows must back-fill to `unknown`, never `in-app-user`.
2. **Phase 17 (activation + observability) BEFORE Phase 19 (volume).** You cannot tune or trust what you cannot see; per-run observability is the prerequisite for raising the run cap.
3. **Phase 18 (enum) BEFORE Phase 20 (QA).** The `nightly_qa` enum value is required before QA tickets can be told apart from manual ones.
4. **SEN/QA ship their damping in the same phase that wires the source.** Auto-ingestion without debounce (Phase 21) or rerun-quarantine (Phase 20) floods the queue the moment it turns on — damping is part of definition-of-done, not a follow-up.

**Soft ordering (preferred):**

- **Phase 18 can largely run in parallel with Phase 17** — sequenced after only for clean numbering.
- **Phase 22 (recurrence)** benefits from a history of resolved tickets accrued by Phases 19/20/21, so it lands after the sources are broadened.

**Invariant across all phases:**

- **Concurrency stays 1** — the atomic claim UPDATE is the atomicity boundary and per-run worktrees share a single clone that gets `git reset --hard` per run. Throughput scales via run-cap + cadence only. Never a perf knob.

## Constraints This Roadmap Must Respect

Binding rules from PROJECT.md, REQUIREMENTS.md, and research SUMMARY. Every phase plan must respect these:

- **Net-new dependency footprint ~0.** Zero new npm packages; exactly one new secret (`SENTRY_AUTH_TOKEN`, scope `event:write`). No new framework, queue engine (BullMQ/pg-boss/Temporal/Redis), or comms vendor — the Supabase claim-UPDATE IS the queue; Sentry resolve is a raw `fetch` PUT; comms reuse the existing `user_notifications` outbox + Resend `fetch` pattern.
- **Concurrency 1 is a load-bearing safety invariant**, never a throughput lever (raising it corrupts the shared-clone worktree base).
- **Direct-main workflow.** No feature branches, no PRs unless Andrew explicitly asks. Commit and push to `origin/main`.
- **Dispatcher daemon code lives OUTSIDE this repo** at `~/dev/autopilot/`; plan/verify steps for daemon work target that external path. Migrations, Edge Functions, and AdminTab UI live in `~/dev/brain`.
- **Postgres enum values are append-only** — `ticket_source` extension (`+nightly_qa`, `+internal`) is additive and safe; never rewrite or reorder existing values.
- **Source is immutable + audited once stamped**; RLS-regression suite must extend to `tickets`/`ticket_messages` for the attribution work.
- **Sentry resolve only on SHA-matched verified-stable deploy** + post-deploy quiet window — never resolve-on-merge (manufactures false-regression storms).
- **Reporter comms hard-gate on `source=in-app-user`** — Sentry/QA/internal tickets stay customer-silent; default-deny content filter redacts paths/SHAs/stack traces/"agent".
- **Push-gate is the only authority boundary**, deterministic and non-LLM; the test-integrity check is mechanical (block net test-deletion / assertion-weakening / `.skip`/`.only`).
- **All AI/LLM in Edge Functions** (constraint AI-02). Frontend AI usage banned.
- **`authenticateRequest(req, supabase, corsHeaders)` from `_shared/auth.ts`** for all Edge Function auth. Never inline.
- **Tech stack locked.** React 18 + Vite 5 + TanStack Query + Zustand v5 + Tailwind + shadcn/ui + Remix Icons + `motion/react`. npm only.
- **Brand: "AI-ready, not AI-powered".** Never positive "AI-powered" in UI copy.

## Research Flags

Phases likely needing deeper research during planning (`/gsd:plan-phase --research-phase`):
- **Phase 19 (throughput):** the subscription rate-limit ceiling at ~30/day is asserted, not measured — re-probe at target volume across a real 5h window; the cap may need to come down to protect Andrew's interactive use.
- **Phase 21 (Sentry):** three unproven items — (1) whether gsd-debug's systematic flow runs non-interactively inside the runner's single headless `claude` session or needs a distinct pass; (2) Honcho session lifecycle (creation, keying by fingerprint, resumption, cleanup); (3) exact Sentry resolve endpoint/token scope/project mapping verified against the live `ai-simple.sentry.io` org, plus confirming `issue_id`/`org_slug` are persisted at ingestion (write-back is impossible without them).

Standard-pattern phases (skip research-phase): Phase 18 (additive enum + ingest RPC), Phase 20 (re-attribution + RPC swap mirroring `ingest_sentry_ticket`), Phase 23 (existing Resend `fetch` + `user_notifications` outbox).

## Deferred to v2.1 (not in this roadmap)

- **FEAT-01/02/03 — Autonomous feature dev.** Highest blast radius, the only workstream with no deterministic oracle. Revisit once the bug-fix / Sentry / QA loop is trusted at volume; when built, it rides suggestion-lane (PR + admin approval) rails only, never the bug lane's auto-push.
- **RSP-04 — Multi-channel reporter comms** (email via Resend, then Telegram/SMS/push). In-app only this milestone.
- **TRU-04 — Per-category auto-approve at full scale** once a deep survival-rate history has accrued.
- **REC-03 — Recurrence→structural escalation across a large catalog** of recurring classes.

---
*Roadmap created: 2026-06-13 — v2.0 Autonomous Operations, Phases 17–23. Build order honors the converged research sequence (A→G; FEAT deferred to v2.1). v1.0 phases 1–16 recorded in MILESTONES.md.*
