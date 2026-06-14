# Phase 21: Sentry Debug → Fix → Resolve - Research

**Researched:** 2026-06-13
**Domain:** Sentry write-back (resolve REST), agent-disciplined debug briefs in a headless daemon, Honcho memory keyed by fingerprint, debounce/cycle-time/oscillation guards
**Confidence:** HIGH

## Summary

Phase 21 adds an enrichment-and-write-back layer on top of the already-shipping v1.0 Sentry ingestion (`ingest_sentry_ticket` + `sentry-webhook`). Three sub-capabilities: (SEN-03) auto-debug Sentry errors into the existing autopilot fix loop with a debug-disciplined + Honcho-memory brief; (SEN-04) cycle-time tracking + a post-deploy debounce + severity→priority; (SEN-05) a new `sentry-resolve` Edge Function that marks the Sentry issue resolved ONLY on a SHA-matched verified-stable deploy, with a per-fingerprint fix cap that freezes the category and pages on oscillation.

The three locked open questions resolve cleanly and change the plan's shape:
1. **`gsd-debug` does NOT run inside the daemon's headless subprocess.** It is an interactive Claude Code orchestrator skill (slash command → spawns `gsd-debugger`/`gsd-debug-session-manager` subagents, uses `AskUserQuestion`, writes `.planning/debug/*.md` checkpoints). The daemon spawns a SINGLE argv-allowlisted subprocess (`codex exec` tier-1, `claude -p` tier-2) with one brief and no interactivity. "gsd-debug-disciplined" therefore means **embedding the scientific-method debug discipline into the brief text** (`src/lib/brief.ts`), not invoking `/gsd-debug`.
2. **Honcho per-fingerprint memory must use the `@honcho-ai/sdk` TypeScript SDK (session-per-fingerprint), NOT the `mcp__plugin_honcho_honcho__*` MCP tools.** The MCP tools are user-representation-oriented and directory-session-scoped, and only exist inside an interactive Claude session — they are unreachable from the daemon subprocess. **However, the SDK is a new npm package, which collides with the milestone's "zero new npm packages" invariant** — this is the single biggest decision the plan must surface to Andrew (see Open Question 2 + Assumptions A1).
3. **The Sentry resolve endpoint is `PUT /api/0/organizations/{org_slug}/issues/{issue_id}/` with body `{"status":"resolved"}`, scope `event:write`** (verified against official Sentry docs). `issue_id` IS persisted at ingestion (`context.sentry.issue_id`); **`org_slug` is NOT a discrete field** — it is only embedded inside the hardcoded `issue_url` string (`ai-simple.sentry.io`). The plan must either add a discrete `org_slug` (and `project_slug`) to the ingestion context OR have `sentry-resolve` read `SENTRY_ORG` from env. Env-read is the lighter path and matches the "one new secret holder" posture.

**Primary recommendation:** Reuse the existing fix loop and `verifyDeploySha`. Embed debug discipline in the brief (no `/gsd-debug` call). Resolve via raw `fetch` PUT in a new `sentry-resolve` Edge Function reading `SENTRY_ORG`/`SENTRY_AUTH_TOKEN` from env, with `issue_id` pulled from ticket context. Add cycle-time + debounce + per-fingerprint cap as DB state. Surface the Honcho-SDK-vs-no-new-package decision to Andrew before planning locks.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 — Auto-debug brief feeds the fix loop (SEN-03):** Sentry errors are auto-debugged via a gsd-debug-disciplined + Honcho-memory brief (Honcho session keyed by fingerprint), and routed into the existing autopilot fix loop. Reuse the loop — do not fork a separate runner.

**D-02 — Cycle-time + debounce + severity priority (SEN-04):** Track error→ticket→fix→resolve cycle time with a resolve-ASAP target. Severity boosts priority. Harden fingerprint dedup with a DEBOUNCE: a minimum post-deploy occurrence count before a fingerprint tickets, to prevent transient-spike ticket storms.
- **Default debounce: a fingerprint must recur ≥3 times within a 15-minute window post-ingestion before it becomes a fixable ticket.** `[Claude's default — Andrew may override]`

**D-03 — Resolution write-back, verified-stable only (SEN-05):** A NEW `sentry-resolve` Edge Function holds `SENTRY_AUTH_TOKEN` (scope `event:write`, already in .env) and marks the issue resolved ONLY on a SHA-matched verified-stable deploy (deployed commit == fix commit AND a post-deploy quiet window passed). NEVER resolve-on-merge. A per-fingerprint fix cap freezes the category (never global) and pages on oscillation.
- **Default fix cap: ≤3 autonomous fix attempts per fingerprint; on the 4th regression, FREEZE that fingerprint/category and page. Post-deploy quiet window: 30 min before resolve write-back.** `[Claude's default — Andrew may override]`

**D-04 — Resolve write-back is outward-facing:** Marking a real issue resolved on the live `ai-simple.sentry.io` org is outward-facing/irreversible-ish. The write-back path must be gated, idempotent, and only fire on verified-stable deploys. The BUILD is safe to ship; the write-back only triggers on the real conditions.

### Claude's Discretion

Schema for cycle-time + per-fingerprint cap state; exact gsd-debug invocation in the runner's headless session; Honcho session API usage; debounce storage. Reuse `ingest_sentry_ticket`, `runner_runs`, the deploy-SHA verification from Phase 17 (`verifyDeploySha`), and the tier-2/paging mechanisms from Phase 19.

### Deferred Ideas (OUT OF SCOPE)

