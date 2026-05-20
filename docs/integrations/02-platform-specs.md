# PER-PLATFORM INTEGRATION SPECS (EXACT)

Each spec gives the **exact** wire shape, file paths, edge function names, OAuth/key flow, scope strings, and `ConnectorRecord` mapping needed to ship that source. Follow the spec literally; deviations should require a written justification.

**Date:** 2026-05-15
**Confidence tags:** [HIGH] verified against ≥1 official doc, [MED] verified against community source, [LOW] needs confirmation before shipping.

**Prerequisites:** Apply F-01 through F-05 from `01-connector-pipeline-vet.md` before starting platform #1. They are pipeline-level fixes; without them every connector duplicates work.

---

## SPEC INDEX

| # | Platform | Auth | Sync model | Tier required | Effort (post-fixes) | Path |
|---|----------|------|------------|---------------|---------------------|------|
| 1 | **Grain** | OAuth2 + PKCE | Webhook + cursor poll | Business $48/mo | **3 dev-days** | Official API |
| 2 | **Fireflies** | API key (Bearer) | Webhook + offset poll | Business $19/mo | **2.5 dev-days** | Official API |
| 3 | **GoHighLevel** | OAuth2 (Marketplace) | Webhook (Ed25519) | Unlimited $297/mo | **5 dev-days** | Official API |
| 4 | **tl;dv** | API key (`x-api-key`) | Webhook + page poll | Business+ | **3 dev-days** | Official API (alpha — wrap) |
| 5 | **RingCentral** | OAuth2 + PKCE | Subscription + poll | Advanced ~$25/mo | **5 dev-days** | Official API |
| 6 | **Microsoft Teams** | OAuth2 (Graph) app+delegated | Graph subscriptions | M365 Bus/E3+ + admin consent | **8 dev-days** | Official API |
| 7 | **Plaud** | Zapier-first / OTP+JWT fallback | Webhook (Zapier) OR poll (openplaud) | Plaud + Zapier $20/mo (path A) | **2 dev-days** path A / **5 dev-days** path B | Zapier sanctioned + openplaud RE |
| 8 | **Mojo Dialer** | None (no API) | Manual CSV+ZIP upload | Call Recording add-on | **3 dev-days** | RE not viable, CSV/MP3 importer |

**Total greenfield effort (best case, sequential):** ~31.5 dev-days for all 8. Doing fixes (F-01 to F-05) first adds ~3 days but cuts ~6 days of duplicate work across platforms. **Net: ~28.5 dev-days, ~6 weeks at 1 engineer.**

Parallel build with 2 engineers, post-fixes: ~3.5 weeks elapsed.

---

# 1) GRAIN

**Why first:** Cleanest API surface of any platform — OAuth2, cursor pagination, 300/min, 4 transcript formats out of the box, MOST modeled like a "reference adapter." Will set the patterns for the others.

## 1.1 Authentication

**Flow:** OAuth 2.0 Authorization Code + PKCE.

| Step | Endpoint | Notes |
|------|----------|-------|
| 1. Auth URL | `https://api.grain.com/_/public-api/oauth2/authorize` | Params: `response_type=code`, `client_id`, `redirect_uri`, `state`, `code_challenge` (S256), `scope=recordings:read transcripts:read webhooks:write` |
| 2. Token exchange | `POST https://api.grain.com/_/public-api/oauth2/token` | Body: `grant_type=authorization_code`, `code`, `redirect_uri`, `code_verifier`, `client_id`, `client_secret` |
| 3. Refresh | Same token URL | `grant_type=refresh_token`, `refresh_token` |

**Required scopes (exact strings):** `recordings:read`, `transcripts:read`, `webhooks:write`, `participants:read`.
**Token TTL:** Access ~1 hour, refresh long-lived (confirm in support ticket — [LOW]).
**Mandatory header on every API call:** `Public-Api-Version: 2025-10-31`. Without this, behavior is undefined.

## 1.2 Endpoints (REST)

Base: `https://api.grain.com/_/public-api/v2`. Auth: `Authorization: Bearer <token>`.

| Action | Method | Path |
|--------|--------|------|
| List recordings (cursor) | `POST` | `/recordings` body `{ "include": ["participants","ai_summary","calendar_event"], "cursor": "...", "limit": 50 }` |
| Get one recording | `POST` | `/recordings/:recording_id` body `{ "include": [...] }` |
| Transcript JSON | `GET` | `/recordings/:recording_id/transcript` |
| Transcript VTT/SRT/TXT | `GET` | `/recordings/:recording_id/transcript.vtt` (or `.srt`/`.txt`) |
| Download media | `GET` | `/recordings/:recording_id/download` (returns bytes, not URL) |
| Create webhook | `POST` | `/hooks/create` body `{ "url": "...", "event_types": ["recording_added","recording_updated"] }` |
| List webhooks | `POST` | `/hooks` |
| Delete webhook | `DELETE` | `/hooks/:id` |

**Webhook event types:** `recording_added`, `recording_updated`, `recording_deleted`, `highlight_added/updated/deleted`, `story_added/updated/deleted`, `upload_status`.

**Webhook payload:**
```json
{ "type": "recording_added", "user_id": "uuid", "data": { /* recording */ } }
```

**Webhook signing:** UNCLEAR — public docs only document a "reachability test" on creation. [DOCS GAP — must confirm with Grain support before shipping prod.] Until confirmed, use a **per-customer unguessable URL segment** as poor-man's auth (e.g., `/grain-webhook/:secret_id` where `:secret_id` is a 32-char random token stored against the user's `import_sources` row).

## 1.3 Rate limit

300 req/min, returned headers `x-ratelimit-limit`, `x-ratelimit-remaining`, `Retry-After`. Plenty for typical loads.

## 1.4 Media URLs

`GET /recordings/:id/download` returns media bytes directly (not a redirect). No TTL — auth-gated. Stream into Supabase Storage on insert; do not persist the URL.

## 1.5 Transcript format → `ConnectorRecord` mapping

Grain JSON shape:
```json
{
  "segments": [
    { "speaker": "Andrew", "participant_id": "uuid", "text": "...", "start_ms": 0, "end_ms": 1230 },
    ...
  ]
}
```

Normalize to consolidated speaker turns via the new `_shared/transcript-normalizer.ts` (F-14). Output:
```
[00:00:00] Andrew: Welcome to the call.

[00:00:08] Phill: Thanks for jumping on.
```

## 1.6 `ConnectorRecord` construction

