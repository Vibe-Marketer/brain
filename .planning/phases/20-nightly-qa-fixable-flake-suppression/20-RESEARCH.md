# Phase 20: Nightly QA -> Fixable Tickets + Flake Suppression - Research

**Researched:** 2026-06-13
**Domain:** Supabase ticket ingestion RPC + Bun/launchd QA triage daemon + React Admin QA/Tickets surfaces
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

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

### the agent's Discretion
Schema shape for the review lane and quarantine state; exact dedup fingerprint composition; how rerun is invoked (re-crawl vs replay); telemetry for what was suppressed. Use existing patterns (`ingest_sentry_ticket`, `qa_runs`, the runner ledger) and stay inside existing surfaces.

### Deferred Ideas (OUT OF SCOPE)

- Raising daily run-cap / volume headroom → Phase 19.
- Sentry debug→fix→resolve → Phase 21.
- Full tier-2 reviewer runtime (the separate-cadence Claude/Hermes agent) may land with Phase 19/23; Phase 20 only needs to ROUTE QA escalations into the lane, not necessarily build the reviewer daemon.
- Customer-facing comms → Phase 23.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| QA-01 | Nightly automated QA run on schedule; launchd job and Playwright crawler already exist, wire them to fixable-ticket path. | Existing nightly shell invokes `scripts/qa/qa-crawler.ts` then `~/dev/autopilot/qa/triage.ts`; implementation should replace direct REST ticket insert inside triage with `ingest_qa_ticket`. [VERIFIED: local source] |
| QA-02 | QA failures auto-create tickets via `ingest_qa_ticket`, stamped `nightly_qa`, DB-deduped, with repro/replay evidence. | Mirror `public.ingest_sentry_ticket`: `SECURITY DEFINER`, service-role-only, `ON CONFLICT (fingerprint) WHERE fingerprint IS NOT NULL`, created/occurrence events, message/evidence write. [VERIFIED: local source] |
| QA-03 | Flake suppression co-ships: rerun-quarantine plus actionability gate to human-triage lane. | Use fresh authenticated recrawls through the existing crawler, not static replay, because the crawler's findings depend on console/network/page interaction state. Store suppressed/review state in a durable DB lane, visible through existing QA/Admin surfaces. [VERIFIED: local source] |
| QA-04 | Autopilot handles QA tickets in same loop, severity-gated, with per-source budget. | The claimer already selects `status='new'` tickets source-agnostically; add source/severity filters and per-source run-count budget before claim, without increasing `maxRunsPerWindow` or `concurrency`. [VERIFIED: local source] |
</phase_requirements>

## Summary

Phase 20 is an integration and damping phase, not a new framework phase. The crawler already generates stable fingerprints and `qa-report.json`; the nightly shell already runs triage; the tickets table already has `source='nightly_qa'`; the dispatcher already claims `status='new'` tickets regardless of source. The missing piece is to move QA filing behind a server-side `ingest_qa_ticket` RPC and put reproducibility/quarantine in front of that RPC. [VERIFIED: local source]

The planner should treat `ingest_sentry_ticket` as the exact ingestion pattern: server-side source stamping, race-safe DB dedup, service-role-only execution, ticket audit events, and no app-level SELECT-then-INSERT. QA needs one extra state machine before the ingest call: nightly finding -> rerun attempts -> quarantined/review or fixable ticket -> recurrence promotion. [VERIFIED: local source]

**Primary recommendation:** implement a small `qa_findings` quarantine/review ledger plus `ingest_qa_ticket` RPC; make only reproduced low/medium findings create `status='new'` fixable tickets, route high/critical or non-actionable findings to `qa_review`/tier-2 state, and enforce QA's share in the existing claimer budget gate. [VERIFIED: local source]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Crawl and fresh reruns | Autopilot daemon | Browser/Playwright | Playwright crawler and launchd scripts live in `~/dev/autopilot` + `scripts/qa`; browser only supplies observed behavior. [VERIFIED: local source] |
| QA ticket ingestion and dedup | Database / Supabase RPC | Autopilot daemon | `ingest_sentry_ticket` proves DB-owned atomic upsert is the existing dedup pattern; daemon calls RPC with service-role. [VERIFIED: local source] |
| Quarantine/review lane | Database / Storage | Admin frontend | Suppressed/review state must be durable and auditable; UI reads it through admin-only surfaces. [VERIFIED: local source] |
| Fixable-ticket claiming | Autopilot daemon | Database queue columns | `selectNextTicket` and `claimTicket` own the claim loop over `tickets`; DB columns hold status/attempt/backoff. [VERIFIED: local source] |
| Per-source budget | Autopilot daemon | Runner ledger / DB | The current budget guard counts `autopilot.jsonl`; Phase 20 should add source-aware counting from DB/ledger before claim. [VERIFIED: local source] |
| Admin visibility | Frontend service + hook + components | Supabase RLS | `qa.service.ts`, `useQaRuns`, `QaSection`, `TicketsSection`, and `TicketTable` already use service/hook separation and admin-only RLS. [VERIFIED: local source] |

