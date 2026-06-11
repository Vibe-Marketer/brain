# Phase 12: Sentry Ingestion - Research

**Researched:** 2026-06-11
**Domain:** Sentry Integration Platform webhooks → Supabase Edge Function → Postgres ticket dedup
**Confidence:** HIGH (payload shape + signature verified against live docs.sentry.io this session)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Ingestion: Sentry ISSUE ALERT webhook → new Supabase Edge Function `sentry-webhook` (no local port, no polling); org `ai-simple`, project `call-vault`
- Auth: shared secret in function env; primary = Sentry webhook signature via `sentry-hook-signature`; fallback = secret query param, constant-time compare; webhook payloads are untrusted input; `verify_jwt` off; 401 before any DB work
- Mapping: `type='bug'`, `source='sentry'`, `reporter_id=NULL` (system — requires relaxing NOT NULL via migration); severity: fatal/error→high, warning→medium, info/unknown→low; `critical` never auto-assigned; `context` jsonb carries issue URL/culprit/release/title/fingerprint material; `ticket_events` 'created' row via service-role
- Dedup: `tickets.fingerprint` (live, unique-when-not-null); same fingerprint → increment `occurrence_count` + update `last_seen_at` (both columns MUST be added by migration — verified absent from live schema); race-safe upsert against the partial unique index
- Severity ≥ high → INSERT `user_notifications` row for admin (table live since 20260131000004); no notification storm on dedup hits
- Manual Sentry-side setup documented for Andrew (exact click path + webhook URL + where the secret goes) — the ONE human prerequisite

### Claude's Discretion
- Exact `context` jsonb key names; payload-field extraction details
- Whether occurrence-increment writes a `ticket_events` row (lean yes)
- Rate limiting / payload-size guard specifics
- Test approach: Deno tests + real-Supabase integration per Phase 1/6 idiom

### Deferred Ideas (OUT OF SCOPE)
- Sentry API polling (pull-based ingestion)
- `sentry-autofix.yml` integration (note only)
- Automated alert-rule creation via Sentry API
- Sentry release tagging in `Sentry.init`
- Re-notification thresholds / notification UI (Phase 14+ / v2)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEN-01 | Sentry issue alerts create tickets automatically via a Supabase Edge Function webhook (org `ai-simple`, project `call-vault`) | Verified payload shape (`data.event` with title/level/culprit/web_url/issue_id/release), verified `sentry-hook-signature` HMAC-SHA256 verification, internal-integration Alert Rule Action delivery path |
| SEN-02 | Sentry-created tickets dedupe by error fingerprint (same error twice → one ticket, occurrence count incremented) | Verified `issue_id` is the stable dedup key (payload `fingerprint` field is raw grouping config, NOT a hash); race-safe `ON CONFLICT` upsert pattern against the live partial unique index |
</phase_requirements>

## Summary

Sentry delivers issue-alert webhooks through the **Integration Platform**: an **internal integration** (org-scoped, no OAuth dance) with a webhook URL and the **Alert Rule Action** toggle enabled. Once enabled, the integration appears in issue alert rules as "Send a notification via {integration}". Each delivery carries `Sentry-Hook-Resource: event_alert`, `action: "triggered"`, and a `data.event` object with `title`, `level`, `culprit`, `web_url`, `issue_url`, `issue_id`, `release`, `tags`, `exception`, `datetime`. Every request is signed: `Sentry-Hook-Signature` = HMAC-SHA256 over the JSON request body keyed by the integration's **Client Secret**. Signature verification is therefore AVAILABLE on this path — the secret-query-param fallback from CONTEXT.md is not needed (keep it documented as a fallback only if the click path drifts).

**Critical dedup finding:** the payload's `fingerprint` field is the issue's grouping *configuration* (e.g. `["{{ default }}"]`) — identical for most issues and useless as a dedup key. The stable per-error identity is **`data.event.issue_id`** (Sentry has already grouped events into issues by its server-side fingerprint). Store `tickets.fingerprint = 'sentry:' || issue_id`. SEN-02's "error fingerprint" semantics are preserved: same error ⇒ same Sentry issue ⇒ same `issue_id`.

