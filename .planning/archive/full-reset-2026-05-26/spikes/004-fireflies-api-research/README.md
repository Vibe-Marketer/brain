---
spike: 004
name: fireflies-api-research
type: standard
validates: "Given Fireflies.ai's GraphQL developer API, when its capabilities are documented end-to-end, then we have a GO/NO-GO/CONDITIONAL verdict for building a Fathom-equivalent integration."
verdict: CONDITIONAL
related: [001]
tags: [provider, fireflies, p1]
---

# Spike 004: Fireflies API Research

## What This Validates

**Given** Fireflies.ai exposes a public, documented GraphQL developer API plus a webhooks v2 system,
**when** every surface (auth, transcripts query, webhooks, rate limits, TOS) is mapped against the Fathom reference template (spike 001),
**then** we can issue a GO / NO-GO / CONDITIONAL verdict for building a Fathom-equivalent Fireflies integration into CallVault.

This is documentation-only. No OAuth attempts, no account signups, no live API calls. All findings come from public docs at `docs.fireflies.ai`, the public terms of service, and the public pricing page.

## Research

### 1. API Existence & Documentation

| Item | Value |
|---|---|
| Public developer portal | `https://fireflies.ai/api` (marketing) |
| Documentation URL | `https://docs.fireflies.ai` |
| GraphQL endpoint | `https://api.fireflies.ai/graphql` |
| Last-updated date of docs | Not timestamped on the public docs site. Latest changelog entry is **v2.23.1** (Bites `skip` validation fix). v2.23.0 added an `is_live` field to the Transcript type — recent enough that the API is actively maintained. |
| API stability tier | **Public, GA-ish.** Docs say "We are actively working to expose more functionality via our API." No formal SLA, no deprecation policy quoted. The Realtime (WebSocket) API is explicitly **beta**; the GraphQL API is not labeled beta. |
| Documentation quality | High. ~70+ doc pages: 18 queries, 14 mutations, two webhook docs (v1 and v2), 40+ schema pages, schema introspection enabled, Realtime WebSocket API docs, examples, MCP server, error-code reference. Fireflies even publishes a `llms.txt` index for LLM consumption. |

**TOC sanity check (from `docs.fireflies.ai/llms.txt`):**
- Fundamentals: authorization, concepts, errors, introspection, **limits**, super-admin
- GraphQL API: `query/transcripts`, `query/transcript`, `query/users`, plus 15 more queries; 14 mutations; **`webhooks.md`** + **`webhooks-v2.md`**
- Schema: 40+ types incl. `Transcript`, `Sentence`, `Summary`, `MeetingAttendee`, `User`, `Speaker`, `Bite`
- Realtime API (WebSocket, beta), Zapier integration, MCP tools, error codes

### 2. Authentication Model

| Item | Value |
|---|---|
| Auth model | **Bearer token from a static API key.** No OAuth 2.0. |
| Authorization header | `Authorization: Bearer <api_key>` |
| Where the API key is generated | User goes to `app.fireflies.ai/integrations` → Fireflies API → copy key. Per-user, generated in the user's own Fireflies dashboard. |
| Key lifetime / rotation / revocation | **Not documented.** The docs say to "verify that the API key hasn't expired" but never specify a TTL, rotation flow, or revocation endpoint. Treat as: lives until user regenerates it in the UI. |
| Multi-account support | Each Fireflies user generates their own key. CallVault would store one key per `import_sources` row, same shape as Fathom's per-account OAuth tokens. **No OAuth = no client-side automated multi-tenant onboarding flow.** Every connecting user must manually paste a key. |

**Implication vs Fathom (BIG ONE):** Fathom uses OAuth 2.0 (3-legged). Fireflies is API-key only. This is a meaningful UX downgrade for end-users: instead of "click → authorize → done", users paste a copied key. The integration code is *simpler* (no `*-oauth-url`, `*-oauth-callback`, `*-oauth-refresh` edge functions needed) but the connect flow is less polished. CallVault's existing `import_sources` schema accepts this — store the key in `oauth_access_token`, leave refresh fields null.

