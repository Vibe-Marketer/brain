# Connection Patterns — Recording Source Connectors

**Last Updated:** 2026-05-26
**Status:** Reference
**Scope:** Catalog of the distinct connection-type archetypes used (or available) for pulling transcripts and recordings into CallVault. Plaud is intentionally excluded — its pattern is documented separately.

---

## TL;DR

Three real archetypes are live in the repo. Two edge cases also exist. Every new vendor connector slots into one of these five shapes; the auth + transport answer determines the rest.

| Pattern | User provides | We get data via | Identity binding | Real-time? | Live in repo |
|---|---|---|---|---|---|
| **A — OAuth + Webhook + Poll** | One click | Webhook push + REST poll | Per-user OAuth token (refreshable) | Yes | Fathom, Zoom, Read.ai, Grain |
| **B — API key + Webhook + Poll** | Pasted key | Webhook push + REST/GraphQL poll | Per-user API key (sometimes workspace) | Yes | Fireflies |
| **C — Static token + Poll only** | Pasted token | REST poll only | Per-user static token | No (5–15 min lag) | Plaud (excluded — fallback shape) |
| **D — Public URL / no auth** | URL | Direct fetch | None | One-shot | YouTube |
| **E — File / email-forward** | Forward address or file drop | Inbox parse / file watcher | Email identity | Push-on-arrival | Not built (Riverside candidate) |

---

## The 3 real archetypes

### A. OAuth + Webhook + REST poll — the default

This is the gold standard. Use it whenever the vendor offers it.

**Mechanics:**
- User clicks "Connect [Vendor]" in the connector UI
- Standard OAuth 2.0 authorization code flow → redirect → callback
- We store `access_token` + `refresh_token` per user
- Vendor pushes webhook events when a meeting finishes (HMAC-signed)
- We poll REST endpoints to backfill / recover missed webhooks

**Why this is the default:**
- Lowest user friction (single click, no token-paste UX)
- Highest reliability (push + poll redundancy guarantees no missed recordings)
- Refresh tokens keep the connection alive indefinitely
- Per-user identity binding maps cleanly to our `recording_sources` table

**Live implementations:** Fathom, Zoom, Read.ai, Grain
**File anchors:** `supabase/functions/{vendor}-oauth-url/`, `{vendor}-oauth-callback/`, `{vendor}-webhook/`, `{vendor}-sync-meetings/`
**Webhook signing:** HMAC-SHA256, vendor-specific signature format (e.g., Zoom uses `v0={ts}:{body}`, Fathom uses `whsec_` prefix)

---

### B. API key paste + Webhook signing + REST/GraphQL poll

