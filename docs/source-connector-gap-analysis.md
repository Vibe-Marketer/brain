# Source Connector Gap Analysis

Status: Phase 0

This document captures the gap between the **current codebase contract** and the **target contract** needed to make new recording-source vendors take hours instead of weeks.

## Executive summary

CallVault already has the beginnings of a shared connector model, but it is not yet the final abstraction.

What exists today:

- one shared insert path (`connector-pipeline.ts`)
- one shared storage target (`recordings`)
- one shared UI mapping layer (`mapRecordingToMeeting()`)
- shared downstream AI consumers (`summarize-call`, `generate-ai-titles`, `auto-tag-calls`, MCP)

What is still fragmented:

- connector-required fields are not explicitly documented in-repo
- media URLs are schema-level fields but not part of the shared connector pipeline
- downstream parity depends on specific `source_metadata` keys that are implicit, not declared
- source onboarding UI is still hardcoded per source in places

## The target contract

The desired steady-state is:

```ts
interface SourceConnector {
  sourceApp: string;
  listRecordings?(window: DateWindow): Promise<SourceRecordingStub[]>;
  getRecording(id: string): Promise<CanonicalSourceConnectorRecord>;
  verifyWebhook?(request: Request): Promise<VerifiedSourceEvent | null>;
}
```

Where `CanonicalSourceConnectorRecord` is the single format every vendor emits.

## Current gaps

## Gap 1 — The hard insert contract is still hidden inside `connector-pipeline.ts`

**Problem:** A new connector author still has to reverse-engineer which fields are truly mandatory.

**Why it slows future vendors:** Every connector starts with archaeology.

**Phase 1 fix:** Make `docs/source-connector-spec.md` the source-of-truth contract and keep a matching shared TypeScript type next to the pipeline.

## Gap 2 — Media URLs are in schema, but not in the shared connector abstraction

**Current state:**

- `recordings` schema has `audio_url` and `video_url`
- `connector-pipeline.ts` does not accept or write either field
- connectors instead stuff source/share/media links into `source_metadata`

**Impact:** The product cannot honestly claim a single canonical media contract yet.

**Phase 1 fix:** Extend the shared connector record + insert path to support:

- `audio_url?: string | null`
- `video_url?: string | null`

Then update `mapRecordingToMeeting()` to prefer first-class columns before metadata fallbacks.

## Gap 3 — Downstream parity still depends on implicit `source_metadata` conventions

Today, Fathom-like behavior depends on metadata keys such as:

- `share_url`
- `recorded_by_name`
- `recorded_by_email`
- `calendar_invitees`
- `participant_emails`
- optionally `action_items`

These are real requirements, but they are not centrally declared.

**Phase 1 fix:** Treat these as the explicit **parity contract** in shared types and tests.

## Gap 4 — Summary ownership is ambiguous

Today:

- source summaries are accepted and cached if present
- `summarize-call` generates one if absent
- downstream tools happily read either form

**Impact:** New connector authors do not know whether they should map source summaries or discard them.

**Phase 1 fix:** Decide one of these and document it clearly:

1. **Accept source summaries** (current behavior), or
2. **System-owned summaries only** (future stricter behavior)

Until that decision is made, connectors should treat source summary as **optional and safe to persist**.

## Gap 5 — We are mixing up **source acquisition** with **canonical ingestion**

The deepest mismatch is not just "some UI is hardcoded." It is that the codebase does not yet separate:

1. **Source acquisition** — how CallVault discovers recordings from a vendor
2. **Canonical ingestion** — how one discovered recording becomes a normalized `recordings` row

Those are different contracts.

### What the wrong shape looks like

A Fireflies screen that asks the operator to paste transcript IDs and import them manually is **not** the target architecture.

Why it is wrong:

- it assumes the user already knows vendor record IDs
- it bypasses the real connector problem of listing/discovering new recordings
- it proves only "we can ingest a known ID", not "we have a recording source integration"
- it does not generalize to the normal user flow for Fireflies, Grain, Otter, or Riverside

### What the right shape looks like

A recording-source vendor should integrate at the **acquisition** layer first:

```ts
interface SourceAcquisitionAdapter {
  sourceApp: string;
  listRecordings(window: DateWindow, account: ConnectedSource): Promise<SourceRecordingStub[]>;
  getRecording(id: string, account: ConnectedSource): Promise<CanonicalSourceConnectorRecord>;
  verifyWebhook?(request: Request): Promise<VerifiedSourceEvent | null>;
}
```

And only then feed canonical ingestion.

The user flow should be:

1. connect source account / provide credentials
2. backfill historical recordings in bulk from the provider
3. keep ingesting future provider recordings automatically (webhook, poller, or both)
4. optionally choose one or many recordings from fetched provider inventory
5. normalize each fetched recording into canonical shape
6. insert through the shared pipeline

### Current codebase evidence

Today the import/onboarding layer is still source-specific:

- `ImportPage.tsx` switches explicitly on source IDs
- `useIntegrationSync.ts` hardcodes supported platforms
- `AddImportSourceDialog.tsx` and `ImportSourcePane.tsx` are static lists

So the real missing abstraction is not just a better `CanonicalSourceConnectorRecord`. It is a **source acquisition registry**.

