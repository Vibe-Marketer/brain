# Phase 12: Sentry Ingestion - Context

**Gathered:** 2026-06-11
**Mode:** smart-discuss (auto — headless defaults, no interactive questioning)
**Status:** Ready for planning

<domain>
## Phase Boundary

Production Sentry errors (org `ai-simple`, project `call-vault`) flow into the DB-backed ticket queue automatically and deduplicated. One new Supabase Edge Function (`sentry-webhook`) receives Sentry ISSUE ALERT webhooks, creates tickets with `source = 'sentry'`, dedupes by error fingerprint, and notifies the admin for high-severity errors. Requirements: SEN-01, SEN-02. ISA reference: ISC-16/ISC-17 at `~/.claude/PAI/MEMORY/WORK/20260610-autonomous-admin-center/ISA.md`.

No dispatcher/autonomous-fix machinery (Phase 13), no approval loop (Phase 14), no capture changes (Phase 15), no Sentry API polling.

</domain>

<decisions>
## Implementation Decisions (pre-decided defaults, recorded headless 2026-06-11)

### Ingestion path
- Sentry **issue alert webhook** → new Supabase Edge Function **`sentry-webhook`** (no local port, no polling)
- Sentry org: `ai-simple`, project: `call-vault`
- Alert-rule creation is NOT automated — manual setup step documented for Andrew with the exact sentry.io click path and the webhook URL (see Specifics)

