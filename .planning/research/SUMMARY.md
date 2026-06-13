# Project Research Summary

**Project:** CallVault v2.0 — Autonomous Operations (Self-Healing CallVault)
**Domain:** Solo-operator, Mac-hosted autonomous code-fix daemon (launchd + Bun/TS) + Supabase backend + headless `claude` (subscription-billed), broadened across Sentry triage, nightly QA, reporter comms, source attribution, and feature dev
**Researched:** 2026-06-12
**Confidence:** HIGH

## Executive Summary

CallVault v2.0 is **not a build-new milestone — it is an activate, attribute, tune, and broaden milestone.** v1.0 already shipped the hard parts: the `~/dev/autopilot` Bun/launchd daemon pack (atomic-claim queue, ephemeral worktrees off a single shared clone, deterministic non-LLM push-gate, denylist, watchdog, kill switch, codex post-fix review, evidence bundles), the Sentry **ingestion** webhook + `ingest_sentry_ticket` RPC, the approval→merge→deploy-SHA-verify path, the nightly QA crawler + triage (`com.callvault.qa-nightly`, 03:30 daily, already loaded), the on-demand QA poller, and the Resend email integration (raw `fetch`). All four researchers converged independently on the same conclusion: the v2.0 workstreams resolve almost entirely to (a) config-knob changes, (b) a handful of new DB columns / one enum extension, (c) prompt/brief composition, and (d) exactly ONE new outbound HTTP call (Sentry resolution write-back). **Net-new dependency footprint: zero new npm packages, one new secret (`SENTRY_AUTH_TOKEN`, scope `event:write`).** The correct posture is to resist every temptation to add a framework, a queue engine, or a comms vendor.

The recommended approach follows a strict dependency-aware order: **prove it works (activate at low real volume + per-run observability) → make it measurable (source attribution) → make it fast (throughput scale-up) → point it at more bug sources (nightly QA re-attribution, then Sentry debug→fix→resolve) → close the human loop (reporter comms) → point it at feature work (suggestion-lane only).** Throughput to ~25–30 fixes/day is reached by raising `maxRunsPerWindow.maxRuns` (12→~30) and tightening cadence — **NOT by raising concurrency.** Concurrency 1 is a load-bearing safety invariant: the atomic claim UPDATE is the atomicity boundary and per-run worktrees share a single clone that gets `git reset --hard` before each run; two concurrent runners corrupt each other's base. The central data-integrity bug to fix first: nightly QA triage files tickets via `send-support-ticket`, which hard-codes `source:'manual'`, and the `ticket_source` enum only contains `('manual','sentry')` — so every QA ticket is currently mis-attributed as a manual user submission. SRC-01 is small, foundational, and must precede broadening and reporter comms.

The key risk is that the existing safety boundary was tuned for an **idle, single-run, fixture-only posture** and has never been exercised at volume on real production tickets. Five go-live blockers the idle posture never stressed: (1) no test-integrity check in the push-gate — the agent's cheapest path to green is to delete/weaken tests, and test files are NOT on the denylist; (2) subscription rate-limit budget bites in tokens-per-5h-window and concurrent bootstraps, competing with Andrew's own interactive Claude; (3) no rebase-before-push — at volume `main` moves between claim and push, producing semantically-stale merges; (4) Sentry resolve-on-merge manufactures false-regression ticket storms (must be resolve-on-SHA-matched-verified-stable-deploy with a post-deploy quiet window); (5) reporter comms must be hard-gated on `source=in-app-user` or they email paying customers about Sentry/QA errors those customers never reported. Mitigation is sequencing: ACT hardens first, SRC precedes RSP, SEN/QA ship their damping in the same phase that wires the source, and FEAT ships last on suggestion-lane rails with no auto-push.

## Key Findings

### Recommended Stack

