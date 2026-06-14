# Phase 22: Recurrence → Structural Fix - Research

**Researched:** 2026-06-14
**Domain:** Supabase ticket-class rollups + Autopilot tier-2 structural-fix escalation
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
Detect recurring classes by clustering across RESOLVED tickets on fingerprint/category (reuse the Phase 18 `source`+error-class taxonomy and the existing fingerprint scheme). A "class" = a cluster of tickets sharing a fingerprint/category root. Cluster over resolved history (60+ resolved tickets exist).
- **Default detection threshold: ≥3 resolved tickets sharing a fingerprint/category root within a rolling 30-day window → flagged as a recurring class.** `[Claude's default — Andrew may override]`

When a class crosses the threshold, create a structural-fix TASK that targets the class root (the shared cause), not any single instance. This is the primary ticket-rate-down lever.

A structural fix is higher blast radius than a per-instance bug fix (it changes shared code/behavior). Per the established principle (FEAT deferred for blast radius; high-risk → human/tier-2), a structural-fix task is surfaced as a SOLUTION-SHAPED recommendation to the tier-2/admin-approval lane (what the class is, why it recurs, the proposed structural fix, 2-3 a/b/c options) — it is NEVER pushed by the autonomous bug lane. Reuse the tier-2 digest (Phase 19) and the autonomy ladder. Andrew approves structural fixes explicitly.

Track per-class recurrence rate so a structural fix's effect is observable: the class's fresh-ticket rate before vs after the fix lands. Surface in AdminTab. A class whose rate drops to ~0 post-fix is "killed."

### the agent's Discretion
Class identity/schema (a `ticket_classes` table or a derived clustering view); how the structural-fix task is represented (a special ticket type/lane vs a tier-2 digest entry); the exact clustering query. Reuse fingerprint scheme, `runner_runs`, tier-2 digest, autonomy-ladder gating, admin surfaces.

### Deferred Ideas (OUT OF SCOPE)
Customer comms → Phase 23. Auto-push of structural fixes → never (admin-approval only). FEAT lane → v2.1.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REC-01 | Recurring ticket classes are detected (fingerprint/category clustering across resolved tickets) | Use `ticket_classes` plus a service-role `rollup_ticket_classes()` RPC keyed by source + error class + namespaced fingerprint root. [VERIFIED: codebase] |
| REC-02 | A recurring class escalates to a structural-fix task that targets the class, not the instance | Insert one `tickets.type='task'`, `source='internal'`, `status='escalated'`, linked to the class and rendered as a tier-2 digest, never as an autonomous bug-lane candidate. [VERIFIED: codebase] |
</phase_requirements>

## Summary

Phase 22 should add a durable `ticket_classes` table, not only a derived view. The class detector needs persistent state for first/last threshold crossing, linked structural-fix task id, post-fix measurement anchors, suppressed duplicate escalations, and AdminTab sorting; a view can expose metrics but cannot safely remember escalation state. [VERIFIED: `tickets`, `ticket_events`, `runner_runs`, `autopilot_category_trust`, and `autopilot_trust_events` migrations]

The class key should be `source:<source>:error:<error_class>:fingerprint:<namespaced_fingerprint_root>`, where `source:<source>:error:<error_class>` matches Autopilot's existing `buildFixCategory()` root and the fingerprint portion is explicitly source-namespaced. `tickets.fingerprint` has one global partial unique index shared by Sentry and QA, while Sentry uses values like `sentry:<issue_id>` and QA commonly uses `qa:<hash>`; the table should not assume every future producer prefixes correctly. [VERIFIED: `20260611000002_create_ticket_tables.sql`, `20260612130000_sentry_ticket_ingestion.sql`, `20260613235000_create_qa_findings_and_ingest_qa_ticket.sql`, `~/dev/autopilot/src/lib/approval.ts`]

