# Phase 21: Sentry Debug → Fix → Resolve - Pattern Map

**Mapped:** 2026-06-13
**Files analyzed:** 8 new + 3 modified (across 2 repos)
**Analogs found:** 10 / 11 (one new call-seam has no daemon precedent)

> Cross-repo phase. Per `docs/architecture/autopilot-brain-ownership.md`, the two
> repos share **no code** — they integrate only through Supabase tables. So files
> split cleanly: schema + Edge Function live in **`~/dev/brain`**; brief + fix-loop
> wiring + cap/oscillation/resolve-caller live in **`~/dev/autopilot`**. The DB
> migration is the coordination point (brain owns schema; autopilot consumes it).
>
> **CONTEXT.md overrides RESEARCH.md where they disagree.** D-05 LOCKED the
> **zero-package JSONB prior-attempt history** (NOT the `@honcho-ai/sdk`). D-06
> LOCKED **disabling `sentry-autofix.yml`**. The RESEARCH "surface the Honcho
> decision to Andrew" thread is already resolved — there is no Honcho SDK in this
> phase, and no `bun add`. Treat any Honcho-SDK pattern in RESEARCH as not applicable.

## File Classification

| New/Modified File | Repo | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|------|-----------|----------------|---------------|
| `supabase/functions/sentry-resolve/index.ts` | brain | edge-function (handler) | request-response → outbound HTTP | `supabase/functions/sentry-webhook/index.ts` | role-match (webhook is inbound; this is outbound) |
| `supabase/functions/sentry-resolve/lib.ts` | brain | utility (pure logic) | transform | `supabase/functions/sentry-webhook/lib.ts` | exact |
| `supabase/functions/sentry-resolve/__tests__/sentry-resolve.deno.test.ts` | brain | test (unit) | — | `supabase/functions/sentry-webhook/__tests__/sentry-webhook.deno.test.ts` | exact |
| `supabase/functions/sentry-resolve/__tests__/sentry-resolve.integration.test.ts` | brain | test (integration) | — | `supabase/functions/sentry-webhook/__tests__/sentry-webhook.integration.test.ts` | exact (MOCK Sentry — never hit live org) |
| `supabase/migrations/2026XXXXXXXXXX_sentry_debounce_cycletime_cap.sql` | brain | migration | CRUD + DDL | `supabase/migrations/20260612130000_sentry_ticket_ingestion.sql` | exact |
| `src/lib/sentry-memory.ts` | autopilot | utility (JSONB history adapter) | CRUD (read prior runs) | `src/lib/db.ts` (typed writers) + `approval.ts::fetchLatestRunnerRun` | role-match |
| `src/lib/sentry-memory.test.ts` | autopilot | test (unit) | — | `src/lib/tier2.test.ts` / `src/lib/agent.test.ts` | exact |
| `src/lib/sentry-resolve.ts` | autopilot | utility (Edge-Function caller + verified-stable gate + cap) | request-response (outbound RPC) | `src/lib/approval.ts` (verifyDeploySha + pageAdmin + executeApproval gate) | role-match |
| `src/lib/sentry-resolve.test.ts` | autopilot | test (unit) | — | `src/lib/approval.test.ts` | exact |
| `src/lib/brief.ts` | autopilot | utility (brief composer) — **EDIT** | transform | self (`composeBrief`) — extend, do not fork | exact (in-place) |
| `src/lib/claim.ts` | autopilot | utility (selection) — **EDIT** | CRUD (query+filter) | self (`selectNextTicket`/`compareTickets`) | exact (in-place) |
| `.github/workflows/sentry-autofix.yml` | brain | config (CI) — **DISABLE (D-06)** | event-driven | self | n/a (disable, not reshape) |

---

## Pattern Assignments

### `supabase/functions/sentry-resolve/index.ts` (edge-function, outbound HTTP) — brain, NEW

**Analog:** `supabase/functions/sentry-webhook/index.ts` (inbound counterpart, same Sentry domain).

