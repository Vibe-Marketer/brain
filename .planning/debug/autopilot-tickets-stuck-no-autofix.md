---
status: root_cause_found
trigger: "Autonomous error handling from the QA bot scrubbing overnight is creating tickets, but the ticket count does not increase past 60, and tickets are not being autonomously fixed even though auto-fix is enabled in settings."
created: 2026-06-12
updated: 2026-06-12
goal: diagnose (fix is a feature build — awaiting Andrew's scope decision)
---

# Debug: Autopilot tickets stuck at 60 + auto-fix not running

## Symptoms
1. Ticket count plateaus at ~60, does not grow despite nightly QA "scrubbing".
2. Auto-fix never runs even though the settings toggle is ON.

## System map (evidence)
Two HALF-BUILT, decoupled pipelines — neither closes the loop on the DB `tickets` table:

### A. DB-ticket autopilot dispatcher (Phase 13/14) — SCHEMA ONLY, NO RUNTIME
- Migrations exist: `20260611200000_autopilot_queue_runner_state.sql` (runner_state, kill_switch,
  claim-queue index, attempts/next_attempt_at), `20260612150000_create_qa_runs.sql`,
  `20260613130000_qa_runs_request_queue.sql`.
- NO process writes `runner_state` heartbeats or claims `status='new'` tickets. The only code
  touching the "daemon heartbeat path" is `scripts/qa/verify-autopilot-rls.ts` — an RLS *probe*,
  not the daemon. No launchd plist, no GitHub Action, no edge function does the claiming.
- UI confirms it's unbuilt:
  - `src/services/admin-dashboard.service.ts:131` getRunnerState comment: card renders "not deployed yet".
  - `src/pages/admin/DashboardSection.tsx:216`: "Autopilot is on, but the dispatcher process isn't
    checking in. Nothing runs until it's back." (mode "offline").
  - `src/pages/admin/QaSection.tsx:9,449`: "Remote trigger wiring lands with Phase 13's dispatcher."
- The settings toggle (`armed = !kill_switch`, DashboardSection.tsx:187) flips `kill_switch` on
  `runner_state`. It arms a runner that does not exist → cosmetic toggle.

### B. Sentry → GitHub-issue @claude autofix — works only if Sentry is configured; decoupled from DB tickets
- `.github/workflows/sentry-autofix.yml`: fires on GitHub `issues` labeled `sentry-alert`, tags
  @claude to open a fix PR with `auto-merge`. Requires a one-time Sentry UI alert rule
  ("Create a GitHub issue" + `sentry-alert` label). Operates on GitHub issues, NOT the 60 DB tickets.

## Root causes
- **Symptom 1 (stuck at 60):** `ingest_sentry_ticket` RPC (`20260612130000_sentry_ticket_ingestion.sql`)
  upserts `INSERT ... ON CONFLICT (fingerprint) DO UPDATE SET occurrence_count+1, last_seen_at=NOW()`.
  Recurring Sentry issues = same fingerprint = NO new row, just occurrence bump. Count plateaus at the
  number of DISTINCT recurring Sentry fingerprints (~60). Working as designed; monotonic growth was the
  wrong expectation. Compounding gap: the QA crawler (`scripts/qa/qa-crawler.ts`) writes
  `qa-report.json` + a `qa_runs` summary only — it does NOT insert tickets ("Triage the JSON report by
  hand"). So crawler findings never become tickets automatically.
- **Symptom 2 (no auto-fix):** The autopilot dispatcher runtime was never built (Phase 13 shipped DB
  schema only). The toggle arms a non-existent daemon. The separate Sentry→GitHub path only works if the
  Sentry alert rule is configured and acts on GitHub issues, not DB tickets.

## Fix is a feature build (not a patch) — awaiting decision
Options in the report. No code changed.

---

## UPDATE 2026-06-13 — note above is SUPERSEDED; system advanced

Re-diagnosed against **live production data** (project vltmrnjsubfzrgrtdqey). The 06-12 conclusion ("dispatcher never built / crawler doesn't file tickets") is no longer true.

### Current reality (evidence)
- **Dispatcher IS running.** 10 tickets show `attempts: 1` with full autopilot escalation messages ("Autopilot escalation — agent made no fix. VERDICT: ESCALATE …") and opened GitHub issues #322–#327. The loop claims, attempts, and escalates.
- **Crawler DOES file tickets now.** Tickets carry `context.userAgent = "qa-nightly-crawler"`.
- **Distribution:** 73 tickets total → **60 resolved, 10 escalated, 2 new, 1 awaiting_approval** (~82% auto-resolved). `/admin/tickets` filters OUT `resolved`, so the visible queue looks all-escalated (perception artifact).

### Real root cause (NOT a loop bug)
The escalations are **correct declines** of QA-crawler noise. Sample verdicts:
- "Copy Report button doesn't exist anywhere in this codebase/route — can't reproduce"
- "query already chunked at 100 ids; off-route network event = crawler navigation-abort artifact"
- "nth=20 positional click-timeout can't be mapped to a component without DOM context"
- "single transient Failed to fetch is intentionally-logged, already-handled network noise"

Three contributing factors:
1. **No source attribution** — every ticket is `source: manual`; crawler vs Don's crawler vs real in-app user are indistinguishable. → **Phase 18 (Source Attribution)**.
2. **Nightly QA crawler floods the queue with non-defects** (click timeouts, transient aborts, by-design 404s, non-existent buttons). → **Phase 20 (Nightly QA → Fixable Tickets + Flake Suppression)**.
3. **`/admin/tickets` hides resolved** → looks like nothing gets fixed.

### Fix design (checks & balances — not a stricter threshold)
Intervention point: `~/dev/autopilot/qa/triage.ts` + `scripts/qa/qa-crawler.ts` + `src/services/qa.service.ts`.
- **Reproduce-before-file:** a finding becomes a *fixable* ticket only if it reproduces on a fresh authenticated load (kills stale-deploy/transient artifacts; verified, not lax).
- **Classify, don't delete:** artifact / by-design findings → low-priority `qa_review` bucket (auditable), not the fixable queue.
- **Recurrence promotion:** a suppressed finding recurring across N nightly runs is promoted back to a real ticket (uses `occurrence_count`). Anti-lax safety net.
- **Autopilot no-fabricate-fix verdict** stays as the last line of defense.

Implements naturally as **Phase 18 → Phase 20**. No one-off patch (would be rebuilt in 20). Autopilot is currently idle (kill switch on), so no new noise is generating right now — time to do it properly.
