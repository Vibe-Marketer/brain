# Requirements: CallVault v2.0 — Autonomous Operations

**Defined:** 2026-06-13
**Core Value:** Take the armed-but-idle Autopilot from "proven on fixtures" to a live, trusted self-healing operation that drives ticket rate down and customer experience up — bugs/errors found, debugged, and fixed autonomously at volume, with the human loop closed and every source accurately tracked.

---

## v1 Requirements

Requirements for this milestone. Each maps to exactly one roadmap phase. Converged build order from research: **activate+observe → attribute → scale → QA → Sentry → comms**, with the trust/recurrence differentiators woven into the phases they enable.

### Loop Activation & Trust (ACT)

- [ ] **ACT-01**: Go live — the kill switch is turned off and the dispatcher claims and fixes real production tickets through the existing fix→gate→approve→merge spine (first real tickets ever claimed)
- [x] **ACT-02**: Daily fix throughput raised to ~25–30/day via `maxRunsPerWindow.maxRuns` + tightened cadence (NOT concurrency — concurrency stays 1); held high until findings taper, with budget/rate-limit guards and hard quiet-hours reserving headroom for Andrew's interactive Claude
- [ ] **ACT-03**: Rollback + blast-radius safety proven on live tickets — revert path, commit-advance-by-exactly-one authority, and denylist all demonstrated under real load
- [x] **ACT-04**: Per-run observability — every autonomous run is visible in AdminTab with status, diff, test result, gate verdict, duration, and cost
- [ ] **ACT-05**: Test-integrity gate added to the deterministic push-gate — mechanically blocks net test-deletion, assertion-weakening, and `.skip`/`.only` additions so the agent cannot "fix" by defeating the tests *(go-live blocker)*
- [ ] **ACT-06**: Rebase-before-push + serialized push + repro-replay re-run on the rebased state — prevents semantically-stale merges when `main` moves between claim and push at volume *(go-live blocker)*
- [ ] **ACT-07**: Worktree reaper + disk guard + wake/`caffeinate` handling so sustained-volume operation can't exhaust disk or stall on sleep

### Source Attribution (SRC)

- [x] **SRC-01**: Every ticket carries its true origin — `ticket_source` enum extended (`+nightly_qa`, `+internal`), each intake path stamps the correct source (fixing the QA-triage `source:'manual'` mis-attribution bug), watchdog tickets stamp `internal`, and legacy rows back-fill to `unknown` (never `in-app-user`)
- [x] **SRC-02**: AdminTab can filter and group tickets by source
- [x] **SRC-03**: Per-source metrics — volume, fix rate, and cycle time tracked per origin

### Throughput Trust, Survival & Autonomy (TRU)

- [x] **TRU-01**: 30-day fix-survival metric — track per fix and per category whether a fix holds versus gets reopened; this is the primary success metric (not closure speed) and the input that gates the autonomy ladder
- [x] **TRU-02**: Per-category autonomy ladder — fixes in categories with a proven survival track record can auto-approve; risky categories stay manual; promotion requires a survival-rate gate plus an explicit admin event (this is what makes 25–30/day livable without hand-approving every fix)
- [x] **TRU-03**: Canary re-test + regression attribution — recent fixes are automatically re-tested; if a fix introduced a regression, the originating ticket is reopened with attribution

### Recurrence → Structural Fix (REC)

- [ ] **REC-01**: Recurring ticket classes are detected (fingerprint/category clustering across resolved tickets)
- [ ] **REC-02**: A recurring class escalates to a structural-fix task that targets the class, not the instance — the primary lever for driving ticket rate down

### Nightly QA → Tickets → Resolution (QA)

- [ ] **QA-01**: Nightly automated QA run on schedule (the `com.callvault.qa-nightly` 03:30 launchd job + Playwright crawler already exist; wire them to the fixable-ticket path)
- [ ] **QA-02**: QA failures auto-create tickets via a new `ingest_qa_ticket` RPC (`source='nightly_qa'`, DB-deduped, mirroring `ingest_sentry_ticket`) with repro/replay evidence attached
- [ ] **QA-03**: Flake suppression co-ships — rerun-quarantine (a finding must fail N times before it tickets) plus an actionability gate that routes non-deterministic findings to a human-triage lane instead of the autonomous fix lane
- [ ] **QA-04**: Autopilot addresses QA-sourced tickets in the same loop, severity-gated, with a per-source budget so QA churn can't starve user/Sentry tickets

### Sentry Debug → Fix → Resolve (SEN)

- [ ] **SEN-03**: Sentry errors are auto-debugged via a gsd-debug-disciplined + Honcho-memory brief (session keyed by fingerprint) and routed into the autopilot fix loop *(builds on v1.0 SEN-01/02 ingestion)*
- [ ] **SEN-04**: Error→ticket→fix→resolve cycle time is tracked with a "resolve ASAP" target; severity boosts priority; fingerprint dedup is hardened with debounce (minimum post-deploy occurrence count) to prevent transient-spike ticket storms
- [ ] **SEN-05**: Sentry resolution write-back — a new `sentry-resolve` Edge Function (holding the one new secret, `SENTRY_AUTH_TOKEN`, scope `event:write`) marks the issue resolved only on a SHA-matched verified-stable deploy; a per-fingerprint fix cap freezes the category and pages on oscillation