**Primary recommendation:** implement a service-role class rollup in `brain` and a small tier-2 consumer extension in `autopilot`; structural fixes surface as solution-shaped internal task tickets in the admin/tier-2 lane, never as auto-pushed bug fixes. [VERIFIED: `docs/architecture/autopilot-brain-ownership.md`, `.planning/design/escalation-tier2-solutions-not-problems.md`, `~/dev/autopilot/src/lib/tier2.ts`]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Class schema + rollup RPCs | Database / Storage | API / Backend | Supabase migrations are the shared contract between `brain` and `autopilot`; rollups need transactional access to tickets, events, and structural-fix links. [VERIFIED: architecture ownership doc] |
| Class detection cadence | API / Backend | Autopilot daemon | Brain owns the RPC; Autopilot can call it on tier-2 cadence or the AdminTab can refresh read RPCs. [VERIFIED: ownership doc, tier2 cycle code] |
| Structural-fix escalation | Autopilot daemon | Database / Storage | Tier-2 digest/routing lives in Autopilot; durable task/ticket rows and audit events live in Supabase. [VERIFIED: `~/dev/autopilot/src/lib/tier2.ts`] |
| Admin observability | Browser / Client | Service + Hook layer | Existing AdminTab metrics use `src/services/admin-dashboard.service.ts` and `src/hooks/useAdminDashboard.ts`; new recurrence metrics should follow that pattern. [VERIFIED: codebase] |
| Approval authority | Autopilot approval path | Admin UI | `executeApproval()` is the only merge route and admin/tier trust events are the authority surface; structural fixes must not bypass it. [VERIFIED: `~/dev/autopilot/src/lib/approval.ts`] |

## Project Constraints (from AGENTS.md)

- Direct-main workflow: commit and push to `origin/main`; no feature branches or PRs unless explicitly asked. [VERIFIED: AGENTS.md]
- Zero new npm packages for this milestone; use npm only. [VERIFIED: AGENTS.md, ROADMAP.md]
- Frontend stack is React 18, Vite 5, React Router v6, TanStack Query, Zustand v5, Tailwind, shadcn/ui, Remix Icons, and `motion/react`; Lucide, FontAwesome, `framer-motion`, pnpm, bun, and yarn are banned in `brain`. [VERIFIED: AGENTS.md]
- Service + Hook separation is locked: services are pure async TS, hooks wrap services with TanStack Query, and components do not call services directly. [VERIFIED: AGENTS.md, `src/CLAUDE.md`]
- Backend schema lives in `brain`; daemon code lives in `~/dev/autopilot`; the repos share no code and integrate only through Supabase tables. [VERIFIED: ownership doc]
- Integration tests must use a real Supabase test project and must not mock Supabase. [VERIFIED: `supabase/CLAUDE.md`]
- All operator-facing tier-2 output must be solution-shaped, one or two plain-English sentences with two or three decisions and one recommendation. [VERIFIED: tier-2 design doc]
- Structural fixes must never ride the autonomous auto-push bug lane. [VERIFIED: Phase 22 CONTEXT]

## Standard Stack

### Core

| Library / Surface | Version | Purpose | Why Standard |
|-------------------|---------|---------|--------------|
| Supabase Postgres migrations | Supabase CLI 2.101.0 | Add `ticket_classes`, indexes, admin RPCs, and service-role rollups | Existing ticket queue, runner ledger, and trust ladder are DB-owned. [VERIFIED: local CLI, migrations] |
| `@supabase/supabase-js` | `^2.84.0` | Frontend/admin service RPC reads and Edge Function calls | Existing services already use Supabase client directly. [VERIFIED: `package.json`, services] |
| Vitest | `^4.0.16` | Unit and migration-text tests | Existing repo test runner and config. [VERIFIED: `package.json`, `vitest.config.ts`] |
| Real Supabase integration tests | repo-native | RPC behavior for rollup/escalation and RLS | Required for backend changes; mocks are banned for integration tests. [VERIFIED: `supabase/CLAUDE.md`] |

### Supporting

