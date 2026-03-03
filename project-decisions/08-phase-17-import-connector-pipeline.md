# Phase 17: Import Connector Pipeline

**Type:** Backend infrastructure + frontend UI

**Goal:** Build a shared connector pipeline utility (`_shared/connector-pipeline.ts`) that normalizes all import connectors (Fathom, Zoom, YouTube) to a 5-stage architecture. Create an import source management UI showing connected sources as a card grid. Validate the pipeline by building one new connector (file upload with Whisper transcription).

---

## Critical Problem to Solve

Phase 15 archived `fathom_calls` via RENAME to `fathom_calls_archive`, creating a read-only compatibility VIEW. But Postgres does NOT route INSERTs through a plain SELECT VIEW without INSTEAD OF triggers. All three existing connectors are writing to a broken target and failing silently in production. This phase fixes all of them.

---

## Plan 01 — Build the Shared Connector Pipeline

### Create `_shared/connector-pipeline.ts`

- [ ] Define `ConnectorRecord` interface — the normalized shape every connector must produce before insertion
- [ ] Define `PipelineResult` type — success/skip/error outcome
- [ ] Build `checkDuplicate(supabase, ownerId, sourceApp, externalId)` — queries `recordings` table by `owner_user_id + source_app + source_metadata->>'external_id'`; fail-open on error (never block an import)
- [ ] Build `insertRecording(supabase, record)` — inserts into `recordings` table + creates `vault_entries` association; vault entry creation is non-blocking (try/catch, logs only — recording commit must succeed even if vault lookup fails)
- [ ] Build `runPipeline(supabase, records[])` — orchestrates checkDuplicate + insertRecording for a batch
- [ ] Use flat async functions, NOT a class hierarchy

### Create Database Migration

- [ ] Create `import_sources` table with `UNIQUE(user_id, source_app)` constraint
- [ ] Add 4 RLS policies (SELECT/INSERT/UPDATE/DELETE) using bank_memberships JOIN pattern
- [ ] Create `get_import_counts()` RPC function — returns per-source count of recordings for the current user
- [ ] Add `skipped_count` column to `sync_jobs` table (tracks dedup skips per sync run)

---

## Plan 02 — Rewire Existing Connectors to Use Pipeline

### YouTube Import

- [ ] Remove `generateYouTubeRecordingId()` — the `9000000000000 + timestamp` numeric ID hack
- [ ] Remove dual write to `fathom_calls_archive`
- [ ] Replace with `checkDuplicate()` + `insertRecording()` from the shared pipeline
- [ ] Note: response `recordingId` changes from `number` to `string` (UUID) — any frontend code navigating by this must handle UUIDs

### Zoom Sync

- [ ] Full rewrite of `syncZoomMeeting()` function
- [ ] Remove the fingerprint-based fuzzy dedup (it queries the broken `fathom_calls` VIEW and calls `handleDuplicateMerge()` which writes back to the VIEW — both broken)
- [ ] Replace with `checkDuplicate()` from the shared pipeline
- [ ] Add three-state outcome tracking: `'synced' | 'skipped' | 'failed'`
- [ ] Track `skipped_count` in `sync_jobs` after every processed item

### Fathom (sync-meetings + fetch-meetings)

- [ ] In `sync-meetings`: replace `fathom_calls` upserts with `checkDuplicate()` + `insertRecording()`
- [ ] In `fetch-meetings`: migrate sync-status check from querying `fathom_calls` to querying `recordings` table (extract `source_metadata.external_id` values) — without this, UI sync indicators show "not synced" for newly imported meetings
- [ ] Preserve `fathom_transcripts` writes as non-blocking supplementary write for backward compatibility

---

## Plan 03 — Build File Upload Connector

### Create `supabase/functions/file-upload-transcribe/index.ts`

Target: ~138 lines (well under the 230-line budget for new connectors)

- [ ] Auth: verify JWT from request
- [ ] File size validation: enforce 25MB client-side limit
- [ ] MIME type validation: allowlist audio/video MIME types
- [ ] Monthly quota check: 10 imports/month across ALL recordings for the user; return 429 if exceeded
- [ ] Dedup: `checkDuplicate()` using dedup key = `filename + '-' + filesize`
- [ ] Transcription: call OpenAI Whisper API (`whisper-1` model at $0.006/minute, synchronous call)
- [ ] Insert: `insertRecording()` from shared pipeline
- [ ] Add `[functions.file-upload-transcribe] verify_jwt = true` to `supabase/config.toml`

