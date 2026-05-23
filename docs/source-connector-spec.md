# Source Connector Spec

Status: Phase 0 draft

This document records the **actual current connector contract from the codebase**, not the desired future contract.

## Executive summary

CallVault already has one shared insertion path for imported recordings: `supabase/functions/_shared/connector-pipeline.ts`. A source connector does not write directly to UI-facing tables. It builds a normalized record, then `runPipeline()` inserts into `recordings` and creates `workspace_entries`.

The important distinction is between:

1. the **hard insert contract** required by `connector-pipeline.ts`, and
2. the **parity contract** needed for Fireflies/Grain/Otter/Riverside recordings to behave like Fathom in the app.

They are not identical today.

## Code anchors

- Pipeline insert path: `supabase/functions/_shared/connector-pipeline.ts:197-215`
- Canonical draft wrapper: `supabase/functions/_shared/canonical-recording.ts`
- Meeting mapping into UI: `src/hooks/useWorkspaces.ts:357-415`
- Summary generation/caching: `supabase/functions/summarize-call/index.ts:175-344`
- AI title generation: `supabase/functions/generate-ai-titles/index.ts`
- Auto-tag generation: `supabase/functions/auto-tag-calls/index.ts`
- MCP recording context/action items: `supabase/functions/mcp-server/index.ts`

## 1) Hard insert contract: what `connector-pipeline.ts` actually requires

`insertRecording()` writes these fields into `recordings` today:

```ts
interface PipelineInsertRecord {
  // Required by current pipeline
  external_id: string;           // becomes recordings.source_call_id
  source_app: string;            // becomes recordings.source_app
  title: string;                 // becomes recordings.title
  full_transcript: string;       // becomes recordings.full_transcript
  recording_start_time: string;  // becomes recordings.recording_start_time
  source_metadata: Record<string, unknown>; // becomes recordings.source_metadata

  // Optional in current pipeline
  summary?: string | null;       // becomes recordings.summary
  duration?: number;             // becomes recordings.duration
  recording_end_time?: string;   // becomes recordings.recording_end_time
  organization_id?: string;
  workspace_id?: string;
  folder_id?: string;
}
```

### Mandatory today

A connector **must** provide:

| Field | Why it is mandatory | Code evidence |
|---|---|---|
| `external_id` | dedup + stored as `recordings.source_call_id` | `connector-pipeline.ts:205-207` |
| `source_app` | source identity, filtering, UI labeling | `connector-pipeline.ts:205-207` |
| `title` | `recordings.title` is inserted directly | `connector-pipeline.ts:202` |
| `full_transcript` | primary search + summarize/title/tag inputs | `connector-pipeline.ts:203`; `summarize-call`; `generate-ai-titles`; `auto-tag-calls` |
| `recording_start_time` | list ordering, call metadata, context rendering | `connector-pipeline.ts:209`; `mapRecordingToMeeting()` |
| `source_metadata` | all source-specific fields are recovered from here downstream | `connector-pipeline.ts:207`; `mapRecordingToMeeting(): meta = source_metadata` |

### Optional today

A connector **may** omit these without breaking insertion:

| Field | Current behavior if omitted |
|---|---|
| `recording_end_time` | stored as `null` |
| `duration` | stored as `null` |
| `summary` | system can generate later via `summarize-call` |
| `organization_id` | pipeline resolves personal org |
| `workspace_id` / `folder_id` | pipeline resolves/rules destination |

## 2) Parity contract: what imported recordings need to behave like Fathom

A recording can insert successfully with the six hard fields above and still feel degraded in the product.

To behave like an existing Fathom/Zoom call in downstream surfaces, a connector **should** add these `source_metadata` keys:

```ts
interface SourceMetadataParityKeys {
  external_id: string; // pipeline prepends this automatically

  // strongly recommended for parity
  share_url?: string | null;
  source_url?: string | null;
  recorded_by_name?: string | null;
  recorded_by_email?: string | null;
  calendar_invitees?: Array<{
    name?: string;
    email?: string;
    is_external?: boolean;
    matched_speaker_display_name?: string;
  }> | null;
  participant_emails?: string[];

  // optional but useful
  action_items?: string[];
  topics_discussed?: string[];
  synced_at?: string;
  import_source?: string;
}
```