```ts
const record: ConnectorRecord = {
  external_id: grainRecording.id,           // stable UUID from Grain
  source_app: 'grain',
  legacy_id_numeric: null,
  title: grainRecording.title,
  full_transcript: normalizedTranscript,
  transcript_status: 'ready',
  transcript_format: 'json',
  transcript_raw: JSON.stringify(grainTranscript),
  summary: grainRecording.ai_summary?.text ?? null,
  audio_url: null,                          // we already downloaded bytes
  video_url: null,
  recording_start_time: grainRecording.start_at,
  recording_end_time: grainRecording.end_at,
  duration: Math.floor((endMs - startMs) / 1000),
  recorded_by_email: grainRecording.owner?.email ?? null,
  recorded_by_name: grainRecording.owner?.name ?? null,
  participant_emails: grainRecording.participants
    .map(p => p.email?.toLowerCase()).filter(Boolean),
  source_metadata: {
    grain_recording_id: grainRecording.id,
    grain_workspace_id: grainRecording.workspace_id,
    grain_calendar_event_id: grainRecording.calendar_event?.id ?? null,
    grain_highlights: grainRecording.highlights ?? [],
    grain_share_url: grainRecording.public_url ?? null,
    import_source: 'grain-webhook' /* or 'grain-sync' */,
    synced_at: new Date().toISOString(),
  },
};
```

## 1.7 Edge Function file layout

```
supabase/functions/
  grain-oauth-url/index.ts          ← returns authorize URL, sets state + code_verifier in DB
  grain-oauth-callback/index.ts     ← exchanges code, stores encrypted tokens
  grain-oauth-refresh/index.ts      ← refresh on 401
  grain-sync-meetings/index.ts      ← cursor poll for backfill / scheduled sync
  grain-webhook/index.ts            ← receives event, calls runPipeline()
  grain-create-webhook/index.ts     ← post-connect, registers webhook with Grain
  _shared/grain-client.ts           ← static class like FathomClient/ZoomClient
```

## 1.8 Build steps (in order)

1. Register OAuth app at `developers.grain.com` → store `GRAIN_CLIENT_ID`/`GRAIN_CLIENT_SECRET` in Supabase secrets.
2. Run migration adding `'grain'` to allowed `source_app` enum (if enum exists, otherwise no-op).
3. Build `_shared/grain-client.ts` (copy `zoom-client.ts` structure — same fetchWithRetry/apiRequest pattern, sub in Grain auth headers).
4. Build `grain-oauth-url` → `grain-oauth-callback` (clone from `zoom-oauth-*`).
5. Build `grain-sync-meetings` calling `_shared/connector-pipeline.runPipeline()`.
6. Build `grain-webhook` calling same `runPipeline()`.
7. Build `grain-create-webhook` to register the receiver URL with Grain after OAuth connect.
8. Add Frontend connect button on `ImportSources` page wired to `grain-oauth-url`.
9. Test against Grain Business sandbox (request from support).
10. Run RLS regression test + integration test with real Grain account.

## 1.9 Gotchas to bake into code

- `Public-Api-Version: 2025-10-31` header on every call — set it inside `grain-client.ts` once.
- `POST` (not `GET`) for list endpoints — non-REST but Grain's design.
- Webhook signing unconfirmed — gate via random URL segment until support clarifies.
- `upload_status` event matters if we ever push recordings INTO Grain (out of scope today).
- Always include `Public-Api-Version` even on token refresh.

---

# 2) FIREFLIES

**Why second:** Stable API, cleanest of the GraphQL platforms, validates that the adapter pattern handles non-REST surfaces.

## 2.1 Authentication

**Flow:** API key (Bearer). No OAuth. User generates at `app.fireflies.ai → Integrations → Fireflies API → Copy Key`.

**CallVault connect UX:** "Paste your Fireflies API key" — single field, single button, validation via `query users { id name email }` against the GraphQL endpoint.

**Store:** Encrypted in `import_sources.oauth_access_token` (the column is generic; treat the API key as a permanent access token, `refresh_token` and `token_expires` stay NULL).

## 2.2 Endpoint (GraphQL)

Single endpoint: `POST https://api.fireflies.ai/graphql`. Auth: `Authorization: Bearer <api_key>`, `Content-Type: application/json`.

**Canonical list-transcripts query:**
```graphql
query CallVaultListTranscripts($fromDate: DateTime, $skip: Int, $limit: Int) {
  transcripts(fromDate: $fromDate, skip: $skip, limit: $limit) {
    id
    title
    date
    duration
    organizer_email
    participants
    audio_url
    video_url
    transcript_url
    sentences {
      speaker_name
      speaker_id
      text
      start_time
      end_time
    }
    summary { overview action_items keywords outline shorthand_bullet }
    meeting_attendance { name email join_time leave_time }
  }
}
```

**Single transcript query:** `query($id: String!) { transcript(id: $id) { ...same fields... } }`.

## 2.3 Webhooks

**Event:** `Transcription completed` (only one documented, [DOCS GAP] on others — assume one).
**Header:** `x-hub-signature: sha256=<hex>` — HMAC-SHA256 of raw body with shared secret.
**Registration:** UI-only at `app.fireflies.ai/settings → Developer Settings → Webhook URL`, or per-upload via `webhook` param in `uploadAudio` mutation.

**Payload:**
```json
{
  "meetingId": "ASxwZxCstx",
  "eventType": "Transcription completed",
  "clientReferenceId": "be582c46-4ac9-4565-9ba6-6ab4264496a8"
}
```

Webhook is **per-user-account** unless on Enterprise (Super Admin webhook).

## 2.4 Rate limits

| Tier | Limit |
|------|-------|
| Free / Pro | 50 req/day — unusable |
| Business / Enterprise | 60 req/min |
| `shareMeeting` | 10/hr, 50 emails/req |
| `deleteTranscript` | 10/min all tiers |

**Required tier: Business minimum** ($19/user/mo annual). Surface this clearly in CallVault connect flow.

## 2.5 Media URLs

`audio_url` and `video_url` are signed, **24-hour TTL**. Re-query the transcript to get a fresh URL on 403. Stream + persist to Supabase Storage on insert.

## 2.6 `ConnectorRecord` mapping