| Library / Surface | Version | Purpose | When to Use |
|-------------------|---------|---------|-------------|
| TanStack Query | `^5.90.10` | Admin recurrence metrics hooks | Use for `useTicketClassMetrics()` / dashboard reads. [VERIFIED: `package.json`, existing hooks] |
| Remix Icons | `^4.7.0` | AdminTab recurrence/structural-fix icons | Only allowed icon library. [VERIFIED: `package.json`, `src/CLAUDE.md`] |
| Autopilot tier-2 module | local TS | Route structural-fix digests and validate solution-shaped output | Reuse `buildTier2Digest()`, `validateTier2Digest()`, and ticket event writes. [VERIFIED: `~/dev/autopilot/src/lib/tier2.ts`] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Durable `ticket_classes` table | Derived SQL view only | A view can calculate current recurrence but cannot store escalation status, linked structural task, first-crossed timestamp, or before/after anchors. Use a table plus read RPC/view. [VERIFIED: schema needs from existing patterns] |
| Internal task ticket + tier-2 digest | New ticket type enum or new lane enum | Existing `ticket_type` already includes `task`, and adding enum values is higher schema churn. Use `type='task'`, `source='internal'`, `status='escalated'`, and context markers. [VERIFIED: `ticket_type` enum] |
| New queue framework | BullMQ / pg-boss / Temporal | Roadmap explicitly forbids new queue infrastructure; Supabase claim/update is the queue. [VERIFIED: ROADMAP.md] |

**Installation:** No packages. [VERIFIED: ROADMAP.md]

## Package Legitimacy Audit

No external packages are required or recommended. [VERIFIED: package/read-only research]

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| none | — | — | — | — | OK | No install |

**Packages removed due to [SLOP] verdict:** none  
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```text
Resolved tickets + occurrence events
          |
          v
rollup_ticket_classes(service-role)
          |
          v
ticket_classes
  class_key = source + error_class + namespaced fingerprint root
  threshold = >=3 occurrences in rolling 30d
          |
          +--> Admin recurrence metrics RPC --> admin-dashboard.service.ts --> useAdminDashboard --> AdminTab
          |
          +--> threshold crossed and no open structural task
                    |
                    v
              internal task ticket
              type=task, source=internal, status=escalated,
              context.structural_fix.class_id/class_key
                    |
                    v
              Autopilot tier-2 digest
              solution-shaped options, admin approval only
```

### Recommended Project Structure

```text
supabase/migrations/
  20260614xxxx_phase22_ticket_classes.sql
src/services/
  admin-dashboard.service.ts        # add recurrence metric RPC mapping
src/hooks/
  useAdminDashboard.ts              # add recurrence metrics query or include in dashboard stats
src/pages/admin/
  DashboardSection.tsx              # compact per-class recurrence surface
src/lib/
  ticket-display.ts                 # plain-English structural-fix/class labels
src/test/migrations/
  phase22-ticket-classes.test.ts
src/test/
  ticket-classes.integration.test.ts
~/dev/autopilot/src/lib/
  tier2.ts                          # structural digest helper or overload
  approval.ts                       # keep structural tasks manual/admin only
```

### Pattern 1: Durable Class Table + Rollup RPC

**What:** Add `ticket_classes` keyed by `class_key`, with `category`, `source`, `error_class`, `fingerprint_root`, threshold counts, pre/post rates, lifecycle fields, and `structural_ticket_id`. [VERIFIED: existing SQL schema patterns]

**Recommended columns:**

```sql
CREATE TABLE public.ticket_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_key text NOT NULL UNIQUE,
  category text NOT NULL,
  source public.ticket_source NOT NULL,
  error_class text NOT NULL DEFAULT 'unknown',
  fingerprint_root text NOT NULL,
  resolved_count_30d integer NOT NULL DEFAULT 0,
  occurrence_count_30d integer NOT NULL DEFAULT 0,
  fresh_ticket_rate_30d numeric(10, 4) NOT NULL DEFAULT 0,
  baseline_rate_30d numeric(10, 4),
  post_fix_rate_30d numeric(10, 4),
  threshold_count integer NOT NULL DEFAULT 3,
  threshold_window_days integer NOT NULL DEFAULT 30,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  first_flagged_at timestamptz,
  last_rollup_at timestamptz,
  structural_ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  structural_fix_landed_at timestamptz,
  killed_at timestamptz,
  status text NOT NULL DEFAULT 'watching',
  context jsonb NOT NULL DEFAULT '{}'::jsonb
);
```

**When to use:** Always for Phase 22; a derived view alone is insufficient. [VERIFIED: phase requirements]

### Pattern 2: Class Key Formation

