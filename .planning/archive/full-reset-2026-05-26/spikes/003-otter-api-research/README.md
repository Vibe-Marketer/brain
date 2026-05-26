---
spike: 003
name: otter-api-research
type: standard
validates: "Given Otter.ai's developer surface, when its API capabilities are documented end-to-end, then we have a GO/NO-GO/CONDITIONAL verdict for building a Fathom-equivalent integration."
verdict: CONDITIONAL
related: [001]
tags: [provider, otter, p0]
---

# Spike 003: Otter API Research

## What This Validates

**Given** Otter.ai's developer surface (in beta, Enterprise-tier),
**when** its REST API, OAuth/Bearer auth, webhooks, rate limits, and TOS clauses are documented end-to-end against the Fathom reference template,
**then** we have a GO/NO-GO/CONDITIONAL verdict on building a Fathom-equivalent Otter integration in CallVault.

**Mode:** Research-only. No code, no OAuth attempts, no signups. All findings sourced from Otter.ai public docs, help center, blog posts, third-party integration write-ups, and TOS.

## Research

### 1. API Existence & Documentation

- **Public developer portal URL:** None publicly indexed. Access is gated behind an Enterprise plan and an account-manager intro. The closest public surface is the help-center article ["Does Otter offer an open API?"](https://help.otter.ai/hc/en-us/articles/4412365535895) which states the API exists but routes you to Otter sales.
- **Documentation URL(s):** All under `help.otter.ai` (Zendesk-hosted, blocked from anonymous WebFetch but indexed in search):
  - [Workspace Webhooks](https://help.otter.ai/hc/en-us/articles/35634832371735-Workspace-Webhooks) — event types, HMAC verification, payload schema
  - [Super Admin specific APIs](https://help.otter.ai/hc/en-us/articles/39661865499799-Super-Admin-specific-APIs) — `GET /workspace`, `GET /workspace/{id}/conversations`
  - [Otter MCP Server](https://help.otter.ai/hc/en-us/articles/35287607569687-Otter-MCP-Server) — OAuth-authenticated MCP at `https://mcp.otter.ai/mcp`
  - [Enterprise Onboarding Guide](https://help.otter.ai/hc/en-us/articles/37155387250583)
- **Last-updated date of docs:** Not visible without account access. The MCP/Public-API enterprise launch was [announced October 2025 on Otter's blog](https://otter.ai/blog/otter-for-enterprise-connect-ai-to-ai-with-otters-mcp); No Jitter coverage frames the public API as ["available for enterprises in the coming weeks"](https://www.nojitter.com/digital-workplace/otter-ai-debuts-centralized-hub-for-meeting-insights) — implying the API is brand-new, less than 6 months old as of this spike (May 2026).
- **API stability tier:** **Beta.** Multiple sources confirm "the Otter.ai public API is currently in beta and requires an Enterprise plan."
- **Base URL (high-confidence):** `https://api.otter.ai/v1` — surfaced repeatedly in indexed help-center search snippets (e.g., `https://api.otter.ai/v1/workspace`).
  - Note: A community CLI ([bcharleson/otter-cli](https://github.com/bcharleson/otter-cli)) hard-codes `https://api.tryotter.com/v1` as its base URL. **`tryotter.com` is the unrelated restaurant POS company "Otter," NOT Otter.ai.** That CLI's domain appears to be a copy-paste/AI-generation error and should not be trusted as evidence of the real base URL. The `api.otter.ai/v1` URL has multiple independent confirmations from Otter.ai's own help center.

### 2. Authentication Model

Two distinct auth surfaces — they're easy to confuse:

**A. Public API (Enterprise, beta)**
- **Bearer token only.** Format: `Authorization: Bearer YOUR_API_KEY`.
- Token generation: per the otter-cli README, "Enterprise Settings → API → Generate Token." Visible only to workspace admins/super admins on Enterprise plans where Otter has manually enabled the API.
- **No OAuth 2.0 authorize/token flow documented.** No mention of `/oauth/authorize`, `/oauth/token`, scopes, or refresh tokens for the public API itself. This is a static API key, not a delegated-OAuth flow.
- Multi-account support from CallVault's perspective: each end user must paste their own admin-generated API key. Per-account dedup possible via the `GET /workspace` response (which returns workspace ID + handle).

**B. MCP Server (Enterprise)**
- **OAuth-authenticated** with "granular permissions" (per Otter's blog and MCP help article). Used by Claude.ai, ChatGPT, Cursor — not by general developer apps.
- Endpoint: `https://mcp.otter.ai/mcp`.
- This is the *consumer-of-API* path, not a build-your-own-integration path. Using MCP from CallVault would mean acting as an MCP client against Otter — possible but architecturally weird for a webhook-driven sync integration.

**C. Zapier API key (Pro/Business/Enterprise)**
- A separate, narrower API key generated at `Apps > Zapier > API Key`, available on **Pro, Business, and Enterprise** plans (not Free).
- This key is purpose-built for Zapier and the documented endpoints/scopes are not the same as the Enterprise Public API. Zapier's Otter integration uses it to poll for new conversations and trigger workflows, but it does NOT expose the full conversation/transcript/webhooks surface the Enterprise Public API does.
- **Caveat:** This could be a workaround for non-Enterprise users. We'd be reverse-engineering Zapier's auth to use a key against an undocumented API surface — a permanent "uses-private-API" risk plus a likely TOS violation (Section 11(c), see TOS section below).

**Verdict on auth:** No proper OAuth 2.0 flow. End users must manually generate and paste an API key inside CallVault — same friction model as the existing share-link paste flow. No CSRF state, no refresh tokens, no per-scope authorization UI.

### 3. Plan Tier Required

**This is the load-bearing finding.**

| Plan      | Price (annual)         | Otter API + Webhooks       | Zapier API key  |
|-----------|------------------------|----------------------------|-----------------|
| Basic     | Free                   | ✗                          | ✗               |
| Pro       | $8.33/user/mo          | ✗                          | ✓ (Zapier only) |
| Business  | $19.99/user/mo         | ✗                          | ✓ (Zapier only) |
| Enterprise| Custom (~$15k–$35k/yr) | ✓ **(in beta, sales-only)** | ✓               |

- **Self-serve developer console:** **None.** [Otter's pricing page](https://otter.ai/pricing) lists "Otter API & Webhooks" exclusively under Enterprise. The only path to enable the API is to contact your account manager — confirmed in [Otter's "Does Otter offer an open API?" help article](https://help.otter.ai/hc/en-us/articles/4412365535895) and the [Recall.ai integration write-up](https://www.recall.ai/blog/how-to-integrate-with-otter-ai).
- **Has Otter opened API access in 2025/2026?** No. The October 2025 Public API announcement explicitly framed the API as Enterprise-only with sales gating. As of May 2026, this remains the case across every source I read.
- **Beta status:** The API is still labeled beta. Schema/endpoint changes without notice are likely.
- **Implication for CallVault end users:** Every CallVault user who wants the full-API integration must be on Otter Enterprise (typically 5+ seats, ~$15k+/year minimum per Vendr data) AND must have asked their account manager to enable the public API for their workspace. **This is R-04 territory in the spike MANIFEST.**
- **Quota tiers:** Documented Enterprise rate limit is 500 req/min. No documented tier below Enterprise.

### 4. Transcript / Recording Endpoints

Confirmed endpoints (from the indexed help-center "Super Admin specific APIs" article):

| Endpoint                                  | Purpose                                                                                  |
|-------------------------------------------|------------------------------------------------------------------------------------------|
| `GET /workspace`                          | Workspace details for the authenticated key — id, name, owner, member count, handle, type |
| `GET /workspace/{id}/conversations`       | List conversations in a workspace, reverse-chronological, cursor-based pagination          |

Per Otter's own description, "Otter APIs provide programmatic access to retrieve channels, **conversations, transcripts, audio, action items, insights, outlines**, and workspace details" — so single-conversation fetch and transcript fetch endpoints exist but their exact paths are not in any indexed snippet. The community otter-cli's command groups (which mirror, but do not authoritatively prove, the API surface) also reference: `conversations get/create/update/delete/transcript/utterances/share`, `speakers list/get/create/update`, `folders list/get/create/update/delete`, `groups list/get/members`, `webhooks list/get/create/update/delete`.

**Webhook payload (from the Workspace Webhooks help article snippets):**
- Top-level shape: `{ meta: {...}, data: {...} }`
- `meta` includes: `name`, `source_type`, `event`, `destination_url`, `created_by`, `source`
- `data` includes: `id`, `title`, `url`, `owner`, `created_at`, `process_status`, `calendar_guests`, `conf_join_url`, plus optional include-flags for `abstract_summary`, `action_items`, `insights`, `outline`, `transcript`

**Transcript format:** Speaker-attributed utterances are exposed (`utterances` referenced in otter-cli; `transcript` referenced in webhook payload). AI-generated content (abstract summary, action items, insights, outline) is included as opt-in webhook fields.

**Date-range filtering & pagination:** Cursor-based pagination on `GET /workspace/{id}/conversations` is confirmed; explicit since/until filtering is not documented in indexed snippets.

### 5. Webhooks

Confirmed via the [Workspace Webhooks help article](https://help.otter.ai/hc/en-us/articles/35634832371735-Workspace-Webhooks):

- **Subscription:** Workspace Admins (Enterprise) configure webhooks via the Developer Portal UI. Programmatic management likely available via `/webhooks` endpoints (otter-cli mirrors `GET/POST/PATCH/DELETE /webhooks`), but that's secondary evidence.
- **Event types (confirmed, two only):**
  - `conversation.completed` — a new conversation has finished processing
  - `conversation.shared` — an existing conversation has been shared to the source
  - **otter-cli uses `Conversation.processed` / `Conversation.shared` (capitalized).** Treat exact casing as unverified until a real Enterprise account confirms.
- **Payload includes (configurable per webhook):** `abstract_summary`, `action_items`, `insights`, `outline`, `transcript`, `calendar_guests`, `conf_join_url`. These are opt-in include-flags — analogous to Fathom's `include_transcript` / `include_summary` / `include_action_items`.
- **Signature verification:** HMAC SHA-256 in the `x-hmac-sha256` header. Secret is generated and revealed once in the Otter Developer Portal. Otter "strongly suggests" HMAC SHA-256; legacy SHA-1 (`Authorization: MAC {HASH}`) is also supported for backward compat.
- **Delivery guarantees:** Not explicitly documented. Standard practice (and what we'd assume) is at-least-once delivery → CallVault MUST keep the existing `processed_webhooks` idempotency table.
- **Authentication-type options:** Beyond HMAC, Otter's webhook config supports Basic Auth and Bearer Token as the egress auth header. We'd use HMAC.

**Match with Fathom pattern:** Effectively yes. The webhook subscription has the same general shape (target_url + events + secret), HMAC verification works the same way, and the include-flags map cleanly onto Fathom's `include_transcript/include_summary/include_action_items`.

### 6. Rate Limits

- **Documented limit:** 500 requests/minute on Enterprise (sourced from third-party Otter pricing/feature guides; cited as the "2026 Enterprise rate limit"). No documented limit for non-Enterprise tiers because non-Enterprise tiers have no public API access.
- **Burst behavior:** Not documented.
- **429 response shape:** Not documented. Otter-cli implements exponential backoff with 3 retries and 500ms initial delay against generic `RateLimitError` — i.e., the community CLI guesses, doesn't have a documented spec.

**Match with Fathom:** Fathom's documented rate limit is 60/min/key; CallVault's `_shared/fathom-client.ts` runs at 55/min with sliding-window jitter. Otter's 500/min is ~8× more permissive — very comfortable for sync-meetings + webhook-driven flows.

### 7. TOS Clauses

Sourced from [Otter.ai Terms of Service](https://otter.ai/terms-of-service) and the cross-referenced privacy policy.

| Clause                                  | Finding                                                                                                                                                                                                                                                                                                  |
|-----------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Storage of meeting data by third parties | **Permitted.** Section 8.1: "Otter.ai may provide tools through the Service that enable you to export information, including User Content, to third party services." Third-party services are not under Otter's control. **No explicit retention cap on third-party storage.**                              |
| User-content rights                      | Section 9.4: User grants other users a non-exclusive license to access/use/modify/distribute their User Content. Sufficient for CallVault to ingest a user's own transcripts.                                                                                                                              |
| **"Competing service" clause — RISK**    | **Section 11(c) prohibits use** "in connection with any direct or indirect commercial purposes, including in connection with any **paid transcription workflow** or **as a value-added component of a commercial product or service**." *CallVault is a paid product whose value depends on transcripts.* |
| Resale of API access                     | Section 11(i) prohibits selling or transferring "access granted under these Terms or any Materials." We're not reselling — end users bring their own keys — but worth noting.                                                                                                                              |
| Required attribution                     | None.                                                                                                                                                                                                                                                                                                    |
| Data retention by Otter                  | Custom Data Retention policy available (Enterprise feature). AWS S3 + AES-256 + daily backups. No customer data used to train Otter's third-party AI providers.                                                                                                                                          |

**TOS bottom line:** Section 11(c) is the single biggest legal risk. Read literally, it could be argued that CallVault — a paid commercial product where "transcripts" are a core value-prop — is using Otter "in connection with a paid transcription workflow." A conservative reading would require **either:**

1. An Otter partnership/reseller agreement (likely required for any commercial integration anyway, given Section 11(i)), OR
2. Legal review confirming that "the user pasted their own API key" + "CallVault never resells the transcript stream" doesn't trip 11(c).

Recommend Andrew get this in front of an attorney before shipping. A 1-line answer from Otter's legal team during the partnership conversation would also resolve it.

### 8. Comparison vs Fathom Template

Per spike 001's 7-function stack and 5 conventions:

**Edge Function Stack (7 functions):**

| Fathom function            | Otter equivalent feasible?                                                                                                                                                          |
|----------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `fathom-oauth-url`         | ✗ — No OAuth flow. Replaced by a paste-an-API-key UI step.                                                                                                                          |
| `fathom-oauth-callback`    | ✗ — No callback. Replaced by a `verify-otter-key` edge function that calls `GET /workspace` to validate the key + capture `account_email`/workspace ID for dedup.                        |
| `fathom-oauth-refresh`     | ✗ — No refresh tokens. Static API key. Long-lived until rotated by user.                                                                                                            |
| `create-fathom-webhook`    | ⚠ — Likely feasible if `POST /webhooks` exists (otter-cli implies it does). If not, end-user manually creates webhook in Otter Developer Portal, pastes secret into CallVault setup. |
| `webhook` (receiver)       | ✓ — Direct port. Different signature header (`x-hmac-sha256`) and different idempotency-key field, but the contract is identical.                                                    |
| `fetch-meetings`           | ✓ — `GET /workspace/{id}/conversations` with cursor pagination. Need to confirm a "fetch single conversation transcript" endpoint exists (high confidence yes; not confirmed exact path). |
| `sync-meetings`            | ✓ — Same shape: list → loop → fetch transcript → upsert.                                                                                                                            |

**Net:** Reduces from 7 functions to ~4 (`verify-otter-key`, `webhook` receiver, `fetch-meetings`, `sync-meetings`). Drops the entire OAuth subsystem (3 functions). `create-otter-webhook` is feasible but optional — could go either way depending on whether programmatic webhook subscription works on the beta API.

**5 Critical Conventions:**

| Convention                                              | Otter compliance                                                                                                                                                       |
|---------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1. Per-account tokens on `import_sources`               | ✓ — Store the static Bearer key on `import_sources.oauth_access_token`. `oauth_refresh_token` and `oauth_token_expires` stay NULL. No code changes needed.            |
| 2. Account-email dedup on `(user_id, source_app, account_email)` | ✓ — Pull `account_email` (or workspace handle) from `GET /workspace`. Same dedup pattern.                                                                              |
| 3. CSRF protection via `oauth_state` round-trip          | ✗ — No OAuth round-trip. Not applicable. Paste-key flow is single-step.                                                                                                |
| 4. Idempotency key on every webhook delivery            | ✓ — Required. Otter doesn't document delivery guarantees, so assume at-least-once. Reuse the `processed_webhooks` table.                                              |
| 5. In-edge-function rate limiter                        | ✓ — Trivial. Documented 500/min cap; we run at 450/min with sliding-window jitter, exponential backoff on 429.                                                         |

**Per-provider DB additions:** Same as Fathom — 2 raw tables `otter_calls` + `otter_transcripts` mirroring `fathom_calls`/`fathom_transcripts`. Keyed by Otter's conversation ID (string per webhook payload). Field map: conversation `id` → PK, `title`, `created_at`, `url`, `owner`, `calendar_guests` (JSONB), opt-in `transcript`/`abstract_summary`/`action_items`/`insights`/`outline` columns.

## Investigation Trail

**Search queries that produced findings:**
- `Otter.ai developer API documentation 2025 2026 public API` — surfaced help.otter.ai canonical articles
- `Otter.ai API access enterprise business tier self-serve developer` — confirmed Enterprise-only gating
- `Otter.ai webhooks integration OAuth 2026` — surfaced Workspace Webhooks article
- `"Super Admin specific APIs" Otter.ai endpoints conversations workspace` — surfaced base URL `https://api.otter.ai/v1/workspace`
- `Otter.ai workspace webhooks event types "conversation.created" payload conversation.completed` — confirmed event names + payload shape
- `Otter.ai webhook secret signature verification HMAC payload schema` — confirmed `x-hmac-sha256` header + HMAC SHA-256
- `"Otter.ai" terms of service API data redistribution storage transcripts` — surfaced TOS sections 8.1, 9.4, 11(c), 11(i)
- `Otter.ai API rate limit requests per minute 2025` — found 500/min Enterprise limit

**URLs fetched directly (passed):**
- https://otter.ai/pricing — confirmed "Otter API & Webhooks" Enterprise-only
- https://otter.ai/terms-of-service — TOS sections cited above
- https://otter.ai/integrations — 40+ integrations, no public developer program mentioned
- https://otter.ai/blog/otter-for-enterprise-connect-ai-to-ai-with-otters-mcp — Oct 10 2025 launch date for MCP
- https://www.recall.ai/blog/how-to-integrate-with-otter-ai — Recall.ai's pitch ("Otter has no public API, use us instead") which is now slightly out-of-date but still useful for contrast
- https://apitracker.io/a/otter-ai — registry stub, no useful detail
- https://www.nojitter.com/digital-workplace/otter-ai-debuts-centralized-hub-for-meeting-insights — coverage of the Public API + MCP launch
- https://github.com/bcharleson/otter-cli — community CLI with **suspect base URL `api.tryotter.com/v1`**; webhook event names + endpoint paths likely correct, base URL likely wrong

**URLs blocked (403 from WebFetch — Zendesk anti-bot):**
- https://help.otter.ai/hc/en-us/articles/4412365535895-Does-Otter-offer-an-open-API
- https://help.otter.ai/hc/en-us/articles/35634832371735-Workspace-Webhooks
- https://help.otter.ai/hc/en-us/articles/35287607569687-Otter-MCP-Server
- https://help.otter.ai/hc/en-us/articles/39661865499799-Super-Admin-specific-APIs
- All of `help.otter.ai/hc/en-us/categories/13352361136535-Otter-Enterprise`

These are accessible to humans in a browser but blocked from anonymous WebFetch. **Indexed search snippets** (Google + Bing via WebSearch) gave us the key facts without the original page bodies. The follow-up OAuth-proof spike should have a human or authenticated browser session pull the full text of these four articles.

**Key findings & surprises:**

1. **Two API surfaces, easy to confuse.** The Enterprise Public API (Bearer + REST) and the Otter MCP Server (OAuth + MCP protocol) are different surfaces. Building a Fathom-equivalent integration uses the REST API; the MCP is a separate offering for AI assistants like Claude/ChatGPT.
2. **No OAuth 2.0 flow on the Public API.** This is a significant departure from Fathom. We collapse the OAuth trio (`*-oauth-url/callback/refresh`) into a single paste-API-key UX.
3. **Restaurant-POS namespace collision.** "Otter" the restaurant POS owns `tryotter.com` and ships its own Bearer-token API with HMAC webhooks at `api.tryotter.com/v1`. Search results, the otter-cli community project, and even Otter.ai's own privacy/security copy occasionally cross-reference. **Future spike work and any code must verify the actual base URL against an authenticated Otter.ai account before shipping.**
4. **Beta + Enterprise-only is a hard gate.** Otter has been criticized historically for not having any API at all (Recall.ai's blog post is from before the Oct 2025 launch). The new Public API is the resolution to that criticism, but it requires Enterprise. As of May 2026, this is unchanged — no self-serve developer console exists.
5. **TOS section 11(c) is a real risk.** Worth a 30-minute lawyer call before any commercial ship.

## Results

**Verdict: CONDITIONAL.** A Fathom-equivalent Otter integration is technically buildable today and the API surface (workspace + conversations + webhooks + HMAC signing) maps cleanly onto our existing pattern. We can compress 7 edge functions to ~4 because there's no OAuth dance — just a paste-API-key flow.

**The conditions are entirely commercial, not technical:**

1. **End users must be on Otter Enterprise** (~$15k+/year, sales-only, custom contract). This collapses the addressable user pool dramatically vs Fathom (which has a self-serve developer tier on lower plans).
2. **Each user must request API enablement** from their Otter account manager — a manual gate Otter chooses to keep, not a self-serve toggle.
3. **TOS section 11(c)** prohibits use "in connection with any paid transcription workflow or as a value-added component of a commercial product or service." Needs legal review or written carve-out from Otter.
4. **API is in beta.** Schema changes likely. Don't ship a marketing launch around Otter integration depth.

**Per spike MANIFEST R-04, this is exactly the CONDITIONAL profile: "buildable, but only if Andrew is willing to require that plan tier from end users."**

**Follow-up spike recommendation (if Andrew greenlights):**

- **Spike 003-followup: `otter-oauth-proof`** — *prerequisite: an Otter Enterprise trial account with API access enabled.*
  - **Scope (in priority order):**
    1. Confirm `https://api.otter.ai/v1` is the production base URL (not `api.tryotter.com/v1`) by hitting `GET /workspace` with a real Bearer token.
    2. Pull the actual list of conversations/transcripts/webhooks endpoints + exact path naming (otter-cli's mirror is unverified).
    3. Confirm webhook event-name casing (`Conversation.processed` vs `conversation.completed`).
    4. Subscribe a webhook end-to-end to a public ngrok URL, verify HMAC SHA-256 against the Developer Portal secret.
    5. Pull a single transcript with utterances, confirm field shape matches what we'd map to `otter_transcripts`.
    6. Get a written answer (in writing) from Otter's account team / legal on TOS section 11(c) for this use case.

**Alternative paths (if NO-GO):**

- **Paste-only integration (Phase 24-equivalent for Otter).** Otter does support manual export of `.txt` transcripts and `.mp3` audio. CallVault's existing `save-pasted-transcript` flow could accept Otter-formatted exports. Not sync-on-new-meeting but works for any Otter user (Free + Pro + Business + Enterprise) with no API gating, no TOS issue, no commercial gate.
- **Zapier bridge.** Pro/Business/Enterprise users can wire Otter → Zapier → CallVault webhook. We'd publish a Zapier integration on our side; Otter's existing Zapier integration handles their side. Slower, less rich data, but expands the addressable user pool to Pro+. *Note: this would be a separate spike to scope.*
- **MCP-as-client.** Use Otter's OAuth MCP server as a CallVault-side data source (CallVault becomes an MCP client). Lighter-weight integration but doesn't fit the webhook-driven sync model and still requires Enterprise on Otter's side.

**Recommendation for spike 006 (synthesis):** Otter is the highest-friction P0 provider — strong API once you're inside, very narrow user pool. Should be ranked below Read.ai and Fireflies in build order if those have lower-friction tiers, and above only if Andrew's target customer base skews enterprise.