```ts
const record: ConnectorRecord = {
  external_id: ff.id,
  source_app: 'fireflies',
  legacy_id_numeric: null,
  title: ff.title,
  full_transcript: normalizeTranscript({ format: 'fireflies', sentences: ff.sentences }),
  transcript_status: 'ready',
  transcript_format: 'json',
  transcript_raw: JSON.stringify(ff.sentences),
  summary: ff.summary?.overview ?? null,
  audio_url: ff.audio_url,                   // store but expect to refresh
  video_url: ff.video_url,
  media_url_expires_at: addHours(now, 24).toISOString(),
  recording_start_time: ff.date,             // ISO
  duration: ff.duration,
  recorded_by_email: ff.organizer_email,
  participant_emails: ff.participants.map(e => e.toLowerCase()),
  source_metadata: {
    fireflies_meeting_id: ff.id,
    fireflies_action_items: ff.summary?.action_items ?? null,
    fireflies_keywords: ff.summary?.keywords ?? null,
    fireflies_attendance: ff.meeting_attendance ?? null,
    fireflies_transcript_url: ff.transcript_url,
    import_source: 'fireflies-sync',
    synced_at: new Date().toISOString(),
  },
};
```

## 2.7 Edge Function file layout

```
supabase/functions/
  save-fireflies-key/index.ts        ← validate key, store encrypted
  fireflies-sync-meetings/index.ts   ← offset poll (skip/limit, max skip 5000 — window by date if more)
  fireflies-webhook/index.ts         ← HMAC verify, single-meeting fetch, runPipeline()
  _shared/fireflies-client.ts        ← GraphQL helper
```

## 2.8 Gotchas

1. **`skip` max 5000** — paginate by date for histories beyond 5000 transcripts.
2. **24h media TTL** — download immediately, never persist Fireflies URL.
3. **Per-user webhook scope** — multi-user CallVault customers each enable individually unless on Enterprise.
4. **Single-key blast radius** — no scopes, rotate aggressively.
5. **`x-hub-signature` is `sha256=<hex>`** — verify with prefix-strip + timing-safe compare.

---

# 3) GOHIGHLEVEL (GHL)

**Why third:** Highest-friction connector (multi-tenant sub-account model, Ed25519 signing, OAuth marketplace review), but high-volume — most CRM users CallVault targets are on GHL.

## 3.1 Authentication

**Flow:** OAuth 2.0 Marketplace App. Build CallVault as Sub-Account-level (Location-scoped) app.

| Step | Endpoint |
|------|----------|
| Auth URL | `https://marketplace.gohighlevel.com/oauth/chooselocation` |
| Token | `POST https://services.leadconnectorhq.com/oauth/token` |
| Refresh | Same |

**Required scopes (exact strings):**
- `conversations.readonly`
- `conversations/message.readonly`
- `contacts.readonly`
- `voice-ai-dashboard.readonly` (optional — only if pulling transcripts)
- `phonenumbers.read` (optional)

**Token lifetimes:** access 24h, refresh 1yr (sliding). Refresh proactively at 22 hours, not on 401.

**Multi-tenant model:** Each OAuth install issues a token per `locationId`. Store per-Location, refresh per-Location, dispatch webhooks per-Location.

## 3.2 Endpoints

Base: `https://services.leadconnectorhq.com`. Auth: `Authorization: Bearer <token>`, `Version: 2021-07-28`, `Accept: application/json`.

| Action | Method + Path |
|--------|---------------|
| Search conversations | `GET /conversations/search?locationId=:locId&limit=50&startAfter=:cursor&startAfterId=:id` |
| Get messages | `GET /conversations/:conversationId/messages?limit=50` |
| **Get call recording** | `GET /conversations/messages/:messageId/locations/:locationId/recording` → returns `audio/x-wav` bytes |
| Get transcription metadata | `GET /conversations/messages/:messageId/locations/:locationId/transcription` |
| Download transcription | `GET /conversations/messages/:messageId/locations/:locationId/transcription/download` |

Filter messages for calls: `messageType === 'TYPE_CALL'` or `'TYPE_VOICEMAIL'`.

## 3.3 Webhooks

**Events:** `InboundMessage`, `OutboundMessage` (call recordings ride on these — there is NO separate `CallRecording.created` event).

**Payload — call shape:**
```json
{
  "type": "InboundMessage",
  "locationId": "...",
  "contactId": "...",
  "conversationId": "...",
  "messageId": "...",
  "messageType": "TYPE_CALL",
  "messageTypeString": "TYPE_CALL",
  "direction": "inbound",
  "status": "completed",
  "callDuration": 142,
  "callStatus": "completed",
  "attachments": ["<recording-url>"],
  "from": "+1...",
  "to": "+1...",
  "dateAdded": "ISO",
  "userId": "...",
  "conversationProviderId": "..."
}
```

**Signature verification (CRITICAL):**
- **Current:** `X-GHL-Signature` — Ed25519. Verify against GHL's published public key.
- **Legacy:** `X-WH-Signature` — RSA-SHA256. **Deprecates July 1, 2026.** Verify both during transition.

GHL public keys: published at marketplace docs (refresh annually). Hardcode the Ed25519 public key in `_shared/ghl-webhook-verify.ts`.

**Registration:** In marketplace app settings → Advanced Settings → Webhooks. Subscribe to `InboundMessage`, `OutboundMessage`, optionally `ConversationUnread`.

## 3.4 Rate limits

| Scope | Limit |
|-------|-------|
| Burst | 100 req / 10s per app per Location |
| Daily | 200,000 req / day per app per Location |

Exponential backoff on 429. The burst limit bites during initial backfill — throttle to ~5 req/s during catch-up.

## 3.5 Tier gating

- **API access:** Unlimited plan ($297/mo) or higher.
- **Conversation AI (transcripts):** Separate paid feature — $0.02/message PAYG, or $97/mo per sub-account.
- **SaaS Mode:** Agency Pro $497/mo for multi-tenant resale (irrelevant for CallVault as an integrator).

Surface tier requirement in connect flow.

## 3.6 Media URLs

**No signed CDN URL.** The recording endpoint streams `audio/x-wav` bytes directly, requires Bearer auth on every fetch. Stream → Supabase Storage on insert. Store storage path; never store GHL URL.

## 3.7 `ConnectorRecord` mapping