**KEY DIFFERENCE from the webhook:** the webhook is the *Internet→us* boundary
(HMAC gate, `verify_jwt = false`, NO `_shared/auth.ts`). `sentry-resolve` is the
*daemon→us* boundary — the **only intended caller is the service-role daemon**, so
it MUST authorize the caller (V2/V4 ASVS, RESEARCH Security Domain). Do NOT copy the
webhook's no-auth posture. Use the pinned Phase 21 scheme: gateway JWT verification
remains enabled and the function constant-time compares the bearer token to the
service-role key available in function env. No admin-user JWT allowance and no
`authenticateRequest` fallback for this daemon-only endpoint.

**Handler skeleton + CORS preflight + size/method gate** (copy webhook lines 40–62):
```typescript
// from sentry-webhook/index.ts:40-59 — keep json() helper, OPTIONS, method gate
const JSON_HEADERS = { ...WEBHOOK_CORS_HEADERS, "Content-Type": "application/json" };
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: WEBHOOK_CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  // ... auth caller, validate body, resolve ...
});
```

**Config-presence guard (Pitfall 4 — function-secret vs `.env`)** — mirror the
webhook's `Deno.env.get(...)` reads but FAIL CLOSED with 503 when unset, and never
echo the value (`supabase/CLAUDE.md` "NEVER expose in responses"):
```typescript
const org = Deno.env.get("SENTRY_ORG");
const token = Deno.env.get("SENTRY_AUTH_TOKEN");
if (!org || !token) return json({ error: "resolve not configured" }, 503); // presence-check only; never log/echo
```