### Reference model: how Fathom already works

The connector pattern we should replicate is the existing Fathom/Zoom shape:

- **Connection state** — account credentials are stored once and reused
- **Search/list step** — user can fetch provider-native recording inventory for a date window (`fetch-meetings` / `zoom-fetch-meetings`)
- **Bulk selection** — user selects many recordings, not one transcript ID
- **Bulk import** — selected IDs are handed to `sync-meetings` / `zoom-sync-meetings`
- **Future ingestion** — provider webhooks and/or repeatable fetch jobs keep new recordings flowing in
- **Canonical insertion** — each fetched recording goes through the shared insert path into `recordings`

For Fathom specifically, the working pattern is:

1. connect account
2. search recordings by date range
3. select many recordings
4. import them into a chosen workspace
5. remain connected so future recordings can continue to arrive through the same account context

That is the baseline Fireflies should match. The target is **not** “paste transcript IDs into a textarea.”

### Fathom reference endpoints and phases

The current Fathom connector already spans the whole lifecycle:

- **Connect account**
  - `fathom-oauth-url`
  - `fathom-oauth-callback`
- **Search/list source recordings**
  - `fetch-meetings`
- **Bulk import selected recordings**
  - `sync-meetings`
- **Stay connected / future ingestion**
  - `create-fathom-webhook`
  - `webhook`
  - `fathom-oauth-refresh` when tokens expire

That is the model to copy:

```ts
connectAccount() -> searchSourceRecordings() -> importSelectedRecordings() -> keepReceivingFutureRecordings()
```

So Fireflies should not ship as a one-off import utility. It should ship as the same four-phase connector lifecycle with Fireflies-specific acquisition underneath and the same canonical insertion underneath that.

### Credential-surface mismatch

The current persistence model is still biased toward older source implementations:

- `import_sources` has generic OAuth token columns
- but also a Fathom-specific `fathom_api_key`
- `user_settings` still carries Fathom-specific `webhook_secret`
- there is no generic place for a source-level signing secret or API-key auth bundle

That means the data model still thinks in terms of "special source fields" instead of "connected source account."

What we actually need is something like:

```ts
interface ConnectedSourceAccount {
  id: string;
  userId: string;
  sourceApp: string;
  accountLabel: string | null;
  authMode: 'oauth' | 'api-key';
  isActive: boolean;
  lastSyncAt: string | null;
  errorMessage: string | null;

  // encrypted provider credentials
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiresAt?: number | null;
  apiKey?: string | null;
  signingSecret?: string | null;
}
```

Fireflies then becomes a normal account-level connector:

- **connect account**: validate API key against Fireflies API, store encrypted API key, optionally store webhook signing secret
- **search/list**: query Fireflies transcripts by date range using stored API key
- **bulk import**: selected transcript IDs are imported from fetched inventory, not typed by hand
- **future ingestion**: verify `X-Hub-Signature` and ingest `meeting.transcribed` / `meeting.summarized` events, or fall back to scheduled polling if webhooks are unavailable

That keeps Fireflies different only in **auth mode**, not in lifecycle.
**Phase 1 fix:** introduce a registry that defines both acquisition and ingestion entrypoints per vendor.

## Proposed registry for Phase 1

## Gap 6 — Transcript normalization is still connector-local

Fireflies and Grain can emit turn objects; Riverside may force file-format normalization; other vendors may vary.

**Impact:** Each connector risks re-implementing transcript formatting rules.

**Phase 1 fix:** move turn/text normalization into a shared `transcript-normalizer` helper.

That helper should own:

- turn sorting
- timestamp formatting
- speaker-name fallback rules
- SRT/VTT/TXT conversion where needed
- final `full_transcript` formatting

## Gap 7 — Vendor viability is uneven

From the current matrix:

- **Fireflies:** strong fit
- **Grain:** strong fit
- **Riverside:** needs transcript-file normalization
- **Otter:** API access/doc visibility remains uncertain

**Impact:** one abstraction may still need multiple acquisition modes:

- rich transcript object sources
- transcript-file sources
- enterprise-only sources

**Phase 1 fix:** keep the canonical contract stable, and vary only the acquisition/normalization layer.

## Recommended Phase 1 implementation order

1. **Lock the contract**
   - keep `docs/source-connector-spec.md` current
   - align shared TS types with the doc

2. **Lift media URLs into the pipeline**
   - support `audio_url` / `video_url` directly

3. **Extract transcript normalization**
   - one helper used by Fireflies, Grain, Riverside, etc.

4. **Create source registry for import surfaces** — shipped in PR #279
   - registry-driven add-source UI reduces hardcoded branching

5. **Use Fireflies and Grain as proof vendors**
   - if both fit with little special casing, the abstraction is probably real

6. **Treat Riverside as the transcript-file validator**
   - proves the normalizer layer

7. **Treat Otter as an access-gated vendor**
   - prove contract only after enterprise API access is confirmed

## Exit criteria for “hours, not weeks”

We should only claim the problem is solved when a new connector mostly consists of:

- one vendor client module
- one mapping function into `CanonicalSourceConnectorRecord`
- one test fixture file
- one small registry entry

If adding a source still requires touching multiple unrelated downstream consumers, the abstraction is not finished.