- Recurrence → structural fix → Phase 22.
- Customer comms → Phase 23.
- No changes to v1.0 ingestion (beyond the additive context-field capture this research recommends for the resolve path).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEN-03 | Sentry errors auto-debugged via a gsd-debug-disciplined + Honcho-memory brief (session keyed by fingerprint), routed into the autopilot fix loop | Resolved as: embed debug discipline in `src/lib/brief.ts`; key a `@honcho-ai/sdk` session by `sentry:<issue_id>` fingerprint; runner already routes Sentry-sourced tickets through `claimer.ts` → `runner.ts` (no fork). See Architecture Patterns 1+2. |
| SEN-04 | Cycle-time tracked (resolve-ASAP), severity boosts priority, fingerprint dedup hardened with debounce | `tickets.occurrence_count`/`last_seen_at` already exist; add a debounce gate (≥3 in 15min) + cycle-time columns/RPC; severity→priority maps onto existing `claimer.ts` claim ordering (urgent DESC → priority DESC → severity rank). See Architecture Pattern 3 + Code Examples. |
| SEN-05 | New `sentry-resolve` Edge Function marks issue resolved only on SHA-matched verified-stable deploy; per-fingerprint fix cap freezes category + pages on oscillation | `PUT /api/0/organizations/{org}/issues/{issue_id}/` `{"status":"resolved"}` scope `event:write` (verified); reuse `verifyDeploySha` (approval.ts); per-fingerprint cap as DB state + `pageAdmin` pattern. See Architecture Pattern 4 + Don't Hand-Roll. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Sentry issue ingestion + dedup | Database / Edge Function | — | `ingest_sentry_ticket` RPC (already shipped) is the atomic write; `sentry-webhook` is the Internet trust boundary. No change. |
| Debounce gate (≥3 in 15min before ticketing) | Database | Edge Function | Occurrence counting is already DB state (`occurrence_count`/`last_seen_at`); the "is this fixable yet" gate belongs in SQL/RPC, read by the claimer. |
| Debug-disciplined brief composition | API / Daemon (autopilot) | — | `src/lib/brief.ts` composes the single argv brief; discipline is brief text, not a tool call. |
| Honcho per-fingerprint memory | API / Daemon (autopilot) | — | Memory read/write happens in the daemon process via the Honcho SDK, scoped to a session keyed by fingerprint. Not a frontend or DB concern. |
| Cycle-time tracking | Database | Daemon | Timestamps live on tickets/runner_runs; a metrics RPC aggregates. Daemon stamps fix/resolve times. |
| Severity → priority | Database / Daemon | — | Claim ordering already lives in `claimer.ts` over DB columns; severity rank already participates. |
| Sentry resolve write-back | API / Edge Function | — | `sentry-resolve` holds the secret + makes the outbound PUT. Edge Function is the only correct secret holder (matches webhook posture). |
| Verified-stable gate (SHA match + quiet window) | Daemon + Edge Function | — | `verifyDeploySha` (daemon, already exists) proves the deploy; the quiet-window + cap check gate the resolve call. |
| Per-fingerprint cap + oscillation paging | Database + Daemon | — | Cap state is DB-durable; paging reuses `user_notifications` (`pageAdmin`). |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | 2 (esm.sh pin) | Edge Function DB + RPC client | Already the project standard; `sentry-webhook` uses the exact `https://esm.sh/@supabase/supabase-js@2` pin. |
| raw `fetch` (Deno) | built-in | Sentry resolve PUT | Project invariant: "Resolution write-back is a single PUT via raw fetch" — no `@sentry/node`/`@sentry/cli` SDK (Out of Scope, REQUIREMENTS.md). |
| `zod` | 3.23.8 (esm.sh pin) | Edge Function input validation | Project standard (`supabase/CLAUDE.md` V5); `sentry-webhook/lib.ts` already pins `https://esm.sh/zod@3.23.8`. |
| Bun + TypeScript | (daemon runtime) | Autopilot daemon code | `~/dev/autopilot` runs on Bun (`bun test`, `Bun.spawn`). Brief/Honcho/cap logic lives here. |
| `vitest` | 4.0.16 | brain test framework | `npm run test` = `vitest run`; Edge Function logic tested via `__tests__/*.test.ts`. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@honcho-ai/sdk` | 2.1.2 (latest); plugin pins `^2.1.0` | Per-fingerprint memory (session + peer.chat + session.context) | ONLY if Andrew approves a new npm package in the daemon. This is the correct fingerprint-keyed memory primitive — but it breaks the "zero new packages" invariant. See Assumptions A1 + Open Question 2. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@honcho-ai/sdk` (new package) | Skip Honcho; store the fingerprint's prior-attempt history as JSONB on the ticket/runner_runs and inject it into the brief | Zero new packages, fully durable, daemon-native. Loses Honcho's dialectic reasoning/representation, but for "what did we try last time on this fingerprint" a structured DB history is arguably better (deterministic, queryable, no external service). **Recommended fallback if Andrew rejects the new package.** |
| `mcp__plugin_honcho_honcho__*` MCP tools | (rejected) | MCP tools are unreachable from the headless daemon subprocess and are directory-session-scoped, not fingerprint-keyed. Cannot satisfy D-01. |
| Discrete `org_slug` column in ingestion context | `sentry-resolve` reads `SENTRY_ORG` from env | Env-read is lighter and keeps v1.0 ingestion untouched (honoring the Deferred "no changes to ingestion"). Org slug is constant (`ai-simple`), so per-ticket storage is redundant. **Recommended.** |
| `statusDetails: {inCommit}` resolve | plain `{"status":"resolved"}` | `inCommit`/`inRelease` ties the resolution to the fix commit/release in Sentry (stronger provenance, auto-regression detection). Requires release/commit data and is "only allowed for issues within a single project" per docs. Worth doing as a v2 enhancement; plain resolve is the safe baseline. See Open Question 3. |