### Reporter Comms — In-App (RSP)

- [ ] **RSP-01**: A reporter receives an in-app status update when their ticket moves (received / in-progress / resolved) — fired only when `source = in-app-user`, so Sentry/QA/internal tickets stay customer-silent
- [ ] **RSP-02**: An auto-generated, plain-English resolution summary is posted in-app on verified-stable deploy, passed through a default-deny content filter that redacts file paths, SHAs, stack traces, and the word "agent"
- [ ] **RSP-03**: When autopilot can't fix a ticket, the reporter gets a human-readable in-app escalation status — not silence

## v2 Requirements

Deferred to v2.1+. Tracked but not in this roadmap.

### Autonomous Feature Dev (FEAT) — deferred to v2.1

- **FEAT-01**: Autonomous coding tasks extended beyond bug-fix to add/optimize feature work
- **FEAT-02**: Test-generation/validation loop so autonomous feature changes ship with coverage
- **FEAT-03**: Feature-task intake — how Andrew queues a feature for the agent and tracks it through the loop
- *Reason for deferral: highest blast radius and the only workstream with no deterministic oracle ("is this the feature we wanted?" is a product judgment, not a test). Revisit once the bug-fix / Sentry / QA loop is fully trusted at volume. When built, it must ride the suggestion-lane (PR + admin approval) only — never the bug lane's auto-push.*

### Comms & Scale follow-ons — deferred to v2.1+

- **RSP-04**: Multi-channel reporter comms (transactional email via Resend, then Telegram/SMS/push)
- **TRU-04**: Per-category auto-approve operating at full scale once a deep survival-rate history has accrued
- **REC-03**: Recurrence→structural-fix escalation operating across a large catalog of recurring classes

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Raising daemon concurrency above 1 | Load-bearing safety invariant — the atomic claim UPDATE and shared-clone worktree (`git reset --hard` per run) assume a single writer. Throughput scales via run-cap + cadence, not concurrency. |
| A job-queue engine (BullMQ / pg-boss / Temporal / Redis) | The Supabase claim-UPDATE already IS the queue. Adding an engine is net new infra for zero gain. |
| `@sentry/node` / `@sentry/cli` SDK | Resolution write-back is a single `PUT` via raw `fetch`, matching the existing webhook pattern. |
| `resend` SDK / Twilio / SendGrid / Telegram for comms | In-app comms reuse the existing `user_notifications` outbox; email (if ever) reuses the existing Resend raw-`fetch` pattern. |
| GitHub Actions or cron for nightly QA | Nightly QA needs the authenticated app from the always-on daemon Mac; launchd already schedules it. |
| New browser/test frameworks for QA | Playwright (1.57) crawler already exists. |
| Cost-metering SDKs / per-token dollar meters | Subscription billing has no per-token meter; guards are runs-per-window + rate-limit backpressure. `est_cost` is a display field. |
| Autonomous feature dev (FEAT) | Deferred to v2.1 — see v2 Requirements. |
| Multi-channel reporter comms (email/Telegram/SMS) | Deferred to v2.1 — in-app only this milestone. |

## Traceability

Which phases cover which requirements. Populated during roadmap creation (2026-06-13).

| Requirement | Phase | Status |
|-------------|-------|--------|
| ACT-01 | Phase 17 | Pending |
| ACT-03 | Phase 17 | Pending |
| ACT-04 | Phase 17 | Complete |
| ACT-05 | Phase 17 | Pending |
| ACT-06 | Phase 17 | Pending |
| ACT-07 | Phase 17 | Pending |
| SRC-01 | Phase 18 | Complete |
| SRC-02 | Phase 18 | Complete |
| SRC-03 | Phase 18 | Complete |
| ACT-02 | Phase 19 | Complete |
| TRU-01 | Phase 19 | Complete |
| TRU-02 | Phase 19 | Complete |
| TRU-03 | Phase 19 | Complete |
| QA-01 | Phase 20 | Pending |
| QA-02 | Phase 20 | Pending |
| QA-03 | Phase 20 | Pending |
| QA-04 | Phase 20 | Pending |
| SEN-03 | Phase 21 | Pending |
| SEN-04 | Phase 21 | Pending |
| SEN-05 | Phase 21 | Pending |
| REC-01 | Phase 22 | Pending |
| REC-02 | Phase 22 | Pending |
| RSP-01 | Phase 23 | Pending |
| RSP-02 | Phase 23 | Pending |
| RSP-03 | Phase 23 | Pending |

**Coverage:**
- v1 requirements: 25 total
- Mapped to phases: 25 ✓ (Phases 17–23)
- Unmapped: 0 ✓
- FEAT-01..03 deferred to v2.1 (intentionally unmapped)

---
*Requirements defined: 2026-06-13*
*Last updated: 2026-06-13 — traceability populated by roadmapper; all 25 v1 requirements mapped to Phases 17–23.*
