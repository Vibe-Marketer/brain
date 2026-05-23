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

## Gap 5 — Import/source UI is still partly source-specific

The transcript table and call detail now tolerate new `source_app` values well, but import/onboarding flows are still hand-wired in places.

Examples from the current codebase:

- `ImportPage.tsx` switches explicitly on `fathom`, `zoom`, `youtube`, `file-upload`, `paste-transcript`
- `useIntegrationSync.ts` only knows `fathom | zoom`
- `AddImportSourceDialog.tsx` is a hardcoded tile list
- `ImportSourcePane.tsx` is a hardcoded source list

**Impact:** Connector backend work is trending shared; connector onboarding UI is not.

**Phase 1 fix:** introduce a `SOURCE_CONNECTOR_REGISTRY` for import/onboarding surfaces.

## Proposed registry for Phase 1

```ts
interface SourceConnectorDefinition {
  id: string;
  label: string;
  onboardingMode: 'oauth' | 'api-key' | 'manual' | 'upload';
  supportsWebhook: boolean;
  supportsPolling: boolean;
  detailComponent: React.ComponentType<any> | null;
  syncFunction?: string;
}
```

This would let Fireflies/Grain/Otter/Riverside become config entries plus one connector module, not a cross-repo scavenger hunt.

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

4. **Create source registry for import surfaces**
   - reduce hardcoded UI branching

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
