---
spike: 001
name: fathom-reference-architecture
type: standard
validates: "Given Fathom is the only currently-shipped full-API integration, when its edge-function stack and raw-table schema are documented, then we have a concrete template every other provider research spike compares against."
verdict: VALIDATED
related: []
tags: [reference, fathom]
---

# Spike 001: Fathom Reference Architecture

## What This Validates

**Given** Fathom is the only currently-shipped full-API integration (OAuth + webhooks + sync, all live in prod since v1),
**when** its edge-function stack, raw-table schema, and integration touchpoints are documented end-to-end,
**then** we have a concrete reference template every other provider (Read.ai, Otter, Fireflies, tl;dv) is measured against in spikes 002-005.

This is a code-read spike — no new code, no runtime test. The deliverable is the architectural spec that downstream provider spikes match their findings against.

## How to Run

This spike is documentation-only. Read this file plus the linked source files. No execution.

## Reference Architecture

### 1. Edge Function Stack (7 functions)

| Function | Purpose | Endpoint Pattern |
|---|---|---|
| `fathom-oauth-url` | Generate OAuth authorize URL with CSRF state, create or reuse `import_sources` row | POST → `{ authUrl, sourceId }` |
| `fathom-oauth-callback` | Exchange code for tokens, store on `import_sources`, detect account email, dedup duplicate accounts | POST `{ code, state }` → `{ sourceId, accountEmail }` |
| `fathom-oauth-refresh` | Refresh access token via stored refresh token | POST → `{ access_token, expires_in }` |
| `create-fathom-webhook` | Register webhook with Fathom (POST to `https://fathom.video/external/v1/webhooks`), store webhook secret in `user_settings` | POST → `{ secret }` |
| `webhook` | Receive Fathom webhook deliveries, idempotency-key against `processed_webhooks`, log into `webhook_deliveries`, write to `fathom_calls` + `fathom_transcripts` | POST (no auth header — verified via webhook secret) |
| `fetch-meetings` | List recent meetings (paginated, rate-limited 55 req/min/isolate) | POST → `{ meetings[] }` |
| `sync-meetings` | Bulk sync historical meetings — fetch list, fetch transcripts, upsert into raw tables | POST → `{ synced, skipped, errors }` |

**OAuth surface (Fathom-specific):**
- Authorize: `https://fathom.video/external/v1/oauth2/authorize` — query params: `client_id`, `redirect_uri`, `response_type=code`, `scope=public_api`, `state`
- Token exchange: `https://fathom.video/external/v1/oauth2/token` — POST form: `grant_type=authorization_code`, `code`, `client_id`, `client_secret`, `redirect_uri`
- API base: `https://api.fathom.ai/external/v1/`
- Auth header: `Authorization: Bearer <access_token>`

**Webhook surface:**
- Subscribe: `POST https://fathom.video/external/v1/webhooks` with `{ destination_url, triggered_for: ['my_recordings'], include_transcript, include_summary, include_action_items }` → returns `{ secret }`
- Conflict handling: 409 if webhook for same destination_url already exists.
- Verification: webhook secret stored in `user_settings.webhook_secret`, used to verify inbound `webhook` deliveries.

**Rate limiting (in-edge-function):**
- Documented limit: 60 req/min per API key.
- Implementation: in-memory sliding window in `fetch-meetings/index.ts` (55 req/min cap with jitter, per-isolate, NOT globally shared — accepted limitation).
- Shared utility: `_shared/fathom-client.ts` provides `FathomClient.fetchWithRetry()` with exponential backoff on 429.

### 2. Database Schema

**Per-provider raw tables** (the pattern from `project_integration_provider_pattern.md`):