The live `tickets` schema (migration 20260611000002) needs one small additive migration: relax `reporter_id` to nullable, add `occurrence_count INTEGER NOT NULL DEFAULT 1` and `last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`. The `'sentry'` enum value, `fingerprint` column, and partial unique index already exist.

**Primary recommendation:** One Edge Function (`sentry-webhook`, `verify_jwt` disabled) + one migration + Deno unit tests + a real-Supabase integration test; verify signature over the RAW request body text before parsing; dedup with a service-role UPSERT keyed on fingerprint with `ON CONFLICT` increment.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Webhook receipt + signature verification | API / Backend (Edge Function) | — | Untrusted ingress; secrets live server-side only |
| Severity/level mapping | API / Backend (Edge Function) | — | Pure server-side transform of untrusted input |
| Fingerprint dedup (count increment) | Database (UPSERT + partial unique index) | Edge Function (issues the statement) | Uniqueness must be enforced by the DB to be race-safe |
| Audit trail (`ticket_events` 'created') | API / Backend (service-role insert) | DB trigger (status changes only) | Mirrors Phase 11 pattern — 'created' events are service-role writes |
| Admin notification | API / Backend (service-role insert into `user_notifications`) | — | No UI dependency this phase |
| Sentry alert rule + integration config | External (sentry.io UI) | — | Manual human prerequisite; API automation out of scope |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Deno built-in Web Crypto (`crypto.subtle`) | Deno (Supabase Edge runtime) | HMAC-SHA256 signature verification | Zero deps; `crypto.subtle.importKey`/`sign` is the Deno-native HMAC path [VERIFIED: codebase — `_shared/` uses Deno std patterns; Web Crypto is built into the Edge runtime] |
| `@supabase/supabase-js@2` via esm.sh | 2.x | Service-role DB writes | Existing idiom in every Edge Function [VERIFIED: codebase `supabase/CLAUDE.md` template] |
| `zod` via `https://esm.sh/zod@3.23.8` | 3.23.8 | Payload validation | Mandated by `supabase/CLAUDE.md` input-validation section [VERIFIED: codebase] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `timingSafeEqual` (constant-time compare) | hand-written 10-line helper or Deno std | Compare computed vs presented signature | Always — string `===` on hex digests leaks timing; compare digests of equal length |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Internal integration webhook (signed) | Legacy "WebHooks" plugin alert action | Legacy plugin sends unsigned generic payloads — would force the query-param fallback; internal integration is the current documented path [CITED: docs.sentry.io/organization/integrations/integration-platform/webhooks/] |
| `issue_id`-based dedup key | Hashing `culprit`+`title` ourselves | Re-implements Sentry's grouping badly; titles mutate across releases |

**Installation:** none — no new packages. esm.sh imports only (zod + supabase-js already in use).

## Package Legitimacy Audit

No new external packages are installed by this phase. esm.sh-pinned imports (`zod@3.23.8`, `@supabase/supabase-js@2`) are already in production use in this repo.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
Sentry (org ai-simple / project call-vault)
  │  issue alert rule fires → action "Send a notification via CallVault Tickets"
  ▼
POST https://<project-ref>.supabase.co/functions/v1/sentry-webhook
  headers: Sentry-Hook-Resource: event_alert
           Sentry-Hook-Signature: <hmac-sha256 hex>
           Sentry-Hook-Timestamp: <ts>
  body:    { action: "triggered", installation: {uuid}, data: { event: {...}, triggered_rule }, actor }
  │
  ▼