The forced fallback when a vendor has no public OAuth app (or it's enterprise-gated).

**Mechanics:**
- User generates a personal API key in the vendor's dashboard
- User pastes the key into CallVault's connector form
- User also installs a webhook in the vendor dashboard pointing at our endpoint (sometimes we provision this via API; sometimes manual)
- We poll their REST or GraphQL API on demand or on schedule

**Trade-offs vs. Pattern A:**
- More user friction (multi-step setup, copy-paste, possibly manual webhook install)
- Key rotation is the user's responsibility (no refresh)
- Otherwise functionally equivalent — still real-time, still per-user identity

**Live implementation:** Fireflies (GraphQL flavor)
**File anchors:** `supabase/functions/fireflies-save-source/`, `fireflies-webhook/`, `fireflies-sync-meetings/`
**Webhook signing:** HMAC-SHA256, header `X-Hub-Signature: sha256=...`

---

### C. Static token + Poll only (no webhook)

The lowest-feature fallback. Use only when the vendor has neither OAuth nor webhooks.

**Mechanics:**
- User pastes a long-lived token / cookie / API key
- We poll the vendor's REST endpoint on a schedule (cron) or on user-triggered sync
- No real-time push — recordings appear with 5–15 min lag

**Trade-offs:**
- No push means we burn API calls polling, hit rate limits, and ship a worse UX
- Tokens can silently expire — needs token-health monitoring
- Used today only for Plaud (intentionally excluded from this doc)

**File anchors:** `supabase/functions/plaud-connect-token/`, `plaud-sync-recordings/`

---

## The 2 edge cases

### D. Public URL / no auth — one-shot ingestion

Not a "connector" in the account-sync sense — there's no identity to attach. Useful for one-off ingestion.

**Mechanics:**
- User pastes a public URL (YouTube link, hosted MP4, etc.)
- We fetch metadata + captions/transcript directly
- No persistent connection, no recurring sync

**Live implementation:** YouTube
**File anchors:** YouTube ingestion path in shared connector pipeline

---

### E. File / email-forward — push-on-arrival without an API

For vendors that emit transcripts as artifacts (PDF, DOCX, SRT, JSON files) rather than via an API.

**Mechanics (planned, not built):**
- User gets a unique forwarding email address (`recordings+{user_id}@callvault.io`)
- User configures their tool to email transcripts there
- Inbox parser extracts attachment, normalizes to canonical schema, drops into pipeline
- Alternative: a file-watcher on a per-user S3/Drive folder

**Use case:** Riverside (file-based transcripts, no JSON turn structure). Other "no-API" vendors.
**Status:** Not implemented. Flagged in `docs/source-connector-gap-analysis.md` as required for Riverside.

---

## How to classify a new vendor

Three questions, in order:

1. **Does the vendor have an OAuth app open to ISVs (no sales contact required)?**
   - Yes → **Pattern A**. Done.
2. **No OAuth, but they have webhooks + a personal API key tier?**
   - Yes → **Pattern B**. (Fireflies-style.)
3. **Neither?**
   - If they emit artifacts via email/file → **Pattern E**.
   - If they have a REST API and a static token → **Pattern C** (last resort).
   - If it's a public link → **Pattern D** (one-shot, not a real connector).

---

## Wishlist vendors — provisional classification

From `docs/vendor-matrix.md` and `docs/source-connector-gap-analysis.md`. **Not verified** — auth surface needs research before scoping.

| Vendor | Likely pattern | Notes |
|---|---|---|
| **tl;dv** | A | Has OAuth |
| **Otter.ai** | B or C | Enterprise-gated API; public self-serve docs unclear |
| **Riverside** | E | File-based transcripts, no JSON turns — needs transcript normalization layer |
| **Gong** | A (enterprise) | Sales contact required for OAuth app |
| **Chorus** | A (enterprise) | Same as Gong |
| **Avoma** | A or B | Tier-dependent |
| **Fellow** | A or B | Tier-dependent |
| **Krisp** | A or B | Tier-dependent |

---

## Shared pipeline — the part you don't have to rebuild

Regardless of pattern, every connector lands payloads in the same canonical shape via:

- `supabase/functions/_shared/connector-pipeline.ts` — pipeline orchestration
- `supabase/functions/_shared/canonical-recording.ts` — normalized recording schema
- `supabase/functions/_shared/webhook-signing.ts` — reusable HMAC primitives
- `src/config/source-registry.ts` — UI-side connector registry
- `src/components/connectors/registry/adapters/` — per-vendor UI adapters

**Implication:** once you classify the vendor into A/B/C/D/E and write the vendor-specific auth + payload-parse code, the downstream work (storage, indexing, UI surfacing) is free.

---

## Related docs

- [01 — Connector Pipeline Vet](./01-connector-pipeline-vet.md)
- [02 — Platform Specs](./02-platform-specs.md)
- [03 — Connector SOP](./03-connector-sop.md)
- [05 — Rollout Plan](./05-rollout-plan.md)
- [06 — Live Connector Verification](./06-live-connector-verification.md)
- [Vendor Matrix](../vendor-matrix.md)
- [Source Connector Gap Analysis](../source-connector-gap-analysis.md)
- [Source Connector Spec](../source-connector-spec.md)