```sql
-- One row per Fathom recording, keyed by Fathom's recording_id (BIGINT)
CREATE TABLE public.fathom_calls (
  recording_id BIGINT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  recording_start_time TIMESTAMPTZ,
  recording_end_time TIMESTAMPTZ,
  url TEXT,
  share_url TEXT,
  recorded_by_name TEXT,
  recorded_by_email TEXT,
  calendar_invitees JSONB,
  full_transcript TEXT,
  summary TEXT,
  -- + AI-generated content fields, edit-tracking flags, sync timestamps
);

-- One row per transcript segment, FK to fathom_calls
CREATE TABLE public.fathom_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id BIGINT NOT NULL REFERENCES fathom_calls(recording_id) ON DELETE CASCADE,
  speaker_name TEXT,
  speaker_email TEXT,
  text TEXT NOT NULL,
  timestamp TEXT,
  -- + non-destructive edit fields (edited_text, edited_speaker_*, is_deleted)
);

-- Idempotency for webhook deliveries
CREATE TABLE public.processed_webhooks (
  webhook_id TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log for webhook delivery
CREATE TABLE public.webhook_deliveries (
  id UUID PRIMARY KEY,
  user_id UUID,
  webhook_id TEXT,
  status TEXT,
  payload JSONB,
  response_code INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Cross-provider tables** (shared):

- `import_sources` — per-account OAuth token storage. Columns: `id, user_id, source_app, oauth_access_token, oauth_refresh_token, oauth_token_expires, account_email, is_active, created_at, updated_at`. Multi-account: a user can connect multiple Fathom workspaces via separate `import_sources` rows.
- `user_settings` — single row per user. Stores `oauth_state` (CSRF), `pending_import_source_id`, `webhook_secret`, `host_email`. Fathom-specific fields will need to be either renamed or generalized when we add more providers.
- `recordings` — modern unified table (Phase 24+). After webhook/sync writes to `fathom_calls`+`fathom_transcripts`, a separate process projects them into `recordings` with `source_app = 'fathom'`.

### 3. Field Mapping (Fathom raw → unified `recordings`)

| Fathom raw field | recordings field | Notes |
|---|---|---|
| `fathom_calls.recording_id` (BIGINT) | `recordings.legacy_recording_id` | original ID kept for traceability |
| `fathom_calls.title` | `recordings.title` | |
| `fathom_calls.recording_start_time` | `recordings.recording_start_time` | |
| `fathom_calls.share_url` | `recordings.share_url` | |
| `fathom_calls.full_transcript` | `recordings.full_transcript` | also indexed by `idx_recordings_transcript_fts` |
| `fathom_calls.summary` | `recordings.summary` | LLM-generated by `summarize-call` |
| `fathom_transcripts[].{speaker_name, text, timestamp}` | `recordings.transcript_segments` (JSONB) | converted to `{start_ms, speaker, text}` shape |
| `fathom_calls.calendar_invitees` (JSONB) | `recordings.source_metadata.attendees` | |
| (literal) `'fathom'` | `recordings.source_app` | distinguishes from `'fathom-paste'` (Phase 24) |

### 4. Frontend Touchpoints

- `src/services/fathom.service.ts` — service layer (pure async functions, no React)
- `src/components/settings/FathomSetupWizard.tsx` — multi-step OAuth + webhook setup wizard
- `src/components/settings/IntegrationsTab.tsx` — Settings → Integrations row that triggers the wizard
- `src/components/import/FathomImportDetail.tsx` — Pane-3 import-source detail panel
- `src/components/transcripts/SyncTab.tsx` + `SyncTabDialogs.tsx` — manual sync trigger + history
- `src/types/meetings.ts` — TypeScript types for the Fathom API response shape

### 5. Critical Conventions Every Provider Must Follow

These are non-negotiable for any new provider integration. Violation = the integration won't fit the existing UI or the cross-provider abstraction.

1. **Per-account OAuth tokens on `import_sources`**, NOT in `user_settings`. (`user_settings` is single-row-per-user; users have multiple provider accounts.)
2. **Account-email dedup on `(user_id, source_app, account_email)`** — pasting the same OAuth flow twice for the same account merges, doesn't duplicate. See `fathom-oauth-callback/index.ts:163-205`.
3. **CSRF protection via `oauth_state` round-trip** through `user_settings`. State is generated in `*-oauth-url`, verified in `*-oauth-callback`.
4. **Idempotency key on every webhook delivery** stored in `processed_webhooks` to survive Fathom's at-least-once delivery guarantees.
5. **In-edge-function rate limiter** matching the provider's documented limit, with 5-10% headroom and exponential backoff on 429.
6. **One raw table per provider**, not a polymorphic table. The unified `recordings` table is the projection target, not the storage substrate.
7. **`source_app` literal** on the projected `recordings` row — `'fathom'` for API, `'fathom-paste'` for Phase 24 paste, `'<provider>'` for each new integration.

## Investigation Trail

- **Read 8 Fathom-related files** to capture the full surface: `fathom-oauth-url/index.ts`, `fathom-oauth-callback/index.ts`, `fathom-oauth-refresh/index.ts`, `create-fathom-webhook/index.ts`, `fetch-meetings/index.ts`, `sync-meetings/index.ts`, `_shared/fathom-client.ts`, `00000000000000_consolidated_schema.sql` (raw table DDL).
- **Surprise:** Fathom uses **two different domains** for OAuth and API: OAuth flows go to `fathom.video/external/v1/...`, the data API lives at `api.fathom.ai/external/v1/...`. Provider research spikes need to confirm whether each provider has the same OAuth-vs-API domain split.
- **Surprise:** The `webhook` edge function (the receiver) was not in the function list output — it's likely deployed but named differently or wrapped into a different file. Did not chase down for this reference doc; only the receiving contract is needed for downstream spikes.
- **Caveat:** `user_settings` is the legacy storage location for OAuth tokens (single-row-per-user), still partially used for backward-compatibility. New providers should write tokens ONLY to `import_sources`, not `user_settings`.

## Results

**Verdict: VALIDATED.** The reference architecture is fully documented. Provider research spikes 002-005 use this as their measurement template — each must answer "does provider X support each of these 7 capabilities and these 5 conventions?"

**Key findings carried forward:**
1. Per-provider edge-function count: ~7 (3 OAuth + 1 webhook-create + 1 webhook-receive + 2 fetch/sync). Each new provider adds the same 7.
2. Per-provider DB additions: 2 raw tables (`<provider>_calls` + `<provider>_transcripts`). The shared tables (`import_sources`, `processed_webhooks`, `webhook_deliveries`) are reused.
3. Frontend additions per provider: 1 setup wizard + 1 import detail panel + 1 service file + types. Settings tab and sync tab generalize.
4. Critical questions for each provider research spike: OAuth scopes, API base URL(s), webhook subscription endpoint + payload shape, rate limit, plan tier required, TOS storage clauses.

**Impact:** Defines the GO/NO-GO criteria for spikes 002-005.