### Design Decisions

- [ ] Use synchronous Whisper flow (not async) — files under 25MB complete within the 150-second edge function wall-clock limit
- [ ] If timeouts become an issue later, add `EdgeRuntime.waitUntil()` async pattern (used by Zoom sync)
- [ ] Use `whisper-1` not `gpt-4o-transcribe` (newer but more expensive) — upgrade path documented

---

## Plan 04 — Build Import Hub UI

### Import Sources Service + Hooks

- [ ] Create `src/services/import-sources.service.ts` with functions:
  - `getImportSources()`, `getImportCounts()` (calls the RPC), `toggleSourceActive()`, `upsertImportSource()`
  - `uploadFile()`, `disconnectImportSource()`, `retryFailedImport()`, `getFailedImports()`
- [ ] Note: `getImportCounts()` calls `supabase.auth.getUser()` internally (RPC requires user ID) — return empty object when unauthenticated
- [ ] Create `src/hooks/useImportSources.ts` with 7 TanStack Query hooks following service+hook pattern

### Source Card Component

- [ ] Build `SourceCard.tsx` with:
  - Status badge (emerald for connected, amber for syncing, red for error, muted for disconnected)
  - Active/inactive toggle
  - "Sync Now" button (for OAuth sources when active)
  - "Disconnect" with Radix AlertDialog confirmation — copy: "Future syncs will stop. Your imported calls will be kept."

### File Upload Dropzone

- [ ] Build `FileUploadDropzone.tsx` with:
  - HTML5 drag-and-drop
  - MIME type allowlist using Set
  - 25MB `MAX_FILE_SIZE_BYTES` constant
  - Per-file state machine: uploading -> done/error
  - Multi-file processing support

### Import Source Grid

- [ ] Build `ImportSourceGrid.tsx` — responsive 1/2/3/4-column grid
- [ ] "Add Source" card with dashed border that opens AddSourceDialog
- [ ] AddSourceDialog shows Grain + Fireflies as "Coming soon" connectors

### Failed Imports Section

- [ ] Build `FailedImportsSection.tsx`:
  - Hidden when no failures exist
  - Collapsible header
  - Per-call retry buttons with per-row loading state
  - File uploads show "Re-upload file" instead of generic retry

### Rewrite Import Page

- [ ] Full rewrite of `src/routes/_authenticated/import/index.tsx`
- [ ] Show 4 source cards (Fathom, Zoom, YouTube, File Upload) + Add Source card
- [ ] OAuth auto-sync on mount: read `?source=fathom&connected=true` URL params, run sync, clean params with `history.replaceState`
- [ ] YouTube card: always shown as "active" (shared API key, no per-user OAuth); sync opens URL input dialog
- [ ] File Upload card: toggle is a no-op (always available); serves as visual affordance for the dropzone below
- [ ] Dedup-aware sync toasts: read `skipped_count` from sync job response

---

## Plan 05 — Deploy and Verify

### Deploy Edge Functions

- [ ] Deploy all 5 edge functions to production: `youtube-import`, `zoom-sync-meetings`, `sync-meetings`, `fetch-meetings`, `file-upload-transcribe`
- [ ] Use `/opt/homebrew/bin/supabase` directly (not `npx supabase` — may not be in PATH)
- [ ] Push database migration

### Frontend Build

- [ ] Run `pnpm build` and verify zero errors

### Verification Checks

- [ ] Confirm zero `fathom_calls` INSERT statements in any connector code
- [ ] Confirm all write connectors import from `connector-pipeline.ts`
- [ ] Verify new connector (file upload) line count against 230-line budget
- [ ] Visual verification: Import Hub shows all sources with status badges, toggle, sync actions
- [ ] End-to-end: file upload drag -> Whisper transcription -> recording appears in call list
- [ ] End-to-end: OAuth connection -> redirect -> auto-sync -> completion toast