```ts
const record: ConnectorRecord = {
  external_id: ghl.messageId,                // unique per call
  source_app: 'ghl',
  legacy_id_numeric: null,
  title: deriveTitle(ghl),                    // e.g., `${ghl.from} → ${ghl.to} (${duration}s)`
  full_transcript: transcriptionContent ?? null,
  transcript_status: transcriptionContent ? 'ready' : 'pending',
  transcript_format: 'json',
  summary: null,                              // GHL doesn't natively summarize at message level
  audio_url: null,                            // bytes streamed to our Storage
  recording_start_time: ghl.dateAdded,
  duration: ghl.callDuration,
  recorded_by_email: null,                    // resolved separately via /users/:userId
  recorded_by_name: null,
  participant_emails: [],                     // GHL doesn't expose emails per call; use phone numbers
  source_metadata: {
    ghl_location_id: ghl.locationId,
    ghl_contact_id: ghl.contactId,
    ghl_conversation_id: ghl.conversationId,
    ghl_message_id: ghl.messageId,
    ghl_direction: ghl.direction,
    ghl_message_type: ghl.messageType,
    ghl_from_phone: ghl.from,
    ghl_to_phone: ghl.to,
    ghl_user_id: ghl.userId,
    ghl_call_status: ghl.callStatus,
    import_source: 'ghl-webhook',
    synced_at: new Date().toISOString(),
  },
};
```

## 3.8 Edge Function file layout

```
supabase/functions/
  ghl-oauth-url/index.ts                   ← /chooselocation flow, state stored
  ghl-oauth-callback/index.ts              ← exchange code, store per-location token
  ghl-oauth-refresh/index.ts               ← scheduled at 22h post-issue
  ghl-webhook/index.ts                     ← Ed25519 verify, dedup, runPipeline()
  ghl-sync-conversations/index.ts          ← cursor poll for backfill
  ghl-fetch-recording/index.ts             ← stream WAV bytes to Storage
  _shared/ghl-client.ts
  _shared/ghl-webhook-verify.ts            ← Ed25519 + RSA fallback
```

## 3.9 Gotchas

1. **Recording lag:** webhook may fire before audio is available. Implement poll with backoff (5s, 30s, 2min, 10min, 30min) before declaring missing.
2. **Webhook ordering not guaranteed** — idempotent on `messageId`.
3. **Voicemail vs call:** `TYPE_VOICEMAIL` is a separate message type; both have audio attachments.
4. **No CallRecording event** — must filter `InboundMessage`/`OutboundMessage` by `messageType`.
5. **Marketplace review** — submission required for public listing. Internal/private install only for dev.
6. **Per-Location tokens** — your DB schema needs `ghl_location_id` keying, not `user_id`.
7. **Ed25519 first, RSA fallback** — until July 2026, then drop RSA.

---

# 4) TL;DV

**Why fourth:** Alpha API — needs defensive wrapping. Build last among "official API" platforms or use as the second-class connector.

## 4.1 Authentication

**Flow:** API key (`x-api-key` header — NOT `Authorization: Bearer`).
Generate at `tldv.io/app/settings/personal-settings/api-keys`.

## 4.2 Endpoints

Base: `https://pasta.tldv.io/v1alpha1`. **Subject to breaking changes — wrap all calls in an adapter.**

| Action | Method + Path |
|--------|---------------|
| List meetings | `GET /meetings?page=1&pageSize=50` |
| Get meeting | `GET /meetings/:meetingId` |
| Get transcript | `GET /meetings/:meetingId/transcript` |
| Get notes | `GET /meetings/:meetingId/notes` |
| Download recording | `GET /meetings/:meetingId/download` → **302 redirect** to signed URL (6h TTL) |
| Import meeting | `POST /meetings/import` |

## 4.3 Webhooks

**Two events only:** `MeetingReady`, `TranscriptReady`. Configurable at User / Team / Organization level. HTTPS required.

**Signature:** Undocumented [DOCS GAP]. Use unguessable URL segment + (optional) custom header shared secret until tl;dv support confirms HMAC scheme.

## 4.4 Rate limits

Undocumented [DOCS GAP]. Build exponential backoff on 429, contact tl;dv for SLA.

## 4.5 Media URL

**302 redirect, 6h TTL.** Follow redirect → stream to Supabase Storage. Tightest TTL among platforms — schedule download immediately on receipt.

## 4.6 `ConnectorRecord` mapping

```ts
const record: ConnectorRecord = {
  external_id: tldv.id,
  source_app: 'tldv',
  title: tldv.title || tldv.metadata?.title,
  full_transcript: normalizeTranscript({ format: 'plain', content: assembleFromSegments(tldv.transcript) }),
  transcript_status: 'ready',
  transcript_format: 'json',
  transcript_raw: JSON.stringify(tldv.transcript),
  audio_url: null,                       // bytes streamed to Storage
  recording_start_time: tldv.startedAt,
  recording_end_time: tldv.endedAt,
  duration: tldv.duration,
  recorded_by_email: tldv.organizer?.email ?? null,
  participant_emails: tldv.invitees?.map((i: any) => i.email?.toLowerCase()).filter(Boolean) ?? [],
  source_metadata: {
    tldv_meeting_id: tldv.id,
    tldv_template_id: tldv.template?.id ?? null,
    tldv_url: tldv.url ?? null,
    tldv_recording_mode: tldv.recordingMode ?? 'bot', // 'bot' | 'desktop'
    import_source: 'tldv-sync',
    synced_at: new Date().toISOString(),
  },
};
```

## 4.7 Edge Function file layout

```
supabase/functions/
  save-tldv-key/index.ts
  tldv-sync-meetings/index.ts
  tldv-webhook/index.ts
  _shared/tldv-client.ts                   ← thick adapter, version-pinned, schema validator
```

## 4.8 Gotchas

1. **Alpha API** — every response goes through a Zod validator. Fail-soft on unknown fields, log to Langfuse.
2. **6h media TTL** — download immediately on webhook.
3. **No rate-limit headers** — instrument from your side.
4. **`x-api-key`, NOT Bearer** — common copy-paste bug.
5. **Two events only** — no delete/update notification. Run reconciliation poll every 6h.
6. **Desktop vs bot mode:** tl;dv pivoted to desktop-app recording for Google Meet (bots get flagged). Transcript quality differs — surface mode in metadata.

---

# 5) RINGCENTRAL

**Why fifth:** Enterprise customer scale, but the most operational friction — Heavy rate-limit group + no recording-completion event + sandbox is dead.

## 5.1 Authentication

**Flow:** OAuth 2.0 Authorization Code + PKCE.

| Step | Endpoint |
|------|----------|
| Auth | `https://platform.ringcentral.com/restapi/oauth/authorize` |
| Token | `POST https://platform.ringcentral.com/restapi/oauth/token` |

PKCE `code_verifier` must be cryptographically random, **no `+`, `/`, `=`** (128 char recommended). `code_challenge_method=S256`.

**Token TTLs:** Access 600–3600s default 3600s. Refresh 7 days default, customizable via `refresh_token_ttl`.

