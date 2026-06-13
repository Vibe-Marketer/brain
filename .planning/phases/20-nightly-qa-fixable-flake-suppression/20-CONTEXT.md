# Phase 20: Nightly QA → Fixable Tickets + Flake Suppression - Context

**Gathered:** 2026-06-13
**Status:** Ready for planning
**Source:** Authored from Andrew's locked design decisions (escalation tier-2 conversation) + ROADMAP + `.planning/design/escalation-tier2-solutions-not-problems.md`. Discuss skipped — design already specified by operator.

<domain>
## Phase Boundary

Wire the existing nightly QA crawler into the fixable-ticket path with correct attribution (`source='nightly_qa'`, landed in Phase 18), and co-ship the flake suppression that keeps a flaky nightly from flooding the queue with junk. This is the direct fix for escalation-noise root cause #2: the nightly QA crawler filing non-defects (navigation artifacts, transient aborts, by-design states) that the autopilot then correctly-but-noisily escalates.

In scope: QA ingestion RPC, reproduce-before-file quarantine, classify-into-review lane, recurrence promotion, severity-gated autonomous QA fix, per-source budget. Out of scope: raising daily volume/run-cap (that's Phase 19), Sentry ingestion changes (Phase 21).
</domain>

<decisions>
## Implementation Decisions

### D-01 — QA findings file via a dedicated server-side RPC (QA-01) [LOCKED]
New `ingest_qa_ticket` RPC stamps `source='nightly_qa'` server-side, DB-dedupes on fingerprint (occurrence bump, not a new row, on repeat), and attaches repro/replay evidence. The crawler must NOT file through the browser `send-support-ticket` path (that path is for in-app person reports). Mirror the existing `ingest_sentry_ticket` RPC as the analog.

### D-02 — Reproduce-before-file / rerun-quarantine (QA-02) [LOCKED — Andrew's core principle]
A finding becomes a *fixable* ticket only if it REPRODUCES across reruns on a fresh authenticated load. A finding that fails fewer than N reruns is quarantined and NEVER tickets. This is "verified, not lax" — the gate is reproducibility, not a category blocklist.
- **Default N = 2** (must reproduce on 2 reruns). `[Claude's default — Andrew may override]`

### D-03 — Classify, don't delete: the review lane (QA-02) [LOCKED — Andrew's principle]
Non-deterministic / artifact / by-design findings route to a low-priority, AUDITABLE `qa_review` lane (a human-triage bucket), NOT the autonomous fix lane and NOT dumped on the operator. Nothing is thrown away — the suppressed bucket is visible for audit. (Implements as a status/lane on the ticket or a dedicated review queue; planner picks the lighter-weight option that stays inside existing surfaces.)

### D-04 — Recurrence promotion (anti-lax safety net) [LOCKED — Andrew's principle]
A quarantined/suppressed finding whose fingerprint recurs across ≥ M nightly runs is PROMOTED back to a real fixable ticket. Uses `occurrence_count` / `last_seen_at`. One-off = noise; persistent = real. Ensures nothing real stays buried by the filter.
- **Default M = 3** consecutive/observed nightly runs. `[Claude's default — Andrew may override]`

### D-05 — Severity-gated autonomous QA fix (QA-03) [LOCKED]
Autopilot addresses QA-sourced tickets in the SAME fix loop, but auto-fixes only at/below a severity threshold; anything above routes to the tier-2 lane (D-07), never silent auto-push at high blast radius.
- **Default: auto-fix `low`/`medium`; `high`/`critical` → tier-2/human lane.** `[Claude's default — Andrew may override]`

### D-06 — Per-source budget (QA-04) [LOCKED]
A QA churn burst must not starve user or Sentry tickets. A per-source budget bounds QA's share of the daily run-cap; user + Sentry always keep reserved capacity. (This is the Phase 19 "per-source budgeting" dependency, pulled into Phase 20 because the suppression needs it; volume HEADROOM / raising the cap stays Phase 19.)
- **Default: QA ≤ 50% of the daily run-cap; user + Sentry reserved the remainder.** `[Claude's default — Andrew may override]`

### D-07 — Tier-2 escalation, never dump on the operator [LOCKED — binding design law]
Per `.planning/design/escalation-tier2-solutions-not-problems.md`: QA findings the autopilot can't fix do NOT surface raw at Andrew. They route to the tier-2 lane (a DIFFERENT model on a DIFFERENT cadence — Claude/Don or a Hermes agent — vs tier-1 Codex) which re-investigates, fixes what it can, and only for the residue emits a solution-shaped digest (1–2 sentence what+why + 2–3 a/b/c decisions). Phase 20 at minimum routes QA escalations into this lane (the `qa_review`/tier-2 queue) rather than at the operator; the full tier-2 reviewer runtime may complete alongside Phase 19/23.

### Claude's Discretion
Schema shape for the review lane and quarantine state; exact dedup fingerprint composition; how rerun is invoked (re-crawl vs replay); telemetry for what was suppressed. Use existing patterns (`ingest_sentry_ticket`, `qa_runs`, the runner ledger) and stay inside existing surfaces.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### QA crawler + triage (the intake to rewire)
- `scripts/qa/qa-crawler.ts` (brain) — the crawler that produces findings
- `~/dev/autopilot/qa/triage.ts` — existing triage layer (enhance here)
- `~/dev/autopilot/qa/nightly-crawl.sh` — the scheduled nightly runner
- `src/services/qa.service.ts`, `src/pages/admin/QaSection.tsx` (brain) — QA UI/service

### Ticket ingestion analog + schema
- `supabase/migrations/*sentry_ticket_ingestion*.sql` — `ingest_sentry_ticket` RPC = the analog for `ingest_qa_ticket`
- `supabase/migrations/*create_qa_runs*.sql`, `*qa_runs_request_queue*.sql` — QA run infra
- `supabase/migrations/*extend_ticket_source_enum*.sql` — `nightly_qa` source (Phase 18)

### Binding design + ownership
- `.planning/design/escalation-tier2-solutions-not-problems.md` — tier-2 + solutions-not-problems law (D-07)
- `docs/architecture/autopilot-brain-ownership.md` — repo ownership + shared-DB seam
- `.planning/debug/autopilot-tickets-stuck-no-autofix.md` — the live root-cause record this phase resolves
</canonical_refs>

<specifics>
## Specific Ideas

- Per-source budget concept already foreshadowed in STATE ("per-source budgeting"). `maxRunsPerWindow` stays low (3–5/day) until Phase 17-05 activation — do not raise it here.
- The crawler currently files browser-console artifacts (modulepreload 404s, nth=N click-timeouts, off-route fetch aborts, non-existent buttons). These are exactly the findings rerun-quarantine (D-02) should drop. Confirmed from escalated tickets #322–#327.
- Dedup must be append-only-safe on `ticket_source` and reuse the fingerprint scheme already on `tickets`.
</specifics>

<deferred>
## Deferred Ideas

- Raising daily run-cap / volume headroom → Phase 19.
- Sentry debug→fix→resolve → Phase 21.
- Full tier-2 reviewer runtime (the separate-cadence Claude/Hermes agent) may land with Phase 19/23; Phase 20 only needs to ROUTE QA escalations into the lane, not necessarily build the reviewer daemon.
- Customer-facing comms → Phase 23.
</deferred>

---

*Phase: 20-nightly-qa-fixable-flake-suppression*
*Context authored 2026-06-13 from operator-locked design (discuss skipped — design pre-specified)*
