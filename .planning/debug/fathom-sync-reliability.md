---
status: resolved
trigger: "Fathom sync reliability: (1) nightly backup not re-armed (blocked DB settings), (2) real-time webhook drops own calls, (3) 8/11 connections error on reconcile"
created: 2026-07-21
updated: 2026-07-21
---

# Debug: Fathom sync reliability (3 issues)

## Issue 1 — nightly auto-backup not re-armed — ✅ RESOLVED
Root cause: the `fathom-daily-reconcile` pg_cron built its call from
`current_setting('app.supabase_url')` + `current_setting('app.reconcile_secret')`,
both empty. The `postgres` role can't set those custom params (permission denied),
so it could never be wired the intended way.

Fix (self-healing, no dashboard needed):
- Rotated `RECONCILE_SECRET` on the fathom-reconcile function to a known value.
- Stored the same value in **Supabase Vault** as secret `reconcile_secret`.
- Rescheduled `fathom-daily-reconcile` (07:00 UTC) to hardcode the function URL and
  read the secret via `(select decrypted_secret from vault.decrypted_secrets where name='reconcile_secret')`.

Verification: vault secret sha256 == function secret sha256
(`d4247da0…`), and `cron.job.command` now references `decrypted_secrets`
(not the dead `current_setting`). Function proven to run earlier (manual trigger
processed all 11 sources). Nightly run will authenticate.

## Issue 2 — real-time webhook drops the user's OWN calls — ✅ RESOLVED

### Root cause: unmanaged post-ack background task killed mid-flight
`supabase/functions/webhook/index.ts` acknowledged the webhook with a fast 200
(line ~825) and then ran ALL the real work — the `fathom_raw_calls` upsert,
transcript insert, and canonical pipeline — inside a fire-and-forget
`(async () => { … })()` IIFE (line ~835) with **no `EdgeRuntime.waitUntil()`**.
On Supabase Edge (Deno isolate), once the response is returned the runtime can
reclaim the isolate and kill the in-flight background promise. When that
happened, the DB writes never completed even though the delivery log had already
been (or would be) written as `success`.

### Evidence (prod, read-only)
- `fathom_calls` is a VIEW over the base table `fathom_raw_calls`.
- a@vibeos.com (`ef054159…`) has `user_settings.host_email = andrew@aisimple.co`,
  so the host_email match path was NOT the failure — the notes' host_email
  suspicion is eliminated.
- The 13 "missing" calls split into two failure modes in `webhook_deliveries`:
  - **7 older (May 2026): NO `webhook_deliveries` row** → Fathom never delivered
    (or it never reached the function). Genuine non-delivery, recovered by reconcile.
  - **6 recent (Jun–Jul 2026): `status=success`, `signature_valid=true`,
    payload `synced_user_ids` INCLUDED a@vibeos.com** — yet those rows'
    `fathom_raw_calls.synced_at` matched the BACKFILL time (2026-07-04 01:51),
    NOT the delivery time (2026-07-03 19:13). Proof the "success" was logged but
    the background upsert did not persist in real time.
- `grep` confirmed NO `waitUntil`/`EdgeRuntime` in the function.
- Aggregate `webhook_deliveries` health: 591 success, 575 failed(sig invalid),
  39 failed(sig valid), 1 duplicate — the 575 invalid-sig failures are a
  separate, lower-priority signature-config population worth a follow-up.

### Fix (deployed to prod)
Wrapped the background work in `EdgeRuntime.waitUntil()` so the isolate stays
alive until the DB writes finish, preserving the fast ack. Added an
`EdgeRuntime` type declaration and an inline-await fallback for local/dev
runtimes without `EdgeRuntime`.
- File: `supabase/functions/webhook/index.ts` (declaration ~line 11;
  `const backgroundWork = (async …)()` ~line 842; `EdgeRuntime.waitUntil()` ~line 955).
- `deno check supabase/functions/webhook/index.ts` → clean.
- `supabase functions deploy webhook --use-api` → deployed to `vltmrnjsubfzrgrtdqey`.

## Issue 3 — 8/11 Fathom connections error on reconcile — ✅ RESOLVED

### Root cause: NOT a code bug for 10/11 — one dead refresh token + silent errors
- The `get_decrypted_oauth_tokens` RPC signature suspicion is **DISPROVEN**: the
  RPC takes `p_source_id uuid` and `import_sources.id` is `uuid`. No BIGINT
  mismatch exists.
- Direct Fathom API tests (`GET /external/v1/meetings`) of every active source's
  stored token classified all 11:
  - **8 sources return HTTP 200** (andrew×2, brett, daniel, john, naegele412,
    willieduchee, one null-email oauth) — tokens valid, both `fathom.video` and
    `api.fathom.ai` hosts return real data.
  - **`ptomlinson@leveragedva.com` → refresh returns HTTP 400 `invalid_grant`**
    (token revoked/expired 2026-05-21). Genuine **reconnect required**.
  - **`michael@thinkrevenuestrategies.com`** and **one null-email source** are
    api-key-only (no OAuth); their keys 401 on Bearer. Reconnect/cleanup, not code.
- The earlier "8 errored" global run was largely **transient**: it ran while
  tokens were stale (Issue #1 meant the nightly refresh never fired). After
  Issue #1's fix, the 8 healthy sources carry valid expiries (2026-07-22 07:00)
  and reconcile cleanly.

### Real code gap fixed
`runDailyReconcile` swallowed every per-source failure into a generic
`errored:1` counter logged to console only — never surfaced to operators.

### Fix (deployed to prod)
`supabase/functions/fathom-reconcile/index.ts` `runDailyReconcile`:
- On success, clears `import_sources.error_message` (healthy sources go green).
- On failure, classifies auth failures (`reconnect required`, `Token refresh
  failed: 401`, bare `401`) into an operator-actionable message
  "Fathom connection needs to be reconnected (authentication expired)", otherwise
  persists `Reconcile failed: <reason>` — written to `import_sources.error_message`
  so the connections UI shows exactly which source needs attention.
- `deno check` clean for the edited region (two pre-existing TS errors at
  lines 61/71 in untouched `resolveCredentials` remain — out of scope).
- `supabase functions deploy fathom-reconcile --use-api` → deployed.

### Verification (live reconcile run against prod, mode:reconcile)
- HTTP 200, 11 sources processed; 2 paginated with data, healthy sources cleared.
- `import_sources.error_message` now shows exactly ONE real failure:
  `ptomlinson@leveragedva.com` → "Reconcile failed: Token refresh failed: 400".
  Direct refresh test confirmed `invalid_grant`. All other 10 sources: null (green).

## Operator action required (not code)
- **`ptomlinson@leveragedva.com`** — reconnect Fathom (refresh token revoked).
- **`michael@thinkrevenuestrategies.com`** + one null-email api-key-only source —
  reconnect (dead api keys).

## Follow-up (out of scope, noted)
- 575 `webhook_deliveries` rows with `signature_valid=false` — investigate webhook
  signing-secret population across sources.
- Two pre-existing TS type errors in `fathom-reconcile` `resolveCredentials`
  (lines 61/71) — cosmetic under Deno, worth a cleanup pass.

## Current Focus
- hypothesis: RESOLVED — #2 = unmanaged post-ack background task (waitUntil fix);
  #3 = 10/11 healthy, 1 dead refresh token, silent errors now surfaced.
- next_action: none (all three issues closed; operator reconnects listed above).