## Project Constraints (from AGENTS.md)

- Direct-main workflow: commit and push to `origin/main`; no PR/branch unless explicitly asked. [VERIFIED: AGENTS.md]
- Use CodeGraph before broad grep for code structure; graph tools are discovery only, not behavioral proof. [VERIFIED: AGENTS.md]
- Frontend stack is React 18 + Vite 5 + react-router-dom v6 + TanStack Query + Zustand v5 + Tailwind + shadcn/ui + Remix Icons + `motion/react`; banned: Lucide, FontAwesome, `framer-motion`, pnpm, bun, yarn. [VERIFIED: AGENTS.md]
- Brain repo package manager is npm only; autopilot repo uses Bun/TypeScript. [VERIFIED: local source]
- Backend is Supabase Postgres/Auth/Storage + Deno Edge Functions; no Docker for Edge Function deploy. [VERIFIED: AGENTS.md]
- Integration tests must hit a real test Supabase database and must not fall back to production env. [VERIFIED: supabase/CLAUDE.md]
- Service + hook separation is locked for frontend data access. [VERIFIED: AGENTS.md]
- Ticket and Admin UI changes must stay inside existing surfaces; no decorative new UX or fake remote runner behavior. [VERIFIED: local source]
- Do not raise daemon concurrency or Phase 19 volume knobs in this phase; concurrency remains 1. [VERIFIED: CONTEXT.md]

## Standard Stack

### Core

| Library / System | Version | Purpose | Why Standard |
|------------------|---------|---------|--------------|
| Supabase Postgres + RPC | Supabase CLI 2.101.0 local | `ingest_qa_ticket`, `qa_findings`/review ledger, ticket dedup | Existing ticket ingestion and queue are DB-backed; `ingest_sentry_ticket` is the proven analog. [VERIFIED: local source] |
| `@supabase/supabase-js` | 2.84 in brain, autopilot dependency present | Service-role RPC calls and admin UI reads | Existing Edge Functions and daemon DB helpers use Supabase JS clients. [VERIFIED: local source] |
| Bun | 1.3.14 | Autopilot triage/claimer runtime | `~/dev/autopilot` package uses `bun test`; nightly triage invokes Bun. [VERIFIED: local source] |
| Playwright | 1.57 in brain | Authenticated QA crawl and reruns | Existing crawler imports Playwright and production nightly shell invokes it. [VERIFIED: local source] |
| Vitest | 4.0.16 | Brain unit/integration tests | Existing `npm test` and integration test gates use Vitest. [VERIFIED: local source] |
| launchd | Darwin Bootstrapper 7.0.0 | Nightly and poller scheduling | `nightly-crawl.sh` is launchd-invoked; project scope explicitly rejects GitHub Actions/cron for nightly QA. [VERIFIED: local source] |

### Supporting

| Library / System | Version | Purpose | When to Use |
|------------------|---------|---------|-------------|
| React/TanStack Query admin surfaces | React 18 / TanStack Query 5.90 | `QaSection`, `TicketsSection`, service/hook reads | Use only for visibility/filtering; not for ticket filing. [VERIFIED: local source] |
| `ticket_events` / `ticket_messages` | Existing DB tables | Audit and evidence attachments/messages | Write lifecycle events and replay evidence from service-role/RPC path. [VERIFIED: local source] |
| `runner_runs` ledger | Existing DB table | Per-run source/budget evidence | Use to enforce and display per-source budget if source is added to detail or joined by ticket. [VERIFIED: local source] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `qa_findings` quarantine table | `tickets.status='triaged'` with `context.qa_lane='qa_review'` | A ticket-status lane is lighter but contradicts D-02's "never tickets" for findings below N reruns and can pollute ticket metrics. Prefer a dedicated ledger for suppressed/review findings. [VERIFIED: local source] |
| Fresh rerun via crawler | Static replay of `qa-report.json` | Report replay cannot prove current browser/network reproducibility; fresh authenticated recrawl matches Andrew's "verified" principle. [VERIFIED: local source] |
| Server Edge Function intake | Browser `send-support-ticket` | Browser path is for person reports and stamps manual-style context; locked decision bans it. [VERIFIED: CONTEXT.md] |

