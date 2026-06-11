# Phase 12: Sentry Ingestion - Pattern Map

**Mapped:** 2026-06-11
**Files analyzed:** 6 new/modified files
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/functions/sentry-webhook/index.ts` | edge function (webhook receiver) | event-driven request-response | `supabase/functions/fireflies-webhook/index.ts` | exact (signed server-to-server webhook) |
| `supabase/migrations/<ts>_sentry_ticket_ingestion.sql` | migration | DDL + SQL function | `supabase/migrations/20260611000002_create_ticket_tables.sql` | exact (same tables, same idiom) |
| (reuse, no edit) `supabase/functions/_shared/webhook-signing.ts` | shared utility | transform | — already exists | exact |
| `supabase/config.toml` (add `[functions.sentry-webhook]` block) | config | — | existing `verify_jwt = false` function blocks | exact |
| `supabase/functions/sentry-webhook/__tests__/*.test.ts` | test (deno unit) | — | `_shared` extraction note in webhook-signing.ts ("testable in isolation"); repo deno test idiom | role-match |
| integration test (dedup/notification) | test (vitest integration) | CRUD | `src/test/rls-regression.test.ts` cleanup idiom + `supabase/CLAUDE.md` contract | role-match |

## Pattern Assignments

### `supabase/functions/sentry-webhook/index.ts` (webhook receiver)

**Analog:** `supabase/functions/fireflies-webhook/index.ts` (signed webhook) + `supabase/functions/send-support-ticket/index.ts` (ticket insert + events idiom)

**Imports + signature primitives** (fireflies-webhook lines 1-15 — REUSE, do not hand-roll):
```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  computeHmacSha256Signature,
  timingSafeEqualString,
} from "../_shared/webhook-signing.ts";
```
⚠️ `computeHmacSha256Signature` returns `sha256=<hex>` (GitHub convention). Sentry's `sentry-hook-signature` header is BARE hex — compare `computeHmacSha256Signature(rawBody, secret)` against `` `sha256=${req.headers.get("sentry-hook-signature")}` `` (or strip the prefix). `timingSafeEqualString` is the constant-time compare.

**Raw-body-first verification pattern** (fireflies-webhook lines 47-63):
```typescript
const rawBody = await req.text();           // BEFORE JSON.parse — signature is over raw body
const signature = req.headers.get("sentry-hook-signature") ?? "";
if (!signature) { return 401 JSON response; }
// verify, THEN: const payload = JSON.parse(rawBody);
```

**Server-to-server CORS block** (fireflies-webhook lines 30-35): wildcard origin, `POST, OPTIONS` methods, standard Allow-Headers list. Copy shape; no browser callers.

**Ticket + events insert idiom** (send-support-ticket lines 144-208): service-role client `createClient(supabaseUrl, supabaseServiceKey)`; insert ticket → insert `ticket_events` row `{ event_type: 'created', new_value: 'new' }`; for Sentry path `actor_id: null` (system) and the atomic UPSERT moves into the SQL function (see migration analog) instead of sequential inserts.

**Error handling** (fireflies-webhook lines 208-222): catch-all → `console.error` + 500 JSON `{ error }`; never leak the secret.

**Zod validation** (send-support-ticket lines 11-24, 128-136): closed-enum schema + `safeParse` + 400 with first issue message. Validate AFTER signature passes.

### Migration (`relax reporter_id + occurrence columns + ingest RPC`)

**Analog:** `supabase/migrations/20260611000002_create_ticket_tables.sql`

- Header comment block (`-- Migration / Purpose / Author / Date`), `====` section banners, `COMMENT ON` for every new column — copy structure verbatim.
- SECURITY DEFINER function idiom (lines: `log_ticket_status_change`): `LANGUAGE plpgsql SECURITY DEFINER SET search_path = public` — the ingest RPC follows the same shape.
- The partial unique index `idx_tickets_fingerprint_unique ... WHERE fingerprint IS NOT NULL` already exists — `ON CONFLICT (fingerprint) WHERE fingerprint IS NOT NULL` targets it.
- DDL needed: `ALTER TABLE public.tickets ALTER COLUMN reporter_id DROP NOT NULL;` + `ADD COLUMN occurrence_count INTEGER NOT NULL DEFAULT 1` + `ADD COLUMN last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.

### `supabase/config.toml`

**Analog:** existing function blocks (69 `verify_jwt` entries; file header: "All user-initiated functions use verify_jwt = false at the gateway level"):
```toml
[functions.sentry-webhook]
verify_jwt = false
```

### Admin notification fan-out

**Analog:** `user_notifications` schema (20260131000004) + `user_roles` (consolidated schema line 75):
```typescript
// admins: SELECT user_id FROM user_roles WHERE role = 'ADMIN'  (service-role)
// insert per admin: { user_id, type: 'system', title, body, metadata: { ticket_id, sentry_issue_id } }
```
`type` is free TEXT (comment lists 'health_alert', 'system', 'info') — use `'system'` or `'sentry_error'`; INSERT policy is `WITH CHECK (true)` (service-role only path).

## Shared Patterns

- **Service-role for system writes:** `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)` — both analogs.
- **JSON responses:** `{ success: boolean, ... }` / `{ error }` with `...corsHeaders, 'Content-Type': 'application/json'` (supabase/CLAUDE.md standard).
- **OPTIONS preflight first line of handler** — both analogs.
- **Method gate:** send-support-ticket lines 109-114 (405 on non-POST).
- **No `authenticateRequest` here:** fireflies-webhook proves the no-JWT webhook path; do NOT import `_shared/auth.ts`.
- **Deploy:** `supabase functions deploy sentry-webhook --use-api` (Docker absent on this machine).
- **Integration test cleanup contract:** temp rows, capture-before-mutate, try/catch per cleanup step, idempotent (`supabase/CLAUDE.md`).