**What:** Reuse Autopilot's existing category root and append a namespaced fingerprint root:

```text
category = source:<normalized source>:error:<normalized error class>
fingerprint_root = <normalized source>:<normalized fingerprint or context fingerprint>
class_key = <category>:fingerprint:<fingerprint_root>
```

**Why:** `tickets.fingerprint` is globally unique and shared across Sentry and QA. Sentry currently prefixes `sentry:` and QA examples prefix `qa:`, but the class layer should fail safe if a future source emits raw IDs. [VERIFIED: ticket unique index, Sentry/QA migrations and tests]

**Error-class extraction order:** mirror Autopilot `buildFixCategory()` exactly: `context.error_class`, `errorClass`, `error_type`, `exception_type`, then Sentry nested `error_class`, `exception_type`, `type`, else `unknown`. [VERIFIED: `~/dev/autopilot/src/lib/approval.ts`]

### Pattern 3: Threshold and Rate Calculation

**What:** Default recurring class threshold is `>=3` resolved/closed occurrences in a rolling 30-day window. Count both ticket rows and dedup occurrence events so the detector works across historical per-instance tickets and newer deduped fingerprints. [VERIFIED: Phase 22 CONTEXT, Sentry/QA ingestion migrations]

**Implementation shape:**

```sql
WITH base AS (
  SELECT
    t.id,
    t.source,
    t.fingerprint,
    t.context,
    t.created_at,
    t.last_seen_at,
    t.occurrence_count,
    /* build category/fingerprint root in SQL with same fallback order */
    ...
  FROM public.tickets t
  WHERE t.status = 'resolved'
    AND t.created_at >= now() - interval '30 days'
    AND t.fingerprint IS NOT NULL
),
occurrences AS (
  SELECT
    b.class_key,
    COUNT(*)::integer AS resolved_count_30d,
    GREATEST(SUM(b.occurrence_count), COUNT(*))::integer AS occurrence_count_30d,
    MIN(b.created_at) AS first_seen_at,
    MAX(COALESCE(b.last_seen_at, b.created_at)) AS last_seen_at
  FROM base b
  GROUP BY b.class_key
)
INSERT INTO public.ticket_classes (...)
SELECT ...
ON CONFLICT (class_key) DO UPDATE SET ...
```

Use `occurrence_count_30d` as the threshold trigger when a single deduped ticket represents multiple arrivals, and keep `resolved_count_30d` visible so the operator can distinguish "three fixed tickets" from "one ticket hit three times." [VERIFIED: `occurrence_count` and `ticket_events` semantics]

### Pattern 4: Structural Fix Representation

**What:** Create one internal task ticket per recurring class:

```text
tickets.type = 'task'
tickets.source = 'internal'
tickets.status = 'escalated'
tickets.severity = class severity max or medium default
tickets.fingerprint = NULL
tickets.context.structural_fix = {
  class_id,
  class_key,
  category,
  source,
  error_class,
  fingerprint_root,
  threshold_count,
  window_days,
  resolved_count_30d,
  occurrence_count_30d,
  baseline_rate_30d
}
```

**Why:** `type='task'` already exists; `source='internal'` already exists; `status='escalated'` already feeds Needs You. This avoids a new enum and keeps the structural fix visible in current AdminTab/ticket detail surfaces. [VERIFIED: `ticket_type`, `ticket_source`, `needsYouQueue()`]

**Guard:** Do not insert a second structural task while `ticket_classes.structural_ticket_id` points to an open `new`, `triaged`, `in_progress`, `awaiting_approval`, or `escalated` task. [VERIFIED: status lifecycle]

### Pattern 5: Tier-2 Digest for Structural Fixes

**What:** Extend Autopilot tier-2 with a structural digest builder. It should render a solution, not a raw problem, and should validate through `validateTier2Digest()`. [VERIFIED: `~/dev/autopilot/src/lib/tier2.ts`]

**Digest content:**

- Summary: the recurring class, why it matters, and the proposed structural fix. [VERIFIED: tier-2 design doc]
- Decisions: two or three options, exactly one recommended. [VERIFIED: `validateTier2Digest()`]
- Route: `digest`, not `auto_fix`, regardless of trust rung, because D-03 overrides category auto-approval for structural fixes. [VERIFIED: Phase 22 CONTEXT]