**Required scopes:**
- `ReadCallLog`
- `ReadCallRecording`
- `WebhookSubscriptions`
- Optional: `Meetings` (RC Video), `ReadMessages` (voicemail).

## 5.2 Endpoints

Base: `https://platform.ringcentral.com`. Auth: `Authorization: Bearer <token>`.

| Action | Method + Path |
|--------|---------------|
| Call log (user) | `GET /restapi/v1.0/account/~/extension/~/call-log?withRecording=true&view=Detailed` |
| Call log (account) | `GET /restapi/v1.0/account/~/call-log` |
| Recording metadata | `GET /restapi/v1.0/account/~/recording/:recordingId` |
| **Recording content** | `GET /restapi/v1.0/account/{accountId}/recording/{recordingId}/content` (on `media.ringcentral.com`) |
| Create subscription | `POST /restapi/v1.0/subscription` |

**Pagination:** `page`, `perPage` (≤1000).

## 5.3 The "no recording-completion event" pattern

Subscribe to:
```
/restapi/v1.0/account/~/extension/~/telephony/sessions
```

When `parties[*].status.code = 'Disconnected'`, capture `telephonySessionId` and poll:
```
GET /restapi/v1.0/account/~/call-log?telephonySessionId=:id&view=Detailed&withRecording=true
```

Backoff schedule: 5s, 30s, 2min, 10min (recording typically appears in 30–90s). After 30 min without recording, mark `transcript_status='unavailable'`.

## 5.4 Webhook subscription mechanics

- Validation-Token echo back on creation
- TLS 1.2+
- Endpoint must respond within **3000ms**
- Body ≤ 1024 bytes
- Return HTTP 200
- Expiration: configurable; renew via `PUT` on subscription resource. Set renewal job at 80% of TTL.

## 5.5 Rate limits

| Group | Limit |
|-------|-------|
| Light | 50/min/user |
| Medium | 40/min/user |
| **Heavy** (recording endpoints) | **10/min/user** |
| Auth | 5/min/user |

Headers returned: `X-Rate-Limit-Group`, `X-Rate-Limit-Limit`, `X-Rate-Limit-Remaining`, `X-Rate-Limit-Window`. On 429, `Retry-After` header gives wait seconds — never retry inside the penalty window (resets clock).

**Request custom rate limit increase early** if customer base exceeds ~5 RC users.

## 5.6 Tier gating

- **Core (~$20/mo):** On-demand recording only — won't have full call history
- **Advanced (~$25/mo):** Automatic recording — required for production CallVault use
- **Ultra (~$35/mo):** Analytics
- **RingSense AI** (transcripts): separate add-on. Optional enrichment lane.

## 5.7 Media

`contentUri` is on `media.ringcentral.com` — **different domain** than `platform.ringcentral.com`. Auth via same Bearer token or `?access_token=` query param (only on media domain). Streaming bytes, no TTL. Stream to Supabase Storage.

## 5.8 `ConnectorRecord` mapping

```ts
const record: ConnectorRecord = {
  external_id: callLog.id,                    // call-log entry ID (stable)
  source_app: 'ringcentral',
  title: deriveTitle(callLog),
  full_transcript: ringSenseTranscript ?? null,
  transcript_status: ringSenseTranscript ? 'ready' : (ringSenseEnabled ? 'pending' : 'unavailable'),
  audio_url: null,                            // bytes streamed
  recording_start_time: callLog.startTime,
  duration: callLog.duration,
  recorded_by_email: callLog.from?.extensionEmail ?? null,
  participant_emails: [], // RC uses phone, not email
  source_metadata: {
    rc_call_log_id: callLog.id,
    rc_session_id: callLog.telephonySessionId,
    rc_recording_id: callLog.recording?.id,
    rc_recording_type: callLog.recording?.type,         // 'OnDemand' | 'Automatic'
    rc_from_phone: callLog.from?.phoneNumber,
    rc_to_phone: callLog.to?.phoneNumber,
    rc_direction: callLog.direction,                    // 'Inbound' | 'Outbound'
    rc_account_id: callLog.accountId,
    import_source: 'ringcentral-webhook+poll',
    synced_at: new Date().toISOString(),
  },
};
```

## 5.9 Edge Function file layout

```
supabase/functions/
  ringcentral-oauth-url/index.ts
  ringcentral-oauth-callback/index.ts
  ringcentral-oauth-refresh/index.ts
  ringcentral-create-subscription/index.ts          ← /telephony/sessions subscription
  ringcentral-renew-subscriptions/index.ts          ← scheduled at 80% TTL
  ringcentral-webhook/index.ts                      ← receives session events
  ringcentral-poll-recording/index.ts               ← invoked from webhook with backoff
  _shared/ringcentral-client.ts
```

## 5.10 Gotchas

1. **No recording-completion event** — poll pattern above is the only way.
2. **Sandbox dead Dec 31 2024** — dev against production with throwaway account.
3. **App in production cannot have scopes added** — must create new app to add scopes. Get scope list right on first build.
4. **`contentUri` on different domain** — DNS allowlist both.
5. **Heavy rate group** — 10/min/user means 1K-recording backfill takes 100 min per user.
6. **PKCE verifier char restriction** — no `+`, `/`, `=` in the random string.

---

# 6) MICROSOFT TEAMS (GRAPH API)

**Why sixth:** Highest implementation cost (admin consent dance + applicationAccessPolicy + two competing APIs + change-notification encryption), but enterprise-mandatory for any org running M365.

## 6.1 Authentication

**Flow:** OAuth 2.0 via Microsoft Identity Platform. Use **application permissions** (not delegated) for CallVault — daemon-style ingest.

| Step | Endpoint |
|------|----------|
| Authority | `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize` |
| Token | `POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token` |
| Graph base | `https://graph.microsoft.com/v1.0` |

**Tenant types:** `/organizations` (work/school only — required for recordings; personal MS accounts NOT supported).

**Required scopes (application permissions, all need admin consent):**
- `OnlineMeetingRecording.Read.All`
- `OnlineMeetingTranscript.Read.All`
- `OnlineMeetings.Read.All`
- `CallRecordings.Read.All` (ad hoc calls)
- `CallTranscripts.Read.All` (ad hoc calls)

**Critical prerequisite:** Tenant admin must run:
```powershell
New-CsApplicationAccessPolicy -Identity "CallVaultPolicy" -AppIds "<your-app-id>" -Description "CallVault recording ingest"
Grant-CsApplicationAccessPolicy -PolicyName "CallVaultPolicy" -Identity "user@tenant.com"
```