**Installation:**
```bash
# ONLY if Andrew approves the Honcho SDK (otherwise use the JSONB-history fallback — no install):
cd ~/dev/autopilot && bun add @honcho-ai/sdk@^2.1.0
# No install needed for sentry-resolve (raw fetch) or the debounce/cap/cycle-time DB work.
```

**Version verification:** `npm view @honcho-ai/sdk version` → `2.1.2` (confirmed this session). The Honcho Claude plugin bundles `@honcho-ai/sdk: ^2.1.0`.

## Package Legitimacy Audit

> Required because Phase 21 *may* install one external package (`@honcho-ai/sdk`), gated behind Andrew's approval.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `@honcho-ai/sdk` | npm | published, v2.x line | not measured this session | github.com/plastic-labs/honcho (official) | [ASSUMED] | Flagged — planner must add `checkpoint:human-verify` before install; ALSO gated behind the "zero new packages" decision |
| `@supabase/supabase-js` | npm | mature | very high | github.com/supabase/supabase-js | OK | Approved (already in use) |
| `zod` | npm | mature | very high | github.com/colinhacks/zod | OK | Approved (already in use) |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none
**Packages requiring human verification [ASSUMED]:** `@honcho-ai/sdk` — discovered via the bundled Honcho Claude plugin's `package.json` (`^2.1.0`) and `npm view` (2.1.2), but the package-legitimacy seam was NOT run this session and the package is gated behind the milestone's "zero new npm packages" invariant. The planner MUST insert a `checkpoint:human-verify` task before any `bun add` AND surface the new-package decision to Andrew. Run `gsd-tools query package-legitimacy check --ecosystem npm @honcho-ai/sdk` at plan time.

## Architecture Patterns

### System Architecture Diagram

```
                          ┌─────────────────────────────────────────────┐
  Sentry (ai-simple org)  │  ~/dev/brain (Edge Functions + migrations)   │
  event_alert webhook ───►│  sentry-webhook ──► ingest_sentry_ticket RPC │
  (issue_id, level, ...)  │      (HMAC gate)        (atomic upsert +      │
                          │                          dedup + notify)      │
                          └───────────────┬─────────────────────────────┘
                                          │ writes tickets row
                                          │ context.sentry.{issue_id, issue_url, ...}
                                          ▼
                          ┌─────────────────────────────────────────────┐
                          │  DEBOUNCE GATE (NEW, SEN-04)                  │
                          │  fixable only when occurrence_count >= 3      │
                          │  within 15min window post-ingestion           │
                          └───────────────┬─────────────────────────────┘
                                          │ ticket becomes claimable
                                          ▼
  ┌────────────────────────────────────────────────────────────────────┐
  │  ~/dev/autopilot (daemon — REUSE the loop, do not fork)             │
  │  claimer.ts (claim ordering: urgent → priority(severity) → ...)     │
  │     │                                                                │
  │     ▼  PER-FINGERPRINT CAP CHECK (NEW, SEN-05): attempts <= 3?      │
  │     │   if 4th regression → FREEZE category + pageAdmin (no claim)  │
  │     ▼                                                                │
  │  brief.ts composeBrief()  ◄── debug-disciplined brief (NEW)         │
  │     │                     ◄── Honcho fingerprint memory OR          │
  │     │                          JSONB prior-attempt history (NEW)    │
  │     ▼                                                                │
  │  agent.ts runAgent() ──► codex exec (tier-1) / claude -p (tier-2)   │
  │     │  single argv, headless, 2400s watchdog. NO /gsd-debug call.   │
  │     ▼  VERDICT: FIXED                                               │
  │  approval.ts executeApproval() ──► rebase → gate → ff-merge → push  │
  │     │                            ──► verifyDeploySha() (SHA match)  │
  │     ▼  deploy verified + quiet window (30min) elapsed               │
  └─────┼──────────────────────────────────────────────────────────────┘
        │ calls (service-role)
        ▼
  ┌─────────────────────────────────────────────┐         ┌──────────────────┐
  │  sentry-resolve Edge Function (NEW, SEN-05)  │  PUT    │  Sentry REST API │
  │  reads SENTRY_AUTH_TOKEN + SENTRY_ORG (env)  │ ──────► │  /api/0/orgs/    │
  │  issue_id from ticket context                 │ resolve │  {org}/issues/   │
  │  idempotent; verified-stable precondition     │         │  {issue_id}/     │
  └─────────────────────────────────────────────┘         └──────────────────┘
```

### Recommended Project Structure
```
~/dev/brain/
├── supabase/functions/sentry-resolve/
│   ├── index.ts            # NEW: auth (service-role caller) → validate → PUT resolve
│   ├── lib.ts              # NEW: pure resolve-payload + endpoint builder (testable)
│   └── __tests__/
│       └── sentry-resolve.test.ts   # NEW: endpoint/payload/idempotency unit tests
├── supabase/migrations/
│   └── 2026XXXXXXXXXX_sentry_debounce_cycletime_cap.sql  # NEW: debounce gate, cycle-time cols/RPC, per-fingerprint cap state
~/dev/autopilot/
├── src/lib/
│   ├── brief.ts            # EDIT: inject debug discipline + prior-attempt memory into the Sentry brief
│   ├── sentry-memory.ts    # NEW: fingerprint memory adapter (Honcho SDK OR JSONB history)
│   ├── sentry-resolve.ts   # NEW: daemon-side caller of the sentry-resolve Edge Function (verified-stable precondition + cap check)
│   └── *.test.ts           # NEW unit tests (bun test)
```