**Outbound resolve PUT** (RESEARCH Pattern 4 — raw fetch, no `@sentry/*` SDK):
```typescript
// issueId comes from the caller body (validated) — strip any "sentry:" prefix first (Pitfall 5)
const bareIssueId = issueId.replace(/^sentry:/, "");
const res = await fetch(
  `https://sentry.io/api/0/organizations/${org}/issues/${bareIssueId}/`,
  { method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "resolved" }) }
);
// Idempotent: already-resolved = 200 no-op. 4xx → real error (caller pages). 5xx → retryable.
```

**Error handling** (copy webhook lines 176–182, generic body — never echo token/digest):
```typescript
} catch (error) {
  console.error("sentry-resolve error:", error instanceof Error ? error.message : "unknown");
  return json({ error: "internal error" }, 500);
}
```

---

### `supabase/functions/sentry-resolve/lib.ts` (utility, pure) — brain, NEW

**Analog:** `supabase/functions/sentry-webhook/lib.ts` (EXACT — same testable-pure-logic split).

Mirror the webhook's "pure logic, contracts pinned by tests" structure. Pure
functions to export (so the Deno test can hit them without a network):

**Zod input schema (V5 path-injection guard, RESEARCH Security)** — copy the
`cappedString` idiom (webhook lib.ts:74) and bound `issue_id` to expected charset:
```typescript
import { z } from "https://esm.sh/zod@3.23.8";   // EXACT pin used project-wide (supabase/CLAUDE.md)
export const resolveInputSchema = z.object({
  issue_id: z.string().trim().min(1).max(256).regex(/^(sentry:)?\d+$/, "issue_id must be numeric"),
});
```

**Endpoint + payload builders** (pure, the test pins these — mirrors webhook's
`deriveFingerprint`/`mapSeverity` exports):
```typescript
export function stripFingerprintPrefix(issueId: string): string {
  return issueId.replace(/^sentry:/, "");          // Pitfall 5
}
export function buildResolveUrl(org: string, issueId: string): string {
  return `https://sentry.io/api/0/organizations/${org}/issues/${stripFingerprintPrefix(issueId)}/`;
}
export const RESOLVE_BODY = { status: "resolved" } as const;
```

---

### `supabase/functions/sentry-resolve/__tests__/*.test.ts` — brain, NEW

**Analogs:**
- Unit → `sentry-webhook/__tests__/sentry-webhook.deno.test.ts` (EXACT — Deno std assert, pins pure-logic contracts):
```typescript
// from sentry-webhook.deno.test.ts header
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";
// Run: deno test supabase/functions/sentry-resolve/__tests__/
// Pin: buildResolveUrl strips "sentry:"; resolveInputSchema rejects non-numeric / oversized issue_id
```
- Integration → `sentry-webhook/__tests__/sentry-webhook.integration.test.ts` (EXACT structure: vitest, real TEST project service-role client, `beforeAll`/`afterAll` capture-and-restore). **CRITICAL (RESEARCH Sampling Rate): MOCK the Sentry endpoint — NEVER fire a real resolve PUT against `ai-simple`.** Follow `supabase/CLAUDE.md` "Running integration tests safely": `VITEST_INTEGRATION_OK=true`, separate TEST project, idempotent cleanup.

---

### `supabase/migrations/2026XXXXXXXXXX_sentry_debounce_cycletime_cap.sql` — brain, NEW

**Analog:** `supabase/migrations/20260612130000_sentry_ticket_ingestion.sql` (EXACT — same Sentry-schema lineage, same SECURITY DEFINER + service-role-only idiom).

**ANTI-PATTERN GUARDS (RESEARCH):** do NOT edit `ingest_sentry_ticket` (Deferred /
out of scope). Additive columns + a NEW cap table + a NEW debounce-predicate / RPC only.

**Migration header + section banners** — copy the analog's header block (lines 1–13)
and the `=====` section banners (`supabase/CLAUDE.md` migration template).

**Per-fingerprint cap table** (RESEARCH Code Examples — service-role-only, RLS enabled):
```sql
CREATE TABLE public.sentry_fingerprint_cap (
  fingerprint TEXT PRIMARY KEY,            -- 'sentry:<issue_id>'
  fix_attempts INTEGER NOT NULL DEFAULT 0,
  frozen BOOLEAN NOT NULL DEFAULT FALSE,
  frozen_at TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ
);
ALTER TABLE public.sentry_fingerprint_cap ENABLE ROW LEVEL SECURITY;  -- supabase/CLAUDE.md: ALL tables RLS
```

**Cycle-time column** (RESEARCH Code Examples — additive, no ingest change):
```sql
ALTER TABLE public.tickets ADD COLUMN sentry_resolved_at TIMESTAMPTZ;  -- set when sentry-resolve succeeds
-- cycle time = sentry_resolved_at - created_at (resolve-ASAP target)
```

**Privileges block** (copy the analog lines 117–126 verbatim idiom — REVOKE from
public/anon/authenticated, GRANT service_role). The cap table and any new RPC are
service-role-only; the daemon and the Edge Function are the only writers:
```sql
REVOKE ALL ON FUNCTION public.<new_rpc>(...) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.<new_rpc>(...) TO service_role;
```

**Debounce gate** (RESEARCH Pattern 3 — a claim-time predicate, NOT SELECT-then-decide;
`occurrence_count` + `last_seen_at` already exist from the analog migration lines 24–27).
Express it so the autopilot claimer can filter on it (a generated column, a view, or an
RPC the claimer reads) — default ≥3 occurrences within 15 min (D-02).

**RLS / cross-org note:** `sentry_fingerprint_cap` is service-role-only (no user
columns). It does NOT need a row in `CROSS_ORG_TABLES` (`src/test/rls-regression.test.ts`)
because it is not user-facing — but it MUST have RLS enabled (no policy = deny-all to
anon/authenticated, which is correct here).

---

### `src/lib/sentry-memory.ts` (utility, JSONB prior-attempt history) — autopilot, NEW

**D-05 LOCKED: zero new npm packages. No `@honcho-ai/sdk`.** Store/read per-fingerprint
prior-attempt history from existing DB state and render it into the brief.

**Analogs:**
- `src/lib/db.ts` — the `DbLike` structural client + typed-writer pattern (inject `db`,
  service-role only, log-don't-throw on write failure):
```typescript
// from db.ts:92-109 — copy the writer shape: DbLike param, .insert(...), console.error on error, void return
export async function writeEvent(db: DbLike, ticketId: string, eventType: string, ...) {
  const { error } = await db.from("ticket_events").insert({ ... });
  if (error) console.error(`[autopilot] event write failed (${eventType}): ${error.message}`);
}
```
- `src/lib/approval.ts::fetchLatestRunnerRun` (lines 177–189) — the "read last N
  runner_runs for a ticket, ordered by started_at desc" query is the EXACT read shape
  for prior-attempt history:
```typescript
// approval.ts:177-188 — adapt: select the prior runs' outcome/verdict/diff_stat/fix_category
const res = (await db.from("runner_runs")
  .select("id, fix_category")           // widen to: outcome, gate_verdict, detail, finished_at
  .eq("ticket_id", ticketId)
  .order("started_at", { ascending: false })
  .limit(1)) as QueryResult;            // widen limit to N for history
```

**Fingerprint key:** `sentry:<issue_id>` already lives on `tickets.fingerprint`
(ingestion migration line 72) and `tickets.context.sentry.issue_id` (webhook index.ts:128).
Resolve history per-fingerprint by joining tickets→runner_runs on the Sentry ticket.

---

### `src/lib/sentry-resolve.ts` (utility, Edge-Function caller + verified-stable gate + cap) — autopilot, NEW

**Analog:** `src/lib/approval.ts` (verifyDeploySha + pageAdmin + the executeApproval
verified-stable resolve sequence). This is the highest-value reuse in the phase.

**NO-ANALOG SEAM (flag for planner):** the daemon has **no existing
Edge-Function-invoke call** (grep of `~/dev/autopilot/src` for `functions.invoke` /
`functions/v1` returns nothing — the daemon only talks to Postgres tables/RPCs today,
per the ownership doc). So the *call to* `sentry-resolve` is genuinely new wiring.
Closest precedent is `createServiceClient()` in `db.ts:68-81`; the natural form is
`supabase.functions.invoke("sentry-resolve", { body: { issue_id } })` from a service-role
client, OR a direct `fetch` to the function URL with the service-role bearer. Planner must
choose and add a `checkpoint` if unsure (A4 assumption: daemon reaches the function with
service-role auth). The Edge Function holds the Sentry secret (D-03); the daemon never does.

**Verified-stable precondition** — reuse `verifyDeploySha` VERBATIM (approval.ts:332-354,
RESEARCH Don't Hand-Roll). Resolve ONLY when it returns `verified: true` AND the 30-min
quiet window has elapsed (D-03):
```typescript
import { verifyDeploySha } from "./approval";   // do NOT re-implement prod-SHA polling
const deploy = await verifyDeploySha(mergedSha);
if (!deploy.verified) return; // never resolve on an unverified deploy (anti-pattern: resolve-on-merge)
```

**The full gate sequence to mirror** — executeApproval's tail (approval.ts:752-765)
already does merge→verifyDeploySha→status:resolved. Extend that exact ordering with the
quiet-window + cap check BEFORE calling sentry-resolve:
```typescript
// after approval.ts:763 (status → 'resolved'), gate the OUTWARD resolve:
//   1. cap not frozen for this fingerprint  2. verifyDeploySha true  3. quiet window elapsed
//   → invoke sentry-resolve → on success, set tickets.sentry_resolved_at (cycle-time stamp)
```

**Per-fingerprint cap + oscillation paging** — reuse the `pageAdmin` pattern
(approval.ts:358-367) and the cap-table from the migration. On the 4th regression,
FREEZE the single fingerprint/category (never global — RESEARCH anti-pattern) and page:
```typescript
// from approval.ts:358-367 — copy the user_notifications insert shape for paging
async function pageAdmin(db: DbLike, title: string, body: string): Promise<void> {
  const { error } = await db.from("user_notifications").insert({
    user_id: ADMIN_USER_ID, type: "health_alert", title, body,
    metadata: { source: "autopilot-approval", paged_at: new Date().toISOString() },
  });
  if (error) console.error(`[approval] page insert failed: ${error.message}`);
}
```

**Oscillation digest** — for the paging body, reuse `tier2.ts` "solutions not problems"
digest (`escalationDigest` + `validateTier2Digest`, tier2.ts:46-96) so the freeze page is
1–2 solution-shaped sentences with 2–3 decisions, not an error dump (RESEARCH Don't Hand-Roll).

**`fix_category` for the cap key** — reuse `buildFixCategory` (approval.ts:173-175):
`source:sentry:error:<class>` — so the freeze is category-scoped, matching the existing
trust-ladder category vocabulary.

---

### `src/lib/brief.ts` (EDIT — extend `composeBrief`, do not fork) — autopilot

**Analog:** self. CONTEXT D-01 "Reuse the loop — do not fork a separate runner."
RESEARCH Pattern 1: discipline is **brief text**, NOT a `/gsd-debug` call (Pitfall 1 —
`/gsd-debug` is interactive and cannot run in the headless single-argv subprocess).

**Extend `composeBrief` (brief.ts:54-82)** — for `ticket.source === "sentry"`, inject a
scientific-method discipline block + the prior-attempt history (from `sentry-memory.ts`)
BEFORE the `=== BEGIN TICKET DATA ===` fence. PRESERVE the existing HARD POLICY block
(brief.ts:57-66) and the single-VERDICT-line protocol verbatim — those are load-bearing
containment, not decoration:
```typescript
// brief.ts already fences ticket content as untrusted DATA (line 57, rule 1) and pins
// VERDICT_PATTERN (line 30). Add, for sentry source, a discipline block:
//   "Debug method (in order): 1) Reproduce from the stack trace + culprit.
//    2) State one hypothesis. 3) Locate the cause at the referenced file:line.
//    4) Make the smallest fix. 5) Run the closest test. Record eliminated
//    hypotheses in NOTES.md. End with exactly one VERDICT line."
// + a PRIOR ATTEMPTS section rendering sentry-memory history (what was tried/failed).
```
The runner already routes Sentry tickets through `composeBrief` unchanged
(`src/runner.ts:239` `const brief = composeBrief(ticket, messages);`) — no runner fork needed.

---

### `src/lib/claim.ts` (EDIT — debounce filter + frozen-fingerprint exclusion + severity→priority) — autopilot

**Analog:** self (`selectNextTicket` lines 99-127, `compareTickets` lines 67-74).

**Debounce + frozen exclusion** — `selectNextTicket` already filters candidates
client-side AFTER the DB fetch (the `excludeSources` precedent, lines 122-125). Add the
same client-side filtering shape: drop Sentry candidates that (a) haven't met the debounce
predicate, or (b) whose fingerprint is `frozen` in `sentry_fingerprint_cap`. Keep the
locked ordering untouched (the comment at line 65 is the contract):
```typescript
// claim.ts:122-125 is the exact pattern to copy — filter BEFORE pickNext, ordering unchanged:
if (options.excludeSources?.length) {
  const excluded = new Set(options.excludeSources);
  candidates = candidates.filter((c) => !excluded.has(c.source));
}
// → add: candidates = candidates.filter(c => c.source !== "sentry" || (debounceMet(c) && !frozen(c)))
```

**Severity → priority (SEN-04, A5)** — `compareTickets` ALREADY ranks by
`SEVERITY_RANK` (lines 22-27, 71) AFTER `priority`. RESEARCH A5: verify whether the
existing severity rank already satisfies "severity boosts priority" before adding a
redundant priority bump. If a real bump is needed, map severity→priority at
ingestion-read; otherwise no change. **Do not invert the queue** — SEVERITY_RANK exists
precisely because the enum declares `critical` first (claim.ts:18-21 warning).

---

### `.github/workflows/sentry-autofix.yml` (DISABLE — D-06) — brain

**Analog:** self. D-06 LOCKED: supersede the legacy Sentry→GitHub-issue→@claude path so
a single Sentry issue is never double-handled (GitHub PR AND DB ticket). The workflow's
own comment (line 64: "auto-resolved in Sentry once the fix is deployed") anticipated
exactly SEN-05.

**Disable cleanly** — neutralize the trigger rather than deleting (preserves history/intent
for the migration record). Either gate the `on:` to a manual-only `workflow_dispatch`, or
add `if: false` to the `claude-autofix` job, with a comment pointing to Phase 21 / the
DB-ticket path. Planner picks; both fully stop the parallel mechanism.

---

## Shared Patterns

### Edge Function structure + secret handling
**Source:** `supabase/functions/sentry-webhook/index.ts` + `supabase/CLAUDE.md` index.ts template
**Apply to:** `sentry-resolve/index.ts`
- CORS preflight (`if req.method === "OPTIONS"`), method gate, `json()` helper, generic error bodies.
- `Deno.env.get(...)` for secrets; **presence-check only in responses** (`!!`), never echo (`supabase/CLAUDE.md`).
- Zod-validate ALL input before use (`https://esm.sh/zod@3.23.8` pin).

### Caller authorization (NOT the webhook's no-auth posture)
**Source:** Phase 21 auth revision + `supabase/CLAUDE.md` "Service role for admin operations"
**Apply to:** `sentry-resolve/index.ts` — the only intended caller is the service-role daemon. Keep gateway JWT verification enabled and authorize by constant-time service-role bearer comparison. No-auth returns 401; normal user/admin JWT returns 403; service-role daemon returns 200. Unlike `sentry-webhook` (HMAC, `verify_jwt=false`), this is NOT an open endpoint.

### Service-role DB access (daemon side)
**Source:** `src/lib/db.ts::createServiceClient` (lines 68-81) + typed writers (92-168)
**Apply to:** `sentry-memory.ts`, `sentry-resolve.ts` — inject `DbLike`; service-role only; log-don't-throw on write failure (`console.error("[autopilot] ...")`).

### Reuse, never re-implement (RESEARCH Don't Hand-Roll)
| Need | Reuse (do NOT build) | Location |
|------|----------------------|----------|
| Deploy-SHA verification | `verifyDeploySha` | `src/lib/approval.ts:332` |
| Admin paging on oscillation | `pageAdmin` (`user_notifications`, type `health_alert`) | `src/lib/approval.ts:358` |
| Solution-shaped freeze digest | `escalationDigest` + `validateTier2Digest` | `src/lib/tier2.ts:46,87` |
| Fix-category key for cap | `buildFixCategory` (`source:sentry:error:<class>`) | `src/lib/approval.ts:173` |
| Fingerprint dedup | `ingest_sentry_ticket` + partial unique index (shipped) | migration `20260612130000` |
| Sentry API client | raw `fetch` PUT (no `@sentry/*`) | RESEARCH Pattern 4 |
| Brief composition | `composeBrief` (extend in place) | `src/lib/brief.ts:54` |
| Candidate filtering | `selectNextTicket` client-side filter | `src/lib/claim.ts:122` |

### Migration conventions
**Source:** `supabase/migrations/20260612130000_sentry_ticket_ingestion.sql` + `supabase/CLAUDE.md` migration template
**Apply to:** the new debounce/cycle-time/cap migration — header block, `=====` section banners, RLS-enabled on every new table, REVOKE-from-public + GRANT-service_role on every new function, `COMMENT ON` for columns/functions, additive-only (no `ingest_sentry_ticket` edits).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/lib/sentry-resolve.ts` (the *outbound Edge-Function call* portion only) | utility | request-response | The autopilot daemon has **no existing Edge-Function-invoke call** — it only talks to Postgres tables/RPCs (verified: grep of `src/` for `functions.invoke`/`functions/v1` is empty; matches the ownership doc "share no code, integrate only through the DB"). The verified-stable gate / cap / paging *do* have analogs (`approval.ts`); the call seam itself is new wiring. Closest precedent: `createServiceClient()` (`db.ts:68`). Planner should pick `supabase.functions.invoke` vs direct `fetch`, and confirm RESEARCH assumption A4 (daemon reaches the function with service-role auth) via a `checkpoint` if unsure. |

---

## Metadata

**Analog search scope:** `~/dev/brain/supabase/functions/` (78 functions), `~/dev/brain/supabase/migrations/` (sentry lineage), `~/dev/brain/.github/workflows/`, `~/dev/autopilot/src/` + `~/dev/autopilot/src/lib/`
**Files scanned:** sentry-webhook (index+lib+tests), ingest migration, _shared/auth, sentry-autofix.yml; autopilot brief/tier2/db/approval(targeted)/claim
**Cross-repo authority:** `docs/architecture/autopilot-brain-ownership.md` (schema=brain, fix-loop=autopilot, DB-only seam)
**Decision precedence:** CONTEXT.md D-05 (JSONB, zero-package) + D-06 (disable workflow) override RESEARCH's Honcho-SDK and "confirm disposition" threads
**Pattern extraction date:** 2026-06-13
