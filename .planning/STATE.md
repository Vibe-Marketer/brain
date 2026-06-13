---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Autonomous Operations
status: planning
last_updated: "2026-06-13T00:00:00.000Z"
last_activity: 2026-06-13
progress:
  total_phases: 7
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# STATE — CallVault v2.0 Autonomous Operations

**Last updated:** 2026-06-13

---

## Project Reference

**Project:** CallVault — v2.0 Autonomous Operations (Self-Healing CallVault)
**Repo:** `/Users/admin/dev/brain` (single source; `callvault/` is abandoned). Dispatcher daemon at `~/dev/autopilot/` (separate repo).
**Production:** https://app.callvaultai.com (Vercel, auto-deploys from `main`)
**MCP endpoint:** https://mcp.callvaultai.com (Cloudflare Worker → Supabase Edge Function)

**Core value:** Take the armed-but-idle Autopilot from "proven on fixtures" to a live, trusted self-healing operation that drives ticket rate down and customer experience up — bugs/errors found, debugged, and fixed autonomously at volume, with the human loop closed and every source accurately tracked.

**Current focus:** Phase 17 — Activation + Per-Run Observability + Go-Live Hardening (turn the kill switch off on real tickets at low volume)

---

## Current Position

Phase: Not started (roadmap created; ready to plan Phase 17)
Plan: —
Status: Roadmap complete, awaiting phase planning
Last activity: 2026-06-13 — v2.0 roadmap created (Phases 17–23, 25 requirements mapped)

## Performance Metrics

(Will populate as phases run.)

- Cycle time per plan: —
- Plans completed per phase: —
- Verification-pass rate: —

---

## Accumulated Context

### Roadmap Evolution

- **v1.0 Self-Serve Public Launch shipped 2026-06-12** — 24 phases (real phases 1–16 + decimal insertions), 113 plans. Full record in MILESTONES.md. Built the Autopilot machinery: spike GO (5/5 fixtures), DB-backed tickets + AdminTab, Sentry ingestion, the `~/dev/autopilot` dispatcher daemon (armed-but-idle, kill switch ON), and the in-app approve→merge bridge.
- **v2.0 roadmap created 2026-06-13** — 7 phases (17–23) derived from the converged research build order (prove → measure → scale → broaden → recurrence → close-loop). 25 requirements across ACT/SRC/TRU/REC/QA/SEN/RSP mapped to exactly one phase each. FEAT-01..03 deferred to v2.1.
  - Phase 17: Activation + per-run observability + go-live hardening (ACT-01,03,04,05,06,07)
  - Phase 18: Source attribution (SRC-01,02,03)
  - Phase 19: Throughput scale-up + trust/survival/autonomy (ACT-02, TRU-01,02,03)
  - Phase 20: Nightly QA → fixable tickets + flake suppression (QA-01,02,03,04)
  - Phase 21: Sentry debug→fix→resolve (SEN-03,04,05)
  - Phase 22: Recurrence → structural fix (REC-01,02)
  - Phase 23: Reporter comms in-app (RSP-01,02,03)

### Key Decisions

- **v2.0 = go live on the Autopilot loop.** v1.0 built and armed the machinery but never claimed a real ticket. The remaining unknowns (does it hold up on real traffic, do the safety boundaries survive load) can only be answered by turning it on. v2.0 is the trust-and-scale milestone.
- **Concurrency stays 1 — invariant, not a perf knob.** The atomic claim UPDATE is the atomicity boundary and per-run worktrees share a single clone that gets `git reset --hard` per run. Throughput scales via run-cap (`maxRunsPerWindow.maxRuns` 12→~30) + tightened cadence only.
- **Net-new footprint ~0.** Zero new npm packages; exactly one new secret (`SENTRY_AUTH_TOKEN`, scope `event:write`). No new queue engine, framework, or comms vendor — the Supabase claim-UPDATE IS the queue; Sentry resolve is a raw `fetch` PUT; comms reuse the existing `user_notifications` outbox + Resend `fetch`.
- **SRC (Phase 18) is a hard dependency before RSP (Phase 23).** Reporter comms gate on `source=in-app-user`; sending comms before attribution is trustworthy emails customers about errors they never reported. Legacy rows back-fill to `unknown`, never `in-app-user`.
- **SEN/QA ship their damping in the same phase that wires the source.** Auto-ingestion without debounce (Phase 21) or rerun-quarantine (Phase 20) floods the queue the moment it turns on — damping is part of definition-of-done, not a follow-up.
- **30-day fix-survival is the primary success metric**, not closure speed. It gates the per-category autonomy ladder that makes 25–30/day livable.
- **Sentry resolve only on SHA-matched verified-stable deploy** + post-deploy quiet window — never resolve-on-merge (manufactures false-regression storms); per-fingerprint cap freezes the category (never global) and pages on oscillation.
- **FEAT deferred to v2.1.** Highest blast radius, no deterministic oracle. When built, suggestion-lane (PR + admin approval) rails only — never the bug lane's auto-push.

