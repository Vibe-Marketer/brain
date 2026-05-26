---
spike: 005
name: tldv-api-research
type: standard
validates: "Given tl;dv's developer surface, when its API capabilities are documented end-to-end, then we have a GO/NO-GO/CONDITIONAL verdict for building a Fathom-equivalent integration."
verdict: CONDITIONAL
related: [001]
tags: [provider, tldv, p1]
---

# Spike 005: tl;dv API Research

## What This Validates

**Given** tl;dv (https://tldv.io) is one of four candidate providers Andrew named for CallVault's multi-source meeting-import pipeline,
**when** its public developer surface is documented (auth, endpoints, webhooks, rate limits, plan tier, TOS),
**then** we render a GO / CONDITIONAL / NO-GO verdict on building a Fathom-template-equivalent integration (Spike 001).

This is a **research-only** spike: no code, no OAuth attempts, no signup. Output is a paper-feasibility doc.

## Research

### 1. API Existence & Documentation

- **Public developer portal:** YES — https://doc.tldv.io/index.html (single-page Redoc/OpenAPI-style reference).
- **Help-center docs:** https://intercom.help/tldv/en/articles/11583137-api-and-webhooks (plain-English overview of API + webhooks).
- **Official MCP server (open-source):** https://github.com/tldv-public/tldv-mcp-server — TypeScript reference client. Created 2025-04-15, last pushed 2025-12-12. 12 stars. This is the most authoritative source for API behavior in code.
- **API stability tier:** **`v1alpha1`** — explicitly alpha. Per docs: "Alpha phase with expected changes." Treat as a moving target.
- **Last-updated:** the doc page itself does not advertise a date, but the MCP repo last-pushed 2025-12-12 implies the API was active and changing through late 2025. Confirmed live as of this research (May 2026).

### 2. Authentication Model

- **Auth type: API key only.** No OAuth.
- **Header:** `x-api-key: <YOUR_API_KEY>`
- **Where generated:** https://tldv.io/app/settings/personal-settings/api-keys (user must be logged in on a Business+ plan).
- **HTTPS-only:** plain HTTP requests are rejected.
- **Lifetime:** not documented; likely indefinite until revoked in UI (typical API-key pattern).
- **Multi-account support:** YES at the org level — webhooks can be scoped to user / team / organization, and a Business+ admin can fetch org-wide data with one key. But each *user account* has its own key; CallVault would store one `import_sources` row per connected tl;dv user/key.
- **Critical consequence vs Fathom:** No OAuth means **no `*-oauth-url` / `*-oauth-callback` / `*-oauth-refresh` edge functions**. Setup is a paste-the-key flow, not a redirect dance. That's actually simpler than Fathom — but it also means we cannot use OAuth scope minimization or rely on the user clicking "approve" in tl;dv's UI for trust signals.

### 3. Plan Tier Required

- **API + webhooks: Business plan or higher.** Confirmed across three independent sources:
  - tl;dv help-center article: "Access to API and webhooks is only available on the Business Plan."
  - Official MCP repo README: "A Business or Enterprise tl;dv account is required."
  - Doc-portal landing page: API access depends on the meeting organizer's plan (not the share-link recipient's plan).
- **Pricing (per-seat, billed annually, as of late-2025 sources):**
  - Free: $0 — no API.
  - Pro: ~$18/mo — no API per the help-center article.
  - **Business: ~$59/mo annual / ~$98/mo monthly — API + webhooks unlocked here.**
  - Enterprise: custom — adds org-wide automation + advanced webhooks.
- **Self-serve:** YES. Business plan is self-serve via tldv.io/app/pricing (no sales call required to get an API key). Enterprise is sales-gated.
- **Quota tier:** plan tier gates *access*, not request volume — no published per-tier rate-limit ladder.
- **Practical impact:** any CallVault user wanting to connect tl;dv must be on Business+ ($59/seat/mo). This is the same gate as Otter's Business tier and Fireflies' Business tier — but **stricter than Fathom**, which gates the API at the Team plan ($24/seat/mo) and offers free API trials.

### 4. Transcript / Recording Endpoints

**Base URL:** `https://pasta.tldv.io/v1alpha1` (confirmed in `src/api/tldv-api.ts` line 17 of the official MCP repo).

| Endpoint | Method | Purpose |
|---|---|---|
| `/meetings` | GET | List meetings, paginated, with filters |
| `/meetings/{meetingId}` | GET | Single meeting metadata |
| `/meetings/{meetingId}/transcript` | GET | Structured transcript |
| `/meetings/{meetingId}/notes` | GET | Notes + markdown + topic summaries |
| `/meetings/{meetingId}/highlights` | GET | AI highlights (deprecated; use /notes) |
| `/meetings/{meetingId}/download` | GET | Signed video download URL (302, 6h expiry) |
| `/meetings/import` | POST | Import a meeting from a public URL |
| `/health` | GET | Liveness check |