**Installation:** no new packages. [VERIFIED: local source]

## Package Legitimacy Audit

No external packages should be installed in Phase 20. The research found only existing dependencies and runtimes. [VERIFIED: local source]

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| None | — | — | — | — | OK | No install needed |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```text
launchd 03:30 / admin request
        |
        v
Playwright QA crawler (fresh authenticated load)
        |
        v
qa-report.json findings with stable fingerprints
        |
        v
autopilot qa/triage.ts
        |
        +--> known hard noise -> qa_findings lane=suppressed, no ticket
        |
        +--> rerun candidate -> run N fresh recrawls for route/fingerprint
                 |
                 +--> fails reproducibility -> qa_findings lane=qa_review/quarantined
                 |
                 +--> reproduced low/medium -> ingest_qa_ticket RPC
                 |
                 +--> high/critical -> qa_findings lane=tier2_review or non-claimable ticket
        |
        v
public.ingest_qa_ticket SECURITY DEFINER
        |
        +--> INSERT tickets source=nightly_qa status=new
        +--> ON CONFLICT fingerprint: occurrence_count++, last_seen_at=now()
        +--> ticket_messages evidence + ticket_events audit
        |
        v
autopilot claimer (concurrency 1, budget gate)
        |
        +--> source budget permits + severity <= medium -> claim/fix
        +--> source budget exhausted -> reserve capacity for non-QA
```

### Recommended Project Structure

```text
supabase/migrations/
  20260613xxxx_create_qa_findings_and_ingest_qa_ticket.sql

~/dev/autopilot/qa/
  triage.ts                 # call RPC, rerun-quarantine, review/quarantine ledger writes
  triage.test.ts            # unit tests for gating/RPC payload/lane decisions

~/dev/autopilot/src/
  claimer.ts                # per-source budget guard before select/claim
  lib/claim.ts              # optional source/severity-aware candidate filtering

src/services/
  qa.service.ts             # read qa_runs + qa_findings review counts/details

src/pages/admin/
  QaSection.tsx             # show suppressed/review/promoted counts inside existing QA surface
```

### Pattern 1: RPC-Owned Atomic Ticket Ingestion

**What:** Create `public.ingest_qa_ticket(...) RETURNS TABLE (ticket_id uuid, occurrence_count integer, created boolean, promoted boolean)` as a `SECURITY DEFINER` function with `SET search_path = public`, revoke from `PUBLIC`, `anon`, and `authenticated`, grant only to `service_role`. [VERIFIED: local source]

**When to use:** Every QA finding that has passed reproducibility and severity gates. [VERIFIED: CONTEXT.md]

**Implementation shape:**

```sql
CREATE OR REPLACE FUNCTION public.ingest_qa_ticket(
  p_fingerprint TEXT,
  p_severity public.ticket_severity,
  p_context JSONB,
  p_message_body TEXT,
  p_attachments JSONB DEFAULT '[]'::jsonb
)
RETURNS TABLE (ticket_id UUID, occurrence_count INTEGER, created BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_ticket_id UUID;
  v_occurrence_count INTEGER;
  v_created BOOLEAN;
BEGIN
  INSERT INTO public.tickets (
    reporter_id, type, severity, status, source,
    fingerprint, context, occurrence_count, last_seen_at
  )
  VALUES (
    NULL, 'bug', p_severity, 'new', 'nightly_qa',
    p_fingerprint, p_context, 1, NOW()
  )
  ON CONFLICT (fingerprint) WHERE fingerprint IS NOT NULL
  DO UPDATE SET
    occurrence_count = tickets.occurrence_count + 1,
    last_seen_at = NOW()
  RETURNING tickets.id, tickets.occurrence_count
  INTO v_ticket_id, v_occurrence_count;

  v_created := (v_occurrence_count = 1);

  IF v_created THEN
    INSERT INTO public.ticket_events (ticket_id, actor_id, event_type, new_value)
    VALUES (v_ticket_id, NULL, 'created', 'new');

    INSERT INTO public.ticket_messages (ticket_id, author_type, author_id, body, attachments)
    VALUES (v_ticket_id, 'agent', NULL, p_message_body, COALESCE(p_attachments, '[]'::jsonb));
  ELSE
    INSERT INTO public.ticket_events (ticket_id, actor_id, event_type, new_value)
    VALUES (v_ticket_id, NULL, 'occurrence', v_occurrence_count::text);
  END IF;

  RETURN QUERY SELECT v_ticket_id, v_occurrence_count, v_created;
END;
$function$;
```