### Decisions Needed

Per-phase research flags (resolve at phase planning, not roadmap creation):
- **Phase 19:** subscription rate-limit ceiling at ~30/day is asserted, not measured — re-probe at target volume across a real 5h window; the cap may need to come down.
- **Phase 21:** (1) whether gsd-debug runs non-interactively inside the runner's headless `claude` session; (2) Honcho session lifecycle keyed by fingerprint; (3) exact Sentry resolve endpoint/token scope/project mapping against the live `ai-simple.sentry.io` org, plus confirming `issue_id`/`org_slug` are persisted at ingestion.

### Todos

- Plan Phase 17 with `/gsd:plan-phase 17`. Phase 17 carries the three go-live blockers (test-integrity gate, rebase-before-push, worktree reaper) plus the first real-ticket activation.
- Before raising volume (Phase 19), confirm per-run observability (ACT-04) is live and trustworthy — you cannot tune what you cannot see.

## Phase-Spanning Knowledge

Binding fragile surfaces (must respect in every phase):

- **Dispatcher daemon code lives at `~/dev/autopilot/`** (separate repo) — plan/verify steps for daemon work target that external path. Migrations, Edge Functions, and AdminTab UI live in `~/dev/brain`.
- **Concurrency 1 is load-bearing.** Never raise it. Throughput = run-cap + cadence.
- **Push-gate is the only authority boundary** — deterministic, non-LLM. The test-integrity check is mechanical (block net test-deletion / assertion-weakening / `.skip`/`.only`).
- **`ticket_source` enum is append-only** — additive extension is safe; never reorder/rewrite existing values. Legacy rows back-fill to `unknown`.
- **Recording ID dual system.** UUID `recordings.id` vs legacy BIGINT — route through `toRecordingUuid()` / `toRecordingUuidBatch()` in `src/lib/recording-ids.ts`. Never `parseInt()`/`Number()`/string coercion.
- **`recordings.share_url` is not a top-level column** — use `resolveShareUrl()` from `src/lib/recording-source-url.ts`.
- **`authenticateRequest(req, supabase, corsHeaders)` from `_shared/auth.ts`** for all Edge Function auth. Never inline.
- **MCP tool result shape: `content[].text` markdown**, NOT structured JSON.
- **All AI/LLM in Edge Functions** (constraint AI-02). Frontend AI usage banned.
- **Direct-main workflow.** No feature branches/PRs unless Andrew explicitly asks.

---

## Session Continuity

### Last session

- **Date:** 2026-06-13
- **Activity:** Created the v2.0 Autonomous Operations roadmap — 7 phases (17–23) from the converged research build order; mapped all 25 v1 requirements; populated REQUIREMENTS.md traceability; reset STATE.md to the v2.0 milestone.
- **Outcome:** `.planning/ROADMAP.md` (v2.0, Phases 17–23), `.planning/REQUIREMENTS.md` (25/25 mapped), `.planning/STATE.md` (this file). Coverage 100%, no orphans. FEAT-01..03 correctly excluded (v2.1).

### Next session

- **Trigger:** Plan Phase 17 — Activation + Per-Run Observability + Go-Live Hardening.
- **Action:** `/gsd:plan-phase 17`. Decompose the three go-live blockers (test-integrity push-gate, rebase-before-push + serialized push, worktree reaper + disk guard + caffeinate) plus per-run observability (ACT-04) and the first controlled real-ticket activation (ACT-01/03). Daemon work targets `~/dev/autopilot/`.

### Files of Record

- `.planning/PROJECT.md` — project context, v2.0 workstreams, Key Decisions, Out of Scope
- `.planning/REQUIREMENTS.md` — 25 v1 requirements traced to Phases 17–23
- `.planning/ROADMAP.md` — 7-phase v2.0 plan + sequencing constraints + research flags
- `.planning/research/SUMMARY.md` — converged research build order (A→G), authoritative
- `.planning/MILESTONES.md` — v1.0 shipped record (real phases 1–16)
- `~/.claude/PAI/MEMORY/WORK/20260610-autonomous-admin-center/ISA.md` — autopilot security model (ISC-1..120)
- `src/CLAUDE.md` / `supabase/CLAUDE.md` / `docs/CLAUDE.md` — folder-scoped binding rules

---

*STATE.md reset to v2.0 Autonomous Operations milestone: 2026-06-13*