**List-meetings query params** (confirmed in MCP source code, `tldv-api.ts:172-185`):
- `query` — string search
- `page`, `limit` — pagination
- **`from`, `to` — ISO-8601 date range filtering ✓** (the doc portal does NOT list these but the MCP code passes them through; assume supported)
- `onlyParticipated` — boolean, only meetings the API-key owner attended
- `meetingType` — `internal` / external etc.

**Pagination response shape:** `{ page, pages, total, pageSize, results[] }`.

**Transcript shape:**
```json
{
  "id": "string",
  "meetingId": "string",
  "data": [
    { "speaker": "string", "text": "string", "startTime": 0, "endTime": 0 }
  ]
}
```
This maps cleanly to Fathom's `fathom_transcripts` row shape (`speaker_name`, `text`, `timestamp`).

**Notes / AI summaries shape:** `structuredNotes[]` + `markdownContent` + `topics[]` (each topic has title + summary). This covers the equivalent of Fathom's `summary` and action-items fields.

**Action items / highlights:** `/highlights` exists but is deprecated; the `/notes` endpoint's `topics[]` and `structuredNotes[]` carry the AI-generated summary content.

**Recording video URL:** YES, via `/meetings/{id}/download` — returns a 302 to a signed S3-style URL valid for 6 hours. Equivalent to Fathom's `share_url` but ephemeral; CallVault would need to either re-fetch on demand or download/store within the 6h window.

### 5. Webhooks

**Configuration is UI-only (not API-managed).** Per the doc and help-center: webhooks are created via Settings → Webhooks in the tl;dv web app. **There is no documented `POST /webhooks` endpoint to programmatically subscribe.** This is a meaningful gap vs Fathom's `create-fathom-webhook` edge function.

**Event types (only two):**
- `MeetingReady` — fires when a meeting finishes processing. Payload includes meeting metadata, organizer, invitees, tl;dv URL.
- `TranscriptReady` — fires when transcript is generated. **Known limitation: TranscriptReady payloads do NOT include calendar metadata (organizer + invitees missing).** You'd need `MeetingReady` + a follow-up GET, or both events keyed by meeting ID.

**Sample MeetingReady payload:**
```json
{
  "id": "webhook-job-id",
  "event": "MeetingReady",
  "executedAt": "2025-06-16T09:23:00Z",
  "data": {
    "id": "meeting-id",
    "happenedAt": "2025-06-15T14:00:00Z",
    "name": "Team Sync",
    "organizer": { "email": "...", "name": "..." },
    "invitees": [ { "email": "...", "name": "..." } ],
    "url": "https://app.tldv.io/meetings/meeting-id"
  }
}
```

**Configuration scope:** user / team / organization (org-wide is Enterprise-only).

**Signature verification: NOT DOCUMENTED.** No `X-Tldv-Signature` header, no HMAC scheme, no webhook-secret published. The help-center notes only that you can optionally include "extra headers" in outbound requests (e.g., a static auth token you set when creating the webhook). **This is a security gap relative to Fathom's per-webhook secret.** Mitigation: have CallVault generate a random shared-secret at setup time, ask the user to paste it into the tl;dv webhook UI as a custom header, then verify on inbound. Workable but more friction than HMAC.

**Delivery guarantees:** undocumented. No published retry policy, no expected response code, no timeout spec.

**Critical consequence:** webhook subscription is a **manual UI step the CallVault user must perform**, not something CallVault edge-functions can do for them. The setup wizard has to walk the user through tl;dv's webhook config UI.

### 6. Rate Limits

- **No published rate limits** in the doc portal, help-center, or MCP repo README.
- **Indirect evidence:** the official MCP client's `tldv-api.ts:103-125` retries on HTTP 429 with exponential backoff (1s → 2s, max 3 retries) — so 429s exist and are expected, but the actual req/min ceiling is not documented.
- **Implication for the Fathom-template's in-edge-function rate limiter:** we'd have to start with a defensive default (e.g., 30 req/min) and tune via observation, OR contact tl;dv support to ask. Fathom publishes 60 req/min; tl;dv leaves it as a black box.

### 7. TOS Clauses

Reviewed https://tldv.io/terms/. Key clauses for a third-party integration:

- **Competing-services restriction (concerning):** Users may not use the service "as a direct competitor of tldx or for the purpose of monitoring the Services' availability, performance, functionality." CallVault is a meeting-transcript app — needs to position as a **destination/aggregator**, not as a tl;dv competitor. Probably fine, but worth a CYA email if the integration goes prod.
- **No scraping / no significant content storage:** "Crawls, scrapes, or spiders... Copies or stores any significant portion of the Content." This is the boilerplate anti-scrape clause. Storing user-authorized API responses for the user's own benefit is generally accepted under industry norms but is **not explicitly carved out** in tl;dv's TOS. Phase-21+ legal review recommended.
- **No reverse engineering** of the service.
- **User data ownership:** "Video recordings and transcripts will not be accessed by tldx, unless upon specific request by the user who created such recordings." Confirms user owns their data — supports the legal basis for syncing it into CallVault.
- **Data retention:** sensitive personal info auto-deleted after 3 months of inactivity; account info kept until deletion.
- **No published DPA / API-specific developer terms** — there's no separate developer-terms page, just the general TOS. We'd be operating under the consumer TOS.
- **No attribution requirement** found.

### 8. Comparison vs Fathom Template

#### Edge-function stack (7 functions in Fathom)

| Fathom function | tl;dv equivalent | Status |
|---|---|---|
| `fathom-oauth-url` | N/A — API-key only | ✗ (not needed) |
| `fathom-oauth-callback` | N/A — paste-key flow | ✗ (not needed) |
| `fathom-oauth-refresh` | N/A — keys don't expire | ✗ (not needed) |
| `create-fathom-webhook` | **Cannot be programmatic** — tl;dv has no webhook-create API endpoint, only UI | ✗ (manual UI step required) |
| `webhook` (receiver) | Can build, but signature verification is shared-secret-via-custom-header, not HMAC | ⚠ |
| `fetch-meetings` | Direct port — `GET /meetings` with `from`/`to`/`page`/`limit` | ✓ |
| `sync-meetings` | Direct port — list + per-meeting fetch + upsert | ✓ |

**Net:** of the 7 Fathom functions, **only 3 (webhook receiver, fetch-meetings, sync-meetings) translate cleanly**. The 3 OAuth functions are replaced by a one-step paste-the-key flow (simpler). The webhook-create function has no API equivalent — the integration's setup wizard must instruct the user to manually configure the webhook in tl;dv's UI.

#### 5 Critical conventions

| Convention | tl;dv compatibility |
|---|---|
| 1. Per-account OAuth tokens on `import_sources` | ✓ (store API key + scope info on `import_sources` instead of OAuth tokens; same pattern, different token type) |
| 2. Account-email dedup on `(user_id, source_app, account_email)` | ⚠ (no automatic email-from-token discovery; would need a `GET /meetings?limit=1` and read `organizer.email`, OR ask the user for their tl;dv email at setup) |
| 3. CSRF protection via `oauth_state` round-trip | ✗ (irrelevant — no OAuth redirect) |
| 4. Idempotency key on every webhook delivery | ✓ (use `webhook.id` from payload as `processed_webhooks.webhook_id`) |
| 5. In-edge-function rate limiter | ⚠ (no published limit; start with 30 req/min defensive default + 429 backoff like the MCP repo does) |
| 6. One raw table per provider (`tldv_calls`, `tldv_transcripts`) | ✓ (clean port — schema fits) |
| 7. `source_app = 'tldv'` on projected `recordings` | ✓ |

## Investigation Trail

**Searches run:**
- `tl;dv API developer documentation 2026`
- `tldv.io API webhooks integration developer`
- `"tl;dv" API rate limit requests per minute`
- `tl;dv pricing Business plan API access 2026 per seat`
- `"tldv" webhook signature verification HMAC secret`
- `"tldv" OAuth multi-account integration enterprise`
- `tldv API "MeetingReady" webhook payload example`
- `tldv.io terms of service customer data retention`
- `"tl;dv" API "x-api-key" reddit github issue`

**URLs fetched / read:**
- https://doc.tldv.io/index.html (official API portal — read 3x for different aspects)
- https://intercom.help/tldv/en/articles/11583137-api-and-webhooks (help-center API doc)
- https://nango.dev/docs/integrations/all/tldv (3rd-party adapter spec — confirmed API-key-only, no pre-built syncs)
- https://www.claap.io/blog/tl-dv-pricing (pricing breakdown, dated 2025-12-30)
- https://comparetiers.com/tools/tldv (cross-check on pricing)
- https://tldv.io/terms/ (TOS — extracted competing-services + scraping clauses)
- https://github.com/tldv-public/tldv-mcp-server (official open-source MCP)
- https://raw.githubusercontent.com/tldv-public/tldv-mcp-server/main/README.MD (full README)
- https://raw.githubusercontent.com/tldv-public/tldv-mcp-server/main/src/api/tldv-api.ts (**ground-truth source code** — endpoint paths, base URL, retry logic, query params)