sentry-webhook Edge Function (verify_jwt = false)
  1. method gate (POST only) + payload size guard
  2. read RAW body text → HMAC-SHA256(SENTRY_WEBHOOK_SECRET, rawBody) → constant-time compare
     vs sentry-hook-signature header  ──fail──► 401 (zero DB work)
  3. zod-parse JSON; require data.event  ──fail──► 400
  4. map: level→severity, build fingerprint 'sentry:'+issue_id, build context jsonb
  5. service-role UPSERT into tickets ON CONFLICT (fingerprint partial idx)
        new row → occurrence_count=1, ticket_events 'created'
        existing → occurrence_count+1, last_seen_at=now()  (no new ticket)
  6. severity in ('critical','high') AND newly created → INSERT user_notifications (admin)
  7. respond 200 fast (Sentry retries/disables slow or erroring webhooks)
```

### Pattern 1: Raw-body signature verification (order matters)

**What:** Verify HMAC over the *raw* request body text BEFORE `JSON.parse`. Sentry computes the signature over the JSON body it sent; re-stringifying a parsed object can reorder/alter whitespace and break the digest.
**When to use:** Always for `sentry-webhook`.
**Example:**
```typescript
// Source: docs.sentry.io/organization/integrations/integration-platform/webhooks/
// (docs show Node crypto.createHmac("sha256", clientSecret).update(body).digest("hex")
//  compared against the sentry-hook-signature header)
const rawBody = await req.text();
const key = await crypto.subtle.importKey(
  "raw", new TextEncoder().encode(secret),
  { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
);
const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
const digestHex = [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, "0")).join("");
// constant-time compare digestHex vs req.headers.get("sentry-hook-signature")
```

### Pattern 2: Race-safe dedup UPSERT

**What:** Let Postgres enforce uniqueness; never SELECT-then-INSERT.
**When to use:** The dedup write.
**Example (SQL shape — the partial unique index `idx_tickets_fingerprint_unique` is the arbiter):**
```sql
INSERT INTO tickets (reporter_id, type, severity, status, source, fingerprint, context, occurrence_count, last_seen_at)
VALUES (NULL, 'bug', $1, 'new', 'sentry', $2, $3, 1, NOW())
ON CONFLICT (fingerprint) WHERE fingerprint IS NOT NULL
DO UPDATE SET occurrence_count = tickets.occurrence_count + 1,
              last_seen_at = NOW()