### Pattern 1: Debug discipline lives in the brief, not a `/gsd-debug` call
**What:** `gsd-debug` is an interactive Claude Code orchestrator (spawns subagents, `AskUserQuestion`, `.planning/debug/*.md` checkpoints). It cannot run inside the daemon's single non-interactive subprocess (`codex exec` / `claude -p`, one argv brief, no stdin).
**When to use:** Always, for SEN-03. Extend `composeBrief()` to add a structured scientific-method block for Sentry-sourced tickets (reproduce → hypothesize → locate via stack trace/culprit → minimal fix → verify with closest test), preserving the existing HARD POLICY containment block.
**Example:**
```typescript
// Source: ~/dev/autopilot/src/lib/brief.ts (existing composeBrief — extend, don't fork)
// Add, for source === "sentry", a discipline block BEFORE the TICKET DATA fence:
//   "Debug method (apply in order): 1) Reproduce from the stack trace + culprit.
//    2) State one hypothesis. 3) Locate the cause at the referenced file:line.
//    4) Make the smallest fix. 5) Run the closest test. Record eliminated
//    hypotheses in NOTES.md. End with exactly one VERDICT line."
```

### Pattern 2: Fingerprint memory — session-per-fingerprint (SDK) or JSONB history (no-package)
**What:** Memory keyed by the Sentry fingerprint (`sentry:<issue_id>`) so a re-attempt on the same error sees what was tried before.
**When to use:** SEN-03. Two implementations; choose at plan time per Andrew's package decision.
**Example (Honcho SDK path — needs `@honcho-ai/sdk`):**
```typescript
// Source: @honcho-ai/sdk v2 model (Peers / Sessions / Messages); CITED: honcho integrate SKILL.md
import { Honcho } from "@honcho-ai/sdk";
const honcho = new Honcho({ /* env-config */ });
const session = honcho.session(`sentry:${issueId}`);   // session keyed by fingerprint
await session.addMessages([{ peer: "autopilot", content: priorAttemptSummary }]);
const memory = await session.context();                 // inject into the brief
// Lifecycle: create on first attempt (idempotent by fingerprint key);
// reuse on every re-attempt; expire by Honcho TTL or never (issues are long-lived).
```
**Example (no-package fallback — RECOMMENDED if package rejected):**
```typescript
// Store prior-attempt summaries on the ticket/runner_runs as JSONB, keyed by fingerprint.
// On claim, SELECT the last N runner_runs for this fingerprint's ticket and render their
// outcomes/VERDICTs into the brief. Deterministic, durable, zero new deps.
```

### Pattern 3: Debounce gate as a DB precondition (not application SELECT-then-decide)
**What:** A fingerprint must recur ≥3 times within 15min post-ingestion before it is claimable. `occurrence_count` + `last_seen_at` already exist on `tickets`.
**When to use:** SEN-04. Implement as a claim-time predicate (the claimer only claims Sentry tickets meeting the debounce), keeping dedup race-safe in the DB (the v1.0 pattern).
**Example:**
```sql
-- A Sentry ticket is "fixable" only when it has recurred enough, recently enough.
-- (Window semantics: occurrences within 15min of first_seen; tune via config.)
-- Add a generated/queried predicate the claimer respects; do NOT change ingest_sentry_ticket.
WHERE source = 'sentry'
  AND occurrence_count >= 3
  AND last_seen_at >= created_at + interval '15 minutes' IS NOT TRUE  -- recurred within window
```

