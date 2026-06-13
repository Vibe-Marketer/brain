# Phase 19: Throughput Scale-Up + Trust, Survival & Autonomy - Research

**Researched:** 2026-06-13
**Domain:** Autopilot throughput control, trust metrics, approval automation, canary regression attribution
**Confidence:** HIGH for internal architecture; MEDIUM for default thresholds because they are locked as defaults but not yet measured live

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
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

### the agent's Discretion
Exact survival-record schema and rollup query; category taxonomy for the ladder; canary re-test harness reuse (repro replay vs targeted test); tier-2 scheduling mechanism (launchd/cron). Reuse existing patterns (`runner_runs`, push-gate, approval/claim paths, the repro-replay machinery from 17-04).

### Deferred Ideas (OUT OF SCOPE)
- Live volume raise (flipping maxRuns up) → gated behind Phase 17-05 activation, not done here.
- QA-source per-source budget → Phase 20 (uses this phase's throughput model).
- Sentry resolve-on-stable → Phase 21. Recurrence→structural → Phase 22. Customer comms → Phase 23.
</user_constraints>

## Summary

Phase 19 should be planned as a cross-repo mechanism phase, not a live-volume activation. Brain owns the schema, RPC rollups, RLS, and admin surfacing; Autopilot owns claim cadence, rate-limit defers, canary execution, tier-2 scheduling, and approval enforcement. The integration seam remains shared Supabase tables only. [VERIFIED: docs/architecture/autopilot-brain-ownership.md]

The core implementation should add durable trust state around the existing `runner_runs` ledger rather than replace it: add per-fix survival/canary fields to `runner_runs`, add a category-level `autopilot_category_trust` table, and add an append-only `autopilot_trust_events` audit table for admin promotions, demotions, canary outcomes, and rate-limit defers. `ticket_events` already records status changes, including reopened transitions, and can be joined to `runner_runs.ticket_id` for survival rollups. [VERIFIED: supabase/migrations/20260613090000_create_or_extend_runner_runs.sql] [VERIFIED: supabase/migrations/20260611000002_create_ticket_tables.sql]

**Primary recommendation:** implement a service-role-written trust ledger plus admin-only RPC rollups, then enforce the autonomy ladder in Autopilot before a fix becomes `awaiting_approval` or auto-merged; leave `concurrency: 1` and the live max-run cap conservative until the post-17-05 real-volume re-probe. [VERIFIED: /Users/admin/dev/autopilot/autopilot.config.ts] [VERIFIED: /Users/admin/dev/autopilot/src/claimer.ts]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Run cap, cadence, quiet hours | Autopilot daemon | Brain admin UI | `claimer.ts` already enforces quiet hours and `maxRunsPerWindow`; Brain should only surface status/config, not schedule work. [VERIFIED: /Users/admin/dev/autopilot/src/claimer.ts] |
| Concurrency invariant | Autopilot daemon | Database atomic claim | Lockdir plus conditional `tickets.status='new'` update are the safety boundary; do not add parallel runners. [VERIFIED: /Users/admin/dev/autopilot/src/claimer.ts] [VERIFIED: /Users/admin/dev/autopilot/src/lib/claim.ts] |
| Per-fix survival record | Database / Storage | Autopilot approval/canary writers | Durable outcome fields belong on `runner_runs`; Autopilot writes them service-role after merge/canary/reopen. [VERIFIED: supabase/migrations/20260613090000_create_or_extend_runner_runs.sql] |
| Per-category survival rollup | Database / RPC | Brain service/hook/UI | Use SECURITY DEFINER admin-only RPCs, matching `ticket_source_metrics()`, so the browser does not reimplement trust math. [VERIFIED: supabase/migrations/20260613180500_source_attribution_backfill_metrics.sql] |
| Autonomy ladder enforcement | Autopilot approval path | Brain admin event function | Enforcement belongs in Autopilot before merge/auto-approval; promotion events belong in Brain Edge Function or service-role admin function. [VERIFIED: /Users/admin/dev/autopilot/src/lib/approval.ts] [VERIFIED: supabase/functions/ticket-approval/index.ts] |
| Canary re-test | Autopilot daemon | Database attribution | Autopilot can reuse safe argv repro replay and test commands; DB must link canary failure to originating `runner_runs.id` and ticket. [VERIFIED: /Users/admin/dev/autopilot/src/lib/evidence.ts] |
| Tier-2 escalation | Autopilot daemon | Brain admin digest surface | Tier-2 is a second model/cadence and must produce solution-shaped digests only; ladder gates whether it may auto-fix. [VERIFIED: .planning/design/escalation-tier2-solutions-not-problems.md] |

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ACT-02 | Daily fix throughput raised to ~25–30/day via `maxRunsPerWindow.maxRuns` + tightened cadence, not concurrency, with rate-limit guards and quiet hours. | `autopilot.config.ts` has `pollIntervalSec: 300`, `quietHours`, `maxRunsPerWindow`, and `concurrency: 1`; `claimer.ts` already suppresses new claims at the run cap. Plan config as tunable with conservative default, not live raise. [VERIFIED: .planning/REQUIREMENTS.md] [VERIFIED: /Users/admin/dev/autopilot/autopilot.config.ts] |
| TRU-01 | Track 30-day fix survival per fix and per category. | Extend `runner_runs` and use `ticket_events` status transitions to derive reopen outcomes; add RPC rollup for admin dashboard. [VERIFIED: supabase/migrations/20260613090000_create_or_extend_runner_runs.sql] [VERIFIED: supabase/migrations/20260611000002_create_ticket_tables.sql] |
| TRU-02 | Per-category autonomy ladder with survival gate and explicit admin promotion event. | Add `autopilot_category_trust` plus append-only trust events; enforce in Autopilot approval logic, and write admin promotion through server-verified admin path. [VERIFIED: supabase/functions/ticket-approval/index.ts] |
| TRU-03 | Canary re-test recent fixes and reopen originating ticket with attribution. | Reuse safe repro replay and approval merge replay structure; reopen the same ticket with linked run/fix metadata, never create an unlinked ticket. [VERIFIED: /Users/admin/dev/autopilot/src/lib/evidence.ts] [VERIFIED: /Users/admin/dev/autopilot/src/lib/approval.ts] |
</phase_requirements>

## Project Constraints (from AGENTS.md)

- Use CodeGraph before broad grep/file reads for architecture or code-relationship questions; direct source reads and tests remain authoritative. [VERIFIED: AGENTS.md]
- Direct-main workflow applies; commits use phase-scoped conventional forms such as `docs(19): ...`. [VERIFIED: AGENTS.md]
- Package manager in Brain is npm only; banned package managers are pnpm, bun, and yarn for Brain. [VERIFIED: AGENTS.md]
- Autopilot is a separate Bun-based daemon repo; do not apply Brain's npm-only package rule inside `~/dev/autopilot`. [VERIFIED: /Users/admin/dev/autopilot/package.json]
- Integration tests must hit a real dedicated Supabase database; never mock Supabase for integration tests and never fall back to production env vars. [VERIFIED: supabase/CLAUDE.md]
- Service + Hook separation is required in Brain: pure async services in `src/services`, TanStack Query wrappers in `src/hooks`, components do not call services directly. [VERIFIED: CLAUDE.md]
- All admin/trust mutations that need verified admin identity should use server-side verification and service-role writes; existing `ticket-approval` follows this pattern. [VERIFIED: supabase/functions/ticket-approval/index.ts]
- No new queue engine, SDK, framework, or npm package is needed for Phase 19. [VERIFIED: .planning/ROADMAP.md]
- Brand copy must not positively use "AI-powered"; operator surfaces must be plain-English and solution-shaped, not raw problem dumps. [VERIFIED: AGENTS.md] [VERIFIED: .planning/design/escalation-tier2-solutions-not-problems.md]

## Standard Stack

### Core

| Library / System | Version | Purpose | Why Standard |
|------------------|---------|---------|--------------|
| Supabase Postgres + RLS | CLI 2.101.0 available locally | Durable trust schema, RPC rollups, admin-only reads, service-role daemon writes | Existing Brain/Autopilot seam is shared Supabase tables only. [VERIFIED: environment probe] [VERIFIED: docs/architecture/autopilot-brain-ownership.md] |
| React + TanStack Query | React 18.3.1, TanStack Query 5.90.10 | Admin dashboard surfacing and cache invalidation | Existing admin dashboard uses service + hook + query keys. [VERIFIED: package.json] [VERIFIED: src/hooks/useAdminDashboard.ts] |
| Bun test | Bun 1.3.14 available locally | Autopilot unit tests for claim/approval/evidence/watchdog | Autopilot `package.json` uses `bun test`. [VERIFIED: /Users/admin/dev/autopilot/package.json] |
| Vitest | 4.0.16 | Brain service/component unit tests | Existing Brain `npm test` uses Vitest with jsdom. [VERIFIED: package.json] [VERIFIED: vitest.config.ts] |

### Supporting

| System | Version | Purpose | When to Use |
|--------|---------|---------|-------------|
| `ticket_events` | Existing table | Reopen/status audit source | Derive whether a resolved originating ticket reopened during the 30-day window. [VERIFIED: supabase/migrations/20260611000002_create_ticket_tables.sql] |
| `admin_audit_log` | Existing table | Admin promotion/demotion event audit | Existing service-role-only, admin-readable audit table can receive trust-admin actions. [VERIFIED: supabase/migrations/20260612120000_create_admin_audit_log.sql] |
| `runner_runs.detail` JSONB | Existing column | Structured canary/defer metadata | Use for rich internal detail while adding stable first-class columns for queryable trust state. [VERIFIED: supabase/migrations/20260613090000_create_or_extend_runner_runs.sql] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Extending `runner_runs` | New `fix_survival_records` table only | Separate table is cleaner historically, but `runner_runs` already has `ticket_id`, `fix_sha`, `branch`, `started_at`, `finished_at`, and admin RLS; a small extension avoids duplicating fix identity. [VERIFIED: supabase/migrations/20260613090000_create_or_extend_runner_runs.sql] |
| RPC rollup | Client-side joins in `admin-dashboard.service.ts` | Client-side rollups would pull operational internals and duplicate SQL logic; existing source metrics use an admin-only RPC. [VERIFIED: src/services/admin-dashboard.service.ts] |
| New scheduler engine | launchd/cron/Bun scripts | Roadmap forbids a new queue engine; Autopilot already runs one-cycle launchd-style scripts. [VERIFIED: .planning/ROADMAP.md] [VERIFIED: /Users/admin/dev/autopilot/src/claimer.ts] |

**Installation:**
```bash
# No new packages required.
```

## Package Legitimacy Audit

No external package install is recommended for this phase. [VERIFIED: .planning/ROADMAP.md]

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| none | npm | n/a | n/a | n/a | n/a | No install |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```text
Admin promotion UI
  -> Brain Edge Function / service-role admin path
  -> autopilot_trust_events + autopilot_category_trust
  -> Autopilot findApproval candidates
  -> ladder gate
     -> manual: status awaiting_approval, admin event required
     -> eligible: still manual until explicit admin promotion
     -> auto: approval merge path may proceed without per-fix manual approval

Autopilot run
  -> claimTicket(status new -> in_progress)
  -> processTicket()
     -> rate limit detected: release claim + jitter backoff + deferred ledger, destroy worktree
     -> fixed: tests + gate + evidence + runner_runs fix identity
  -> approval/auto-approval merge
  -> runner_runs merged_at/survival_due_at/category
  -> canary re-test within 24h and before 30d
     -> pass: canary fields updated
     -> regression: same ticket reopened + linked ticket_events/trust event + survival false
  -> RPC rollup
  -> Admin dashboard trust card
```

### Recommended Project Structure

```text
brain/
├── supabase/migrations/20260613xxxx_phase19_autopilot_trust.sql
├── supabase/functions/autopilot-trust-admin/index.ts
├── src/services/admin-dashboard.service.ts
├── src/hooks/useAdminDashboard.ts
├── src/pages/admin/DashboardSection.tsx
└── src/services/__tests__/admin-dashboard.service.test.ts

autopilot/
├── autopilot.config.ts
├── src/lib/claim.ts
├── src/lib/approval.ts
├── src/lib/trust.ts
├── src/lib/canary.ts
├── src/claimer.ts
└── src/*.{test.ts}
```

### Pattern 1: Durable Survival Schema

**What:** Extend `runner_runs` for per-fix trust state and add category/audit tables. [VERIFIED: repo schema]

```sql
ALTER TABLE public.runner_runs
  ADD COLUMN IF NOT EXISTS fix_category text,
  ADD COLUMN IF NOT EXISTS merged_at timestamptz,
  ADD COLUMN IF NOT EXISTS survival_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS survival_status text
    CHECK (survival_status IS NULL OR survival_status IN ('pending','held','reopened','deferred','not_applicable')),
  ADD COLUMN IF NOT EXISTS reopened_at timestamptz,
  ADD COLUMN IF NOT EXISTS reopened_event_id uuid REFERENCES public.ticket_events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS canary_status text
    CHECK (canary_status IS NULL OR canary_status IN ('pending','passed','failed','skipped')),
  ADD COLUMN IF NOT EXISTS canary_last_run_at timestamptz,
  ADD COLUMN IF NOT EXISTS canary_next_run_at timestamptz,
  ADD COLUMN IF NOT EXISTS canary_failure_detail jsonb;

CREATE TABLE public.autopilot_category_trust (
  category text PRIMARY KEY,
  rung text NOT NULL DEFAULT 'manual'
    CHECK (rung IN ('manual','eligible','auto')),
  min_fixes integer NOT NULL DEFAULT 5,
  survival_threshold numeric NOT NULL DEFAULT 0.90,
  survival_rate_30d numeric,
  completed_fixes_30d integer NOT NULL DEFAULT 0,
  last_promoted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_promoted_at timestamptz,
  last_demoted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.autopilot_trust_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES public.runner_runs(id) ON DELETE SET NULL,
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  category text,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  old_value text,
  new_value text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

**Why:** `runner_runs` already represents one daemon run and stores `ticket_id`, `fix_sha`, branch, test/gate output, and `detail`; adding queryable trust columns makes rollups cheap while preserving rich JSON detail. [VERIFIED: supabase/migrations/20260613090000_create_or_extend_runner_runs.sql]

### Pattern 2: Survival Rollup Query

**What:** Use a SECURITY DEFINER RPC to compute per-category completed fixes, survived fixes, reopened fixes, survival rate, and ladder state. [VERIFIED: existing RPC pattern]

```sql
CREATE OR REPLACE FUNCTION public.autopilot_trust_metrics()
RETURNS TABLE (
  category text,
  rung text,
  completed_fixes bigint,
  survived_fixes bigint,
  reopened_fixes bigint,
  survival_rate numeric,
  eligible boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH completed AS (
    SELECT
      rr.fix_category AS category,
      rr.id,
      rr.survival_status
    FROM public.runner_runs rr
    WHERE rr.fix_category IS NOT NULL
      AND rr.merged_at IS NOT NULL
      AND rr.survival_due_at <= now()
      AND rr.survival_due_at >= now() - interval '30 days'
      AND COALESCE(rr.detail->>'rate_limit_suspected', 'false') <> 'true'
  )
  SELECT
    c.category,
    COALESCE(t.rung, 'manual') AS rung,
    COUNT(*) AS completed_fixes,
    COUNT(*) FILTER (WHERE c.survival_status = 'held') AS survived_fixes,
    COUNT(*) FILTER (WHERE c.survival_status = 'reopened') AS reopened_fixes,
    CASE WHEN COUNT(*) = 0 THEN 0::numeric
      ELSE ROUND((COUNT(*) FILTER (WHERE c.survival_status = 'held'))::numeric / COUNT(*)::numeric, 4)
    END AS survival_rate,
    COUNT(*) >= COALESCE(t.min_fixes, 5)
      AND CASE WHEN COUNT(*) = 0 THEN 0::numeric
        ELSE (COUNT(*) FILTER (WHERE c.survival_status = 'held'))::numeric / COUNT(*)::numeric
      END >= COALESCE(t.survival_threshold, 0.90) AS eligible
  FROM completed c
  LEFT JOIN public.autopilot_category_trust t ON t.category = c.category
  GROUP BY c.category, t.rung, t.min_fixes, t.survival_threshold
  ORDER BY c.category;
END;
$function$;
```

**Decision:** the autonomy-ladder gate uses the same 30-day survival metric window as TRU-01: a rolling 30-day window of completed fixes in that category, with `merged_at IS NOT NULL`, `fix_sha IS NOT NULL`, `survival_due_at <= now()`, and rate-limit defers excluded. Promotion eligibility still requires at least 5 completed fixes in that rolling window and at least 90% survival. [RESOLVED: D-02/D-03]

### Pattern 3: Autonomy Ladder State Machine

**What:** The DB stores current rung; the RPC computes eligibility; Autopilot enforces rung at merge/approval time. [VERIFIED: approval path]

```text
manual
  - default for every category
  - all fixes require explicit admin approval

eligible
  - derived gate met: survival_rate >= 0.90 over >= 5 completed fixes in the rolling 30-day window
  - no auto-merge yet; waits for explicit admin promotion event

auto
  - admin promoted category after eligibility
  - Autopilot may auto-approve only this category
  - auto-demote to manual/eligible when survival drops below threshold
```

**Enforcement point:** add a trust check in `approval.ts` before an approval action is considered satisfied and before an auto-approved category is merged. Today `findApprovals()` only returns admin-authored approval/rejection rows on `awaiting_approval` tickets, and `executeApproval()` performs the merge. Phase 19 should add `findApprovalCandidates()` or `findMergeActions()` that returns either admin approvals or system auto-approvals only when `category.rung === 'auto'` and the run is gate/test clean. The `auto` rung means auto-approve only: it skips the human approval step, but never bypasses deterministic rebase, repro replay, push-gate, fast-forward-only merge, or deploy verification. [VERIFIED: /Users/admin/dev/autopilot/src/lib/approval.ts] [RESOLVED: D-03]

### Pattern 4: Canary Re-Test Harness

**What:** Reuse the existing `findReproReplay()` safe argv contract when present; fall back to targeted `npm test`/`npm run build`/gate commands for Brain fixes. [VERIFIED: /Users/admin/dev/autopilot/src/lib/evidence.ts] [VERIFIED: /Users/admin/dev/autopilot/src/lib/approval.ts]

**Schedule:** canary rows with `canary_next_run_at <= now()` are claimed by a separate one-cycle Autopilot script under launchd/cron, with lockdir concurrency 1 like `claimer.ts`. [VERIFIED: /Users/admin/dev/autopilot/src/claimer.ts]

**Regression attribution:** on canary failure, update the original ticket from `resolved` to `new` or `triaged`, write a `ticket_events` row such as `canary_regression_reopened`, write an agent message with the 1-2 sentence what/why plus proposed next step, and update `runner_runs.reopened_event_id`, `survival_status='reopened'`, and `canary_status='failed'`. Do not insert a new ticket. [VERIFIED: .planning/phases/19-throughput-scaleup-trust-survival-autonomy/19-CONTEXT.md]

### Pattern 5: Rate-Limit Defer Path

**What:** Promote `detectRateLimit(transcript)` from passive detail to a first-class terminal branch. [VERIFIED: /Users/admin/dev/autopilot/src/lib/evidence.ts] [VERIFIED: /Users/admin/dev/autopilot/src/runner.ts]

```typescript
if (detectRateLimit(transcript)) {
  const attempts = await fetchAttempts(db, ticketId);
  await releaseClaimWithJitter(db, ticketId, attempts, "rate_limit_defer", nowMs);
  await finishRun("requeued", "deferred:rate-limit", {
    gate_verdict: "skipped",
    gate_stage: "rate_limit",
    detail: { reason: "rate-limit", rate_limit_suspected: true },
  });
  return "deferred:rate-limit";
}
```

**Required distinction:** do not count rate-limit defers as failed fixes, survival attempts, or max-attempt poison. A rate-limit DEFER must not increment `tickets.attempts`; it follows a separate retry-with-backoff path per D-05 and is never logged as a failed fix. If current claim code increments attempts before detection, the D-05 implementation must make the defer path restore or avoid the increment atomically and record any defer count separately from attempts. [VERIFIED: /Users/admin/dev/autopilot/src/lib/claim.ts] [RESOLVED: D-05]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Queue engine | New worker framework or queue service | Existing launchd one-cycle scripts + Supabase tables | Roadmap locks "no new queue engine"; `claimer.ts` already has lockdir concurrency 1 and budget guards. [VERIFIED: .planning/ROADMAP.md] |
| Client-side trust math | Browser-side multi-table rollups | Postgres SECURITY DEFINER RPC | Existing `ticket_source_metrics()` pattern centralizes admin-only metrics. [VERIFIED: supabase/migrations/20260613180500_source_attribution_backfill_metrics.sql] |
| Approval authority | Browser writes to `ticket_events` | Edge Function/service-role path with verified JWT and `has_role` | Existing `ticket-approval` prevents forged approval events. [VERIFIED: supabase/functions/ticket-approval/index.ts] |
| Repro command parsing | Shell strings from ticket bodies | Existing safe argv `findReproReplay()` contract | Current replay rejects shell metacharacters, unsafe commands, and node eval. [VERIFIED: /Users/admin/dev/autopilot/src/lib/evidence.ts] |
| Parallel throughput | More workers/concurrency | Run cap + cadence only | `concurrency: 1` is a load-bearing invariant. [VERIFIED: /Users/admin/dev/autopilot/autopilot.config.ts] |

**Key insight:** Phase 19 is about making trust measurable and enforceable; raising concurrency or adding a new queue would undermine the exact safety mechanisms this phase is meant to prove. [VERIFIED: .planning/ROADMAP.md]

## Common Pitfalls

### Pitfall 1: Treating Rate Limits as Failed Fixes
**What goes wrong:** rate-limit transcripts get ledgered as `failed` or verification failure, consuming attempts and lowering survival/trust metrics. [VERIFIED: current runner catch path]
**Why it happens:** `runner.ts` currently records `rate_limit_suspected` in normal `finishRun()` detail but the catch path hardcodes `rate_limit_suspected: false`, and no branch turns rate limits into `deferred:rate-limit`. [VERIFIED: /Users/admin/dev/autopilot/src/runner.ts]
**How to avoid:** branch on `detectRateLimit()` immediately after agent transcript capture and in the catch path when a transcript exists; release the claim, destroy the worktree in `finally`, set jittered backoff, and write `outcome='deferred:rate-limit'`. [VERIFIED: /Users/admin/dev/autopilot/src/lib/evidence.ts]
**Warning signs:** `runner_runs.status='failed'` or `outcome LIKE '%rate%'`; tickets hitting max attempts after usage-limit text. [ASSUMED]

### Pitfall 2: Auto-Promotion Without an Admin Event
**What goes wrong:** a category silently transitions to `auto` when metrics cross the threshold. [VERIFIED: D-03 locked decision]
**Why it happens:** planners may conflate computed eligibility with the `auto` rung. [ASSUMED]
**How to avoid:** compute `eligible` in RPC, but only mutate `rung='auto'` through a verified admin service-role function that also writes audit/trust event rows. [VERIFIED: supabase/functions/ticket-approval/index.ts]

### Pitfall 3: Reopening a New Ticket Instead of the Originating Ticket
**What goes wrong:** canary failures spawn unlinked tickets, so survival attribution breaks. [VERIFIED: D-04 locked decision]
**Why it happens:** Sentry/watchdog ingestion patterns often create/dedupe tickets, but canary regressions are not new incidents; they are failed survival for a known fix. [VERIFIED: supabase/migrations/20260612130000_sentry_ticket_ingestion.sql]
**How to avoid:** require `runner_runs.ticket_id` and `runner_runs.id` on canary tasks, update that ticket's status, and store `reopened_event_id` on the run. [VERIFIED: supabase/migrations/20260613090000_create_or_extend_runner_runs.sql]

### Pitfall 4: Polluting the Denominator
**What goes wrong:** defers, gate failures, and never-merged branches count as completed fixes. [ASSUMED]
**Why it happens:** `runner_runs` records all daemon runs, not only merged fixes. [VERIFIED: supabase/migrations/20260613090000_create_or_extend_runner_runs.sql]
**How to avoid:** survival denominators must require `merged_at IS NOT NULL`, `fix_sha IS NOT NULL`, and `survival_due_at <= now()`, and exclude `deferred:rate-limit`. [VERIFIED: current ledger columns]

### Pitfall 5: Tier-2 Becomes a Human Escalation Rename
**What goes wrong:** Tier-2 sends raw stack traces or problem statements to Andrew. [VERIFIED: .planning/design/escalation-tier2-solutions-not-problems.md]
**Why it happens:** current runner escalation posts a GitHub handoff issue and a message that says the autopilot could not fix it. [VERIFIED: /Users/admin/dev/autopilot/src/runner.ts]
**How to avoid:** replace direct operator escalation with a tier-2 queue and only surface a solution-shaped digest for the residue. [VERIFIED: .planning/design/escalation-tier2-solutions-not-problems.md]

## Code Examples

### Existing Run-Cap Guard

```typescript
// Source: /Users/admin/dev/autopilot/src/claimer.ts
if (runs >= config.maxRunsPerWindow.maxRuns) {
  const msg = `budget cap: ${runs}/${config.maxRunsPerWindow.maxRuns} runs in ${config.maxRunsPerWindow.windowHours}h window`;
  await updateRunnerState(db, { status: "idle", last_result: msg });
  return { result: "suppressed:budget", claims: 0, merges };
}
```

### Existing Safe Repro Replay Extraction

```typescript
// Source: /Users/admin/dev/autopilot/src/lib/evidence.ts
export function findReproReplay(context: unknown, _messageBodies: string[], replayRoot?: string): ReproReplay | null {
  const record = asRecord(context);
  return replayFromRecord(record?.repro_replay, replayRoot);
}
```

### Existing Approval Recognition Boundary

```typescript
// Source: /Users/admin/dev/autopilot/src/lib/approval.ts
const candidates = events.filter(
  (e) =>
    e.actor_id !== null &&
    e.actor_id !== undefined &&
    (APPROVAL_EVENT_TYPES as readonly string[]).includes(e.event_type)
);
```

## State of the Art

| Old Approach | Current Phase 19 Approach | When Changed | Impact |
|--------------|---------------------------|--------------|--------|
| Closure speed / fix rate as success | 30-day survival as primary metric | Phase 19 locked context, 2026-06-13 | Planning must prioritize durable post-merge state over faster approvals. [VERIFIED: 19-CONTEXT.md] |
| Manual approval for every fix | Per-category manual/eligible/auto ladder | Phase 19 locked context | Throughput becomes livable without removing admin control globally. [VERIFIED: 19-CONTEXT.md] |
| Direct tier-1 escalation to operator/issue | Tier-2 second-opinion model then solution digest | Binding design, 2026-06-13 | Operator sees decisions and recommended resolutions, not raw problems. [VERIFIED: .planning/design/escalation-tier2-solutions-not-problems.md] |
| Rate-limit as generic failed run | Retryable defer with claim release and jitter | Phase 19 locked context | Protects survival metrics and avoids wasting fix attempts. [VERIFIED: 19-CONTEXT.md] |

**Deprecated/outdated:**
- Direct GitHub issue handoff from tier-1 as the operator-facing escalation path; Phase 19 should route to tier-2 first. [VERIFIED: /Users/admin/dev/autopilot/src/runner.ts] [VERIFIED: .planning/design/escalation-tier2-solutions-not-problems.md]
- Using `npx` as a planned new dependency path; Brain package manager is npm, and no new package is needed. The existing runner currently shells `npx vitest`, but Phase 19 does not need to expand that pattern. [VERIFIED: /Users/admin/dev/autopilot/src/runner.ts] [VERIFIED: AGENTS.md]

## Open Questions (RESOLVED)

1. **Category taxonomy source**
   - What we know: tickets have `type`, `severity`, `source`, and `context`; Phase 18 added operational source precision. [VERIFIED: src/services/tickets.service.ts] [VERIFIED: supabase/migrations/20260613180500_source_attribution_backfill_metrics.sql]
   - Resolution: a fix category is `ticket.source` plus a coarse error class derived from existing fingerprint/type fields. Do not create a new taxonomy system; reuse fields tickets already carry and keep the category coarse enough for survival counts to accumulate. [RESOLVED]

2. **Exact denominator window**
   - What we know: requirement says whether a fix holds over 30 days and per-category rollup gates promotion. [VERIFIED: .planning/REQUIREMENTS.md]
   - Resolution: measure the autonomy-ladder gate over a rolling 30-day window of completed fixes in that category, matching the 30-day survival metric. The gate is `>=5` completed fixes in that rolling window and `>=90%` survival, with defers and unmerged runs excluded. [RESOLVED]

3. **Auto-merge vs auto-approve naming**
   - What we know: current production path merges only after an approval event; Phase 19 says proven categories can auto-approve. [VERIFIED: /Users/admin/dev/autopilot/src/lib/approval.ts] [VERIFIED: 19-CONTEXT.md]
   - Resolution: `auto` means auto-approve only. It skips the human approval step but never bypasses deterministic rebase, repro replay, push-gate, fast-forward-only merge, or deploy verification. Insert a service-role `autopilot_auto_approval` trust event and route through the same merge mechanics; do not forge an admin `approval` event. [RESOLVED]

4. **Rate-limit attempt accounting**
   - What we know: `claimTicket()` increments `attempts` before the agent runs. [VERIFIED: /Users/admin/dev/autopilot/src/lib/claim.ts]
   - Resolution: a rate-limit DEFER does not increment `tickets.attempts` and is never logged as a failed fix. It is a separate retry-with-backoff path per D-05; implementation must avoid or restore the pre-run claim increment atomically and store defer accounting separately from fix attempts. [RESOLVED]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Brain build/test, GSD tools | yes | v26.0.0 | none |
| npm | Brain package scripts | yes | 11.12.1 | none; npm only |
| Bun | Autopilot tests/scripts | yes | 1.3.14 | none for Autopilot |
| Supabase CLI | Migration/type generation/deploy | yes | 2.101.0 | Use linked project/remote SQL only if CLI auth unavailable |
| psql | Direct DB query debug | not found in probe output | unknown | Supabase CLI or Supabase SQL editor |
| CodeGraph | Brain code navigation | yes | 1291 files indexed | `rg`/direct reads |
| Graphify | Planning graph | stale/no matching nodes | built 2026-05-30, 496 commits behind | Ignore as behavioral evidence |

**Missing dependencies with no fallback:** none for research/planning.

**Missing dependencies with fallback:**
- `psql` did not print a version in the availability probe; planner can use Supabase CLI, generated migrations, or SQL editor for schema verification. [VERIFIED: environment probe]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Brain unit framework | Vitest 4.0.16 with jsdom |
| Brain config file | `vitest.config.ts` |
| Brain quick run command | `npm test -- src/services/__tests__/admin-dashboard.service.test.ts` |
| Brain full suite command | `npm test` |
| Brain integration command | `npm run test:integration` only with dedicated test Supabase env |
| Autopilot unit framework | Bun test 1.3.14 |
| Autopilot config file | none detected |
| Autopilot quick run command | `bun test src/lib/claim.test.ts src/lib/approval.test.ts src/lib/evidence.test.ts` from `~/dev/autopilot` |
| Autopilot full suite command | `bun test` from `~/dev/autopilot` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| ACT-02 | Run cap suppresses new claims; concurrency remains 1; quiet hours still suppress claims | Autopilot unit | `bun test src/claimer.test.ts src/lib/claim.test.ts` | `src/lib/claim.test.ts` exists; `src/claimer.test.ts` is Wave 0 gap |
| ACT-02 | Conservative cap is surfaced in Admin dashboard without changing live volume | Brain unit/UI | `npm test -- src/services/__tests__/admin-dashboard.service.test.ts` | exists, needs new cases |
| TRU-01 | Per-fix survival fields and per-category rollup exclude defers and unmatured fixes | SQL integration / service unit | `npm run test:integration -- src/**/*.integration.test.ts` with guarded DB, plus service tests | integration file is Wave 0 gap |
| TRU-02 | Ladder state: manual -> eligible -> auto; admin event required for promotion; auto-demotion on survival drop | SQL integration + Autopilot unit | `bun test src/lib/trust.test.ts src/lib/approval.test.ts` | `approval.test.ts` exists; `trust.test.ts` is Wave 0 gap |
| TRU-03 | Canary failure reopens the originating ticket and links `runner_runs.id`/event id | Autopilot unit + DB integration | `bun test src/lib/canary.test.ts`; `npm run test:integration` if env available | Wave 0 gap |
| D-05 | Rate-limit hit releases claim, backs off with jitter, destroys worktree, and records defer not failure | Autopilot unit | `bun test src/lib/claim.test.ts src/lib/evidence.test.ts src/runner.test.ts` | claim/evidence tests exist; runner test is Wave 0 gap |
| D-06 | Tier-2 escalations obey ladder and emit solution digest only | Autopilot unit | `bun test src/lib/tier2.test.ts` | Wave 0 gap |

### Sampling Rate

- **Per task commit:** relevant targeted test from the table above.
- **Per wave merge:** Brain `npm test -- src/services/__tests__/admin-dashboard.service.test.ts` plus Autopilot `bun test` for touched daemon modules.
- **Phase gate:** Brain `npm test`, Brain `npm run build`, Autopilot `bun test`, Autopilot `bun run typecheck`; real-DB integration tests only when `VITEST_INTEGRATION_OK=true` and test Supabase env vars are present. [VERIFIED: supabase/CLAUDE.md]

### Wave 0 Gaps

- [ ] `~/dev/autopilot/src/claimer.test.ts` - covers ACT-02 budget/cadence quiet-hours behavior.
- [ ] `~/dev/autopilot/src/lib/trust.test.ts` - covers TRU-02 ladder eligibility, promotion, and demotion.
- [ ] `~/dev/autopilot/src/lib/canary.test.ts` - covers TRU-03 canary selection and originating-ticket reopen.
- [ ] `~/dev/autopilot/src/runner.test.ts` or focused helper tests - covers D-05 rate-limit defer path.
- [ ] `src/services/__tests__/admin-dashboard.service.test.ts` new cases - covers trust metric RPC mapping and dashboard service contract.
- [ ] `supabase/functions/autopilot-trust-admin/__tests__/autopilot-trust-admin.test.ts` - covers server-verified admin promotion event.
- [ ] Optional real-DB integration test for RLS/RPC if dedicated Supabase test env is configured; skip cleanly otherwise.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes | `authenticateRequest(req, supabase, corsHeaders)` in Edge Functions. [VERIFIED: supabase/CLAUDE.md] |
| V3 Session Management | no direct new browser session logic | Reuse Supabase auth/session; no custom session store. [VERIFIED: CLAUDE.md] |
| V4 Access Control | yes | Admin-only RLS, `has_role(auth.uid(),'ADMIN')`, service-role-only writes for trust/audit rows. [VERIFIED: supabase/migrations/20260612120000_create_admin_audit_log.sql] |
| V5 Input Validation | yes | Zod in Edge Functions for admin mutation payloads, matching `ticket-approval`. [VERIFIED: supabase/functions/ticket-approval/index.ts] |
| V6 Cryptography | no new crypto | Do not add cryptographic primitives. [ASSUMED] |
| V7 Error Handling | yes | Rate-limit defer must not become failed-fix exception; Edge Functions return plain error codes without secrets. [VERIFIED: supabase/functions/ticket-approval/index.ts] |
| V10 Malicious Code | yes | Repro replay must keep safe argv allowlist and reject shell metacharacters/eval. [VERIFIED: /Users/admin/dev/autopilot/src/lib/evidence.ts] |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Forged category promotion from browser | Elevation of privilege | Edge Function verifies JWT and ADMIN role, then service-role writes audit/trust event. [VERIFIED: supabase/functions/ticket-approval/index.ts] |
| Reporter reads runner/trust internals | Information disclosure | Admin-only RLS on `runner_runs`, `runner_state`, new trust tables/RPCs. [VERIFIED: supabase/migrations/20260613090000_create_or_extend_runner_runs.sql] |
| Shell injection through canary replay | Tampering / execution | Safe argv parser; no shell strings from DB/ticket bodies. [VERIFIED: /Users/admin/dev/autopilot/src/lib/evidence.ts] |
| Trust metric manipulation by defers | Tampering | Exclude `deferred:rate-limit` and unmatured runs from rollups; append trust events. [VERIFIED: 19-CONTEXT.md] |
| Silent auto-promotion | Repudiation / elevation | Require explicit admin event and audit row; auto-demotion can be system-authored with metadata. [VERIFIED: 19-CONTEXT.md] |

## Runtime State Inventory

This is not a rename/refactor phase, but it has durable runtime state implications. [VERIFIED: phase scope]

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | `tickets`, `ticket_events`, `runner_state`, `runner_runs`, `admin_audit_log` already exist; `runner_runs` has no survival/canary columns today. [VERIFIED: migrations] | Add migration for trust fields/tables/RPCs; backfill old runs as `not_applicable` or leave null so old history does not skew metrics. |
| Live service config | Autopilot local `autopilot.config.ts` currently has `pollIntervalSec: 300`, `quietHours: 01:00-07:00`, `maxRunsPerWindow.maxRuns: 4`, `concurrency: 1`. [VERIFIED: /Users/admin/dev/autopilot/autopilot.config.ts] | Add conservative tunable config for future cap/cadence, but do not raise live cap in this phase. |
| OS-registered state | Autopilot scripts are launchd-style one-cycle processes, but launchd plist files were not part of this read set. [ASSUMED] | Planner should inspect `~/dev/autopilot/launchd/` before scheduling tier-2/canary jobs. |
| Secrets/env vars | Existing Autopilot uses `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; no new secret is required by Phase 19 unless tier-2 uses a separate model provider credential. [VERIFIED: /Users/admin/dev/autopilot/src/lib/db.ts] [ASSUMED] | Avoid new secrets unless tier-2 provider requires one; document if added. |
| Build artifacts | Autopilot has `clone/` and `worktrees/`; current repo has unrelated dirty/untracked files. [VERIFIED: /Users/admin/dev/autopilot status] [VERIFIED: git status] | Do not modify unrelated artifacts; canary/rate-limit defers must always clean worktrees. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Survival denominator is a rolling 30-day window of completed fixes in the category, matching TRU-01. | Pattern 2 / Open Questions | Gate SQL must filter completed fixes by the rolling window. |
| A2 | Category is `ticket.source` plus a coarse error class from existing fingerprint/type fields. | Open Questions | Over-specific categories may delay eligibility; keep coarse. |
| A3 | Auto-approve routes through existing merge mechanics without forging admin `approval` rows and never bypasses push-gate/ff-only merge. | Open Questions | Event model must distinguish system auto-approval from admin approval. |
| A4 | Rate-limit defers do not increment `tickets.attempts`; defer accounting is separate retry-with-backoff state. | Pattern 5 / Open Questions | Implementation must avoid races around claim-time attempt increments. |
| A5 | Tier-2 can be scheduled with existing launchd/cron patterns. | Runtime State Inventory | Need extra scheduling setup if no suitable launchd pattern exists. |

## Sources

### Primary (HIGH confidence)
- `.planning/phases/19-throughput-scaleup-trust-survival-autonomy/19-CONTEXT.md` - locked decisions D-01 through D-06.
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md` - ACT-02 and TRU-01/02/03 phase scope and sequencing.
- `.planning/design/escalation-tier2-solutions-not-problems.md` - binding tier-2/operator digest design.
- `docs/architecture/autopilot-brain-ownership.md` - cross-repo ownership and shared DB seam.
- `supabase/migrations/20260611000002_create_ticket_tables.sql` - `tickets` and `ticket_events`.
- `supabase/migrations/20260611200000_autopilot_queue_runner_state.sql` - queue-control columns and `runner_state`.
- `supabase/migrations/20260613090000_create_or_extend_runner_runs.sql` - `runner_runs` ledger.
- `src/services/admin-dashboard.service.ts`, `src/hooks/useAdminDashboard.ts`, `src/pages/admin/DashboardSection.tsx` - current admin dashboard/read patterns.
- `/Users/admin/dev/autopilot/autopilot.config.ts`, `/Users/admin/dev/autopilot/src/claimer.ts`, `/Users/admin/dev/autopilot/src/lib/claim.ts`, `/Users/admin/dev/autopilot/src/lib/approval.ts`, `/Users/admin/dev/autopilot/src/runner.ts`, `/Users/admin/dev/autopilot/src/lib/evidence.ts` - daemon mechanics.

### Secondary (MEDIUM confidence)
- Graphify status - graph exists but is stale by 338 hours / 496 commits and returned no nodes for Phase 19 queries, so it was not used for behavioral claims.

### Tertiary (LOW confidence)
- Assumptions listed in the Assumptions Log only.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - verified against local package files and current code.
- Architecture: HIGH - verified against ownership doc, migrations, admin service, and Autopilot daemon files.
- Pitfalls: HIGH for rate-limit and escalation current-state risks; MEDIUM for exact category/denominator recommendations.

**Research date:** 2026-06-13
**Valid until:** 2026-07-13 for internal architecture; revisit immediately after Phase 17-05 activation and real rate-limit re-probe.