### Anti-Patterns to Avoid

- **View-only detection:** loses escalation state and before/after anchors. Use a table plus RPC/view. [VERIFIED: requirements]
- **Raw fingerprint as class key:** collision-prone across sources and inconsistent with Phase 18 category taxonomy. Namespace source and category. [VERIFIED: shared unique fingerprint index]
- **Autonomous auto-push for structural fixes:** violates D-03; structural fixes are higher blast radius than per-instance bugs. [VERIFIED: Phase 22 CONTEXT]
- **New package / queue engine:** violates roadmap constraints. [VERIFIED: ROADMAP.md]
- **Frontend recomputation of class metrics:** violates service+hook separation and makes AdminTab expensive/stale. Use SQL RPCs. [VERIFIED: repo architecture]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Queueing structural work | New job queue or cron table | Existing `tickets` + `ticket_events` + Autopilot tier-2 cycle | Supabase tickets are already the queue and AdminTab understands them. [VERIFIED: roadmap and code] |
| Approval authority | Custom structural-fix merge path | Existing `executeApproval()` admin/trust approval path, with structural tasks forced manual | Keeps push-gate, rebase, repro, and deploy-SHA gates intact. [VERIFIED: approval code] |
| Metrics UI data access | Component-side Supabase queries | `admin-dashboard.service.ts` + `useAdminDashboard.ts` | Locked service + hook pattern. [VERIFIED: AGENTS.md] |
| Fingerprint parsing | Ad hoc source-specific branches in UI | DB rollup normalizer + Autopilot `buildFixCategory()` parity tests | Prevents drift between class detection and trust category routing. [VERIFIED: approval code] |

**Key insight:** recurrence is not another bug queue; it is a measured class lifecycle. The durable state belongs in Postgres, while the solution proposal belongs in tier-2/admin approval. [VERIFIED: ownership doc]

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | `tickets` stores `source`, `fingerprint`, `context`, `occurrence_count`, `last_seen_at`, and status; `ticket_events` stores `created`, `occurrence`, and status changes; `runner_runs` stores `fix_category` and survival state. [VERIFIED: migrations] | Add `ticket_classes`, rollup RPCs, and optional links to structural task tickets. No destructive migration. |
| Live service config | No external SaaS config is required for recurrence detection. [VERIFIED: phase scope] | None. |
| OS-registered state | Autopilot tier-2 cadence may run from launchd, but Phase 22 does not need a new launchd job if it hooks into the existing tier-2 cycle. [VERIFIED: `~/dev/autopilot/src/tier2.ts`, ownership doc] | Planner should prefer existing tier-2 cycle; only add launchd config if a current job is absent during implementation. |
| Secrets/env vars | No new secret required. Supabase service-role access already powers daemon writes and RPC calls. [VERIFIED: roadmap constraints] | None. |
| Build artifacts | Generated Supabase types must be regenerated after migrations. [VERIFIED: repo workflow] | Run `supabase gen types ... > src/types/supabase.ts` through the repo's normal linked/test path. |

## Common Pitfalls

### Pitfall 1: Global Fingerprint Collision
**What goes wrong:** QA and Sentry share the `tickets.fingerprint` unique index; using bare fingerprint as class identity can merge unrelated sources if a producer emits an unprefixed value. [VERIFIED: migrations]  
**How to avoid:** class key must include normalized `source`, `error_class`, and a source-namespaced fingerprint root. [VERIFIED: recommended schema]

### Pitfall 2: Missing Deduped Occurrences
**What goes wrong:** counting only resolved ticket rows misses repeated occurrences collapsed into one ticket via `occurrence_count`. [VERIFIED: Sentry/QA ingest RPCs]  
**How to avoid:** rollup should expose both `resolved_count_30d` and `occurrence_count_30d`, and threshold on occurrence count while retaining row count. [VERIFIED: schema]

### Pitfall 3: Creating Duplicate Structural Tasks
**What goes wrong:** each rollup can file another task for the same still-open class. [VERIFIED: status lifecycle]  
**How to avoid:** store `structural_ticket_id` and check open statuses before creating any new task. [VERIFIED: recommended schema]