### Why these parity keys matter

| Key | Downstream surface |
|---|---|
| `share_url` | `CallDetailHeader`, `CallOverviewTab`, `CallTranscriptTab` show/view outbound links |
| `recorded_by_name`, `recorded_by_email` | speaker matching, contact/host context, export metadata |
| `calendar_invitees` | invitees pills, participant counts, contact import, transcript speaker/email matching |
| `participant_emails` | import/search/host inference helpers |
| `action_items` | MCP `get_action_items` fast-path avoids an extra LLM pass |

## 3) Important mismatch: schema contract vs current connector contract

The `recordings` schema itself supports more than `connector-pipeline.ts` currently writes.

`20260131000007_create_recordings_tables.sql` includes:

- `audio_url TEXT`
- `video_url TEXT`
- `full_transcript TEXT`
- `summary TEXT`
- `source_metadata JSONB`
- `duration INTEGER`
- `recording_start_time TIMESTAMPTZ`
- `recording_end_time TIMESTAMPTZ`

### Current gap

The shared connector pipeline **does not write `audio_url` or `video_url` at all**. It only writes link/media-ish values if a connector places them inside `source_metadata`.

That means the current codebase contract is:

- **Schema-level capability:** `audio_url` and `video_url` exist.
- **Connector-level reality:** connectors must currently preserve media URLs in `source_metadata`, because the shared insertion path does not accept/write media columns.

If we want media URLs to be first-class mandatory connector outputs, Phase 1 needs to extend the shared pipeline, not just update docs.

## 4) What the system already generates for you

These are not required from a connector for the current system to work:

| Field / feature | Current owner |
|---|---|
| `ai_generated_title` | `generate-ai-titles` Edge Function |
| `global_tags` / auto-tags | `auto-tag-calls` Edge Function |
| `action_items_cache` | MCP `extract_action_items` cache path |
| LLM summary when no summary exists | `summarize-call` Edge Function |

## 5) Important nuance: summaries are allowed today

If a connector already has a trustworthy source summary, the current codebase **does allow and use it**.

Evidence:

- pipeline inserts `record.summary ?? null` into `recordings.summary`
- `summarize-call` returns cached summary unless `force_refresh` is set
- MCP recording context surfaces `recording.summary`
- `auto-tag-calls` can analyze transcript **and** summary

So the strict statement "connectors must not produce summary" is **not true for the current codebase**.

The accurate statement is:

- source summaries are **optional**,
- accepted if present,
- and system-generated summaries backfill when absent.

## 6) Recommended canonical TypeScript model for Phase 1

This is the practical target shape implied by the codebase:

```ts
interface CanonicalSourceConnectorRecord {
  // hard insert contract
  externalId: string;
  sourceApp: string;
  title: string;
  fullTranscript: string;
  recordingStartTime: string;
  sourceMetadata: Record<string, unknown>;

  // parity fields
  recordingEndTime?: string | null;
  durationSeconds?: number | null;
  sourceUrl?: string | null;
  shareUrl?: string | null;
  audioUrl?: string | null; // phase-1 pipeline extension needed
  videoUrl?: string | null; // phase-1 pipeline extension needed
  recordedByName?: string | null;
  recordedByEmail?: string | null;
  calendarInvitees?: Array<{ name?: string; email?: string; is_external?: boolean }> | null;
  participantEmails?: string[] | null;

  // optional source enrichment
  summary?: string | null;
  actionItems?: string[] | null;
  topicsDiscussed?: string[] | null;
}
```

## 7) Conformance checklist for a new vendor connector

A vendor connector passes conformance when it proves all of the following:

### Insert contract

- Can build `external_id`, `source_app`, `title`, `full_transcript`, `recording_start_time`, `source_metadata`
- Uses a stable vendor identifier for `source_call_id`
- Produces lowercase `source_app`
- Inserts through the shared pipeline instead of custom SQL

### Product parity

