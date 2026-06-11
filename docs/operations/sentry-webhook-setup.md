# Sentry Webhook Setup Runbook

**Last updated:** 2026-06-11
**Owner:** Andrew Naegele (naegele412@gmail.com)
**Status:** Function deployed; live Sentry delivery pending the steps below

---

## Prerequisite framing

**Execution of live Sentry ingestion has ONE human prerequisite: this page.**

The `sentry-webhook` Edge Function is built, tested, and deployed. It is live at:

```
https://vltmrnjsubfzrgrtdqey.supabase.co/functions/v1/sentry-webhook
```

It already rejects unsigned requests (`401 {"error":"invalid signature"}`). What it cannot do
without you is receive *real* Sentry alerts — that requires creating a Sentry internal
integration and wiring an alert rule to it. Five minutes, all in the Sentry UI.

When a production error fires after this setup, it lands in **AdminTab → Tickets** as a
`source=sentry` bug ticket, deduped by Sentry's issue ID, with admin notifications on the
first occurrence of a `high`-severity (fatal/error level) issue.

---

## Step 1 — Create the internal integration

1. Go to **sentry.io → org `ai-simple` → Settings → Developer Settings → Internal Integrations → New Internal Integration**.
2. **Name:** `CallVault Tickets`
3. **Webhook URL:** paste exactly:
   ```
   https://vltmrnjsubfzrgrtdqey.supabase.co/functions/v1/sentry-webhook
   ```
4. Enable **Alert Rule Action** (this is what makes the integration appear as an action
   when you build an alert rule in Step 3).
5. **Save.**

---

## Step 2 — Provision the secret

1. On the integration's page, copy the **Client Secret** (shown after the integration is
   saved — the label may read "Client Secret" or appear under the integration's credentials).
2. Set it as the function's secret (this is where the secret goes — never commit it):
   ```bash
   supabase secrets set SENTRY_WEBHOOK_SECRET=<client-secret>
   ```
   The function HMACs each request body with this secret and constant-time-compares it against
   the `sentry-hook-signature` header. A mismatch is a `401` with zero database work.

**Fallback (only if the signature path is ever unavailable):** set
`SENTRY_WEBHOOK_SECRET=qp:<random-string>` and append `?secret=<random-string>` to the webhook
URL in Step 1. The function then authenticates via the query param instead of HMAC. The primary,
recommended path is HMAC — use the fallback only if Sentry signing breaks.

---

## Step 3 — Create the alert rule

1. Go to **project `call-vault` → Alerts → Create Alert Rule** (issue alert).
2. **Recommended conditions** (so dedup increments are visible in production — see Pitfall note):
   - "A new issue is created", OR
   - "The issue changes state from resolved to unresolved" (regression), OR
   - "The issue is seen more than 100 times in 1 hour"
3. **Action:** **"Send a notification via CallVault Tickets"**
4. **Save.**

> **Why the "seen more than N times" condition matters:** an alert rule with only
> "a new issue is created" fires exactly once per issue, so `occurrence_count` never climbs in
> production even though dedup works. Including a seen-more-than / regression condition exercises
> the increment path. (Dedup itself is independently proven by the integration test — two
> synthetic deliveries with the same issue ID yield one ticket at `occurrence_count=2`.)

---

## Step 4 — Smoke test

1. Trigger a synthetic error on production — e.g. open the browser console on
   `app.callvaultai.com` and run `throw new Error("sentry webhook smoke test")` (or
   `setTimeout(() => { heck() }, 0)` for an unhandled ReferenceError).
2. Wait for the alert rule to fire (depends on your conditions; "new issue" fires immediately).
3. Confirm a ticket appears in **AdminTab → Tickets** with `source=sentry`.
4. In the Supabase dashboard, the function logs for `sentry-webhook` should show a `200`.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `401 {"error":"invalid signature"}` on real deliveries | `SENTRY_WEBHOOK_SECRET` not set, or set to the wrong value (it must equal the integration's Client Secret) | Re-copy the Client Secret and re-run `supabase secrets set SENTRY_WEBHOOK_SECRET=...` |
| `401 {"msg":"Missing authorization header"}` (gateway message, not the function's) | The `verify_jwt = false` config block didn't make it into the deploy | Confirm `[functions.sentry-webhook] verify_jwt = false` is in `supabase/config.toml`, redeploy with `supabase functions deploy sentry-webhook --use-api` |
| No deliveries at all | "Alert Rule Action" not enabled on the integration, or the alert rule's action isn't "Send a notification via CallVault Tickets" | Re-check Step 1 (enable Alert Rule Action) and Step 3 (select the action) |
| Every distinct error dedupes into ONE ticket | Fingerprint bug — the function would be using the payload's `fingerprint` field instead of `issue_id`. This should never happen (the function uses `sentry:<issue_id>`). | File a ticket; do not work around it |
| Tickets stuck at `occurrence_count=1` while Sentry shows rising event counts | Alert rule only has "a new issue is created" — it fires once per issue | Add a "seen more than N times" or regression condition (Step 3) |

---

## What's deployed vs. what's pending

- **Deployed & proven:** function live; unsigned POST → `401 {"error":"invalid signature"}`;
  `GET` → `405`; HMAC signing logic byte-verified against openssl; dedup + notification
  semantics proven by the integration test against the dedicated Supabase test project.
- **Pending this runbook:** the real Sentry → ticket end-to-end. It cannot be exercised by the
  executor because `supabase secrets list` exposes only a *digest* of the secret, not its value,
  and only Sentry holds the real Client Secret used to sign deliveries. The first real Sentry
  alert (new-issue or unresolve transition) after Steps 1–3 is the live proof.

---

## Deploy / redeploy reference

```bash
# Docker is absent on this machine — always use --use-api
supabase functions deploy sentry-webhook --use-api

# Verify the signature gate is live (must return 401 with the FUNCTION's body):
curl -s -w "\nHTTP %{http_code}\n" -X POST \
  https://vltmrnjsubfzrgrtdqey.supabase.co/functions/v1/sentry-webhook -d '{}'
# Expect: {"error":"invalid signature"}  HTTP 401
```