### Pitfall 4: Trust Ladder Accidentally Auto-Approves Structural Fixes
**What goes wrong:** `routeTier2Escalation()` can return `auto_fix` when category trust is auto. [VERIFIED: tier2 code]  
**How to avoid:** structural-fix escalations must force digest/manual route even if the per-instance category is trusted. [VERIFIED: D-03]

### Pitfall 5: Admin Surface Shows Problems, Not Decisions
**What goes wrong:** recurring classes become another raw alert list. [VERIFIED: tier-2 design doc]  
**How to avoid:** render class metrics plus one solution-shaped tier-2 digest and two/three explicit decisions. [VERIFIED: tier-2 design]

## Code Examples

### Category Parity

```typescript
// Source: ~/dev/autopilot/src/lib/approval.ts
export function buildFixCategory(ticket: { source?: string | null; context?: unknown }): string {
  return `source:${normalizeCategoryPart(ticket.source, "unknown")}:error:${errorClassFromContext(ticket.context)}`;
}
```

### Tier-2 Digest Validation

```typescript
// Source: ~/dev/autopilot/src/lib/tier2.ts
export function validateTier2Digest(digest: Tier2Digest): Tier2Validation {
  const summary = digest.summary.trim();
  if (summary.length < 20 || summary.split(/[.!?]+/).filter((part) => part.trim()).length > 2) {
    return { valid: false, reason: "summary_must_be_one_or_two_sentences" };
  }
  if (digest.decisions.length < 2 || digest.decisions.length > 3) {
    return { valid: false, reason: "decision_count_must_be_two_or_three" };
  }
  if (digest.decisions.filter((decision) => decision.recommendation).length !== 1) {
    return { valid: false, reason: "exactly_one_recommendation_required" };
  }
  return { valid: true, reason: "ok" };
}
```

### Admin Service Pattern