- `mapRecordingToMeeting()` can recover share/view link and host/invitee data from `source_metadata`
- call detail opens without null-reference regressions
- MCP `list_calls`, `get_transcript`, `get_recording_context`, and `get_action_items` work with the imported row
- `summarize-call` works when summary is absent
- `generate-ai-titles` works because `full_transcript` exists
- `auto-tag-calls` works because transcript (and optional summary) exist

### Non-goals for the connector itself

- It does not generate AI title text itself
- It does not generate auto-tags itself
- It does not need to precompute LLM action items if none are supplied

## 8) Bottom line

The current CallVault connector contract is **smaller and more source-metadata-driven** than the desired future contract.

- Six fields are hard-required by the shared insert path.
- Several additional metadata keys are required for Fathom-like UX parity.
- `audio_url` / `video_url` are present in schema but not yet in the connector abstraction.
- Source summaries are optional, but fully supported today.

## 9) What we are **not** shooting for

A connector surface that asks the user to paste one transcript ID at a time is **not** the target architecture for recording sources.

That kind of screen can be useful as a debug harness, but it is not the real contract we need to solve.

Why:

- it proves only direct ingestion of a known vendor record
- it does not solve source-native discovery of recordings
- it does not represent the real user flow for connected accounts
- it keeps acquisition logic outside the connector abstraction

The target connector flow is:

1. connect source account
2. backfill historical recordings in bulk from the provider
3. keep ingesting future provider recordings automatically (webhook, poller, or both)
4. choose provider-native recordings from fetched inventory when user intervention is needed
5. normalize each fetched recording into the canonical ingestion shape
6. insert through the shared pipeline

So the complete solution requires **two contracts**:

- **Acquisition contract** — connect account, list/backfill recordings, fetch details, and optionally webhook-verify future events
- **Canonical ingestion contract** — map one fetched source recording into `recordings`

Both have to exist before “new vendors take hours, not weeks” is true.

## 10) Connector lifecycle invariant

This lifecycle must be the **same for every recording-source connector**.

Not "works once."
Not "supports an initial import."
Not "special-cases Fireflies."

The invariant is:

```ts
interface RecordingSourceConnector {
  sourceApp: string;

  // account-level connection state
  connect(input: ConnectSourceInput): Promise<ConnectedSourceAccount>;
  refreshConnection?(account: ConnectedSourceAccount): Promise<ConnectedSourceAccount>;
  disconnect(account: ConnectedSourceAccount): Promise<void>;

  // historical ingestion
  listRecordings(window: DateWindow, account: ConnectedSourceAccount): Promise<SourceRecordingStub[]>;
  getRecording(recordingId: string, account: ConnectedSourceAccount): Promise<CanonicalSourceConnectorRecord>;

  // future ingestion
  verifyWebhook?(request: Request, account: ConnectedSourceAccount): Promise<VerifiedSourceEvent | null>;
  listNewRecordings?(since: Cursor, account: ConnectedSourceAccount): Promise<SourceRecordingStub[]>;
}
```

A connector is only valid when it supports the same **perpetual** operational model as every other source:

1. account is connected once
2. historical recordings can be backfilled in bulk
3. future recordings continue to arrive without manual per-recording setup
4. every fetched recording normalizes into the same canonical ingestion contract
5. downstream readers remain source-agnostic

If a vendor can only import one known transcript ID at a time, that is a debug utility, not a finished connector.

## 11) Auth mode varies; lifecycle does not

Different vendors may authenticate differently:

- Fathom: OAuth and/or API key
- Zoom: OAuth
- Fireflies: API key plus optional webhook signing secret
- Grain: OAuth, PAT, or workspace token
- Riverside: API key
- Otter: likely enterprise API credentials

That is acceptable.

What is **not** acceptable is letting auth differences leak into the connector lifecycle.

The stable rule is:

- auth mode may vary
- discovery/backfill/future-ingestion lifecycle may **not** vary
- canonical ingestion contract may **not** vary
- downstream readers may **not** vary

So the connector abstraction has to normalize two different things:

1. **provider auth surface** → one `ConnectedSourceAccount`
2. **provider recording payload** → one canonical ingestion record

If we do only the second normalization, we have not solved the recording-source problem.
