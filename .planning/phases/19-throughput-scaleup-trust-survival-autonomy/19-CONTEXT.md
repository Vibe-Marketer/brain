# Phase 19: Throughput Scale-Up + Trust, Survival & Autonomy - Context

**Gathered:** 2026-06-13
**Status:** Ready for planning
**Source:** Authored from ROADMAP + STATE Key Decisions + `.planning/design/escalation-tier2-solutions-not-problems.md`. Discuss skipped — direction already specified in STATE and the tier-2 design.

<domain>
## Phase Boundary

Raise daily fix throughput to ~25–30/day WITHOUT raising concurrency, and ship the trust mechanisms — 30-day fix-survival metric, per-category autonomy ladder, canary regression-reopen — that make that volume livable instead of a human-approval bottleneck. Plus treat subscription rate-limit hits as retryable defers, never failed fixes.

**Critical scoping:** Phase 19 builds the MECHANISM. The actual live volume raise (flipping `maxRunsPerWindow.maxRuns` up) stays gated behind Phase 17-05 activation + trustworthy observability — do not raise live volume in this phase. Concurrency stays 1 forever.
</domain>

<decisions>
## Implementation Decisions

### D-01 — Throughput via run-cap + cadence ONLY (ACT-02) [LOCKED]
Raise target to ~25–30/day via `maxRunsPerWindow.maxRuns` + tightened cadence. NEVER raise concurrency (stays 1 — atomic-claim + shared-clone-reset invariant). Hard quiet-hours reserve headroom for Andrew's interactive Claude. Budget/rate-limit guards in place. Ship the config + guards; the live cap raise happens post-17-05.

### D-02 — 30-day fix-survival is THE primary metric (TRU-01) [LOCKED]
Track, per fix AND per category, whether a fix HOLDS vs gets reopened over 30 days. This — not closure speed — is the primary success metric and the input that gates the autonomy ladder. Needs a durable per-fix survival record (likely on/derived from `runner_runs` + ticket reopen events) and a per-category rollup.

### D-03 — Per-category autonomy ladder (TRU-02) [LOCKED]
Fixes in categories with a proven survival track record can auto-approve; risky categories stay manual. Promotion requires BOTH a survival-rate gate AND an explicit admin event (never auto-promotes silently).
- **Default gate: a category becomes auto-approve-eligible at ≥90% 30-day survival over ≥5 completed fixes; promotion still requires an explicit admin opt-in event recorded in an audit trail.** `[Claude's default — Andrew may override]`
- Ladder rungs: `manual` → `eligible` (gate met, awaiting admin event) → `auto` (admin-promoted). Demotion is automatic on a survival drop below threshold.

### D-04 — Canary re-test + regression attribution (TRU-03) [LOCKED]
Recently-merged fixes are automatically re-tested; if a fix introduced a regression, the ORIGINATING ticket is reopened WITH attribution (linked to the fix/run) — never a new unlinked ticket. Mirrors the Sentry "resolve only on verified-stable" caution.
- **Default canary window: re-test fixes within their first 24h post-merge (and again before the 30-day survival mark).** `[Claude's default — Andrew may override]`

### D-05 — Rate-limit hit = retryable defer, never a failed fix (Pitfall 2) [LOCKED]
A subscription/API rate-limit hit during a run is treated as a retryable DEFER: release the claim, destroy the worktree, back off with jitter, re-queue. NEVER logged as a failed fix (that would poison survival metrics + waste an attempt). Distinct exit path from a genuine fix failure.

### D-06 — Tier-2 escalation is a trust mechanism that lives here [LOCKED — binding design]
Per `.planning/design/escalation-tier2-solutions-not-problems.md`: the autonomy ladder (D-03) GOVERNS what tier-2 may auto-fix vs must surface as a decision. Phase 19 integrates the tier-2 reviewer (a DIFFERENT model on a DIFFERENT cadence — Claude/Don or a Hermes agent vs tier-1 Codex) into the trust layer: tier-1 fixes or hands to tier-2; tier-2 re-investigates, auto-fixes within its ladder rung, and only for the residue emits a solution-shaped operator digest (1–2 sentence what+why + 2–3 a/b/c decisions). No raw problem dumps at the operator.

### Claude's Discretion
Exact survival-record schema and rollup query; category taxonomy for the ladder; canary re-test harness reuse (repro replay vs targeted test); tier-2 scheduling mechanism (launchd/cron). Reuse existing patterns (`runner_runs`, push-gate, approval/claim paths, the repro-replay machinery from 17-04).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Daemon throughput + claim/approval (autopilot)
- `~/dev/autopilot/autopilot.config.ts` — `maxRunsPerWindow`, cadence, quiet-hours, concurrency (=1, never change)
- `~/dev/autopilot/src/lib/claim.ts`, `~/dev/autopilot/src/lib/approval.ts` — claim/defer/approve paths (rate-limit defer D-05 lands here; approval gates on autonomy ladder D-03)
- `~/dev/autopilot/src/runner.ts`, `~/dev/autopilot/src/watchdog.ts`

### Survival / ledger / attribution (brain schema + UI)
- `supabase/migrations/*autopilot_queue_runner_state*.sql`, the `runner_runs` ledger (Phase 17) — survival record substrate
- `src/services/admin-dashboard.service.ts`, `src/pages/admin/DashboardSection.tsx` — where survival/ladder/canary surface (admin-gated)

### Binding design + ownership
- `.planning/design/escalation-tier2-solutions-not-problems.md` — tier-2 + autonomy-ladder integration (D-06)
- `docs/architecture/autopilot-brain-ownership.md` — repo ownership + shared-DB seam
</canonical_refs>

<specifics>
## Specific Ideas

- **Rate-limit re-probe (STATE flag):** the ~30/day subscription rate-limit ceiling is ASSERTED, not measured. It can only be validated by a real run at target volume across a ~5h window — which requires 17-05 activation. So Phase 19 ships a CONSERVATIVE cap + the defer/back-off machinery (D-05) and the survival/observability to measure it; the actual re-probe + cap tuning happens post-activation. Do not hard-commit to 30/day in code; make the cap a tunable config with a conservative default.
- Survival metric depends on reliable ticket-reopen attribution (D-04) — canary reopen must link to the originating run so survival is measured against the right fix.
- Quiet-hours must reserve headroom for Andrew's interactive Claude on this machine (shared rate-limit pool).
</specifics>

<deferred>
## Deferred Ideas

- Live volume raise (flipping maxRuns up) → gated behind Phase 17-05 activation, not done here.
- QA-source per-source budget → Phase 20 (uses this phase's throughput model).
- Sentry resolve-on-stable → Phase 21. Recurrence→structural → Phase 22. Customer comms → Phase 23.
</deferred>

---

*Phase: 19-throughput-scaleup-trust-survival-autonomy*
*Context authored 2026-06-13 from STATE decisions + tier-2 design (discuss skipped — direction pre-specified)*