### 3. Plan Tier Required

From `fireflies.ai/pricing`:

| Tier | Price (annual) | API access |
|---|---|---|
| Free | $0 | ✓ Included |
| Pro | $10/seat/mo | ✓ Included |
| Business | $19/seat/mo | ✓ Included + "Unlimited integrations" |
| Enterprise | $39/seat/mo | ✓ Included |

**API is on the FREE tier.** This is a significant differentiator vs many competitors (Otter, Read.ai often gate API behind paid tiers). The catch is rate limits, not access (see §6 below).

**Plan-tier requirement for webhooks:** Webhooks v1 are allowed on all tiers for individual owner; **team-wide webhooks via Super Admin role require Enterprise**. Webhooks v2 plan restrictions are not documented (treat as available all tiers).

### 4. Transcript / Recording Endpoints (GraphQL queries)

#### `transcripts` (list query)

Filters: `keyword` (max 255 chars; deprecated `title` synonym), `keyword_match_type` (`TITLE` | `SENTENCES` | `ALL`), `fromDate` / `toDate` (ISO 8601), `host_email`, `organizer_email`, `participant_email`, `mine` (boolean), `user_id`, `organizers[]`, `participants[]`, `channel_id`.

Pagination: **offset-based** via `limit` (max **50**) + `skip`. No cursor pagination.

```graphql
query Transcripts($userId: String, $fromDate: DateTime, $toDate: DateTime) {
  transcripts(user_id: $userId, fromDate: $fromDate, toDate: $toDate, limit: 50, skip: 0) {
    id
    title
    date
    duration
    host_email
    organizer_email
    meeting_link
    audio_url
    video_url
  }
}
```

#### `transcript` (single, full content)

Returns the full `Transcript` type. Confirmed available fields:

- **Identity:** `id`, `title`, `date` (transcript creation), `duration`, `meeting_link`, `audio_url`, `video_url`, `transcript_url`, `dateString`, `is_live`
- **People:** `host_email`, `organizer_email`, `user { user_id name email integrations }`, `participants` (string array of emails), `meeting_attendees [{ displayName, email, phoneNumber, name, location }]`, `speakers [{ id, name }]`
- **Content — `sentences[]`:**
  - `index` (Int)
  - `text` (String) — user-edited or default
  - `raw_text` (String) — original transcribed text
  - `start_time` (String)
  - `end_time` (String)
  - `speaker_id` (ID)
  - `speaker_name` (String)
  - `ai_filters` (sentiment, task, pricing, metric, question, etc.)
- **AI summary — `summary { ... }`:** `keywords`, `action_items`, `outline`, `shorthand_bullet`, `overview`, `bullet_gist`, `gist`, `short_summary`, `short_overview`, `meeting_type`, `topics_discussed`, `transcript_chapters`
- **Analytics — `analytics { ... }`:** sentiments, speaker statistics

#### `bites` (highlights / soundbites)