The entire milestone needs almost no new stack — see `STACK.md`. Every core technology is already present and proven: Bun + TypeScript daemon runtime, `@supabase/supabase-js@^2.84` (opportunistic bump to `^2.108`, no breaking change), headless `claude -p` as the fix engine, `codex exec` for post-fix review, Playwright `1.57` for QA crawl + verification, and Resend via raw `fetch`. Scheduling is launchd (already runs four jobs) — **not** GitHub Actions (can't reach an authenticated local target, splits ops off the daemon host) and **not** cron (no wake handling). The only genuinely new external surface is a Sentry Organization Auth Token for the resolution write-back, held server-side in a new Edge Function.

**Core technologies:**
- **Bun + TypeScript daemon (`~/dev/autopilot`)**: the fix engine host — already proven 5/5 on fixtures; v2.0 is config + small logging deltas, no restructure.
- **`@supabase/supabase-js@^2.x`**: the DB-backed queue, `runner_state`, `ticket_events`, RLS-scoped writes — the claim-UPDATE IS the queue; do not add BullMQ/pg-boss/Temporal.
- **Sentry Web API (REST `/api/0/`, no SDK)**: one `PUT` to mark an issue resolved on verified deploy — raw `fetch` matching the existing webhook pattern; `@sentry/node`/`@sentry/cli` are unneeded weight.
- **launchd**: schedules dispatcher, qa-poller, watchdog, AND nightly QA on the one always-on Mac.
- **gsd-debug skill + Honcho MCP**: agent-side, reached by the headless `claude` in-brief — zero daemon dependency, already on the machine.
- **Resend (raw `fetch`)**: reporter comms reuse the exact existing `send-support-ticket` pattern — no `resend` SDK, no Twilio/SendGrid/Telegram.

### Expected Features

See `FEATURES.md`. The loop is armed-but-idle (kill switch ON, zero real tickets claimed); v2.0 turns it on and makes it trustworthy across six workstreams (ACT / SEN / QA / RSP / SRC / FEAT).

**Must have (table stakes):**
- **ACT-04 per-run observability** — status/diff/tests/gate-verdict/duration/cost in AdminTab; you cannot trust what you can't see (prerequisite for going live).
- **ACT-01 go-live + ACT-03 rollback/blast-radius proven on live tickets** — the actual milestone unlock; mechanisms exist, prove them on real traffic.
- **SRC-01 accurate source attribution** — foundational; stop the data-integrity bug before more sources feed in.
- **SEN-03 Sentry auto-debug→fix + SEN-05 resolve write-back** — first new source, highest-volume real input.
- **QA-01/02 nightly QA + flake suppression (rerun-quarantine)** — flake suppression MUST co-ship; a flaky nightly that files junk tickets is net-negative.
- **RSP-01/02 reporter status notifications + resolution summary (in-app)** — close the human loop so CX goes up, not just the code.

**Should have (competitive differentiators):**
- **30-day fix-survival as the primary metric** (not closure speed) — makes the loop a learning engine, not a patch-mill. Almost nobody does this.
- **Per-category autonomy ladder** — the mechanism that makes 25–30/day safe; run hot on safe categories, conservative on risky ones.
- **Recurrence → structural-fix escalation** — kills ticket classes, not instances; the clearest expression of "drive ticket rate down."
- **Canary re-test + regression attribution → reopen originating ticket** — self-correcting loop that keeps survival-rate honest.
- **SRC-02/03 source filter + per-source metrics** — operator dashboards once attribution is clean.

**Defer (v2.x+):**
- **FEAT-01/02/03 autonomous feature dev** — highest risk, no deterministic oracle; suggestion-lane (PR + admin approval) ONLY, never auto-push. Defer until bug-fix + Sentry + QA are all trusted.
- **Multi-channel reporter comms (email/Telegram/SMS/push)** — explicitly deferred; in-app `user_notifications` + Resend email only for this milestone.
- **Recurrence→structural escalation at scale** — needs a history of recurring classes to act on.

### Architecture Approach

See `ARCHITECTURE.md`. This is a SUBSEQUENT-milestone integration map, not a greenfield design — far more is already built than the brief implies. The load-bearing structural property: **one `tickets` table, many sources, a source-agnostic daemon.** Every intake path (in-app, Sentry, QA, watchdog, feature task) converges on `tickets` with a `source` stamp; the claimer claims any `status='new'` row regardless of source. This means broadening sources requires ZERO changes to the claim/gate/approval spine — you only add a correctly-stamped intake path. Source-specific behavior (Sentry debug enrichment, task test-gen) lives in the **brief** (`lib/brief.ts`), never in claim/gate logic. The deterministic non-LLM push-gate is the only authority boundary and is per-run and volume-independent — which is exactly why raising volume is low-risk on the safety axis.

**Major components (as-built, v2.0 modifies):**
1. **`claimer.ts`** — 7-step poll cycle (guards → heartbeat → kill switch → stale sweep → approval-merge → budget guards → claim+run); MODIFY: raise `maxRuns`, tighten cadence, add per-fire drain cap.
2. **`runner.ts` + `lib/brief.ts`** — per-ticket fix via worktree + headless `claude`; MODIFY: source/type-aware brief (Sentry-debug, task variants), per-run cost/duration log, test-gen requirement for tasks.
3. **`push-gate.sh`** — deterministic kill-switch→commit-advance→denylist boundary; MODIFY: add a non-LLM test-integrity check (block net test-deletion / assertion-weakening / `.skip`).
4. **`approval.ts`** — the only path to main (rebase→gate→ff-merge→deploy-SHA verify→resolved); MODIFY: call new `sentry-resolve` EF on resolve of a Sentry-sourced ticket.
5. **`qa/triage.ts`** — nightly findings→tickets; MODIFY: file via NEW `ingest_qa_ticket` RPC (`source='nightly_qa'`, DB-deduped) instead of `send-support-ticket`(manual); attach replay artifact.
6. **NEW Edge Functions** — `sentry-resolve` (holds Sentry token, write-back on verified deploy), `notify-reporter` (drains `user_notifications` outbox → Resend, no-ops for NULL-reporter tickets).
7. **NEW migrations** — extend `ticket_source` enum (`+nightly_qa`, `+internal`), `ingest_qa_ticket` RPC, reporter-notify outbox trigger, Sentry priority-on-ingest.

### Critical Pitfalls

See `PITFALLS.md`. These are the failures the existing boundary does NOT catch because it was tuned for an idle, single-run, fixture-only posture.

1. **Agent "fixes" by deleting/weakening tests** — test files are NOT on the denylist; the cheapest path to green is `.skip`/weaker matchers/deleted assertions, and the suite goes green. **Avoid:** add a mechanical, non-LLM test-integrity check to the push-gate that blocks net test-deletion / assertion-weakening / `.skip`/`only` additions; verify regression tests actually fail on pre-fix code. **Go-live blocker.**
2. **Subscription rate-limit exhaustion starves both autopilot AND Andrew's interactive Claude** — the limit that bites is tokens-per-5h-window and concurrent bootstraps, not runs/day. **Avoid:** cap concurrent bootstraps (semaphore 1–2, never burst-launch a backlog), spread cadence (don't raise concurrency), hard quiet hours reserving headroom for Andrew, treat rate-limit as a retryable defer (release claim, destroy worktree, back off) never a failed-fix.
3. **Sentry oscillation — resolve-on-merge manufactures false-regression ticket storms** — a transient post-deploy spike flips resolved→regressed and self-feeds. **Avoid:** resolve only on SHA-matched verified-stable deploy + post-deploy quiet window; debounce ticket creation by minimum post-deploy occurrence count; per-fingerprint fix cap that freezes the *category* (never global) and pages.
4. **Claim races + semantically-stale merges against fast-moving main** — at volume + Andrew pushing + auto-deploy, the claim→push window means base staleness is the norm; a clean textual merge is NOT proof the fix still applies. **Avoid:** rebase-onto-latest-`origin/main` immediately before the push-gate and re-run the repro replay on the rebased state; serialize the push step; atomic verify-and-steal on TTL re-queue; clean stale `index.lock` on startup. **Go-live blocker.**
5. **Reporter comms over-promise / leak internals / fire on never-filed tickets** — Sentry/QA tickets carry a `reporter_id` that is not a real user. **Avoid:** hard-gate comms on `source=in-app-user` (operational tickets are customer-silent); tie "resolved" to verified-stable deploy not merge; default-deny content filter on dynamic summaries (redact paths/SHAs/stack traces/"agent"); milestone-only cadence. **Hard dependency on SRC landing first** — and back-fill legacy rows to `unknown` (NOT `in-app-user`), excluded from comms, or a mis-stamped Sentry row emails a customer.