**Key findings:**
1. **API exists, is public, and is documented** — this is the strongest tl;dv finding. Spike 005 was launched expecting tl;dv to be the most opaque of the four providers; it turned out to have a usable Redoc API portal AND an official open-source MCP server.
2. **Source-code-confirmed endpoints + filters.** The official MCP repo's `tldv-api.ts` is the authoritative spec — it confirms `from`/`to`/`onlyParticipated`/`meetingType` filters that the doc portal omits. This is more reliable than the docs.
3. **API key, not OAuth** — simplifies setup (no callback URLs, no scopes, no token refresh) but breaks symmetry with Fathom's OAuth model. The `import_sources` table can store API keys in the same `oauth_access_token` column or via a new `api_key` column.
4. **Webhook subscription is UI-only** — the single biggest gap vs Fathom. We can't programmatically register a webhook; the setup wizard must walk the user through tl;dv's web app.
5. **No webhook signature** — security gap. Mitigated by having the user paste a CallVault-generated secret as a custom header in tl;dv's webhook UI, then verifying on receipt.
6. **No published rate limit** — must defensive-default and tune.
7. **Business plan ($59/mo) is the floor** — same as Otter/Fireflies, more expensive than Fathom's Team plan.
8. **API is `v1alpha1`** — explicit alpha tier. Schema can change without notice. Build with versioned types and a single API-client module so we can swap when v1 ships.

**Surprises:**
- Expected to find no API at all (Andrew's brief said "rumored to be enterprise-API-only"). Actually finding a self-serve Business-tier API + a polished MCP repo is a meaningful upside.
- The MCP source code documents query params the official Redoc page does not. This is unusual — usually docs lead, code lags. Read the code, not just the docs.

## Results

**Verdict: CONDITIONAL.**

**Verdict reasoning (5 sentences):**
tl;dv has a real, public, documented API that supports list/fetch/transcript/notes endpoints sufficient for a Fathom-template integration; the official open-source MCP server proves the surface is functional and stable enough to build against. Auth simplifies the integration (API key paste vs OAuth dance), and the data shapes map cleanly onto CallVault's `recordings` projection model. The integration is **CONDITIONAL** rather than VALIDATED for three reasons: (1) **webhook subscription is UI-only** — users must manually configure webhooks in tl;dv's settings, which adds friction to the setup wizard but is not a blocker; (2) **no webhook signature scheme** is published, requiring a workaround using a paste-it-yourself custom header secret; (3) **API is `v1alpha1`** with explicit "expect changes" disclaimer, so we should expect breakage and version-isolate the client. Plan-tier gating ($59/mo Business minimum) limits the addressable user base — same gate as Otter and Fireflies — and TOS competing-services clause warrants a 1-line CYA email to tl;dv before going prod, but neither is disqualifying.

**Follow-up spike recommendation (CONDITIONAL → next gate):**

**Spike 007 (proposed): tl;dv OAuth-proof / setup-wizard prototype** — scope:
1. Andrew signs up for a tl;dv Business trial.
2. Generate an API key via UI.
3. Hit `GET /v1alpha1/meetings?limit=5` with the key from a curl/edge-function — confirm the response shape matches MCP code.
4. Create a webhook in the tl;dv UI pointing at a request-bin endpoint, capture a real `MeetingReady` and `TranscriptReady` payload, confirm whether *any* signature/auth header is sent (the docs may be incomplete).
5. Probe rate limit empirically: hit `/health` 100x in a minute, observe when 429s start.
6. **Output:** a 1-page runtime-confirmed addendum to this spike, then green-light a Phase 25+ implementation plan.

**Alternative paths (if the runtime spike fails):**
- If the `v1alpha1` API turns out to be unstable (breaking changes during a 2-week observation), **defer tl;dv to Phase 30+** and ship Fireflies/Otter first.
- If the Business plan price-gate blocks user adoption (CallVault telemetry shows <5% of users on tl;dv Business), pivot to a **paste-meeting-URL** flow using `POST /v1alpha1/meetings/import` (which accepts public meeting URLs) — lower-fidelity but no plan tier required for the *importer*.

**Comparison takeaway:** Of the 4 candidate providers (Read.ai, Otter, Fireflies, tl;dv), tl;dv has the **lowest auth complexity** (paste-key, no OAuth) but the **highest setup-wizard friction** (manual webhook UI step) and the **least mature API surface** (`v1alpha1` + no published rate limits). It's a viable second-or-third-priority integration after Fireflies (which Andrew expects has the best docs) and Otter — not a NO-GO, but not the first one to build.
