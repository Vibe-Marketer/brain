---
spike: 002
name: readai-api-research
type: standard
validates: "Given Read.ai's developer surface, when its API capabilities are documented end-to-end, then we have a GO/NO-GO/CONDITIONAL verdict for building a Fathom-equivalent integration."
verdict: CONDITIONAL
related: [001]
tags: [provider, read-ai, p0]
---

# Spike 002: Read.ai API Research

## What This Validates

**Given** Read.ai is a candidate provider for CallVault's "full integration" tier (matching the Fathom reference template — OAuth + webhooks + sync, all 7 edge functions, both raw tables, full transcript depth),
**when** its public developer surface is documented end-to-end against the Fathom reference architecture (spike 001),
**then** we have a GO/NO-GO/CONDITIONAL verdict for whether a Fathom-equivalent Read.ai integration is buildable today, and what the OAuth-proof follow-up spike must validate before we commit a phase.

## Research

### 1. API Existence & Documentation

- **Public developer portal:** No standalone developer portal. Docs live inside the Read.ai support help center (Zendesk-hosted at `support.read.ai`).
- **Documentation URLs:**
  - API + MCP overview: `https://support.read.ai/hc/en-us/articles/49379985941523-Read-AI-API-and-MCP-Overview`
  - API Reference: `https://support.read.ai/hc/en-us/articles/49381161088659-API-Reference`
  - API Keys & Authentication: `https://support.read.ai/hc/en-us/articles/49380809380371-API-Keys-Authentication`
  - Webhooks: `https://support.read.ai/hc/en-us/articles/16352415827219-Getting-Started-with-Webhooks`
  - Webhook launch announcement: `https://www.read.ai/post/read-integration-webhooks` (May 25, 2023)
  - MCP launch announcement: `https://www.read.ai/post/read-ai-mcp-your-meetings-just-became-your-most-powerful-dev-tool` (Feb 25, 2026)
- **Last-updated date:** Article IDs in the 49000000+ range plus an explicit "March 17, 2026" caveat about signing-key behavior on the webhooks page indicate the developer-API surface is current as of Q1 2026. Webhooks have been GA since 2023; the REST API + MCP server are in **open beta** as of late-Feb 2026.
- **API stability tier:** **OPEN BETA.** The API and MCP server are explicitly labeled "currently available as an open beta release." Webhooks are GA (since 2023). This is a freshness/risk signal — the OAuth contract may evolve before GA.

### 2. Authentication Model

**TWO separate auth surfaces, depending on capability:**

#### Webhooks (GA, simple)
- **No OAuth.** Webhooks are configured per-user inside `app.read.ai/analytics/integrations/webhooks` via the Read.ai web UI.
- Read.ai pushes payloads to a webhook URL the user pastes in. The receiver verifies via an **HMAC SHA-256 signing key** the user copies during setup, sent in the `X-Read-Signature` header.
- Caveat: signing-key support only exists for **webhooks created after March 17, 2026**. Older webhooks have no signature verification.

#### REST API + MCP (open beta)
- **OAuth 2.1 with Dynamic Client Registration (DCR).** Authorization Code flow with PKCE, refresh tokens.
- Token endpoints sit at `https://api.read.ai/`. Example redirect URI Read.ai pre-fills: `https://api.read.ai/oauth/ui` — this is the Read-hosted login UI; CallVault would supply its own redirect URI when registering its OAuth client.
- DCR means CallVault can self-register an OAuth client programmatically (no manual developer-portal listing) — RFC 7591 dynamic client registration.
- **Access token TTL: 10 minutes.** **Refresh tokens are single-use and rotate on each refresh** (with a short grace period to handle in-flight requests).
- **No static API keys / personal access tokens** today. Read.ai explicitly lists "Support for static API keys/personal access tokens" as a planned GA enhancement.
- **No client_credentials grant** today either — only Authorization Code is supported, which means a browser-based user login is required for every Read.ai workspace connection.
- Bearer token auth: `Authorization: Bearer <access_token>` header on every API call.
- **Multi-account support:** Yes — each OAuth flow ties to one Read.ai user/workspace. CallVault would store one set of `access_token + refresh_token` per `import_sources` row, exactly the Fathom pattern.