### Pattern 4: Sentry resolve — raw fetch PUT, env-sourced org, idempotent
**What:** `PUT /api/0/organizations/{org_slug}/issues/{issue_id}/` body `{"status":"resolved"}`, `Authorization: Bearer <SENTRY_AUTH_TOKEN>`, scope `event:write`.
**When to use:** SEN-05, only after `verifyDeploySha` passes AND the 30-min quiet window elapsed AND the per-fingerprint cap is not tripped.
**Example:**
```typescript
// Source: docs.sentry.io/api/events/update-an-issue/ (CITED)
const org = Deno.env.get("SENTRY_ORG")!;                 // 'ai-simple'
const token = Deno.env.get("SENTRY_AUTH_TOKEN")!;        // scope event:write
const res = await fetch(
  `https://sentry.io/api/0/organizations/${org}/issues/${issueId}/`,
  { method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "resolved" }) }
);
// Idempotent: resolving an already-resolved issue is a no-op 200. Treat 4xx as a
// real error (page); 5xx as retryable. Never log the token.
```

### Anti-Patterns to Avoid
- **Calling `/gsd-debug` or any MCP tool from the daemon.** Both require an interactive Claude session; the daemon has neither. (Resolves Open Question 1.)
- **Resolve-on-merge.** Manufactures false-regression storms (D-03/STATE). Resolve ONLY after `verifyDeploySha` + quiet window.
- **Global freeze on oscillation.** Cap freezes the SINGLE fingerprint/category, never the whole loop (D-03).
- **Storing the Sentry token anywhere but the Edge Function env.** It is the one new secret holder (D-03, STATE "one new secret").
- **Changing `ingest_sentry_ticket`.** Deferred/out of scope. Capture org/project via env in the resolve function, or as a NEW additive context field on a NEW write path — never edit the v1.0 RPC.
- **SELECT-then-INSERT dedup.** The DB partial-unique index is the arbiter (v1.0 invariant).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deploy-SHA verification | A new poll-prod-for-SHA routine | `verifyDeploySha` in `~/dev/autopilot/src/lib/approval.ts` | Already polls prod, matches the baked-in `@sentry/vite-plugin` release SHA, injectable for tests. Reuse verbatim. |
| Admin paging on oscillation | A new notification channel | `pageAdmin` pattern (`user_notifications` insert, type `health_alert`) in approval.ts | Established paging path; AdminTab already surfaces it. |
| Sentry API client | `@sentry/node` / `@sentry/cli` | raw `fetch` PUT | Explicit Out-of-Scope item; one endpoint, one method. |
| Fingerprint dedup | Application-side counting | `ingest_sentry_ticket` + partial unique index (shipped) | Race-safe in the DB; v1.0 already does this. |
| Edge Function auth | Inline `Authorization` parsing | `authenticateRequest` from `_shared/auth.ts` | Project invariant (STATE + supabase/CLAUDE.md). The `sentry-resolve` caller is the service-role daemon, so verify the caller is authorized (service-role or admin), not a public JWT. |
| Tier-2 escalation digest | A new operator-message format | `enqueueTier2Escalation`/`validateTier2Digest` in `~/dev/autopilot/src/lib/tier2.ts` | "Solutions not problems" digest is already built + validated (1-2 sentences, 2-3 decisions, banned error dumps). Reuse for cap-freeze paging. |

**Key insight:** Phase 21 is almost entirely composition of shipped primitives. The only genuinely new code is: the `sentry-resolve` Edge Function (raw fetch), the debounce/cycle-time/cap DB state, the brief discipline block, and the fingerprint-memory adapter. Everything else (deploy-SHA gate, paging, dedup, claim ordering, tier-2 digest) already exists.

## Runtime State Inventory

> Phase 21 is additive (new function + new DB state + brief edits), not a rename/refactor. Included because it touches a live external service (Sentry) and the daemon.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `tickets.context.sentry.issue_id` IS persisted (verified in `sentry-webhook/index.ts`). `org_slug` is NOT a discrete field — only inside the hardcoded `issue_url` string (`ai-simple.sentry.io`). `occurrence_count`/`last_seen_at` exist. | Resolve function reads `SENTRY_ORG` from env (recommended) OR plan adds a discrete `org_slug`/`project_slug` field on a new write path. NEW migration for debounce/cycle-time/cap state. |
| Live service config | Sentry alert rule + GitHub-issue integration exists (`.github/workflows/sentry-autofix.yml`). The webhook → `ingest_sentry_ticket` path is live. Resolving writes to the REAL `ai-simple` org. | The `sentry-autofix.yml` GitHub-issue path is a PARALLEL legacy mechanism (Sentry → GitHub issue → @claude). Confirm with Andrew whether it stays or is superseded by the daemon loop (potential double-handling). Flag — not a code change in this phase unless Andrew says so. |
| OS-registered state | Autopilot daemon runs via launchd on the always-on Mac (per STATE). Tier-2 runs on a distinct cadence (`cadenceMinutes: 180`). | None for this phase — reuse the existing daemon schedule. |
| Secrets/env vars | `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` confirmed present in `~/dev/brain/.env` (names only; values not read). `SENTRY_WEBHOOK_SECRET` used by the webhook. | `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` must be set as Supabase Edge Function secrets for `sentry-resolve` (env in `.env` ≠ deployed function secret). Plan must add `supabase secrets set` step. Verify token scope is `event:write`. |
| Build artifacts | None — no compiled binaries carry Sentry identifiers. | None. |

**The canonical question (after all files updated):** the live Sentry `ai-simple` org will accept resolve PUTs the moment the token is set as a function secret — so the verified-stable gate + cap MUST be in place and tested BEFORE the function can ever fire. Ship the guards in the same phase (matches STATE "SEN ships its damping in the same phase").

## Common Pitfalls

### Pitfall 1: Assuming `/gsd-debug` runs in the daemon
**What goes wrong:** Plan tries to shell `/gsd-debug` or an MCP tool from `runAgent`; it deadlocks or no-ops (no interactive session, no stdin, `AskUserQuestion` impossible).
**Why it happens:** D-01 says "gsd-debug-disciplined," which reads like a tool call.
**How to avoid:** Treat it as discipline-in-the-brief. The daemon spawns ONE argv subprocess with one brief (verified in `agent.ts`/`runner.ts`).
**Warning signs:** Any plan task that imports `mcp__*`, calls a slash command, or expects checkpoints in the daemon.

### Pitfall 2: Honcho new-package collides with "zero new npm packages"
**What goes wrong:** Plan installs `@honcho-ai/sdk` silently, violating a stated milestone invariant (STATE Key Decisions: "Zero new npm packages; exactly one new secret").
**Why it happens:** D-01 names Honcho explicitly; the MCP tools look free but are unusable from the daemon.
**How to avoid:** Surface the decision to Andrew BEFORE planning locks: (a) approve the one package for genuine Honcho memory, or (b) use the JSONB prior-attempt-history fallback (zero packages, deterministic). Recommend (b) unless Andrew wants Honcho's reasoning.
**Warning signs:** A `bun add` task with no `checkpoint:human-verify` and no note about the invariant.

### Pitfall 3: Resolve oscillation loop (the cap's reason for existing)
**What goes wrong:** A "fix" regresses, the error re-fires, a new ticket is created, the agent re-fixes, re-resolves, re-regresses — an infinite resolve/regress storm against the live org.
**Why it happens:** Resolve write-back + auto-fix without a per-fingerprint attempt ceiling.
**How to avoid:** Per-fingerprint cap ≤3; on the 4th regression FREEZE that fingerprint/category (never global) and page via the tier-2 digest. Track attempts in durable DB state keyed by fingerprint.
**Warning signs:** Rising `occurrence_count` on a fingerprint that already has a merged fix; repeated resolve PUTs for the same `issue_id`.

### Pitfall 4: Function-secret vs `.env` confusion
**What goes wrong:** `sentry-resolve` deployed but `SENTRY_AUTH_TOKEN`/`SENTRY_ORG` only live in `.env`, not in Supabase function secrets → runtime `undefined` → 401 from Sentry or a thrown null.
**Why it happens:** `.env` is for local/daemon; Edge Functions read deployed secrets.
**How to avoid:** Plan an explicit `supabase secrets set SENTRY_AUTH_TOKEN=... SENTRY_ORG=...` step and a config-presence check in the function (return 503 if unset, never expose the value).
**Warning signs:** Function works locally, 401s in prod.

### Pitfall 5: Resolving the wrong identifier
**What goes wrong:** The resolve PUT uses the dedup fingerprint (`sentry:<issue_id>`) instead of the bare `issue_id`, or uses the project-issues endpoint with an org slug.
**Why it happens:** The stored fingerprint is `sentry:` + issue_id; the API wants the bare issue_id.
**How to avoid:** Strip the `sentry:` prefix; read `context.sentry.issue_id` (already the bare value as a string). Use the ORGANIZATION issues endpoint with `SENTRY_ORG`.
**Warning signs:** 404 from Sentry on resolve.

## Code Examples

### Cycle-time tracking (SEN-04) — timestamps + aggregation
```sql
-- Source: project DB conventions (supabase/CLAUDE.md). Additive columns; do NOT touch ingest_sentry_ticket.
-- error_at = first_seen (tickets.created_at for sentry rows); ticket_at = same;
-- fix_at = runner_runs.merged_at; resolve_at = NEW column set when sentry-resolve succeeds.
-- A metrics RPC aggregates median cycle time per source, mirroring the Phase 18 per-source metrics RPC.
ALTER TABLE public.tickets ADD COLUMN sentry_resolved_at TIMESTAMPTZ;  -- when write-back succeeded
-- Cycle time = sentry_resolved_at - created_at (resolve-ASAP target tracked per fingerprint).
```

### Severity → priority (SEN-04) — reuse existing claim ordering
```typescript
// Source: ~/dev/autopilot/autopilot.config.ts + claimer.ts (claim order:
//   urgent DESC → priority DESC → severity rank → created_at ASC).
// Severity ALREADY participates in claim ordering. SEN-04 "severity boosts priority"
// means mapping high/medium/low severity onto the priority field at ingestion-read or
// claim time — confirm the existing severity rank already satisfies this before adding
// a redundant priority bump.
```

### Per-fingerprint cap state (SEN-05)
```sql
-- Durable attempt ceiling keyed by fingerprint. A 4th regression flips frozen=true
-- and the claimer excludes frozen fingerprints (category-scoped freeze, never global).
CREATE TABLE public.sentry_fingerprint_cap (
  fingerprint TEXT PRIMARY KEY,            -- 'sentry:<issue_id>'
  fix_attempts INTEGER NOT NULL DEFAULT 0,
  frozen BOOLEAN NOT NULL DEFAULT FALSE,
  frozen_at TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ
);
ALTER TABLE public.sentry_fingerprint_cap ENABLE ROW LEVEL SECURITY;
-- service-role only (no user-facing access); admin reads via service-role surfaces.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sentry → GitHub issue → @claude PR (`sentry-autofix.yml`) | Sentry webhook → DB ticket → daemon fix loop → SHA-verified resolve | Phase 12 (ingestion) → Phase 21 (this) | The GitHub-issue path becomes legacy/parallel. Confirm disposition with Andrew (Runtime State / Live service config). |
| Manual resolve in Sentry UI | Programmatic `event:write` resolve only on verified-stable deploy | Phase 21 | First autonomous write-back to the live org — guarded by SHA match + quiet window + cap. |