## Implications for Roadmap

Based on research, the converged build order is **A → B → C → D → E → F → G**. All four researchers independently produced this same sequence. Safety is constant throughout because it is mechanical and per-run; the ordering is driven by *trust accrual* and *attribution dependency*, not by safety gating.

### Phase A: Activation + Per-Run Observability (ACT-01 partial, ACT-03, ACT-04, + go-live hardening)
**Rationale:** Prove the loop works on real traffic at low-but-real volume before raising anything. Observability is the prerequisite for tuning everything downstream — you cannot responsibly turn the kill switch off, let alone push to 30/day, without per-run visibility.
**Delivers:** Kill switch off on a small controlled volume; per-run cost/duration/gate-verdict surfaced to JSONL + evidence + AdminTab; rollback + blast-radius + denylist proven on live tickets; **the three go-live hardening blockers** — test-integrity push-gate check (Pitfall 1), rebase-before-push + serialized push (Pitfall 4), worktree reaper + disk guard + caffeinate (Pitfall 10).
**Addresses:** ACT-04 per-run observability, ACT-01/03 go-live + rollback proven.
**Avoids:** Pitfalls 1 (rate-limit, initial tuning), 2 (gate fatigue — keep ladder low), 3 (test weakening — go-live blocker), 9 (claim races / stale merges — go-live blocker), 10 (worktree/disk exhaustion).
**Depends on:** nothing.