Without applicationAccessPolicy, even fully-consented app permissions return 403 on user-specific endpoints. **Document this in customer onboarding — it's the #1 friction point.**

## 6.2 Endpoints — USE A, NOT B

| API | Purpose | Use? |
|-----|---------|------|
| **A. `/users/{id}/onlineMeetings/{id}/recordings`** | MEDIA (MP4 + VTT) | **YES** |
| B. `/communications/callRecords` | Analytics only — no media | Only for PSTN analytics. NOT for CallVault. |

**Core paths:**
| Action | Method + Path |
|--------|---------------|
| List user's meetings | `GET /users/{userId}/onlineMeetings` |
| Recordings for meeting | `GET /users/{userId}/onlineMeetings/{id}/recordings` |
| Download MP4 | `GET /users/{userId}/onlineMeetings/{id}/recordings/{rid}/content` |
| Transcripts for meeting | `GET /users/{userId}/onlineMeetings/{id}/transcripts` |
| Download VTT | `GET /users/{userId}/onlineMeetings/{id}/transcripts/{tid}/content` |
| All recordings (delta) | `GET /users/{userId}/onlineMeetings/getAllRecordings` |
| Ad hoc calls | `GET /users/{userId}/adhocCalls/{cid}/recordings` |

`recordingContentUrl` in response is a Graph URL (not pre-signed SharePoint) — auth via Bearer.

## 6.3 Change notifications (webhooks)

**Subscribe via:** `POST /v1.0/subscriptions`

```json
{
  "changeType": "created",
  "notificationUrl": "https://app.callvaultai.com/api/teams-webhook",
  "lifecycleNotificationUrl": "https://app.callvaultai.com/api/teams-lifecycle",
  "resource": "communications/onlineMeetings/getAllRecordings",
  "expirationDateTime": "2026-05-20T00:00:00Z",
  "clientState": "callvault-secret-123",
  "includeResourceData": true,
  "encryptionCertificate": "<base64 public key>",
  "encryptionCertificateId": "callvault-cert-v1"
}
```