Planner note: adjust this skeleton if `ticket_messages.author_type='agent'` has any future CHECK changes; current table allows it. [VERIFIED: local source]

### Pattern 2: Dedicated QA Finding Ledger For Quarantine And Review

**What:** Add a durable table for non-ticket findings, for example `public.qa_findings`, keyed by fingerprint plus source/app route metadata, with `lane` and occurrence fields. [VERIFIED: local source]

**Recommended columns:** `fingerprint text primary key`, `lane text check in ('quarantined','qa_review','promoted','ignored_noise')`, `finding_type text`, `severity ticket_severity`, `route text`, `selector text`, `message text`, `first_seen_at timestamptz`, `last_seen_at timestamptz`, `occurrence_count integer`, `consecutive_nightly_count integer`, `repro_attempts jsonb`, `last_qa_run_id uuid references qa_runs(id)`, `promoted_ticket_id uuid references tickets(id)`, `context jsonb`. [VERIFIED: local source]

**Why:** D-02 says findings below N reruns never ticket; D-03 says suppressed/review findings remain auditable. A dedicated ledger satisfies both without adding non-fixable rows to `tickets`. [VERIFIED: CONTEXT.md]

### Pattern 3: Fresh Recrawl Rerun-Quarantine

**What:** Invoke the existing crawler for a constrained route rerun instead of replaying saved JSON. `scripts/qa/qa-crawler.ts` already accepts `--route` and emits fresh fingerprints. [VERIFIED: local source]

**When to use:** For each fresh real finding after hard noise filtering and before RPC ingestion. Default N=2 means the original crawl is evidence, then two fresh authenticated reruns must observe the same fingerprint before filing a fixable ticket. [VERIFIED: CONTEXT.md]

**Planning detail:** Add an autopilot helper that runs `npm run qa:crawl -- --route <route>` or directly invokes `npx tsx scripts/qa/qa-crawler.ts --route <route>` from `/Users/admin/dev/brain`, with `QA_APP_URL=https://app.callvaultai.com` for nightly. Record each rerun's exit code, report path, and matched fingerprint in `qa_findings.repro_attempts`. [VERIFIED: local source]

### Pattern 4: Severity Gate Before Claimable Status

**What:** Only low/medium reproduced QA findings become claimable `tickets.status='new'`. High/critical reproduced QA findings should route to tier-2/review, either as `qa_findings.lane='qa_review'` or as a non-claimable `tickets.status='escalated'` with `source='nightly_qa'`. [VERIFIED: CONTEXT.md]

**Recommendation:** Prefer `qa_findings.lane='qa_review'` for high/critical until the tier-2 runtime exists; add an admin-visible count/detail in `QaSection`. This avoids the current `escalated` behavior that creates GitHub handoff/operator-oriented messaging from `runner.ts`. [VERIFIED: local source]

### Pattern 5: Source Budget In The Existing Claimer Gate

**What:** Add QA budget enforcement next to the existing quiet-hours/run-count budget guard in `~/dev/autopilot/src/claimer.ts`. [VERIFIED: local source]

**Recommended behavior:** Compute `totalRunsInWindow` and `qaRunsInWindow`; if `qaRunsInWindow >= floor(maxRunsPerWindow.maxRuns * 0.5)`, select/claim only non-QA tickets until the window rolls. Do not increase `maxRunsPerWindow.maxRuns`, `pollIntervalSec`, or `concurrency`. [VERIFIED: CONTEXT.md]

**Implementation path:** Add `source` to `TicketCandidate`, fetch it in `selectNextTicket`, and either filter candidates before `pickNext` or pass an excluded source set from `claimer.ts` after the budget check. [VERIFIED: local source]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fingerprint dedup | SELECT then INSERT in `triage.ts` | Partial unique index + `ON CONFLICT` RPC | Existing Sentry path is race-safe at DB layer. [VERIFIED: local source] |
| Queue engine | BullMQ/Temporal/Redis/job runner | Existing `tickets` table + conditional UPDATE claim | Project explicitly treats Supabase claim UPDATE as the queue. [VERIFIED: REQUIREMENTS.md] |
| New QA scheduler | GitHub Actions/cron | Existing launchd jobs | Nightly QA needs the authenticated always-on Mac context. [VERIFIED: REQUIREMENTS.md] |
| Review UI from scratch | New dashboard/app surface | Existing `QaSection` and `TicketsSection` | Locked UX asks to stay inside existing surfaces. [VERIFIED: CONTEXT.md] |
| Static report replay | JSON-only replay as proof | Fresh authenticated crawler rerun | Console/network/interaction findings are runtime observations. [VERIFIED: local source] |