Separate endpoint exists. Bites are user-clipped highlights (similar to Fathom's "highlights"). Confirmed by changelog entry v2.23.1 patching the Bites query's `skip` validation. Available as a query alongside `transcripts`.

#### Verdict on transcript depth: **EQUIVALENT-OR-BETTER than Fathom.**

Fireflies returns **more** AI-generated structure than Fathom's API:
- Multiple summary granularities (`gist`, `short_overview`, `overview`, `bullet_gist`, `shorthand_bullet`)
- `topics_discussed` and `transcript_chapters` (Fathom doesn't expose chapters)
- Per-sentence sentiment + AI filters (Fathom doesn't)
- Meeting analytics (speaker time, sentiment trends)

**Format mapping to CallVault's unified `recordings` table:** straightforward. Map `sentences[].{text, start_time, speaker_name, speaker_id}` → `recordings.transcript_segments` JSONB. Map `summary.overview` → `recordings.summary`. Store all the extra AI fields in `recordings.source_metadata`.

### 5. Webhooks

**Two webhook systems exist.** Use **v2** for any new integration; v1 is the legacy single-event system.

#### Webhooks v2 (use this)

| Item | Value |
|---|---|
| Subscribe via | **Dashboard config** at `app.fireflies.ai/integrations/api/webhook` — enter HTTPS URL, optional signing secret, select events. **No public GraphQL mutation to subscribe programmatically.** |
| Event types | `meeting.transcribed` (transcript ready), `meeting.summarized` (summary generated) |
| Delivery format | JSON POST. Payload: `{ event, timestamp (unix ms), meeting_id, client_reference_id? }` |
| Signature header | `X-Hub-Signature: sha256=<hex>` — HMAC-SHA256 of raw body, hex-encoded, prefixed `sha256=` |
| Verification | User-provided signing secret entered at subscription time. CallVault generates a 16–32 char secret per user, stores in `import_sources` (or a new column), user pastes it into Fireflies dashboard. |
| Delivery SLA | Endpoint must respond 2xx within **10 seconds** or delivery is marked failed. Retry policy not documented; assume best-effort. |
| Plan tier | Not documented. Treat as available all tiers. |

#### Webhooks v1 (legacy)

- Single event: "Transcription completed"
- Subscribe via Developer Settings dashboard, OR via `webhook` parameter on individual `uploadAudio` GraphQL mutations (per-upload webhook, useful for self-uploaded audio)
- Header: `x-hub-signature` (lowercase, same HMAC-SHA256 scheme)
- **Team-wide webhooks require Enterprise + Super Admin role**

#### CRITICAL GAP vs Fathom

**Fireflies has no API to programmatically register webhooks.** Fathom's `create-fathom-webhook` edge function does `POST https://fathom.video/external/v1/webhooks` and gets back a generated secret — fully automatable. Fireflies requires the **end-user to manually paste the destination URL and signing secret into the Fireflies dashboard.**

This means CallVault's setup wizard for Fireflies must:
1. Generate a per-user signing secret server-side, display it.
2. Display CallVault's webhook receiver URL with the user's account ID embedded.
3. Show the user a screenshot/instructions: "Go to `app.fireflies.ai/integrations/api/webhook`, paste these two values, save."
4. (Optional) Poll `transcripts` API for the first ~10 minutes to detect successful round-trip, mark webhook as verified.

This is a UX downgrade vs Fathom but is **survivable** — same pattern as connecting Slack incoming webhooks or Stripe webhooks in many SaaS apps.

### 6. Rate Limits

From `fundamentals/limits` (confirmed):

| Plan | Standard API rate limit |
|---|---|
| Free | **50 requests / day** |
| Pro | **50 requests / day** |
| Business | **60 requests / minute** |
| Enterprise | **60 requests / minute** |

Specialized endpoints:
- Add to Live API: 3 req / 20 min
- Share Meeting API: 10 req / hour, max 50 emails/req

**429 response shape:** `too_many_requests` error code, message `"Too many requests. Please retry after [time] (UTC)"`, with `retryAfter` UTC timestamp in `extensions` metadata. Standard GraphQL error envelope.

**No credit-based limits.** Hard caps. No "AI credits" charge for transcript queries (those credits exist only for the `apply_audio_to_meeting` / `extract` mutations — error code `require_ai_credits` exists but applies to specific AI features, not transcript reads).

#### CRITICAL FINDING: Free/Pro plans are useless for backfill

50 req/day will not support **any** meaningful sync. A user with 200 historical meetings can't be backfilled in less than **4 days** on Free/Pro. CallVault must:

- **Require Business+ ($19/seat/mo) for serious use.** This is the practical floor.
- For Free/Pro users: support webhook-only mode (catch new transcripts as they happen, no historical backfill) and clearly warn during onboarding.
- For Business/Enterprise: 60/min is comfortable. Fathom's documented limit is 60/min — Fireflies matches at the paid tier. CallVault's existing in-edge-function rate limiter pattern (`_shared/fathom-client.ts`'s `fetchWithRetry()`) ports cleanly with the rate constant changed.

Developer Program perk: 3 months free Business tier with "expanded rate limits" during dev. Useful for getting CallVault's Fireflies integration tested without paying.

### 7. TOS Clauses (from `fireflies.ai/terms-of-service`)

Quoted clauses:

#### §11(c) — third-party storage of meeting data

> "Certain Recurring Subscriptions may include options for you to store User Content in a dedicated storage environment managed by Fireflies or in your own cloud storage account."

CallVault storing transcripts in Supabase Postgres is not directly addressed but **not prohibited** — the TOS treats user-controlled storage as expected.

#### §6(a) — competing service / standalone clauses (FLAGS)

> **"Incorporate our Services into your own product or services on a 'stand-alone basis'"** — forbidden. Your products must "reasonably add value beyond the value of Fireflies' Services and the Services must be merely a component of your products and services and not its primary focus."

> "Sell, resell, sublicense, distribute, or rent our Services to another person or entity" — forbidden.

> **"Develop or use any applications or software that interact with our Services without our prior written consent"** — this is the clause that makes the Developer Program application *required*, not optional.

> "Use any data mining, robots, or similar data gathering or extraction methods designed to scrape or extract data from our Services" — forbidden (covers non-API scraping; doesn't apply to our use of the official API).

#### §10(d) — AI compete

> "Use Outputs to develop models that compete with Fireflies" — forbidden.
> "develop artificial intelligence models that compete with Fireflies or its licensors' products" — forbidden.

#### §5(c) — deletion-on-request

> "If you delete your User Content from the Services, Fireflies will delete copies of such content within a reasonable timeframe, unless such content remains in another user's account and subject to our retention of copies for archival, backup, and legal compliance purposes."

#### §5(b) — attribution

> Users "irrevocably waive any 'moral rights' or other rights with respect to attribution of authorship or integrity of materials regarding User Content."

No outbound attribution requirement on CallVault's side.

#### TOS verdict — CONDITIONAL but workable

CallVault is a **transcript management / meeting workspace** that **augments** Fireflies — not a Fireflies clone, not standalone. As long as positioning is "Fireflies feeds into CallVault for unified search/RAG/cross-provider notes" rather than "CallVault replaces Fireflies", §6(a) is satisfied. The "prior written consent" clause means **filing the Developer Program application is mandatory before going live**, even though API keys are technically self-serve. Skipping that is a TOS violation.

### 8. Comparison vs Fathom Template

#### 7-function edge stack mapping

Because Fireflies uses static API keys (no OAuth), four of Fathom's seven edge functions collapse into one. Webhook subscription is manual (no programmatic endpoint), so that function disappears too.

| Fathom edge function | Fireflies equivalent | Status |
|---|---|---|
| `fathom-oauth-url` | N/A — no OAuth | ✗ (collapses) |
| `fathom-oauth-callback` | `fireflies-connect` — accepts pasted API key, validates with `users{}` query, dedups by account email | ✓ (simpler) |
| `fathom-oauth-refresh` | N/A — keys don't expire on a clock | ✗ (collapses) |
| `create-fathom-webhook` | N/A — no programmatic webhook subscribe | ✗ (collapses, replaced with manual UX) |
| `webhook` (receiver) | `fireflies-webhook` — same shape, verifies `X-Hub-Signature` HMAC, idempotency-key against `processed_webhooks` | ✓ |
| `fetch-meetings` | `fetch-fireflies-meetings` — `transcripts` query with `limit` + `skip` pagination, in-edge-function rate limiter (60/min for Business+, 50/day for Free/Pro) | ✓ |
| `sync-meetings` | `sync-fireflies-meetings` — fetch list → fetch full transcript per id → upsert into `fireflies_calls` + `fireflies_transcripts` | ✓ |

**Net edge function count: ~4** (vs Fathom's 7). Less code, less maintenance.

#### 5 critical conventions check

| Convention | Fireflies fit |
|---|---|
| 1. Per-account tokens on `import_sources` | ✓ — store API key in `oauth_access_token`, leave refresh/expires null |
| 2. Account-email dedup on `(user_id, source_app, account_email)` | ✓ — call `users{ email }` after pasting key, dedup |
| 3. CSRF protection via `oauth_state` round-trip | ⚠ N/A — no OAuth flow to protect. Replace with: validate the pasted key with one `users{}` round-trip before storing. |
| 4. Idempotency key on every webhook delivery | ✓ — use `meeting_id + event + timestamp` from v2 payload as idempotency key |
| 5. In-edge-function rate limiter matching provider limit | ✓ — port `FathomClient.fetchWithRetry()` pattern; constants change to 60/min (Business+) or 50/day (Free/Pro) |
| 6. One raw table per provider | ✓ — `fireflies_calls` + `fireflies_transcripts` |
| 7. `source_app` literal on projected `recordings` row | ✓ — `'fireflies'` |

**5/7 conventions clean fit. 2 collapse harmlessly** because the underlying mechanism (OAuth) doesn't exist.

#### Frontend touchpoints

Same shape as Fathom — `FirefliesSetupWizard.tsx`, `FirefliesImportDetail.tsx`, `fireflies.service.ts`, types. Wizard is **2 steps simpler** (no OAuth redirect dance) but adds a "configure webhook in Fireflies dashboard" instructional screen with copy-buttons for URL + secret.

## Investigation Trail

### Pages fetched
- `https://docs.fireflies.ai/` — landing page (confirmed GraphQL pitch)
- `https://docs.fireflies.ai/llms.txt` — full TOC, ~70 pages
- `https://docs.fireflies.ai/getting-started/quickstart` — endpoint URL + auth header confirmed
- `https://docs.fireflies.ai/fundamentals/authorization` — bearer token, no OAuth
- `https://docs.fireflies.ai/fundamentals/limits` — exact rate limits per plan
- `https://docs.fireflies.ai/fundamentals/errors` — error code list
- `https://docs.fireflies.ai/miscellaneous/error-codes` — full 16-code table incl. 429 shape
- `https://docs.fireflies.ai/graphql-api/webhooks` — v1 spec
- `https://docs.fireflies.ai/graphql-api/webhooks-v2` — v2 spec, full payload + headers
- `https://docs.fireflies.ai/graphql-api/query/transcripts` — list query schema
- `https://docs.fireflies.ai/graphql-api/query/transcript` — single query schema
- `https://docs.fireflies.ai/schema/sentence` — Sentence type fields
- `https://docs.fireflies.ai/realtime-api/overview` — beta WebSocket API exists (out of scope for MVP)
- `https://docs.fireflies.ai/getting-started/developer-program` — application required, 3-mo free Business tier
- `https://docs.fireflies.ai/additional-info/change-log` — v2.23.1 latest, actively maintained
- `https://docs.fireflies.ai/getting-started/introduction` — "actively expanding API"
- `https://fireflies.ai/pricing` — API on Free tier, plan ladder
- `https://fireflies.ai/terms-of-service` — full TOS, all 5 critical clauses

### URLs that 404'd (not actual gaps, just wrong path guesses)
- `docs.fireflies.ai/getting-started/authorization` — actual path is `/fundamentals/authorization`
- `docs.fireflies.ai/concepts/rate-limit` — actual path is `/fundamentals/limits`
- `docs.fireflies.ai/schema/transcript` — fields docs are inline at `/graphql-api/query/transcript` instead
- `fireflies.ai/terms` and `fireflies.ai/legal` — actual TOS path is `/terms-of-service`

### Key discoveries
1. **Fireflies has TWO webhook systems** — v1 (single event, dashboard-only) and v2 (granular events, two events live: `meeting.transcribed` + `meeting.summarized`). v2 is the right target.
2. **No OAuth.** Bearer token from a self-serve user dashboard. Big UX delta vs Fathom. Code delta: 4 fewer edge functions.
3. **No programmatic webhook subscription.** End-user must paste URL + signing secret into Fireflies dashboard. UX downgrade, code simpler.
4. **Free/Pro = 50 req/day.** Business+ = 60 req/min. The Free tier has "API access" but the rate limit makes real backfill impossible without Business.
5. **TOS §6(a) requires "prior written consent"** for any app interacting with Fireflies. The Developer Program application is the consent mechanism. Failing to file is a TOS violation.
6. **Realtime WebSocket API exists** (beta) — streams live transcript segments. Out of scope for v1 of CallVault's integration but a future-flag opportunity for live-call features.
7. **Transcript schema is RICHER than Fathom** — multiple summary granularities, transcript chapters, per-sentence sentiment, AI filters, meeting analytics. CallVault gets more data per call than from Fathom.

## Results

**Verdict: CONDITIONAL.**

**Reasoning:**

1. The API exists, is public, is GA-grade, and is actively maintained (v2.23.1 changelog entry confirms). GraphQL endpoint, auth, webhooks v2, rate limits, and full transcript schema are all documented and verifiable from public sources without an account.
2. The transcript depth **exceeds** Fathom — Fireflies returns more structured AI output (chapters, multi-granularity summaries, per-sentence sentiment) than Fathom's API does. This is a *better* data source for CallVault's unified recordings table.
3. Two material conditions block a clean GO: **(a)** the 50 req/day free-tier rate limit makes real-world backfill impossible without Business ($19/seat/mo), and **(b)** webhook subscription is manual-paste-into-dashboard, not programmatic, so the setup wizard adds an instructional step that Fathom doesn't need.
4. TOS is permissive *if* CallVault positions as augmenting Fireflies (not replacing) and *if* the Developer Program application is filed before public launch. §6(a)'s "prior written consent" clause makes the application a hard prerequisite, not optional.
5. Edge-function count drops from 7 → ~4 because no OAuth flow and no programmatic webhook registration. This is *less* code to maintain than Fathom — Fireflies is the **lowest-implementation-cost provider** of the four researched.

**Why CONDITIONAL not VALIDATED:** Two pre-flight conditions must be cleared before any code is written —
- File the Developer Program application and secure written consent (TOS §6(a)).
- Confirm the manual-webhook-paste setup UX is acceptable to product (it's the only viable path; no programmatic registration endpoint exists in public docs).

**Follow-up spike recommendation:** **Spike 008 — Fireflies API key + webhook v2 round-trip proof.** Andrew generates an API key from his own Fireflies account, runs three live tests: (1) `users{}` + `transcripts(limit:5){}` to confirm key works and pagination is offset-based as documented, (2) configures a v2 webhook pointing at a temporary edge function and triggers a meeting → confirm `X-Hub-Signature` HMAC verifies and idempotency key is unique per delivery, (3) hammer the API to verify 60/min Business-tier rate limit kicks in with the documented `too_many_requests` shape. ~2 hours, no production code. Decides whether the manual webhook paste UX flies and whether v2 reliability is good enough.

**Alternative paths (not needed — verdict isn't INVALIDATED):**

- *If* the Developer Program application is rejected: fall back to a "BYOK paste your own key" mode where CallVault never registers as an app, just consumes user-pasted keys with TOS responsibility on the end-user. Legally murkier but technically functional.
- *If* the manual webhook UX tests poorly: lean on the Realtime WebSocket API (beta) for live-meeting cases and run polling-only sync (`fetch-meetings` on a cron) for batch — sidesteps webhook setup entirely at cost of 5–15min latency.