### Auth — webhook payloads are untrusted input
- Shared secret stored in the function's env (Supabase function secrets)
- Primary: verify Sentry webhook signature via the `sentry-hook-signature` header (HMAC-SHA256 of the raw body with the shared secret) **if the alert-webhook path provides it** — researcher must confirm against current docs.sentry.io, not training data
- Fallback if signature is unavailable on the issue-alert webhook path: secret query param on the webhook URL, constant-time compared against the env secret
- Unauthenticated/invalid-signature requests are rejected (401) before any DB work; `verify_jwt` disabled for this function (Sentry can't send Supabase JWTs)

### Mapping (Sentry → tickets row)
- `type = 'bug'`, `source = 'sentry'` (enum value already exists in `ticket_source`)
- `reporter_id = NULL` (system) — **requires migration**: live `tickets.reporter_id` is `NOT NULL` referencing `auth.users`; Sentry tickets have no human reporter. Relax to nullable (NULL = system/telemetry), mirroring `ticket_events.actor_id NULL = system` semantics. RLS impact: reporter-scoped SELECT policy (`reporter_id = auth.uid()`) never matches NULL, so Sentry tickets are admin-visible only — correct behavior.
- Severity from Sentry level: `fatal`/`error` → `high`, `warning` → `medium`, `info` (and anything else/unknown) → `low`. **`critical` is never auto-assigned from telemetry** — reserved for human triage.
- `context` jsonb carries: Sentry issue URL, culprit, release, plus title/short summary and raw fingerprint material — enough for downstream triage without opening the Sentry UI (roadmap SC 3)
- Insert writes a `ticket_events` row (`event_type = 'created'`, `actor_id = NULL`) via service-role, matching the Phase 11 audit pattern

### Dedup (ISA ISC-17 pattern)
- Key: `tickets.fingerprint` — column and partial unique index (`idx_tickets_fingerprint_unique`, unique when not null) are **already live** per the 11-02 migration
- Same fingerprint arriving again → increment `occurrence_count` + update `last_seen_at` on the existing ticket instead of creating a new one
- **Schema gap (verified against live 11-02 migration):** `occurrence_count` and `last_seen_at` do NOT exist on `tickets` — they exist only in the abandoned legacy `support_tickets` schema. Phase 12 adds them via a small additive migration: `occurrence_count INTEGER NOT NULL DEFAULT 1`, `last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- Upsert must be race-safe against the partial unique index (e.g. `INSERT ... ON CONFLICT` on the fingerprint index or equivalent retry) — two webhook deliveries for the same fingerprint must yield exactly one ticket with count 2

### Admin notification
- Tickets landing at severity ≥ `high` also INSERT a `user_notifications` row for the admin (table exists since migration `20260131000004`; no UI dependency in this phase)
- Dedup occurrences do not re-notify on every hit (avoid notification storms) — exact re-notify policy at planner/Claude discretion (e.g. notify on create only, or on create + escalating thresholds)

### Claude's Discretion
- Exact `context` jsonb key names; payload-field extraction details (driven by researcher's verified current payload shape)
- Whether occurrence-increment also writes a `ticket_events` row (lean: yes, cheap audit signal, but not required by SEN-01/02)
- Rate limiting / payload-size guard specifics on the function
- Test approach: Deno tests for the function + real-Supabase integration per the Phase 1/6 idiom

</decisions>

<code_context>
## Existing Code Insights

### Live schema (verified in `supabase/migrations/20260611000002_create_ticket_tables.sql`)
- `tickets`: id, reporter_id (NOT NULL — must relax), type, severity, status (default `new`), source (`manual`|`sentry`), fingerprint (nullable, partial unique index), context jsonb, created_at/updated_at
- `ticket_events`: append-only, no authenticated INSERT policy — written by SECURITY DEFINER trigger (status changes) and service-role code
- Status-audit trigger `ticket_status_audit` fires on status UPDATE only; occurrence increments (count/last_seen) won't pollute the status audit trail
- `user_notifications` table live since `20260131000004_create_notifications_table.sql`

### Reusable Assets
- `send-support-ticket` Edge Function (Phase 11 pivot) — the existing service-role ticket-INSERT + `ticket_events` 'created' pattern to mirror
- Existing webhook receivers (`fireflies-webhook`, `grain-webhook`) — established Edge Function webhook idiom: raw-body handling, secret verification, fast 2xx response
- `supabase/functions/_shared/` — shared CORS/auth helpers
- `src/test/rls-regression.test.ts` — tickets tables already covered from Phase 11; confirm NULL-reporter rows don't leak cross-user

### Established Patterns
- Edge Functions: read `supabase/CLAUDE.md` before implementation (planner/researcher must read it)
- Service-role client for system writes; never trust request-body identity fields
- Conventional commits scoped `feat(12-xx):`
- npm only; no AI code in frontend (AI-02) — this phase is backend-only, no UI work required (AdminTab tickets view from 11-03 displays Sentry tickets for free via the `source` filter)

### Integration Points
- `supabase/functions/sentry-webhook/` — new function (execution phase; planning writes no supabase/ files)
- `supabase/migrations/` — one additive migration: relax `reporter_id` to nullable + add `occurrence_count`, `last_seen_at`
- `src/types/supabase.ts` — regenerate/extend after migration
- sentry.io org `ai-simple` / project `call-vault` — manual alert-rule + webhook configuration (human prerequisite, see Specifics)

</code_context>

<specifics>
## Specific Ideas

### Human prerequisite (the ONE manual step — execution cannot start without it)
Execution has exactly one human prerequisite: **Sentry-side webhook configuration + shared secret provisioning.** Documented steps for Andrew:

1. Generate a shared secret (executor provides it, e.g. `openssl rand -hex 32`) and set it as a Supabase function secret: `supabase secrets set SENTRY_WEBHOOK_SECRET=<value>` (this is where the secret goes on our side)
2. In sentry.io: **Settings → Developer Settings → Internal Integrations → New Internal Integration** (org `ai-simple`) — name it `CallVault Tickets`, set the Webhook URL to the deployed function URL `https://<project-ref>.supabase.co/functions/v1/sentry-webhook`, enable **Alert Rule Action**, and save. Copy the integration's signing secret if Sentry issues one (preferred over our generated secret — researcher confirms which secret signs `sentry-hook-signature`)
3. In sentry.io: project `call-vault` → **Alerts → Create Alert Rule** → issue alert ("When a new issue is created / event is seen") → add action **"Send a notification via CallVault Tickets"** (the internal integration) → save
4. If signature verification turns out unavailable on this path, instead use a plain webhook alert action pointing at `https://<project-ref>.supabase.co/functions/v1/sentry-webhook?secret=<value>`
5. Hand the secret value to the executor; never commit it

(Exact click path to be re-verified by the researcher against current sentry.io UI/docs and corrected in the plan if drifted.)

### Verification ideas
- Synthetic POST with a captured/representative Sentry payload → ticket row with source `sentry`, severity mapped, context populated (ISC-16 probe)
- Same payload twice → one ticket, `occurrence_count = 2`, `last_seen_at` advanced (ISC-17 probe)
- Bad/missing signature → 401, zero rows
- `fatal`-level payload → `user_notifications` row for admin exists

</specifics>

<deferred>
## Deferred Ideas

- Sentry API polling (pull-based ingestion) — out of scope, webhook-only
- `sentry-autofix.yml` integration — deferred idea, note only
- Automated alert-rule creation via Sentry API — manual setup documented instead
- Sentry release tagging in `Sentry.init` — already on roadmap "later" list
- Re-notification thresholds / notification UI — Phase 14+ / v2

</deferred>