**Mandatory rules:**
- `changeType: "created"` only (recordings don't update)
- `lifecycleNotificationUrl` REQUIRED if `expirationDateTime > 1 hour`
- `includeResourceData: true` requires `encryptionCertificate` (RSA 2048+ public key, base64 DER)
- Validation token flow: respond 200 OK with `validationToken` query param echoed in body within **10 seconds**

**Resource paths:**
- `communications/onlineMeetings/getAllRecordings` — tenant-wide
- `communications/onlineMeetings/getAllTranscripts`
- `communications/adhocCalls/getAllRecordings`
- `users/{userId}/onlineMeetings/getAllRecordings` — per user

**Subscription max lifetime:** Varies by resource (~1h baseline, longer with lifecycle URL). Renew at 80% TTL via scheduled job.

## 6.4 Rate limits

| Surface | Limit |
|---------|-------|
| Per app across all tenants | 15,000 req / 20s |
| Per tenant across all apps | 10,000 req / 20s |
| **Per app per tenant** | **1,500 req / 20s** |
| Per single callRecord | 40 req / 20s |
| List call records | 40 req / 20s |
| PSTN per app per tenant | 200 req / 60s |

ResourceUnits per-tenant-size: S (<50u) 3,500 RU/10s, M (50–500u) 5,000, L (>500u) 8,000.

429 sometimes returns `Retry-After`, sometimes not — implement exponential backoff fallback.

## 6.5 License requirements (TENANT side, not your app)

- Basic Teams recording: any M365 Business Basic+ (NOT A1/F)
- Teams Premium ($10/user/mo add-on): advanced controls, intelligent recap
- Compliance Recording: requires E3/E5/A3/A5/G3/G5/Business Premium/Standard — DON'T offer this lane unless you become a certified compliance partner (long process)
- Graph API access: gated by tenant's licensing, not CallVault's app

## 6.6 Storage

Recordings physically in OneDrive (private meetings) or SharePoint (channel meetings). Graph API abstracts the backend — fetch via Graph regardless.

## 6.7 `ConnectorRecord` mapping

```ts
const record: ConnectorRecord = {
  external_id: recording.id,                          // recording UUID
  source_app: 'teams',
  title: meeting.subject,
  full_transcript: vttContent ? normalizeTranscript({ format: 'vtt', content: vttContent }) : null,
  transcript_status: vttContent ? 'ready' : 'pending',
  transcript_format: 'vtt',
  transcript_raw: vttContent,
  video_url: null,                                    // MP4 streamed to Storage
  audio_url: null,
  recording_start_time: recording.createdDateTime,
  recording_end_time: recording.endDateTime,
  duration: Math.floor((endMs - startMs) / 1000),
  recorded_by_email: meeting.organizer?.upn ?? null,
  recorded_by_name: meeting.organizer?.displayName ?? null,
  participant_emails: meeting.participants?.attendees
    ?.map((a: any) => a.identity?.user?.userPrincipalName?.toLowerCase())
    .filter(Boolean) ?? [],
  source_metadata: {
    teams_recording_id: recording.id,
    teams_meeting_id: meeting.id,
    teams_call_id: recording.callId,
    teams_tenant_id: tenantId,
    teams_organizer_aad_id: meeting.organizer?.id,
    teams_join_url: meeting.joinWebUrl,
    teams_content_correlation_id: recording.contentCorrelationId,
    import_source: 'teams-subscription',
    synced_at: new Date().toISOString(),
  },
};
```

## 6.8 Edge Function file layout

```
supabase/functions/
  teams-oauth-url/index.ts                       ← Microsoft auth + admin-consent guidance
  teams-oauth-callback/index.ts
  teams-create-subscription/index.ts             ← lifecycle + encryption cert
  teams-renew-subscriptions/index.ts             ← 80% TTL renewal
  teams-webhook/index.ts                         ← validation token + decrypt resourceData
  teams-lifecycle/index.ts                       ← reauth / removed events
  teams-fetch-recording/index.ts                 ← stream MP4 + VTT to Storage
  _shared/teams-client.ts
  _shared/teams-decrypt.ts                       ← RSA-decrypt encrypted resourceData
```

## 6.9 Gotchas

1. **`/onlineMeetings/{id}/recordings` returns NOTHING for non-calendar meetings.** Calendar-backed only.
2. **applicationAccessPolicy required** for app-only flows — without it 403 everywhere.
3. **Personal MS accounts not supported** — work/school only.
4. **Private channel meetings NOT supported** for change notifications.
5. **callRecord retention only 30 days** — back it up via subscription firehose.
6. **Encryption mandatory on `includeResourceData: true`** — RSA 2048+ cert pair, rotate yearly.
7. **Subscription lifetime <1h without lifecycle URL** — subscription creation FAILS if `expirationDateTime > 1h` and no lifecycle URL.
8. **`OnlineMeetingRecording.Read.Chat` (RSC) is DIFFERENT from `.All`** — RSC is for in-meeting Teams apps. Use `.All`.

---

# 7) PLAUD

**Why seventh:** Different access shape (consumer hardware → cloud), three viable paths. Use Zapier-first (sanctioned) + openplaud-fallback (power users).

## 7.1 PATH A — Zapier Webhook (recommended, ship first)

**User flow:**
1. User connects Plaud to Zapier (one click, OAuth at Zapier side).
2. User creates a Zap: Trigger `Plaud → Transcript & Summary Ready` → Action `Webhooks by Zapier → POST` → URL = `https://app.callvaultai.com/api/plaud-zapier-webhook`.
3. CallVault hosts a public webhook endpoint with HMAC signing.

**CallVault-side implementation:**
- Single Edge Function: `plaud-zapier-webhook/index.ts`
- Body parsed → fetch transcript + summary from Plaud's Zap payload → call `runPipeline()` with `source_app: 'plaud'`.
- Audio file: Plaud's Zap trigger doesn't include audio bytes directly — chain a second Zap step that downloads via Zapier "Files" or push us a URL we fetch.

**ConnectorRecord mapping (from Zap payload):**
```ts
const record: ConnectorRecord = {
  external_id: zap.plaud_recording_id,
  source_app: 'plaud',
  title: zap.title,
  full_transcript: zap.transcript_text,
  transcript_status: 'ready',
  transcript_format: 'plain',
  summary: zap.summary_markdown,
  audio_url: zap.audio_url ?? null,
  recording_start_time: zap.recorded_at,
  duration: zap.duration_seconds,
  participant_emails: [],
  source_metadata: {
    plaud_recording_id: zap.plaud_recording_id,
    plaud_device_id: zap.device_id ?? null,
    plaud_folder: zap.folder ?? null,
    plaud_tags: zap.tags ?? [],
    plaud_region: zap.region ?? 'us',
    plaud_zapier_zap_id: zap.zap_id,
    import_source: 'plaud-zapier',
    synced_at: new Date().toISOString(),
  },
};
```

**Effort:** ~2 dev-days.

**Tradeoffs:** User needs Zapier ($20/mo). Audio file requires an extra Zap step.

## 7.2 PATH B — openplaud-style direct API (power users)

**Auth flow:** Email OTP → JWT bearer.

| Step | Endpoint |
|------|----------|
| 1. Request OTP | `POST https://api.plaud.ai/auth/send_code` body `{ "email": "..." }` |
| 2. Verify OTP | `POST https://api.plaud.ai/auth/verify_code` body `{ "email": "...", "code": "123456" }` → returns JWT |
| 3. Refresh | Auto-refresh at 30 days from expiry (300d lifetime) |

**Critical limitation:** users who signed into Plaud with Google/Apple OAuth have a DIFFERENT identity on Plaud's side. OTP flow looks successful but recording list returns empty. **Fallback:** "paste your token from web.plaud.ai DevTools" flow with a GIF walkthrough.

**Endpoints (US — `api.plaud.ai`, EU — `api-euc1.plaud.ai`, APAC — `api-apse1.plaud.ai`):**

| Action | Method + Path |
|--------|---------------|
| List recordings | `GET /api/recordings?page=N&limit=50` |
| Get recording | `GET /api/recordings/:id` |
| Get transcript | `GET /api/recordings/:id/transcript` |
| Get summary | `GET /api/recordings/:id/summary` |
| Audio download | Signed S3 URL from `resource.plaud.ai` (TTL ~ short, refetch on 403) |
| Tags | `GET /api/tags` |
| Speakers | `GET /api/speakers` |

**Mandatory headers:**
- `Authorization: Bearer <jwt>`
- `User-Agent: Mozilla/5.0 ...` (browser-grade — Cloudflare bot challenge otherwise)
- `Accept-Language: en-US,en;q=0.9`

**Rate limit:** Self-impose 10 req/min/user (openplaud default).

**Library:** Fork `openplaud/openplaud` (AGPL-3.0 — requires source disclosure on the connector module) OR port `arbuzmell/plaud-api` (MIT, Python) endpoint list to TypeScript yourself. Latter is cleaner license for closed CallVault stack.

**Token storage:** `import_sources.oauth_access_token` (encrypted via `pgp_sym_encrypt`), `oauth_refresh_token` = NULL (Plaud doesn't issue refresh tokens — re-OTP on expiry), `oauth_token_expires` = JWT exp.

**ConnectorRecord mapping:**
```ts
const record: ConnectorRecord = {
  external_id: plaud.id,
  source_app: 'plaud',
  title: plaud.title || plaud.metadata?.title || `Plaud recording ${plaud.id}`,
  full_transcript: normalizeTranscript({ format: 'json', segments: plaud.transcript.segments }),
  transcript_status: plaud.transcript ? 'ready' : 'pending',
  transcript_format: 'json',
  transcript_raw: JSON.stringify(plaud.transcript),
  summary: plaud.summary?.markdown ?? null,
  audio_url: null,                              // bytes fetched + streamed to Storage
  recording_start_time: plaud.recorded_at,
  duration: plaud.duration_seconds,
  participant_emails: [],
  source_metadata: {
    plaud_recording_id: plaud.id,
    plaud_device_id: plaud.device_id,
    plaud_folder: plaud.folder,
    plaud_tags: plaud.tags,
    plaud_region: 'us',
    plaud_action_items: plaud.action_items ?? null,
    plaud_mind_map: null, // not in reverse-engineered API
    import_source: 'plaud-direct',
    synced_at: new Date().toISOString(),
  },
};
```

**Edge Function file layout (Path B):**
```
supabase/functions/
  plaud-otp-send/index.ts
  plaud-otp-verify/index.ts                         ← stores JWT
  plaud-sync-recordings/index.ts                    ← poll every 5 min
  plaud-fetch-media/index.ts                        ← stream audio to Storage
  plaud-zapier-webhook/index.ts                     ← Path A
  _shared/plaud-client.ts                           ← UA + region routing + retry
```

**Effort:** ~3 additional dev-days on top of Path A.

## 7.3 Gotchas (both paths)

1. **Cloudflare bot challenge on all `api*.plaud.ai`** — set realistic browser User-Agent.
2. **Google/Apple Plaud users blocked from OTP flow** — provide DevTools token-paste fallback.
3. **Region-specific base URLs** — store `plaud_region` per user, route accordingly.
4. **ToS is permissive** but Plaud can change at any time — implement gracefully on 401/403 with reauth prompt.
5. **"Sync to cloud while charging" must be enabled on device** — surface this in onboarding.
6. **No webhook from Plaud directly** — Zapier is the only sanctioned push mechanism today.

## 7.4 Build sequence

1. Ship Path A (Zapier webhook) — 2 days, zero credentials stored.
2. Add Path B (direct OTP + sync) — 3 more days for power users.
3. Monitor support tickets for OAuth (Google/Apple) Plaud users — they need DevTools token-paste UX.

---

# 8) MOJO DIALER

**Why eighth:** No API exists. Build a manual-import flow. Don't waste dev time reverse-engineering — there's nothing exposed.

## 8.1 Verdict

| Question | Answer |
|----------|--------|
| Public API? | NO |
| OAuth/key? | NO |
| Webhooks? | NO |
| Zapier official? | NO (community connectors, no recording trigger) |
| Recording retention | 90 days |
| Path forward | **CSV + MP3 folder uploader** |

## 8.2 User flow

1. User goes to Mojo: `Reports → Call Recording → Select dates → Download (multiple selected MP3s as ZIP) AND Export CSV`.
2. User drags ZIP + CSV into CallVault's **Mojo Importer**.
3. CallVault parses CSV → matches MP3 filenames to rows → ingests each.

## 8.3 CSV column inventory (needs live verification — [LOW])

Expected fields (from Mojo support docs and KB references):
- Call timestamp (date + time)
- Phone number from
- Phone number to
- Agent ID / name
- Disposition (Contact / DNC Contact / DNC Number / No Answer / etc.)
- Duration (seconds)
- Result code
- Contact name (best effort)
- Lead group / list

**Action item BEFORE building:** Get a Mojo test account, export real CSV + MP3 batch, document exact column names and MP3 filename convention. Bake that schema into a Zod validator.

## 8.4 MP3 filename matching

Mojo's filename pattern appears to be: `{timestamp}_{phone}_{agent}.mp3` (needs empirical verification). Match by:
1. Parse filename → extract `{timestamp}` and `{phone}`
2. Find CSV row with same `timestamp ± 10s` AND same phone number
3. If multi-match, prefer the row with matching agent ID

## 8.5 `ConnectorRecord` mapping

```ts
const record: ConnectorRecord = {
  external_id: deriveMojoExternalId(csvRow),   // SHA1(`mojo:${timestamp}:${from}:${to}:${agent}`)
  source_app: 'mojo',
  title: `${csvRow.agent} → ${csvRow.contact_name || csvRow.to_phone}`,
  full_transcript: null,                        // CallVault transcribes
  transcript_status: 'pending',
  transcript_format: 'plain',
  audio_url: null,                              // bytes uploaded
  recording_start_time: parseTimestamp(csvRow.timestamp),
  duration: parseInt(csvRow.duration_seconds),
  recorded_by_email: agentEmailLookup(csvRow.agent),
  recorded_by_name: csvRow.agent,
  participant_emails: [],
  source_metadata: {
    mojo_phone_from: csvRow.from_phone,
    mojo_phone_to: csvRow.to_phone,
    mojo_agent_id: csvRow.agent_id,
    mojo_disposition: csvRow.disposition,
    mojo_result_code: csvRow.result_code,
    mojo_contact_name: csvRow.contact_name,
    mojo_lead_group: csvRow.lead_group,
    mojo_csv_filename: uploadedCsvName,
    mojo_audio_filename: matchedMp3Filename,
    import_source: 'mojo-csv-upload',
    synced_at: new Date().toISOString(),
  },
};
```

## 8.6 Edge Function + UI

**Backend:**
```
supabase/functions/
  mojo-csv-upload/index.ts                  ← receives multipart form (CSV + ZIP), parses, queues per-call ingest
  mojo-process-row/index.ts                 ← per-row worker: store MP3 to Storage, queue transcription, runPipeline()
```

**Frontend:**
- New tab on Import Hub: "Mojo Dialer"
- Drag-drop zone for CSV
- Drag-drop zone for ZIP / multi-MP3
- After upload: show parsed rows with match status
- "Import N calls" button → kicks off background processing

## 8.7 Effort: 3 dev-days

Half a day each for: CSV parser, ZIP/MP3 ingestor + Storage upload, matching logic, error UI, transcription queue, integration test with real Mojo export.

---

# CROSS-PLATFORM SUMMARY

## Auth model cheat sheet

| Platform | Auth | Token TTL | Refresh |
|----------|------|-----------|---------|
| Grain | OAuth2 + PKCE | 1h access, long refresh | Auto |
| Fireflies | API key (Bearer) | Permanent | N/A — rotate manually |
| GHL | OAuth2 (Marketplace) | 24h / 1yr | At 22h |
| tl;dv | API key (`x-api-key`) | Permanent | N/A |
| RingCentral | OAuth2 + PKCE | 3600s / 7d | Auto |
| Teams | OAuth2 (Graph, app) | 1h / 90d | Auto |
| Plaud (Zapier) | None on CallVault side | N/A | N/A |
| Plaud (Direct) | OTP → JWT | 300d / no refresh | Re-OTP |
| Mojo | None | N/A | N/A |

## Sync model cheat sheet

| Platform | Real-time | Backfill | Best practice |
|----------|-----------|----------|----------------|
| Grain | Webhook (signing unconfirmed) | Cursor poll | Webhook + nightly cursor sweep |
| Fireflies | Webhook (HMAC `x-hub-signature`) | Offset poll | Webhook + 6h reconcile |
| GHL | Webhook (Ed25519) | Cursor poll | Webhook + recording-poll loop |
| tl;dv | Webhook (signing unconfirmed) | Page poll | Webhook + 6h reconcile |
| RingCentral | Subscription (telephony) → poll | Date-windowed call-log fetch | Subscription + poll-on-disconnect |
| Teams | Graph subscription (encrypted) | `getAllRecordings` delta | Subscription + 80% TTL renewal |
| Plaud (Zapier) | Zap fires | Manual export fallback | Zapier-first |
| Plaud (Direct) | Poll only | Page poll | 5-min poll |
| Mojo | N/A | Manual CSV+ZIP upload | UI uploader |