```typescript
// Source: src/services/admin-dashboard.service.ts
export async function getAutopilotTrustMetrics(): Promise<AutopilotTrustMetric[]> {
  const { data, error } = await supabase.rpc("autopilot_trust_metrics");
  if (error) {
    throw new Error(`Failed to fetch autopilot trust metrics: ${error.message}`);
  }
  return ((data ?? []) as AutopilotTrustMetricsRpcRow[]).map(mapAutopilotTrustMetricsRow);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| One ticket per manual report | Fingerprint-deduped Sentry/QA tickets with `occurrence_count` and `last_seen_at` | Phase 12 / Phase 20 | Class detection must count deduped occurrences as recurrence signal. [VERIFIED: migrations] |
| Per-ticket fix success only | `runner_runs.fix_category` + 30-day category trust rollups | Phase 19 | Recurrence can reuse the same source/error taxonomy. [VERIFIED: trust migration] |
| Raw escalations to operator | Tier-2 solution digest with 2-3 decisions | Phase 19 design | Structural fixes should surface as proposals, not raw errors. [VERIFIED: tier-2 design and code] |

**Deprecated/outdated:**
- Bare `source='manual'` as person-reported source is legacy; Phase 18 adds `unknown`, `nightly_qa`, and `internal`. [VERIFIED: Phase 18 migrations]
- Sentry-only fingerprint thinking is outdated; QA and future sources share the same `tickets.fingerprint` column. [VERIFIED: QA/Sentry migrations]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | No unverified assumptions used. | — | — |

## Open Questions

1. **RESOLVED: `ticket_classes` table or derived view?**
   - Decision: use a durable `ticket_classes` table plus admin read RPC/view. [VERIFIED: schema requirements]
   - Reason: threshold crossings, linked structural tickets, before/after anchors, duplicate suppression, and killed status require persisted state. [VERIFIED: phase criteria]

2. **RESOLVED: exact clustering key and collision handling**
   - Decision: `source:<source>:error:<error_class>:fingerprint:<source>:<fingerprint_root>`. [VERIFIED: existing category taxonomy and global fingerprint index]
   - Reason: the class root reuses Phase 18 source/error taxonomy and protects against cross-source collisions in the shared unique fingerprint column. [VERIFIED: migrations]

3. **RESOLVED: threshold**
   - Decision: default threshold is `occurrence_count_30d >= 3` over a rolling 30-day window, with `resolved_count_30d` also displayed. [VERIFIED: CONTEXT.md, ingest semantics]
   - Reason: this honors D-01 and handles both historical per-instance resolved rows and deduped recurrence rows. [VERIFIED: migrations]

4. **RESOLVED: structural-fix representation**
   - Decision: internal `tickets.type='task'`, `source='internal'`, `status='escalated'`, linked from `ticket_classes.structural_ticket_id`, with the proposed fix rendered as a tier-2 digest. [VERIFIED: enums, AdminTab queue, tier2 code]
   - Reason: no new enum needed; existing Needs You and ticket detail surfaces already expose escalated work. [VERIFIED: codebase]

5. **RESOLVED: AdminTab observability**
   - Decision: add `ticket_class_metrics()` admin RPC and map it through `admin-dashboard.service.ts` / `useAdminDashboard.ts`, with a compact dashboard list of recurring classes, rate before/after, current status, and linked structural task. [VERIFIED: existing source/trust metric pattern]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Vite/Vitest scripts | yes | v26.0.0 | none needed |
| npm | package scripts | yes | 11.12.1 | none; npm only |
| Supabase CLI | migrations/types | yes | 2.101.0 | linked project or SQL review if remote unavailable |
| gsd-tools | GSD workflow | yes | gsd-sdk v1.1.0 | none needed |
| psql | optional direct DB inspection | no | — | Supabase CLI and Supabase JS integration tests |

**Missing dependencies with no fallback:** none.  
**Missing dependencies with fallback:** `psql`; not required for planning because Supabase CLI and repo integration helpers are available. [VERIFIED: local command probes]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.16 + real Supabase integration tests |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test -- src/test/migrations/phase22-ticket-classes.test.ts src/services/__tests__/admin-dashboard.recurrence.test.ts` |
| Full suite command | `npm test` plus `npm run test:integration -- ticket-classes` when test DB env is available |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| REC-01 | Rollup clusters resolved tickets into source/error/fingerprint classes and flags threshold at >=3/30d | migration unit + integration RPC | `npm test -- src/test/migrations/phase22-ticket-classes.test.ts` and `npm run test:integration -- ticket-classes` | no, Wave 0 |
| REC-01 | Class key is source-namespaced and does not collide bare QA/Sentry fingerprints | migration unit + integration RPC | same as above | no, Wave 0 |
| REC-02 | Threshold crossing creates at most one internal structural task and links it to class | integration RPC | `npm run test:integration -- ticket-classes` | no, Wave 0 |
| REC-02 | Structural task routes to tier-2 digest/manual approval, never auto-fix route | Autopilot unit | `cd ~/dev/autopilot && npm test -- src/lib/tier2.test.ts src/lib/approval.test.ts` | partial existing; add cases |
| D-04 | Admin recurrence metrics expose before/after rates and killed status | service/unit + component | `npm test -- src/services/__tests__/admin-dashboard.recurrence.test.ts src/pages/admin/__tests__/DashboardSection.recurrence.test.tsx` | no, Wave 0 |

### Sampling Rate

- **Per task commit:** targeted migration/service/autopilot unit tests for changed files. [VERIFIED: repo test scripts]
- **Per wave merge:** `npm test` in `brain`; relevant `~/dev/autopilot` tests for tier-2 changes. [VERIFIED: package scripts]
- **Phase gate:** `npm run build`, targeted integration test with test Supabase env or explicit SKIPPED if env unavailable, and AdminTab screenshot for UI changes. [VERIFIED: repo verification rules]

### Wave 0 Gaps

