# Vendor Matrix

Status: Phase 0 research matrix

This matrix compares the next likely recording-source vendors against the **current CallVault connector contract**.

## Comparison fields

- **Transcript access:** Can we fetch speaker-by-speaker transcript text directly?
- **Trigger model:** Webhook on new recording vs poll/list-only.
- **Auth model:** OAuth2, API key, PAT, or enterprise gating.
- **Rate limit:** Published rate limit if available.
- **Fixture/dev tier:** Can we test with a free/low-cost account?

## Summary table

| Vendor | Transcript access | Trigger model | Auth model | Published rate limit | Cheapest realistic dev tier | Notes |
|---|---|---|---|---|---|---|
| Fathom | Yes (existing integration) | Webhook + pull | OAuth / API key in existing code | Existing codebase behavior | Existing | Baseline source today |
| Fireflies | Yes, rich transcript via GraphQL `transcript` / `transcripts` | Webhooks V2 (`meeting.transcribed`, `meeting.summarized`) + poll | API key (Bearer) | Free/Pro: 50 req/day; Business/Enterprise: 60 req/min | Free for light test, Business for real backfill | Strong fit for current contract |
| Grain | Yes, dedicated transcript endpoint in JSON/VTT/SRT/TXT | Hooks (`recording_added`, `recording_updated`, `upload_status`) + list/poll | PAT, workspace token, or OAuth2 | 300 req/min | Starter is first tier with API access | Strong fit; most complete public API after Fireflies |
| Otter | Public pricing says API + webhooks are Enterprise features; public recording/transcript API docs not discoverable | Unknown / likely enterprise-only | Enterprise API & webhooks per pricing page | No public developer rate docs found | Enterprise only | Highest uncertainty / likely worst self-serve fit |
| Riverside | Transcript file download exists; list recordings exists; transcript is file-oriented, not rich JSON turns | Poll/list documented; no public webhook docs found in current docs index | API key for select Business accounts | Recordings list: once every 10s per unique request; transcription download: once per second | Free product exists, but Business API access is gated to select Business accounts | Feasible but requires transcript normalization from file |

## Evidence and notes by vendor

## Fireflies

### Official sources

- Transcripts list query: `https://docs.fireflies.ai/graphql-api/query/transcripts`
- Single transcript query: `https://docs.fireflies.ai/graphql-api/query/transcript`
- Webhooks V2: `https://docs.fireflies.ai/graphql-api/webhooks-v2`
- Limits: `https://docs.fireflies.ai/fundamentals/limits`

### What the API gives us

Fireflies exposes:

- transcript id
- title
- date/dateString
- duration
- transcript URL, audio URL, video URL
- host/organizer email
- meeting attendees
- `sentences[]` with speaker name, text, start/end times
- summary subfields including action items and topics

### Contract fit

Fireflies is a **direct match** for the current CallVault connector shape.

It can supply:

- `title`
- `full_transcript`
- `recording_start_time`
- `duration`
- optional `recording_end_time`
- source/share/media URLs
- participant and recorder metadata
- optional source summary/action items

### Risk

The main risk is **plan gating**, not data shape. Free/Pro plans are limited to **50 API requests/day**, which is enough for fixture work but not reliable backfill.

## Grain

### Official sources

- API docs root: `https://developers.grain.com/`
- Pricing/help article: `https://support.grain.com/en/articles/9253220-which-grain-plan-is-right-for-me`

### What the API gives us

Grain v2 exposes:

- list recordings
- get recording
- transcript in JSON (`participant_id`, `speaker`, `start`, `end`, `text`)
- transcript in TXT/VTT/SRT
- recording download
- hooks for `recording_added`, `recording_updated`, `recording_deleted`, `upload_status`
- participants with names/emails
- `start_datetime`, `end_datetime`, `duration_ms`, and share `url`

### Contract fit

Grain is also a **strong fit**.

Compared to Fireflies:

- auth is more flexible (PAT, workspace token, OAuth2)
- transcript shape is simpler but still fully usable
- hooks are explicit and API-driven
- published rate limit is generous (**300 req/min**)

### Risk

API access starts at **Starter** per official help. Free is good for recordings, but not for API-driven connector work.

## Otter

### Official sources

- Pricing: `https://otter.ai/pricing`
- Product/dev landing: `https://dev.otter.ai/`

### What is publicly confirmed

The pricing page explicitly lists **“Otter API & Webhooks”** only on **Enterprise**.

The public `dev.otter.ai` site currently behaves like a product/marketing site. In this audit, it did **not** expose a public recording/transcript API reference comparable to Fireflies, Grain, or Riverside.

### Contract fit

This is the **least certain** vendor in the current batch.

What we can say from current evidence:

- Otter clearly has transcript product functionality.
- Otter clearly sells API/webhook access.
- Public self-serve API docs for recording/transcript ingestion were not found during this audit.

### Risk

High. Otter may require enterprise sales access before we can even validate the connector surface.

## Riverside

### Official sources

- Intro / auth: `https://docs.riverside.fm/quickstart`
- List recordings: `https://docs.riverside.fm/endpoints-reference/list-all-recordings`
- Download transcription file: `https://docs.riverside.fm/endpoints-reference/v3/download-transcription-file`
- Pricing: `https://riverside.com/pricing`

### What the API gives us

Riverside documents:

- recording list with `recording_id`, `name`, `created_date`, `tracks`, and downloadable files
- transcription file download endpoint (`txt`, `srt`, etc.)
- API key auth for select Business accounts

### Contract fit

Riverside is **feasible**, but not as direct a fit as Fireflies or Grain.

Why:

- transcript access appears file-based, not sentence-object-based
- docs expose media/tracks strongly
- we likely need a format normalizer step (`txt`/`srt` → `full_transcript`)
- public webhook docs were not found in the current docs index, so poll-first is the safer assumption

### Risk

Two constraints:

1. **Business API access is gated** (“select Business accounts only”).
2. Transcript is likely good enough, but less ergonomic than Fireflies/Grain.

## Practical ranking for connector rollout

### Best next sources for the existing codebase

1. **Fireflies** — best balance of transcript richness + webhook support + simple auth
2. **Grain** — strongest API ergonomics overall, but API access starts above free
3. **Riverside** — viable with a transcript-format normalization layer
4. **Otter** — hold until API surface is confirmed with real enterprise docs/access

## What this means for CallVault

If the goal is "hours, not weeks" for the *next* few vendors, Fireflies and Grain are the best truth-tests for the contract.

If those two can share the same normalized connector path, the contract is probably good enough.

If Riverside forces a different transcript normalization path, that belongs in a shared transcript-normalizer layer — not in per-vendor downstream UI logic.
