# Phase 17: Import Connector Pipeline - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Build a shared connector pipeline utility (`_shared/connector-pipeline.ts`) that normalizes all import connectors (Fathom, Zoom, YouTube) to a 5-stage architecture. Create an import source management UI showing connected sources. Validate the pipeline by building one new connector (file upload with Whisper transcription) in ≤230 lines. Routing rules are Phase 18 — this phase builds the pipeline they'll plug into.

</domain>

<decisions>
## Implementation Decisions

### Import source management UI
- Card grid layout — each source is a card (like an integrations dashboard, Zapier-style)
- Full detail on each card: logo, source name, connected account email, status badge (active/paused/error), last sync time, call count imported, active/inactive toggle
- "Add Source" card or button lives on the same Import page — clicking it opens the OAuth flow or setup wizard inline
- Users connect new sources and manage existing ones from a single page

### New connector: File upload (audio/video)
- First new connector to validate the pipeline — file upload with Whisper transcription
- Accepted formats: MP3, WAV, M4A, MP4, MOV, WebM — broad audio + video support
- Multi-file drag-and-drop upload — each file becomes a separate recording, processed in parallel or queued
- Transcription via OpenAI Whisper API — CallVault handles the API call, users don't need their own API key
- File uploads count toward the standard 10 imports/month free tier limit — consistent across all sources

### Sync behavior & feedback
- OAuth sources (Fathom, Zoom) support both auto-sync on schedule AND manual "Sync Now" button
- During sync: source card shows live progress ("Syncing... 4/12 calls") with progress bar/spinner
- When sync completes: toast notification summarizing results ("Fathom sync complete — 8 new calls imported")
- Dedup: duplicates silently skipped during import, but sync summary reports them ("Skipped 3 duplicates")
- Partial failures: import what works, surface errors. Failed calls shown in a "failed imports" section with retry option. No all-or-nothing rollback.

### Source connection flow
- Disconnecting a source keeps all imported calls — "Your calls are yours." Only future syncs stop.
- Disconnect confirmation: simple dialog — "Disconnect Fathom? Future syncs will stop. Your imported calls will be kept." One-click confirm.
- After first-time OAuth connection: auto-sync immediately — user sees calls appearing within seconds, no extra prompt.

### Claude's Discretion
- Error display pattern for sources with issues (expired tokens, API errors) — pick based on existing app error handling patterns
- OAuth flow UX (same-window redirect vs popup) — pick based on existing OAuth patterns in the app (v1 used redirect)
- Card grid responsive behavior (columns per breakpoint)
- Progress bar implementation details
- File upload chunk/stream strategy
- Auto-sync interval (hourly, daily, etc.)

</decisions>

<specifics>
## Specific Ideas

- User wants to add connectors incrementally: file upload first (Phase 17), then Grain and Fireflies as future connectors
- File upload is considered the "most valuable" new connector — enables users who don't use Fathom/Zoom to get calls into CallVault
- The Import page should feel like a single command center for all import activity — connect, sync, upload, see status

</specifics>

<deferred>
## Deferred Ideas

- Grain connector — future phase (after pipeline validated with file upload)
- Fireflies.ai connector — future phase (after Grain)
- These would be added one at a time as new connectors, each validating the ≤230 line pipeline promise

</deferred>

---

*Phase: 17-import-connector-pipeline*
*Context gathered: 2026-02-27*