- [ ] `src/test/migrations/phase22-ticket-classes.test.ts` — SQL shape, RLS, grants, namespaced class key, no view-only implementation.
- [ ] `src/test/ticket-classes.integration.test.ts` — real DB rollup threshold, dedupe occurrence counting, structural task idempotency.
- [ ] `src/services/__tests__/admin-dashboard.recurrence.test.ts` — maps `ticket_class_metrics()` rows.
- [ ] `src/pages/admin/__tests__/DashboardSection.recurrence.test.tsx` — renders recurrence rates and linked structural task.
- [ ] `~/dev/autopilot/src/lib/tier2.test.ts` — structural digest forces manual/digest even when trust rung is auto.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes | Admin-facing RPCs guard with `public.has_role(auth.uid(), 'ADMIN')`; service-role-only rollup/escalation RPCs revoke anon/authenticated execute. [VERIFIED: existing metrics/RPC pattern] |
| V3 Session Management | no | No new session behavior. [VERIFIED: phase scope] |
| V4 Access Control | yes | RLS on `ticket_classes`; admin SELECT only; service-role writes only. [VERIFIED: existing runner/trust patterns] |
| V5 Input Validation | yes | SQL normalizers cap/normalize class key parts; structural task context is JSONB with controlled server-side fields. [VERIFIED: recommended pattern] |
| V6 Cryptography | no | No cryptographic code. [VERIFIED: phase scope] |

### Known Threat Patterns for Phase 22

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Reporter-controlled ticket context influencing class SQL or digest text | Tampering / Injection | Treat ticket text/context as data; normalize category parts in SQL/TS; do not shell interpolate. [VERIFIED: existing brief and approval discipline] |
| Non-admin viewing operational recurrence classes | Information Disclosure | Admin-only RLS and RPC role guard. [VERIFIED: existing admin metrics pattern] |
| Structural tasks bypassing approval | Elevation of Privilege | Force tier-2 digest/manual route; existing approval path remains the only merge route. [VERIFIED: D-03, approval code] |
| Duplicate structural task spam | Denial of Service | Unique/open-task guard via `ticket_classes.structural_ticket_id` and class status. [VERIFIED: recommended schema] |

## Sources

### Primary (HIGH confidence)

- `.planning/phases/22-recurrence-structural-fix/22-CONTEXT.md` — locked D-01..D-04 decisions.
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md` — REC-01/02 and milestone constraints.
- `supabase/migrations/20260611000002_create_ticket_tables.sql` — ticket enums, global fingerprint unique index, lifecycle events.
- `supabase/migrations/20260612130000_sentry_ticket_ingestion.sql` — Sentry dedupe, occurrence_count, last_seen_at.
- `supabase/migrations/20260613180000_extend_ticket_source_enum.sql` and `20260613180500_source_attribution_backfill_metrics.sql` — source taxonomy and metrics pattern.
- `supabase/migrations/20260613200000_phase19_autopilot_trust.sql` — `runner_runs.fix_category`, trust state, admin metrics.
- `supabase/migrations/20260613230001_sentry_debounce_cycletime_cap.sql` — fingerprint cap and Sentry resolve metrics pattern.
- `supabase/migrations/20260613235000_create_qa_findings_and_ingest_qa_ticket.sql` and `20260614000000_ingest_qa_ticket_defense_in_depth.sql` — QA fingerprint/occurrence semantics.
- `src/lib/ticket-display.ts`, `src/services/admin-dashboard.service.ts`, `src/hooks/useAdminDashboard.ts`, `src/pages/admin/DashboardSection.tsx` — AdminTab display/service patterns.
- `~/dev/autopilot/src/lib/approval.ts`, `src/lib/tier2.ts`, `src/lib/trust.ts` — category construction, approval authority, trust ladder, tier-2 digest.
- `.planning/design/escalation-tier2-solutions-not-problems.md` and `docs/architecture/autopilot-brain-ownership.md` — tier-2 operator contract and repo ownership.

### Secondary (MEDIUM confidence)

- CodeGraph status/context for `brain` and `autopilot` — discovery only; source reads above are authoritative.
- GSD Graphify status — stale by 344 hours with no useful Phase 22 hits; not used as behavioral proof.

### Tertiary (LOW confidence)

- none.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all stack choices are existing repo tools; no packages added.
- Architecture: HIGH — grounded in current migrations and Autopilot source.
- Pitfalls: HIGH — each pitfall maps to a verified existing schema/code behavior.

**Research date:** 2026-06-14  
**Valid until:** 2026-07-14, unless Phase 21/22 schema changes land first.

## RESEARCH COMPLETE