### 3. Plan Tier Required

**For webhooks (the integration we'd primarily lean on):**
- **Pro plan minimum.** Webhooks are explicitly listed as a "Premium integration" alongside Notion, Salesforce, HubSpot, Jira, Confluence, Zapier — all gated behind Pro+.
- **Cost:** Pro is **$15/month annual** ($19.75 monthly), Enterprise $22.50/$29.75, Enterprise+ $29.75/$39.75 (10-license minimum for Enterprise+).
- Hard cap: **15 webhooks per user.** Email verification required to create a webhook.

**For the REST API + MCP (beta):**
- "Available to all users regardless of plan or workspace" — but workspaces must have **Downloads enabled** in Workspace Settings → Reports & Sharing.
- This is the surprise: API access is NOT plan-gated today, but webhooks ARE. Free-tier users can hit the REST API in beta but cannot register a webhook. **For our use case (push-driven sync to mirror Fathom), the binding constraint is the Pro tier.**

**Self-serve developer console:** No traditional "developer console." OAuth dynamic client registration is self-serve via API; webhook setup is self-serve via web UI. No enterprise sales call required for either.

### 4. Transcript / Recording Endpoints

REST API base: `https://api.read.ai/`
MCP base: `https://api.read.ai/mcp/`
Auth header: `Authorization: Bearer <access_token>`

#### Endpoints (confirmed)

- **`GET /v1/meetings`** — Paginated list of meetings, reverse chronological, returns both active and ended meetings (active meetings have limited expandable-field data). Optional start-time filter.
  - Pagination: **cursor-based.** `cursor=<id-of-last-meeting-in-prior-page>`.
  - Response shape: `{ "object": "list", "url": "/v1/meetings", "has_more": <bool>, "data": [ ... ] }`.
  - Expandable fields via `expand[]=...`: `summary`, `chapter_summaries`, `action_items`, `key_questions`, `topics`, `transcript`, `metrics`, `recording_download`.
  - Example: `GET https://api.read.ai/v1/meetings?expand[]=transcript&expand[]=summary`.
  - Caveat: expanding multiple fields on a list query is documented as slow.
- **`GET /v1/meetings/{id}/live`** — Real-time transcript + chapter summaries for active, live-enabled meetings. Not needed for our sync pattern (post-meeting only) but exists.

#### Transcript format
- Structured. Speaker names + timestamps included (Unix milliseconds, per webhook payload schema, which is presumed identical to API response shape).
- Summaries, chapter summaries, action items, key questions, topics, metrics all available as separate expandable fields — equivalent or richer than Fathom's `summary` + transcript split.
- Recording download URL available via `expand[]=recording_download`.

#### Date-range filtering
- "Optionally filtered by start time" per docs. Confirmed but exact param name not exposed in Zendesk-blocked help-center URLs we couldn't fetch directly.

### 5. Webhooks

**Yes, fully supported and GA since May 25, 2023.**

- **Subscribe:** Manual via web UI at `https://app.read.ai/analytics/integrations/webhooks`. NOT programmatic — there is no "create webhook" REST endpoint exposed today. **This is a meaningful gap vs Fathom**, where `create-fathom-webhook` POSTs to `https://fathom.video/external/v1/webhooks` to register a destination. For Read.ai, the user must manually paste their webhook URL into the Read.ai dashboard during onboarding.
- **Event triggers:** `meeting_end` (fires when meeting report finishes generating), `manual` (user-triggered re-send).
- **Payload shape (top-level fields):** `session_id`, `trigger`, `chapter_summaries`, `transcript` (with speaker names + timestamps in Unix ms), `request_id` (unique per delivery — usable as idempotency key), plus action items, summary, topics, key questions per the Pro-plan triggers list.
- **Signature verification:** HMAC SHA-256 of raw request body using the webhook's signing key, compared against `X-Read-Signature` header. Signing key shown only at webhook creation; user copies and stores it securely.
  - **Caveat:** Signing-key functionality only exists for webhooks created after **March 17, 2026**. Older webhooks have no signature.
- **Delivery guarantees:** Not explicitly documented. The presence of a stable `request_id` per delivery strongly implies at-least-once with retries (matches industry norm). Idempotency is the consumer's responsibility — fits Fathom's `processed_webhooks` pattern exactly.
- **Hard limit:** 15 webhooks per user.

### 6. Rate Limits

- **Not documented.** No explicit requests/min number, no documented 429 response shape, no Retry-After guidance.
- Implication: build defensive client-side rate limiting (5-10 req/sec ceiling) and exponential-backoff-on-429 anyway, mirroring `_shared/fathom-client.ts`. Confirm actual limits during the OAuth-proof spike by hammering `/v1/meetings` and reading response headers.

### 7. TOS Clauses (storage + redistribution)

Reviewed `https://www.read.ai/termsofservice` end-to-end:

- **(1) Competing services:** No clause prohibits building competing services. **Clear.**
- **(2) Third-party storage of meeting data:** Not addressed. The TOS only covers Read.ai's own processing/storage rights ("you agree that we may process, transfer, and store information about you in the United States and other countries"). **No prohibition on the API consumer storing the transcript data they retrieve.** This is the same posture as Fathom.
- **(3) Attribution / branding requirements:** None found. No required "Powered by Read AI" badge or trademark display rule on retrieved data.
- **(4) Redistribution restrictions:** Section 4(b) grants Read AI a broad license over user content but does NOT forbid the user from redistributing their own meeting data. **Clear** — same as Fathom.
- **(5) Data retention obligations:** Not addressed in the public TOS. Enterprise+ tier exposes "Custom data retention policy" as a paid feature, implying retention rules are workspace-side, not API-consumer-side.

**Privacy / governance:** Read.ai does not sell user data and does not allow third-party AI tools to use Google-Workspace-API data for training. This is internal-Read-AI policy and does not constrain our app's use of data the user explicitly authorized us to fetch via OAuth.

**Net read: TOS is permissive enough to ship a full integration.** Same risk class as Fathom. No clauses block third-party storage or redistribution of meeting data the authenticated user owns.

### 8. Comparison vs Fathom Template

Mapped against the 7 edge functions and 5 conventions from spike 001:

| Fathom capability | Read.ai equivalent | Status |
|---|---|---|
| `fathom-oauth-url` (build authorize URL with CSRF state) | OAuth 2.1 authorize URL on `api.read.ai/oauth/...` after dynamic client registration | ✓ Direct equivalent |
| `fathom-oauth-callback` (exchange code, store tokens, dedup account) | Standard OAuth 2.1 code exchange returning `access_token` + `refresh_token` + `id_token` | ✓ Direct equivalent |
| `fathom-oauth-refresh` (rotate access token) | Refresh-token grant, **single-use rotating refresh tokens** with grace window | ⚠ Partial — token TTL is **10 minutes** (vs Fathom's longer-lived tokens). Refresh logic must be more aggressive. Single-use refresh with rotation means the "store new refresh token" step in callback must be atomic to avoid losing the chain. |
| `create-fathom-webhook` (POST to provider's webhook endpoint, store secret) | **No programmatic webhook creation.** User must manually configure the webhook in `app.read.ai`. | ✗ Not supported — only manual UI flow exists |
| `webhook` (receive, verify HMAC, idempotency-key, write to raw tables) | Receive POST, verify HMAC SHA-256 against `X-Read-Signature`, dedupe by `request_id` | ✓ Direct equivalent (post-March-17-2026 webhooks only) |
| `fetch-meetings` (list recent meetings, paginated, rate-limited) | `GET /v1/meetings` with cursor pagination + expand fields | ✓ Direct equivalent (rate limit needs empirical confirmation) |
| `sync-meetings` (bulk historical sync) | Same `GET /v1/meetings` paged backwards via cursor + per-meeting expand for transcript | ✓ Direct equivalent |

| Fathom convention | Read.ai conformance | Status |
|---|---|---|
| Per-account OAuth tokens on `import_sources` (NOT user_settings) | OAuth flow per workspace login → one `import_sources` row per workspace | ✓ Direct equivalent |
| Account-email dedup on `(user_id, source_app, account_email)` | OAuth `id_token` returns user identity → extract email for dedup | ✓ Direct equivalent |
| CSRF protection via `oauth_state` round-trip | Standard OAuth 2.1 `state` param | ✓ Direct equivalent |
| Idempotency key on every webhook delivery | `request_id` field on every payload — purpose-built for this | ✓ Direct equivalent |
| In-edge-function rate limiter matching documented limit | **No documented limit** — must be set conservatively | ? Unknown — empirical confirmation needed |
| One raw table per provider | `readai_calls` + `readai_transcripts` follows the existing pattern | ✓ Direct equivalent |
| `source_app` literal | `'readai'` for API, `'readai-paste'` for Phase 24 paste fallback | ✓ Direct equivalent |

**Summary:** 9 ✓ direct equivalents, 1 ⚠ partial (token TTL/refresh complexity), 1 ✗ blocking gap (no programmatic webhook creation), 1 ? unknown (rate limits).

The single ✗ is the meaningful one. **Read.ai's webhook setup wizard cannot be a one-click OAuth-then-everything-magical flow like Fathom's.** It requires either (a) a multi-step UI walking the user through copy-pasting their webhook URL + signing key into `app.read.ai`, or (b) sync-only mode using the REST API to poll `GET /v1/meetings` on a cron and skip webhooks entirely.

## Investigation Trail

Read-only research session. No OAuth attempts, no account signups, no API calls.

1. **Read spike 001** to internalize the Fathom reference architecture (7 edge functions + 5 conventions).
2. **Web search:** "Read.ai developer API documentation 2026" → confirmed official help-center articles exist at `support.read.ai/hc/en-us/articles/49379985941523-...` (API+MCP Overview) and `49381161088659-...` (API Reference).
3. **WebFetch attempts on `support.read.ai`:** All blocked with HTTP 403. Zendesk help center denies headless fetches. Fell back to Google's indexed copies via WebSearch summaries.
4. **Web search:** `"read.ai" API webhooks developer integration` → recovered webhook setup details, payload shape, `X-Read-Signature` HMAC SHA-256 verification, `request_id` dedupe field, GA-since-May-2023 history.
5. **WebFetch on `read.ai/post/read-integration-webhooks`** (✓ succeeded, not Zendesk-gated) → confirmed Pro/Enterprise plan tier requirement and the 5 data triggers (summary, chapters, topics, action items, key questions).
6. **WebFetch on `read.ai/integrations`** (✓) → confirmed native integrations roster; Zapier present (no n8n/Make as official partners).
7. **Web search:** "api.read.ai REST endpoints authentication bearer token" → recovered OAuth 2.1 + DCR details, 10-minute access-token TTL, single-use rotating refresh tokens, `GET /v1/meetings` and `GET /v1/meetings/{id}/live` endpoint signatures.
8. **Web search:** "read.ai API beta access" → confirmed open-beta status, "available to all users regardless of plan" caveat (with Workspace Downloads gate), no static API keys yet.
9. **Web search:** `"X-Read-Signature" HMAC` → confirmed HMAC SHA-256 of raw body, signing-key-only-for-post-March-17-2026 webhooks.
10. **Web search:** `"api.read.ai" v1/meetings expand transcript` → confirmed full expand-field list (summary, chapter_summaries, action_items, key_questions, topics, transcript, metrics, recording_download), cursor-based pagination shape `{ object, url, has_more, data[] }`.
11. **WebFetch on `read.ai/termsofservice`** (✓) → no clauses against competing services, third-party storage, redistribution, or attribution. Permissive.
12. **WebFetch on `read.ai/plans-pricing`** (✓) → confirmed exact tier pricing: Pro $15/mo (annual), Enterprise $22.50, Enterprise+ $29.75 + 10-license minimum.
13. **WebFetch on `read.ai/post/read-ai-mcp-your-meetings-just-became-your-most-powerful-dev-tool`** (✓) → MCP launched Feb 25, 2026; confirms beta-tier disclaimers and "more data types coming" hedge on the API surface.
14. **Web search:** `"app.read.ai" integrations webhooks setup signing key` → confirmed 15-webhook-per-user cap, email-verification gate, signing-key-post-March-17-2026 caveat.
15. **Web search:** Read.ai rate limits → **no documented limit found.** Recorded as unknown.
16. **Web search:** Read.ai OAuth DCR multi-tenant → confirmed DCR (RFC 7591) is the registration model, suitable for our SaaS use case.

**Surprises / things to flag for OAuth-proof spike:**
- Token TTL of **10 minutes** is unusually short. Every API call from a sync job must check expiry and refresh before each request. Aggressive refresh + retry logic required in `_shared/readai-client.ts`.
- Single-use rotating refresh tokens with a grace window mean we MUST persist the new refresh token immediately on every refresh call. If two parallel sync jobs both refresh the same token, only one gets the new chain — the other is locked out until the user re-OAuths.
- **No documented programmatic webhook subscription endpoint.** The webhook is configured by the user inside Read.ai's web UI. CallVault's setup wizard cannot fully automate Read.ai onboarding the way it does Fathom — at minimum, we'll need a "paste your webhook URL into Read.ai" instructional step.
- **No documented rate limit.** Empirical confirmation is required during the OAuth-proof spike before we ship.

## Results

**Verdict: CONDITIONAL.**

A Fathom-equivalent integration is buildable today, with two specific compromises:

1. **Webhook subscription is user-driven, not programmatic.** The setup wizard becomes a guided multi-step UI ("OAuth → we generate your webhook URL → you paste it into `app.read.ai/analytics/integrations/webhooks` → you copy the signing key back into our wizard") instead of one-click. The webhook RECEIVER side maps cleanly to Fathom's pattern.
2. **OAuth token churn is high.** 10-minute access tokens with single-use rotating refresh tokens demand careful concurrency control in the refresh path (atomic write of new refresh token, mutex around concurrent refreshes per `import_sources` row). This is solvable but adds maybe 50-100 lines of edge-function code vs Fathom's longer-lived tokens.

Plus one true unknown: **rate limits** are not documented, so the production rate-limiter ceiling has to be set empirically.

The TOS is permissive (no anti-competing-service or anti-storage clauses), the API is open-beta but has the endpoints we need, and DCR means we don't have to negotiate a developer-program listing. The Pro plan ($15/mo annual) gates webhooks but is consumer-affordable.

**Verdict reasoning:** All 7 Fathom-equivalent edge functions can be built (1 of them — webhook creation — becomes a UI walkthrough rather than an API call). All 5 critical conventions (per-account tokens, email dedup, CSRF state, idempotency key, raw-table-per-provider) map directly. The two real risks (programmatic webhook gap, token-refresh concurrency) are engineering work, not deal-breakers. The beta status of the API is the dominant residual risk — we ship knowing Read.ai may change the OAuth contract before GA. CONDITIONAL is the honest verdict because of that beta + the unknown rate limit, not because the integration is unsafe to plan.

**Recommended follow-up spike — OAuth-proof:**

- **Name:** `007-readai-oauth-proof` (or rename per workspace convention).
- **Scope:** Andrew personally Pro-tier-upgrades a Read.ai account, runs the dynamic client registration call, completes a real OAuth 2.1 Authorization Code flow against `api.read.ai/oauth/...`, hits `GET /v1/meetings?expand[]=transcript` on a real meeting, pastes a webhook URL into `app.read.ai`, captures one real webhook delivery into a webhook.site or similar, verifies the HMAC SHA-256 signature manually, and pings `/v1/meetings` until 429 to discover the actual rate limit ceiling.
- **Output:** A captured pcap-equivalent (curl transcripts) of every step, plus a confirmed numerical rate limit. Verdict file says "GO" or downgrades to "INVALIDATED" only if Read.ai breaks their stated contract.
- **Effort:** ~2 hours including the Pro-tier upgrade.

**If NO-GO/INVALIDATED — alternative paths (preserved for completeness):**
- N/A — this verdict is CONDITIONAL, not INVALIDATED. Fallback (paste-only via Phase 24's `*-paste` pattern) remains available if the OAuth-proof spike surfaces a blocker, but is not the recommended path.