**Key insight:** the hard part is not filing a ticket; it is preventing unverified browser artifacts from entering a source-agnostic autonomous fix loop. [VERIFIED: local source]

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | `tickets` rows have `source`, `fingerprint`, `occurrence_count`, `last_seen_at`; `qa_runs` stores run reports; `known-fingerprints.json` stores local dedup in autopilot. [VERIFIED: local source] | Migrate QA dedup state from file/local behavior to DB. Do not rely on `known-fingerprints.json` as canonical after RPC lands. |
| Live service config | launchd invokes `~/dev/autopilot/qa/nightly-crawl.sh`; Admin request queue uses `qa_runs.status='requested'` and `qa-poller.ts`. [VERIFIED: local source] | Ensure launchd command path still works after triage signature changes; decide whether `qa-poller` should also triage or remain run-ledger-only. |
| OS-registered state | `com.callvault.qa-nightly` is referenced as the nightly job in requirements/context; launchd is available locally. [VERIFIED: local source] | If script path or env expectations change, reload launchd plist outside repo. |
| Secrets/env vars | Nightly triage reads `/Users/admin/dev/brain/.env(.local)` for `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; crawler reads login creds and `QA_APP_URL`. [VERIFIED: local source] | No new secret. Keep service-role use in autopilot/Edge server context only; never browser. |
| Build artifacts | `qa-report.json`, `~/dev/autopilot/qa/known-fingerprints.json`, `~/dev/autopilot/qa/runs.log`, `~/dev/autopilot/logs/autopilot.jsonl`. [VERIFIED: local source] | Treat old file dedup as transitional; preserve logs but don't use them as source of truth for new recurrence promotion. |

## Common Pitfalls

### Pitfall 1: Creating Tickets Before Reproducibility
**What goes wrong:** transient navigation aborts, click timeouts, or by-design states become `status='new'` and the source-agnostic claimer spends fix capacity on noise. [VERIFIED: local source]
**Why it happens:** current triage filters only two hardcoded network noise classes and then files every fresh real finding. [VERIFIED: local source]
**How to avoid:** require N fresh reruns before `ingest_qa_ticket`; store failed reruns in `qa_findings`, not `tickets`. [VERIFIED: CONTEXT.md]
**Warning signs:** sudden spike of low-context `nightly_qa` tickets with single occurrence and no replay evidence. [VERIFIED: local source]

### Pitfall 2: Treating `qa_review` As A Claimable Ticket
**What goes wrong:** review-lane findings still get claimed because `selectNextTicket` only checks `status='new'`, not a separate lane. [VERIFIED: local source]
**Why it happens:** adding `context.qa_lane='qa_review'` alone does not affect the claimer. [VERIFIED: local source]
**How to avoid:** either keep review items in `qa_findings` or ensure any ticket review lane uses a non-`new` status and tests prove the claimer ignores it. [VERIFIED: local source]
**Warning signs:** `qa_review` items appear in `runner_runs` or get worktrees. [VERIFIED: local source]

### Pitfall 3: Recurrence Promotion Fails Because Suppressed Items Are Not Counted
**What goes wrong:** a persistent flaky-looking defect never reaches a real ticket. [VERIFIED: CONTEXT.md]
**Why it happens:** local `known-fingerprints.json` prevents repeats from being reconsidered; `qa_runs.report` is append-only but not a recurrence index. [VERIFIED: local source]
**How to avoid:** increment `qa_findings.occurrence_count` and `last_seen_at` every nightly run, including suppressed/review findings; promote at M=3 observed nightly runs. [VERIFIED: CONTEXT.md]
**Warning signs:** same fingerprint appears in multiple `qa_runs.report.findings` but no ticket or review record changes. [VERIFIED: local source]

### Pitfall 4: QA Starves User/Sentry Tickets
**What goes wrong:** a QA burst consumes all daily claim budget. [VERIFIED: CONTEXT.md]
**Why it happens:** current budget guard only counts total JSONL starts; candidate selection is source-agnostic. [VERIFIED: local source]
**How to avoid:** source-aware budget check before claim; when QA budget is exhausted, filter QA out of candidates rather than stopping all claims. [VERIFIED: local source]
**Warning signs:** `suppressed:budget` while non-QA tickets remain claimable, or QA runs exceed 50% of starts. [VERIFIED: local source]

### Pitfall 5: High/Critical QA Tickets Auto-Fix Silently
**What goes wrong:** high-blast-radius QA findings go through the same low-friction fix loop. [VERIFIED: CONTEXT.md]
**Why it happens:** current claimer ranks critical/high higher and does not know QA severity policy. [VERIFIED: local source]
**How to avoid:** severity gate before ticket creation or before claim: low/medium only for autonomous QA; high/critical to tier-2/review lane. [VERIFIED: CONTEXT.md]
**Warning signs:** `runner_runs` contains `source='nightly_qa'` high/critical work. [VERIFIED: local source]

## Code Examples

### Triage RPC Call Shape

```typescript
const { data, error } = await supabase.rpc("ingest_qa_ticket", {
  p_fingerprint: f.fingerprint,
  p_severity: ticketSeverity(f),
  p_context: {
    qa: {
      origin: "qa-nightly-crawler",
      app_url: report.app_url,
      route: f.route,
      selector: f.selector || null,
      finding_type: f.type,
      occurrences_this_run: f.occurrences ?? 1,
      repro: reproEvidence,
      qa_run_id: runId,
    },
  },
  p_message_body: buildMessage(report, f),
  p_attachments: [],
});