**Deprecated/outdated:**
- The `sentry-autofix.yml` "Do not close this issue manually — it will be auto-resolved once deployed" comment anticipated exactly this phase. The auto-resolve mechanism it references is what SEN-05 builds.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The Honcho SDK (`@honcho-ai/sdk`) is the only real way to do fingerprint-keyed Honcho memory from the daemon, and installing it conflicts with the "zero new npm packages" invariant. The JSONB-history fallback is a viable zero-package substitute. | Standard Stack / Pattern 2 / Open Q2 | If Andrew wants true Honcho reasoning, the package must be approved; if the fallback is chosen, no Honcho dialectic memory — just structured prior-attempt history. Either way the plan must NOT silently install. |
| A2 | `SENTRY_ORG` env value is the slug `ai-simple` (consistent with the hardcoded `ai-simple.sentry.io` in the webhook). Value not read (per instruction). | Pattern 4 / Runtime State | If the env holds an org ID or a different slug, the resolve URL path is wrong → 404. Plan must verify the value resolves to the org slug at deploy time. |
| A3 | `SENTRY_AUTH_TOKEN` actually carries `event:write` (or `event:admin`) scope. STATE/CONTEXT assert it but scope was not introspected this session. | Pattern 4 / Runtime State | A read-only token 403s on resolve. Plan must verify scope before relying on write-back. |
| A4 | The daemon (`~/dev/autopilot`) can reach the deployed `sentry-resolve` Edge Function with service-role auth (same way it calls Supabase RPCs today). | Architecture / Don't Hand-Roll | If the daemon should call Sentry directly instead of via the Edge Function, the secret-holder boundary changes. CONTEXT D-03 says the FUNCTION holds the secret, so the daemon calls the function — assumed. |
| A5 | "Severity boosts priority" is largely satisfied by the existing severity rank in claim ordering; only a thin mapping may be needed. Not yet confirmed against `claimer.ts` ordering internals. | Code Examples | If priority and severity are fully independent in the claimer, a real priority-bump write is needed at ingestion-read. Low risk; verifiable at plan time. |

## Open Questions