### Phase B: Source Attribution (SRC-01/02/03)
**Rationale:** The measurement substrate. You cannot evaluate which source produces value without correct attribution, and the central data-integrity bug (QA tickets mis-stamped `'manual'`) must be fixed before QA tickets can be told apart from manual ones. Foundational for the per-category ladder, per-source metrics, and reporter-comms gating.
**Delivers:** `ticket_source` enum extended (`+nightly_qa`, `+internal`); watchdog stamp corrected to `'internal'`; AdminTab source filter/column; per-source metrics view.
**Uses:** additive enum migration (Postgres enum values are append-only — safe); dual-read incremental read migration; RLS-regression suite extended to `tickets`/`ticket_messages`.
**Implements:** Pattern 1 (one tickets table, many sources) + Pattern 4 (SECURITY DEFINER ingest RPC + DB-enforced dedup).
**Avoids:** Pitfall 7 — back-fill legacy rows to `unknown` (NOT `in-app-user`), keep source immutable + audited, run RLS-regression on the tickets tables.
**Depends on:** A (so runs are observable) — but largely parallelizable with A.

### Phase C: Throughput Scale-Up to ~25–30/day (ACT-02)
**Rationale:** Only raise volume once activation is proven (A) and output is attributable/measurable (B). Throughput = cadence × runs-per-cycle × budget cap — NOT concurrency.
**Delivers:** `maxRunsPerWindow.maxRuns` 12→~28–30; `pollIntervalSec` tightened to ~120–180s + small per-fire drain cap; quiet-hours/backoff re-derived against real arrival rate; rate-limit-as-retryable-defer wired via `detectRateLimit()`; per-category autonomy ladder begins promoting on accrued cold-run credit.
**Uses:** existing rolling-window budget counter, `detectRateLimit()`, the urgent-lane re-loop in `claimer.ts`.
**Avoids:** Pitfall 1 (cap concurrent bootstraps, hard quiet hours for Andrew's headroom), Pitfall 2 (keep autonomy ladder low; promotion requires explicit admin event + survival-rate gate).
**Depends on:** A, B. **Keep concurrency 1 — invariant, not a perf knob.**

### Phase D: Nightly QA → Fixable Tickets + Flake Suppression (QA-01/02/03)
**Rationale:** The crawl/triage/launchd infra already exists (`com.callvault.qa-nightly`, 03:30 daily). This is mostly a re-attribution + RPC swap unlocked by B's enum, plus the damping that MUST co-ship.
**Delivers:** triage swapped from `send-support-ticket`(manual) to NEW `ingest_qa_ticket` RPC (`source='nightly_qa'`, DB-deduped — retires file-based `known-fingerprints.json`); replay artifact attached per finding; severity-gate on which findings enter the fix queue; **rerun-quarantine** (fail N times before ticketing) + cross-source dedup + actionability gate (no deterministic repro → human-triage lane, not the autonomous fix lane).
**Implements:** `ingest_qa_ticket` mirroring the proven `ingest_sentry_ticket` pattern.
**Avoids:** Pitfall 5 — flake suppression ships WITH QA-01/02, not after; per-source budget allocation so QA churn can't starve user/Sentry tickets.
**Depends on:** B (enum), C (volume headroom).

### Phase E: Sentry Debug→Fix→Resolve (SEN-03/04/05)
**Rationale:** Ingestion already ships from v1.0. This is the enrichment + write-back layer. The one new credential (`SENTRY_AUTH_TOKEN`) is isolated to one new Edge Function.
**Delivers:** source-aware debug brief (gsd-debug discipline + Honcho session keyed by fingerprint, ref stored in `context.sentry.honcho_session`); `ingest_sentry_ticket` priority/urgent boost by severity; NEW `sentry-resolve` Edge Function for write-back; **debounce + resolve-on-stable + per-fingerprint cap**.
**Uses:** Sentry REST `PUT /api/0/organizations/{org}/issues/{id}/` `{"status":"resolved","statusDetails":{"inCommit":"<sha>"}}`, Bearer org auth token scope `event:write`, raw `fetch`. Requires `issue_id` + `org_slug` persisted at ingestion — **verify before building SEN-05.**
**Avoids:** Pitfall 3/4 — resolve ONLY on SHA-matched verified-stable deploy + post-deploy quiet window; reopen-with-attribution (ISC-99) not unlinked new ticket; per-fingerprint cap freezes the category.
**Depends on:** A/C (a working, observed fix loop), B (attribution to measure Sentry cycle-time).

### Phase F: Reporter Comms (RSP-01/02/03)
**Rationale:** Closes the human loop but doesn't affect fix throughput; benefits from a steady stream of real resolved tickets to send summaries about. Hard dependency on SRC.
**Delivers:** status-change outbox trigger → `user_notifications` (only when `reporter_id IS NOT NULL`); NEW `notify-reporter` Edge Function (drains outbox → Resend); resolution summary surfaced from the existing `approval.ts` plain-English note; reporter-facing escalation (not silence).
**Uses:** Pattern 5 (`user_notifications` outbox + Edge Function does outbound); existing Resend `fetch` pattern.
**Avoids:** Pitfall 6 — hard-gate on `source=in-app-user` (no-ops cleanly for Sentry/QA NULL-reporter); resolve-on-verified-deploy not merge; default-deny dynamic-content filter (extend ISC-120); milestone-only cadence.
**Depends on:** **SRC (Phase B) landing and verified first** (Pitfall 6/7 dependency); C/D/E for a steady resolving-ticket stream.

### Phase G: Autonomous Feature Dev — Suggestion-Lane Only (FEAT-01/02/03)
**Rationale:** Highest blast radius, weakest auto-verification (no deterministic oracle — "is this the feature we wanted?" is a product judgment, not a test), most dependent on the fix engine being trusted under load. Ship last.
**Delivers:** AdminTab task-intake form (`type='task'`, `source='internal'`, with explicit acceptance criteria); task-flavored brief (build/optimize, not reproduce/fix); test-gen requirement enforced in the runner (assert the diff includes new/changed tests before `awaiting_approval`); scope guard.
**Uses:** the suggestion-lane substrate (ISC-56..67); the existing denylist diverts schema/RLS/auth/billing automatically.
**Avoids:** Pitfall 8 — **PR-lane + admin-event approval ONLY, never auto-push**; denylist still diverts; definition-of-done gate (UI + backend + tests); no intent = no run; reject diffs exceeding declared blast radius.
**Depends on:** A–C (trusted loop), B (internal attribution); F optional.

### Phase Ordering Rationale

- **Prove → measure → scale → broaden → close-loop → feature.** Activation and observability (A) must precede volume (C) because you cannot tune or trust what you cannot see. Attribution (B) is the measurement substrate everything downstream reads — it precedes broadening so QA/Sentry signal isn't buried under "manual."
- **SRC before RSP is a hard dependency, not a preference.** Reporter comms gate on `source=in-app-user`; sending comms before attribution is trustworthy emails customers about errors they never reported (Pitfall 6/7).
- **SEN and QA ship their damping in the same phase that wires the source.** Auto-ingestion without debounce (Pitfall 4) and rerun-quarantine (Pitfall 5) floods the queue the moment it turns on — damping is part of the definition-of-done, not a follow-up.
- **FEAT last, on suggestion-lane rails.** The only workstream with no deterministic oracle; it must not borrow the bug lane's auto-push authority.
- **The real scaling bottleneck at 30/day is human approval, not machinery** — which is the natural trigger for the per-category autonomy ladder (WS5 metrics are its prerequisite).

### Research Flags

Phases likely needing deeper research during planning (`/gsd:plan-phase --research-phase`):
- **Phase C (throughput):** the subscription rate-limit ceiling at 30/day is *asserted, not measured* — the v1 spike validated entitlement at low volume only. Re-probe at target volume; the number may need to come down.
- **Phase E (Sentry debug→fix→resolve):** three unproven items — (1) whether gsd-debug's systematic flow can be driven non-interactively inside the runner's single headless `claude` session or needs a distinct pass; (2) Honcho session lifecycle (creation, keying by fingerprint, resumption across occurrences, cleanup) — MCP availability ≠ a worked-out memory schema; (3) exact Sentry resolve endpoint/token scope/project mapping verified against the live `ai-simple.sentry.io` org.

Phases with standard patterns (skip research-phase):
- **Phase B (source attribution):** additive enum + RPC mirroring the proven `ingest_sentry_ticket` pattern; well-understood migration discipline.
- **Phase D (nightly QA):** infra exists; re-attribution + RPC swap mirroring an existing pattern.
- **Phase F (reporter comms):** reuses the existing Resend `fetch` + `user_notifications` outbox pattern.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Versions verified against npm registry + Sentry API docs (2026-06-12); integration points verified against live `~/dev/autopilot` source + `~/dev/brain` Edge Functions. Net-new footprint is one secret. |
| Features | HIGH | Industry patterns well-documented (Sentry Seer/Autofix, Slack flake suppression, SRE phased-autonomy ladders, support-comms playbooks); existing surface fully mapped in the autonomous-admin-center ISA (ISC-1..120). |
| Architecture | HIGH | Grounded in live daemon source, deployed migrations, deployed Edge Functions, and `launchctl list` — not training data. "Already exists" claims were file-verified. |
| Pitfalls | HIGH | Failure modes corroborated by Claude Code rate-limit bug reports, Sentry regression/auto-resolve issues, agentic-repair research on assertion-weakening, and parallel-worktree merge practice; mapped against ISC-104..120. |

**Overall confidence:** HIGH

### Gaps to Address

- **Subscription rate-limit ceiling at 30/day:** asserted, not measured. **Handle in Phase C** — sustained-load probe across a real 5h window; tune the run cap down if Andrew's interactive use throttles.
- **gsd-debug non-interactive invocation + Honcho memory schema:** unproven inside a headless `claude -p` session on real Sentry tickets. **Handle in Phase E** research-phase — prototype the source-aware brief on one live Sentry ticket before committing to the heavier pre-claim triage runner.
- **Sentry `issue_id`/`org_slug` persistence at ingestion:** the write-back is impossible without them. **Verify in Phase E planning** — check `ingest_sentry_ticket` stores them in `context`; add a column/context key if only the fingerprint is stored.
- **Approval throttle at 30/day:** human approval becomes the bottleneck. The per-category auto-approve rung is a real safety-design decision the WS5 (Phase B) metrics should inform. **Out of scope to build now; flag for a follow-on** once survival-rate data accrues.
- **Sentry resolve scope/token/project mapping** against the live `ai-simple.sentry.io` org: verify endpoint, token scope (`event:write`), and `context.sentry.project='call-vault'` mapping during Phase E.

## Sources

### Primary (HIGH confidence)
- Live daemon source: `~/dev/autopilot/{autopilot.config.ts, src/claimer.ts, src/runner.ts, src/lib/{agent,brief,claim,approval,evidence}.ts, src/watchdog.ts, src/qa-poller.ts, qa/triage.ts, gate/{push-gate.sh,nightly-crawl.sh}}` — concurrency-1 + `maxRunsPerWindow{24h,12}`, `detectRateLimit()`, `JsonlRunLine` schema (no cost/duration fields), argv-allowlist spawner.
- Live migrations + Edge Functions: `~/dev/brain/supabase/{migrations/*, functions/{send-support-ticket,sentry-webhook,ticket-approval}}` — `ticket_source` enum `('manual','sentry')`, `ingest_sentry_ticket` RPC, Resend raw-`fetch` pattern, `qa_runs`/`runner_state`/`ticket_events`/`user_notifications` schema.
- Loaded launchd jobs (`launchctl list`): `com.callvault.{autopilot, autopilot-watchdog, qa-poller, qa-nightly}` (qa-nightly 03:30 daily).
- npm registry + Sentry API docs (2026-06-12): current versions verified; `PUT /api/0/organizations/{org}/issues/{id}/`, Bearer org auth token, scope `event:write`.
- ISA (HIGH, authoritative for current-state): `~/.claude/PAI/MEMORY/WORK/20260610-autonomous-admin-center/ISA.md` (ISC-1..120 — push-gate, kill switch, ephemeral worktrees, denylist, watchdog, repro-replay oracle, autonomy ladder, trust ledger).
- Planning context: `.planning/PROJECT.md` (v2.0 workstreams ACT/SEN/QA/RSP/SRC/FEAT), `.planning/research/SUMMARY-v1.0.md`.

### Secondary (MEDIUM confidence)
- Sentry blog/docs — AI-powered Autofix, "Your agent can't fix what it can't see" (production context); Semaphore self-healing CI; Impala Intech phased-autonomy L1–L4; Slack Engineering flaky-test auto-detection & suppression; DevRev/Help Scout/Zendesk ticket-handling & escalation playbooks.
- Agentic-repair research — arXiv 2605.01471 (assertion-weakening, test-deletion), arXiv 2507.18755 (program repair at scale).

### Tertiary (LOW confidence — needs validation during planning)
- Claude Code rate-limit GitHub issues (#53922, #41788, #50518) — community-reported window-exhaustion behavior; validate against Andrew's actual subscription tier at target volume (Phase C).
- Sentry regression-feedback-loop reports (getsentry/sentry #81894, forum 4101) — informs the resolve-on-stable-deploy + debounce design; validate against the live org's behavior (Phase E).
- Git worktree parallel-AI-agent conflict-recovery guides — inform rebase-before-push; the daemon stays concurrency-1, so multi-agent specifics are precautionary not load-bearing.

---
*Research completed: 2026-06-12*
*Ready for roadmap: yes*