if (error) throw new Error(`ingest_qa_ticket failed: ${error.message}`);
```

Source basis: `sentry-webhook/index.ts` calls `supabase.rpc("ingest_sentry_ticket", ...)`; `triage.ts` currently builds ticket context/message. [VERIFIED: local source]

### Source-Aware Budget Filter

```typescript
const total = runsThisWindow();
const qa = await countRunsInWindowBySource(db, "nightly_qa", config.maxRunsPerWindow.windowHours);
const qaCap = Math.floor(config.maxRunsPerWindow.maxRuns * 0.5);
const excludedSources = qa >= qaCap ? new Set(["nightly_qa"]) : new Set<string>();
const head = await selectNextTicket(db, config, Date.now(), excludedSources);
```

Source basis: `claimer.ts` already gates on quiet hours and total rolling-window count before claim. [VERIFIED: local source]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Local `known-fingerprints.json` dedup in triage | DB-level fingerprint dedup via `ingest_qa_ticket` | Phase 20 | Race-safe dedup, occurrence counts, recurrence promotion. [VERIFIED: local source] |
| File every fresh non-hard-noise finding | Reproduce-before-file, then severity/actionability gate | Phase 20 | Prevents nightly crawler artifacts from entering the fix queue. [VERIFIED: CONTEXT.md] |
| Source-agnostic run budget | Per-source QA budget inside total run cap | Phase 20 | QA cannot starve user/Sentry without raising volume. [VERIFIED: CONTEXT.md] |
| Operator-facing escalation | Tier-2/review lane | Phase 20 minimum route | Keeps raw QA problems away from Andrew. [VERIFIED: design doc] |

**Deprecated/outdated:**
- Direct REST inserts into `tickets` from `triage.ts`: replace with `ingest_qa_ticket` RPC. [VERIFIED: local source]
- `known-fingerprints.json` as canonical suppression state: keep only as migration/diagnostic artifact. [VERIFIED: local source]
- Browser `send-support-ticket` for QA: banned by locked decision. [VERIFIED: CONTEXT.md]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Treating original crawl + 2 fresh reruns as satisfying default N=2 reruns. | Architecture Patterns | If Andrew means 2 total observations rather than 2 reruns after original, crawler cost doubles unnecessarily. |
| A2 | `qa_findings` dedicated ledger is acceptable as "inside existing surfaces" if rendered in `QaSection`. | Standard Stack / Architecture Patterns | Planner may choose ticket-status lane instead, requiring more UI/claimer safeguards. |

## Open Questions

1. **Should on-demand Admin "Run scan now" also file/promote tickets?**
   - What we know: `qa-poller.ts` currently runs the crawler and finalizes `qa_runs`, but it does not call `triage.ts`. [VERIFIED: local source]
   - What's unclear: whether manual/on-demand scans should affect recurrence and filing, or remain observational. [ASSUMED]
   - Recommendation: Nightly path must file; on-demand should record findings but default to no filing unless explicitly tagged `triggered_by='admin-request'` and the planner decides manual runs count toward recurrence.

2. **How strict is recurrence "consecutive" vs "observed"?**
   - What we know: CONTEXT says "consecutive/observed nightly runs" with default M=3. [VERIFIED: CONTEXT.md]
   - What's unclear: whether a missing fingerprint resets the counter. [ASSUMED]
   - Recommendation: track both `occurrence_count` and `consecutive_nightly_count`; promote on consecutive count when possible, but keep observed count for audit.

3. **Should high/critical reproduced QA findings become `tickets.status='escalated'` immediately?**
   - What we know: current runner escalation creates operator-oriented agent handoff messages/GitHub issues, which D-07 wants to replace. [VERIFIED: local source]
   - What's unclear: whether Phase 20 should add the minimal tier-2 queue table now. [ASSUMED]
   - Recommendation: keep high/critical in `qa_findings.lane='qa_review'` until tier-2 runtime is implemented; do not use current `runner.ts` escalation path as the final D-07 behavior.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | brain scripts/tests | Yes | v26.0.0 | — |
| npm | brain package manager | Yes | 11.12.1 | No pnpm/bun/yarn in brain |
| Bun | autopilot daemon/tests | Yes | 1.3.14 | None for autopilot |
| Supabase CLI | migrations/types/deploy | Yes | 2.101.0 | Supabase dashboard/manual SQL for emergency only |
| launchd | nightly scheduling | Yes | Darwin Bootstrapper 7.0.0 | None; GitHub Actions/cron out of scope |
| Playwright | crawler/rerun | Package present | 1.57 declared | Existing `npm run qa:crawl` |

**Missing dependencies with no fallback:** none found. [VERIFIED: local source]

**Missing dependencies with fallback:** research-plan/classify-confidence GSD seams are unavailable in this CLI; fallback was direct local source verification and explicit confidence labels. [VERIFIED: local command]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Brain unit/integration framework | Vitest 4.0.16 |
| Brain config file | `vitest.config.ts` |
| Brain quick run command | `npm test -- src/services/__tests__/qa.service.test.ts src/services/__tests__/tickets.service.test.ts src/pages/admin/__tests__/QaSection.test.tsx src/components/settings/__tests__/TicketTable.test.tsx` |
| Brain full suite command | `npm test` |
| Brain real-DB integration command | `npm run test:integration -- sentry-webhook` pattern; add QA RPC integration test and run with TEST env |
| Autopilot unit framework | Bun test |
| Autopilot quick run command | `cd ~/dev/autopilot && bun test qa/triage.test.ts src/lib/claim.test.ts` |
| Autopilot full suite command | `cd ~/dev/autopilot && bun test` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| QA-01 | Nightly shell invokes crawler then triage, and triage uses RPC rather than REST insert. | unit/static + shell smoke | `cd ~/dev/autopilot && bun test qa/triage.test.ts` | Existing file, needs new cases |
| QA-02 | `ingest_qa_ticket` creates first ticket, dedups second call, increments `occurrence_count`, advances `last_seen_at`, writes message/event, service-role-only. | real DB integration | `npm run test:integration -- qa-ticket-ingestion` | Missing Wave 0 |
| QA-03 | Finding below N reruns is quarantined/reviewed, not ticketed; repeated M findings promote. | autopilot unit + DB integration | `cd ~/dev/autopilot && bun test qa/triage.test.ts` plus QA RPC integration | Existing triage test needs expansion; DB test missing |
| QA-04 | QA low/medium tickets can be claimed; high/critical route to review; QA budget filters QA without blocking non-QA. | autopilot unit | `cd ~/dev/autopilot && bun test src/lib/claim.test.ts` | Existing file, needs source-budget cases |
| QA-04 | Admin UI shows QA runs plus review/suppressed counts inside existing surfaces. | React unit | `npm test -- src/pages/admin/__tests__/QaSection.test.tsx src/components/settings/__tests__/TicketTable.test.tsx` | Existing files, need new review-count cases |

### Sampling Rate

- **Per task commit:** run the focused brain or autopilot quick command for touched files. [VERIFIED: local source]
- **Per wave merge:** run `cd ~/dev/autopilot && bun test` for daemon changes and `npm test -- <focused files>` for brain changes. [VERIFIED: local source]
- **Phase gate:** run `npm test`, `cd ~/dev/autopilot && bun test`, and the new real-DB `ingest_qa_ticket` integration test if TEST env is available; if TEST env is unavailable, mark integration test SKIPPED explicitly. [VERIFIED: supabase/CLAUDE.md]

### Wave 0 Gaps

- [ ] `supabase/functions/qa-ingestion/__tests__/qa-ticket-ingestion.integration.test.ts` or `src/test/qa-ticket-ingestion.integration.test.ts` — covers `ingest_qa_ticket` real DB semantics.
- [ ] `~/dev/autopilot/qa/triage.test.ts` — add rerun-quarantine, recurrence promotion, RPC payload, and no-REST-ticket-insert tests.
- [ ] `~/dev/autopilot/src/lib/claim.test.ts` — add source-aware filtering and QA budget cases.
- [ ] `src/pages/admin/__tests__/QaSection.test.tsx` — add review/quarantine counts once service shape is chosen.
- [ ] `src/services/__tests__/qa.service.test.ts` — add `qa_findings` read service tests if the dedicated table is used.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | No for nightly service-role path; yes for admin UI reads | Service-role key only in daemon/Edge context; admin UI gated by Supabase Auth/RLS. [VERIFIED: local source] |
| V3 Session Management | Yes for crawler login | Existing Playwright login uses test account env; do not log credentials. [VERIFIED: local source] |
| V4 Access Control | Yes | `qa_runs`, `runner_runs`, tickets are admin-readable; ingestion RPC revoked from anon/authenticated. [VERIFIED: local source] |
| V5 Input Validation | Yes | Treat crawler finding text as untrusted; cap message sizes; validate RPC args and never use finding-provided source. [VERIFIED: local source] |
| V6 Cryptography | Yes for service-role secret handling | Use Supabase service-role env; do not introduce custom crypto. [VERIFIED: local source] |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Forged QA source in finding payload | Spoofing | RPC stamps `source='nightly_qa'` server-side; triage tests already assert source not read from payload. [VERIFIED: local source] |
| Duplicate ticket storm | Denial of Service | DB partial unique fingerprint index + `ON CONFLICT` occurrence bump. [VERIFIED: local source] |
| Service-role leakage | Information Disclosure / Elevation | Keep RPC calls in autopilot/Edge only; no browser exposure; never log env values. [VERIFIED: supabase/CLAUDE.md] |
| Review lane accidentally claimable | Elevation / Tampering | Do not store review-only items as `status='new'`; add claimer tests. [VERIFIED: local source] |
| Customer comms from QA tickets | Information Disclosure | `source='nightly_qa'` remains operational/customer-silent; reporter_id NULL. [VERIFIED: local source] |

## Sources

### Primary (HIGH confidence)

- `.planning/phases/20-nightly-qa-fixable-flake-suppression/20-CONTEXT.md` — locked D-01..D-07 decisions.
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md` — QA-01..QA-04 and sequencing constraints.
- `.planning/design/escalation-tier2-solutions-not-problems.md` — tier-2/solutions-not-problems law.
- `scripts/qa/qa-crawler.ts` — crawler arguments, fingerprinting, report shape.
- `~/dev/autopilot/qa/triage.ts`, `~/dev/autopilot/qa/nightly-crawl.sh`, `~/dev/autopilot/src/qa-poller.ts` — current nightly/on-demand QA flow.
- `supabase/migrations/20260612130000_sentry_ticket_ingestion.sql` — `ingest_sentry_ticket` analog.
- `supabase/migrations/20260611000002_create_ticket_tables.sql`, `20260612150000_create_qa_runs.sql`, `20260613130000_qa_runs_request_queue.sql`, `20260613180000_extend_ticket_source_enum.sql`, `20260613180500_source_attribution_backfill_metrics.sql` — schema constraints.
- `~/dev/autopilot/src/claimer.ts`, `~/dev/autopilot/src/lib/claim.ts`, `~/dev/autopilot/src/runner.ts` — claim/budget/fix/escalation behavior.
- `src/services/qa.service.ts`, `src/pages/admin/QaSection.tsx`, `src/services/tickets.service.ts`, `src/components/settings/TicketTable.tsx` — admin service/UI surfaces.
- `./AGENTS.md`, `./CLAUDE.md`, `./supabase/CLAUDE.md` — project constraints and integration test safety.

### Secondary (MEDIUM confidence)

- Stale Graphify queries returned no useful nodes and graph status was stale by 338 hours; not used as behavioral proof.
- CodeGraph context identified crawler/ticket entry points; direct file reads were used for final claims.

### Tertiary (LOW confidence)

- None used for implementation recommendations. External web research was not needed because this phase installs no packages and is governed by existing local systems.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all recommended tools are already in repo or installed locally.
- Architecture: HIGH — grounded in direct source/migration reads.
- Pitfalls: HIGH — each pitfall maps to current code behavior plus locked phase decisions.
- Open questions: MEDIUM — on-demand filing semantics and exact review-lane schema need planner/operator decision.

**Research date:** 2026-06-13
**Valid until:** 2026-07-13 for local architecture; refresh earlier if Phase 19 changes run-budget storage or tier-2 queue schema.