RETURNING id, occurrence_count;
```
`occurrence_count` in RETURNING distinguishes created (=1) from deduped (>1) — drives the notify-on-create-only rule and the response body. Note: supabase-js `.upsert()` cannot target a partial unique index with an increment expression — use a SECURITY DEFINER SQL function (RPC) or `postgres`-driver query from the Edge Function. Recommend an RPC `ingest_sentry_ticket(...)` defined in the same migration: keeps the atomic upsert + conditional `ticket_events`/`user_notifications` writes in one transaction.

### Pattern 3: Existing webhook idiom in this repo

`fireflies-webhook/` and `grain-webhook/` are the closest analogs: kebab-case folder, fast 2xx, secret check before work, service-role client. Mirror their structure; do NOT use `authenticateRequest` (no JWT on this path).

### Anti-Patterns to Avoid
- **`JSON.stringify(await req.json())` then HMAC:** digest mismatch risk — sign the raw text.
- **String `===` signature compare:** timing side-channel; use constant-time compare.
- **SELECT-then-INSERT dedup:** two concurrent deliveries create two tickets or one 500.
- **Slow handler:** Sentry disables webhooks that consistently fail/time out — return 200 promptly; do all writes in one RPC round-trip.
- **Trusting `data.event.fingerprint` as a hash:** it's `["{{ default }}"]` for default-grouped issues — collides across ALL default issues. Use `issue_id`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Error grouping/fingerprinting | Custom hash of title+stack | Sentry's `issue_id` | Sentry already groups events into issues server-side |
| Atomic upsert + audit + notify | Three sequential supabase-js calls | One SQL function (RPC) in the migration | Transactionality + race-safety in one place |
| HMAC | Manual byte math | Web Crypto `crypto.subtle` | Built into the Edge runtime |

**Key insight:** Sentry has already solved dedup (issues) and authenticity (signed webhooks) — the function's job is verification, mapping, and one atomic DB write.

## Common Pitfalls

### Pitfall 1: Wrong dedup key (payload `fingerprint` field)
**What goes wrong:** All default-grouped errors share `["{{ default }}"]` → every Sentry error dedupes into ONE ticket.
**Why it happens:** Field name collision — payload `fingerprint` is grouping config, not the group hash.
**How to avoid:** `tickets.fingerprint = 'sentry:' + data.event.issue_id`.
**Warning signs:** Second distinct error increments the first ticket's count.

### Pitfall 2: `reporter_id NOT NULL` blocks system tickets
**What goes wrong:** Insert fails — live schema requires a reporter referencing `auth.users`.
**How to avoid:** Migration relaxes to nullable BEFORE function deploy; plan must order migration → db push → function.
**Warning signs:** `null value in column "reporter_id" violates not-null constraint`.

### Pitfall 3: `verify_jwt` default rejects Sentry
**What goes wrong:** Supabase Edge Functions require a JWT by default; Sentry sends none → 401 from the platform before your code runs.
**How to avoid:** `[functions.sentry-webhook] verify_jwt = false` in `supabase/config.toml` (repo already does this for `fireflies-webhook`/`grain-webhook` — copy that block) and/or `--no-verify-jwt` on deploy.
**Warning signs:** 401 with `{"msg":"Missing authorization header"}` from the gateway, not your function.

### Pitfall 4: Alert rule fires once per ISSUE by default
**What goes wrong:** "A new issue is created" condition fires only on first occurrence — occurrence_count never increments; SEN-02 looks broken in production.
**How to avoid:** Document alert-rule condition choice: include "The issue is seen more than {N} times" / regression conditions, or accept create-only alerts and treat occurrence_count as alert-delivery count. For the SEN-02 probe, two synthetic POSTs to the function prove dedup regardless of rule config.
**Warning signs:** Tickets stuck at occurrence_count=1 while Sentry shows rising event counts.

### Pitfall 5: RLS regression test expects non-null reporter scoping
**What goes wrong:** NULL-reporter rows are admin-only-visible (reporter policy never matches NULL). Fine — but integration tests that seed Sentry tickets then read them back as a non-admin will see zero rows.
**How to avoid:** Test reads via service-role or an ADMIN-role JWT.

## Code Examples

### Level → severity mapping (locked decision, concrete)
```typescript
function mapSeverity(level: unknown): "high" | "medium" | "low" {
  switch (String(level ?? "").toLowerCase()) {
    case "fatal":
    case "error":   return "high";
    case "warning": return "medium";
    default:        return "low";   // info, debug, unknown — never 'critical' from telemetry
  }
}
```

### Context jsonb shape (recommended keys)
```typescript
const context = {
  sentry: {
    issue_id: ev.issue_id,            // also the dedup basis
    issue_url: `https://ai-simple.sentry.io/issues/${ev.issue_id}/`, // human UI link
    api_issue_url: ev.issue_url,      // API URL from payload
    web_url: ev.web_url,              // event deep link
    title: ev.title,
    culprit: ev.culprit,
    level: ev.level,
    release: ev.release ?? null,
    platform: ev.platform ?? null,
    environment: tagValue(ev.tags, "environment"),
    first_seen_event_id: ev.event_id,
    project: "call-vault",
    triggered_rule: payload.data?.triggered_rule ?? null,
  },
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Legacy "WebHooks" plugin (unsigned, per-project) | Integration Platform internal integration (signed, org-scoped, Alert Rule Action) | Integration Platform GA (years back; still current 2026) | Signature verification available — query-param fallback unnecessary |
| `service hooks` API | Same as above | — | Out of scope |

**Deprecated/outdated:** none relevant.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Client Secret is displayed on the internal integration's settings page after creation (standard Integration Platform behavior; exact UI label not re-verified this session) | Manual setup steps | Andrew hunts for the secret — low risk, documented as "copy the Client Secret shown on the integration page" |
| A2 | Issue UI URL `https://ai-simple.sentry.io/issues/{issue_id}/` resolves (org-subdomain URL format) | Context jsonb | Link 404s; `web_url`/`issue_url` from payload remain as verified fallbacks |
| A3 | `supabase/config.toml` carries `verify_jwt=false` blocks for existing webhooks (pattern assumed from repo idiom; planner must confirm file state) | Pitfall 3 | Deploy step adds `--no-verify-jwt` flag instead |

## Open Questions

1. **Alert-rule condition set for production** — create-only vs frequency-based re-firing (Pitfall 4). Recommendation: document both; default to "new issue + regression + seen >100 times" so dedup increments are exercised. Decision is Andrew's at setup time; does not block the build.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| supabase CLI | migration push + function deploy | ✓ (repo workflow uses it; deploy via `--use-api`, Docker absent) | — | CI deploy workflow |
| Sentry org `ai-simple` / project `call-vault` | SEN-01 | ✓ (per roadmap; sentry-trace headers already in CORS allowlist) | — | — |
| Sentry internal integration + Client Secret | signature verification | ✗ NOT YET CONFIGURED — the one human prerequisite | — | secret query param (only if signing path unavailable) |
| Supabase test project (`.env.test`) | integration tests | per `supabase/CLAUDE.md` Option A | — | Deno unit tests only |

**Missing dependencies with no fallback:** Sentry-side integration/secret (human prerequisite — execution blocked until provisioned; build + unit tests proceed without it).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (repo) + `deno test` for Edge Function units |
| Config file | `vitest.config.ts` (integration tests gated by `VITEST_INTEGRATION_OK=true`) |
| Quick run command | `deno test supabase/functions/sentry-webhook/__tests__/` |
| Full suite command | `npm test` (unit) / `npm run test:integration` (real-Supabase) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEN-01 | Valid signed payload → ticket row (source=sentry, severity mapped, context populated, events row) | integration | `npm run test:integration -- sentry-webhook` | ❌ Wave 0 |
| SEN-01 | Bad/missing signature → 401, zero DB writes | unit (deno) | `deno test supabase/functions/sentry-webhook/__tests__/` | ❌ Wave 0 |
| SEN-02 | Same issue_id twice → one ticket, occurrence_count=2, last_seen_at advanced | integration | `npm run test:integration -- sentry-webhook` | ❌ Wave 0 |
| SEN-01 | fatal level → user_notifications row for admin | integration | `npm run test:integration -- sentry-webhook` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `deno test supabase/functions/sentry-webhook/__tests__/`
- **Per wave merge:** `npm test`
- **Phase gate:** `npm test` green + integration suite green (or cleanly skipped when test project absent) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `supabase/functions/sentry-webhook/__tests__/sentry-webhook.test.ts` — signature + mapping units (SEN-01)
- [ ] `supabase/functions/sentry-webhook/__tests__/sentry-webhook.integration.test.ts` (or `src/test/` sibling) — dedup + notification (SEN-01/02)
- [ ] Captured/representative payload fixture (from docs example shape)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | HMAC-SHA256 `sentry-hook-signature` over raw body; constant-time compare; 401 before DB work |
| V3 Session Management | no | stateless webhook |
| V4 Access Control | yes | service-role writes only; RLS leaves NULL-reporter tickets admin-visible only; no client-supplied identity trusted |
| V5 Input Validation | yes | zod schema on parsed payload; payload-size cap; method gate |
| V6 Cryptography | yes | Web Crypto HMAC — never hand-rolled |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Forged webhook → ticket spam / notification spam | Spoofing | Signature verification; reject before DB |
| Replayed valid payload inflating counts | Tampering/Repudiation | Acceptable (count inflation only, no escalation); optional `sentry-hook-timestamp` staleness check at Claude's discretion |
| Oversized body DoS | DoS | Size cap (e.g. 512KB) before HMAC |
| Secret leakage via logs/response | Information disclosure | Never log secret or full signature; `supabase secrets` storage |
| SQL injection via payload strings | Tampering | Parameterized supabase-js / RPC args only |

## Project Constraints (from CLAUDE.md)

- Root: npm only; conventional commits `feat(12-xx):`; no AI code in frontend (AI-02) — phase is backend-only.
- `supabase/CLAUDE.md`: kebab-case function folders; migration naming `YYYYMMDDHHMMSS_description.sql` with header + section banners; zod input validation; standard CORS headers + OPTIONS preflight; deploy with `supabase functions deploy sentry-webhook --use-api` (Docker absent); integration tests ONLY against the dedicated test project via `npm run test:integration`, cleanup contract mandatory (temp rows, try/catch afterAll, idempotent).
- RLS regression: `tickets`/`ticket_messages`/`ticket_events` already in `CROSS_ORG_TABLES` (Phase 11); NULL-reporter rows need a sanity assertion that they don't leak to non-admin users.

## Manual Sentry Setup (verified click path, for the plan's human-prerequisite doc)

1. sentry.io → org `ai-simple` → **Settings → Developer Settings** → create a new **Internal Integration** (name: `CallVault Tickets`). [CITED: docs.sentry.io/organization/integrations/integration-platform/]
2. In the integration form: set **Webhook URL** = `https://<project-ref>.supabase.co/functions/v1/sentry-webhook`; enable **Alert Rule Action**; save. [CITED: same — "The integration will then show up as a service in the action section when creating or updating an alert rule"]
3. Copy the integration's **Client Secret** (shown on the integration page) → executor sets it: `supabase secrets set SENTRY_WEBHOOK_SECRET=<client-secret>`. [A1 ASSUMED for exact UI label]
4. Project `call-vault` → **Alerts → Create Alert Rule** (issue alert) → conditions per Open Question 1 → action **"Send a notification via CallVault Tickets"** → save. [CITED: action label format from integration-platform docs]
5. Webhook deliveries will carry `Sentry-Hook-Resource: event_alert`, `action: "triggered"`. [CITED: docs.sentry.io/organization/integrations/integration-platform/webhooks/issue-alerts/]

## Sources

### Primary (HIGH confidence)
- https://docs.sentry.io/organization/integrations/integration-platform/webhooks/ — headers (`Sentry-Hook-Resource`, `Sentry-Hook-Timestamp`, `Sentry-Hook-Signature`), HMAC-SHA256 w/ Client Secret verification example, request structure (action/installation/data/actor) — fetched 2026-06-11
- https://docs.sentry.io/organization/integrations/integration-platform/webhooks/issue-alerts/ — `event_alert` resource, `action: "triggered"`, `data.event` fields incl. `fingerprint: ["{{ default }}"]` example proving the dedup-key finding — fetched 2026-06-11
- https://docs.sentry.io/organization/integrations/integration-platform/ — internal integration creation path, Alert Rule Action semantics, webhook URL at creation — fetched 2026-06-11
- Live repo: `supabase/migrations/20260611000002_create_ticket_tables.sql` (tickets schema reality), `supabase/CLAUDE.md` (conventions), `20260131000004_create_notifications_table.sql` (user_notifications exists)

### Secondary (MEDIUM confidence)
- Repo idiom: `fireflies-webhook/`, `grain-webhook/` as structural analogs

### Tertiary (LOW confidence)
- none

## Metadata

**Confidence breakdown:**
- Payload + signature: HIGH — live docs fetched this session
- Schema gap (occurrence_count/last_seen_at/reporter_id): HIGH — verified against live migration file
- Sentry UI click path: MEDIUM — top-level path cited; exact field labels may drift (A1)

**Research date:** 2026-06-11
**Valid until:** 2026-07-11 (Sentry Integration Platform is stable; re-verify click path at execution)