1. **Honcho memory: approve a new npm package, or use the zero-package JSONB fallback?** (THE decision for this phase.)
   - What we know: MCP Honcho tools are unreachable from the daemon and not fingerprint-keyed; the `@honcho-ai/sdk` (session-per-fingerprint) is the correct primitive but is a new package vs the "zero new npm packages" milestone invariant.
   - What's unclear: whether Andrew values Honcho's dialectic memory enough to break the invariant for ONE package, or prefers the deterministic JSONB prior-attempt history.
   - Recommendation: Default to the JSONB fallback (zero packages, durable, deterministic). Surface the choice to Andrew at `/gsd-discuss-phase` or via a planner `checkpoint:human-verify`. If approved, gate the `bun add` behind package-legitimacy + human-verify.

2. **Capture org/project at ingestion vs read from env in the resolve function?**
   - What we know: `issue_id` is persisted; `org_slug` is only inside the hardcoded URL string; `SENTRY_ORG`/`SENTRY_PROJECT` exist in `.env`. Deferred says "no changes to v1.0 ingestion."
   - What's unclear: nothing blocking.
   - Recommendation: Read `SENTRY_ORG` from the Edge Function env (lighter, honors "no ingestion changes"). Org slug is constant, so per-ticket storage is redundant.

3. **Plain `{"status":"resolved"}` vs `statusDetails: {inCommit/inRelease}`?**
   - What we know: plain resolve is verified and sufficient; `inCommit`/`inRelease` ties resolution to the fix commit/release (stronger provenance, Sentry-side regression detection) but requires release data and is project-scoped.
   - What's unclear: whether the deployed release/commit is reliably available to the resolve call.
   - Recommendation: Ship plain `{"status":"resolved"}` as the baseline; note `inCommit` as a v2 enhancement once release wiring is confirmed.

4. **Disposition of the legacy `sentry-autofix.yml` GitHub-issue path.**
   - What we know: it is a parallel Sentry→GitHub→@claude mechanism; the daemon loop supersedes it functionally.
   - Recommendation: Confirm with Andrew whether it stays (double-handling risk) or is disabled. Not a required code change in Phase 21 unless Andrew directs it.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Sentry REST API (`ai-simple` org) | SEN-05 resolve write-back | ✓ (live org; resolve verified against docs) | API v0 | — |
| `SENTRY_AUTH_TOKEN` (scope event:write) | SEN-05 | ✓ in `.env` (name confirmed; scope assumed A3) | — | Must also be set as Edge Function secret |
| `SENTRY_ORG` / `SENTRY_PROJECT` | SEN-05 path | ✓ in `.env` (names confirmed; values not read) | — | Function can hardcode `ai-simple` if env unset (not recommended) |
| `verifyDeploySha` | SEN-05 verified-stable gate | ✓ `~/dev/autopilot/src/lib/approval.ts` | shipped | — |
| `@honcho-ai/sdk` | SEN-03 (Honcho path only) | ✗ not installed | 2.1.2 available | JSONB prior-attempt history (zero-package) |
| Honcho MCP tools | (rejected for daemon) | ✓ in interactive session only | — | Unusable from daemon — N/A |
| supabase CLI (`--use-api` deploy) | deploy `sentry-resolve` | ✓ present | — | — |
| Bun | daemon code + tests | ✓ (daemon runtime) | — | — |
| vitest 4.0.16 | brain Edge Function tests | ✓ | 4.0.16 | — |

**Missing dependencies with no fallback:** none (Sentry API, deploy-SHA verifier, secrets all present).
**Missing dependencies with fallback:** `@honcho-ai/sdk` (not installed) → JSONB prior-attempt history.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (brain) | vitest 4.0.16 |
| Framework (daemon) | `bun test` (`~/dev/autopilot`) |
| Config file | `~/dev/brain/vitest.config.ts` (brain); none for daemon (bun built-in) |
| Quick run command (brain) | `npm run test -- supabase/functions/sentry-resolve` |
| Full suite command (brain) | `npm run test` |
| Quick run command (daemon) | `cd ~/dev/autopilot && bun test src/lib/sentry-resolve.test.ts` |
| Full suite command (daemon) | `cd ~/dev/autopilot && bun test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEN-03 | Sentry brief carries debug discipline + prior-attempt memory; routed into the loop | unit | `cd ~/dev/autopilot && bun test src/lib/brief.test.ts` | ❌ Wave 0 (brief.test new) |
| SEN-03 | Fingerprint memory adapter reads/writes by `sentry:<issue_id>` (SDK or JSONB) | unit | `cd ~/dev/autopilot && bun test src/lib/sentry-memory.test.ts` | ❌ Wave 0 |
| SEN-04 | Debounce gate: a fingerprint <3 occ / outside 15min is NOT claimable; ≥3 within window IS | unit (pure predicate) + integration (DB) | `npm run test -- supabase` ; `npm run test:integration` | ❌ Wave 0 |
| SEN-04 | Cycle-time aggregation RPC returns per-source resolve cycle time | integration | `npm run test:integration` | ❌ Wave 0 |
| SEN-04 | Severity → priority reflected in claim ordering | unit | `cd ~/dev/autopilot && bun test src/claimer.test.ts` | ✅ (extend existing) |
| SEN-05 | Resolve builds correct endpoint + payload (`PUT /api/0/organizations/{org}/issues/{id}/`, `{"status":"resolved"}`); strips `sentry:` prefix | unit | `npm run test -- supabase/functions/sentry-resolve` | ❌ Wave 0 |
| SEN-05 | Resolve is idempotent (already-resolved = no-op); 4xx pages, 5xx retryable; token never logged | unit | `npm run test -- supabase/functions/sentry-resolve` | ❌ Wave 0 |
| SEN-05 | Verified-stable precondition: no resolve unless `verifyDeploySha` true AND quiet window elapsed | unit | `cd ~/dev/autopilot && bun test src/lib/sentry-resolve.test.ts` | ❌ Wave 0 |
| SEN-05 | Per-fingerprint cap: 4th regression freezes the fingerprint (not global) + pages | unit + integration | `cd ~/dev/autopilot && bun test` ; `npm run test:integration` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the closest unit command above for the changed file (`bun test <file>` or `npm run test -- <path>`).
- **Per wave merge:** `cd ~/dev/autopilot && bun test` AND `npm run test` (both repos green).
- **Phase gate:** full brain suite + full daemon suite green; `sentry-resolve` integration test green against a TEST Sentry target (NEVER fire a real resolve PUT against `ai-simple` in tests — mock the Sentry endpoint), before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `~/dev/autopilot/src/lib/sentry-memory.ts` + `sentry-memory.test.ts` — covers SEN-03 memory
- [ ] `~/dev/autopilot/src/lib/brief.test.ts` (or extend) — covers SEN-03 discipline block
- [ ] `~/dev/autopilot/src/lib/sentry-resolve.ts` + `sentry-resolve.test.ts` — covers SEN-05 daemon precondition + cap
- [ ] `~/dev/brain/supabase/functions/sentry-resolve/index.ts` + `lib.ts` + `__tests__/sentry-resolve.test.ts` — covers SEN-05 endpoint/payload/idempotency (MOCK Sentry; never hit live org)
- [ ] `~/dev/brain/supabase/migrations/*_sentry_debounce_cycletime_cap.sql` + integration test — covers SEN-04 debounce/cycle-time + SEN-05 cap state
- [ ] Extend `~/dev/autopilot/src/claimer.test.ts` — debounce predicate + frozen-fingerprint exclusion + severity→priority

*Wave 0 must land the test scaffolds + a mocked Sentry endpoint before any code that can call the live resolve API.*

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1`, `security_block_on: high` (config.json).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `sentry-resolve` caller must be authorized (service-role daemon / admin), not public. Use `authenticateRequest` or a service-role check; never an open endpoint. |
| V3 Session Management | no | Stateless function; no sessions. |
| V4 Access Control | yes | Resolve write-back is admin/system-only. The function must reject non-authorized callers (the daemon is the only intended caller). |
| V5 Input Validation | yes | Validate `issue_id` (zod: bounded string, expected shape) before building the URL — prevents path injection into the Sentry URL. Strip `sentry:` prefix safely. |
| V6 Cryptography | no (reuse) | No new crypto. Webhook HMAC already shipped; resolve uses bearer token over HTTPS. |
| V7 Errors & Logging | yes | Never log `SENTRY_AUTH_TOKEN`. Generic error bodies (mirror webhook: never echo secret/digest). |

### Known Threat Patterns for {Edge Function + outbound Sentry write}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path injection via crafted `issue_id` into the Sentry URL | Tampering | zod-validate `issue_id` to digits/expected charset before interpolation; strip `sentry:` prefix; encode. |
| Unauthorized resolve calls (anyone hitting the function) | Elevation of Privilege | Caller authz (service-role/admin only); function is not a public endpoint. |
| Token leakage in logs/responses | Information Disclosure | Never log or return the token; presence-check only (`!!Deno.env.get(...)`). |
| Resolve oscillation / runaway PUTs | Denial of Service (self-inflicted, against live org) | Per-fingerprint cap + verified-stable precondition + idempotency. |
| Spoofed deploy-SHA (resolving before the fix is live) | Spoofing | `verifyDeploySha` reads the prod-baked SHA; quiet window adds margin. |

## Sources

### Primary (HIGH confidence)
- `~/dev/autopilot/src/lib/agent.ts`, `brief.ts`, `runner.ts`, `approval.ts`, `tier2.ts`, `autopilot.config.ts` — daemon invocation model, `verifyDeploySha`, paging, tier-2 digest (read this session)
- `~/dev/brain/supabase/functions/sentry-webhook/index.ts` + `lib.ts`, `supabase/migrations/20260612130000_sentry_ticket_ingestion.sql` — what ingestion persists (`issue_id`, `issue_url`, hardcoded `ai-simple`/`call-vault`; NO discrete org_slug)
- `~/.claude/skills/gsd-debug/SKILL.md` + `~/.claude/gsd-core/workflows/debug.md` — gsd-debug is an interactive orchestrator (subagents, AskUserQuestion, checkpoints) — not daemon-runnable
- Honcho MCP tool schemas (loaded this session) + `~/.claude/plugins/marketplaces/honcho/plugins/honcho/package.json` (`@honcho-ai/sdk: ^2.1.0`) + `honcho-dev/skills/integrate/SKILL.md` — Peers/Sessions/Messages model; SDK is the integration path
- docs.sentry.io/api/events/update-an-issue/ (WebFetch) — `PUT /api/0/organizations/{org}/issues/{id}/`, `{"status":"resolved"}`, scope `event:write`/`event:admin`

### Secondary (MEDIUM confidence)
- WebSearch (Sentry API resolve) cross-checked against the official docs page — endpoint + scope corroborated
- `npm view @honcho-ai/sdk version` → 2.1.2 (registry existence only; legitimacy seam NOT run → tagged [ASSUMED])

### Tertiary (LOW confidence)
- none relied upon

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all reuse of shipped primitives; the one new package is explicitly flagged and gated.
- Architecture: HIGH — daemon invocation model, ingestion context, and resolve endpoint all read/verified directly this session.
- Pitfalls: HIGH — derived from the actual daemon code and the live-org write-back risk.
- Honcho package decision: MEDIUM — SDK is the right primitive but the install conflicts with a milestone invariant (decision belongs to Andrew).

**Research date:** 2026-06-13
**Valid until:** 2026-07-13 (Sentry API stable; re-verify the Honcho SDK version + the `@honcho-ai/sdk` legitimacy at plan time if the package path is chosen)
