# Phase 24: Fathom Share-Link Save - Context

**Gathered:** 2026-05-07 (derived from BACKLOG.md entry + research session)
**Status:** Ready for planning
**Source:** Direct authoring (skipped discuss-phase — scope captured in BACKLOG.md after multi-agent research)

<domain>
## Phase Boundary

Let any user save the contents of any Fathom share link into CallVault by pasting the URL + transcript themselves. CallVault becomes a permanent, searchable home for transcripts the user has been given access to — even ones recorded by other people, even after the original share is revoked.

**Boundary:**
- IN SCOPE: A modal that accepts a Fathom share URL + raw pasted transcript text, parses it into structured segments, dedups by share-token, and stores it in the user's workspace as a recording — using the existing `recordings` table.
- OUT OF SCOPE: Server-side fetching from fathom.video (legal posture). Video file archival (the user can manually upload an MP4 they downloaded themselves — but that's a v2 deliverable, not v1). Bookmarklet, Chrome extension, or other automated capture (v2+). Auto-detection of non-Fathom transcript formats (Otter, Zoom, Read.ai — also v2+).

**Why this framing (legal + ethical):**
Fathom ToS §2 prohibits automated tools accessing the Service AND storing/copying audiovisual works. CallVault makes ZERO server-side requests to fathom.video. The user — Bob — does the copying himself, in his own browser, using Fathom's own "Copy transcript" button. CallVault is a notes app receiving user-generated content. Same legal posture as Notion, Evernote, Obsidian. We are not a Fathom client.

</domain>

<decisions>
## Implementation Decisions

### Data model
- **D-01:** Extend the existing `recordings` table — DO NOT create a separate `pasted_recordings` table. Add new columns: `share_token TEXT`, `transcript_segments JSONB`. Reuse existing `share_url`, `full_transcript`, `summary`, `source_metadata` JSONB, `bank_id` (workspace), `legacy_recording_id`, `source_app` columns.
- **D-02:** Set `source_app = 'fathom-paste'` for paste-source recordings. This distinguishes them from API-imported Fathom recordings (`source_app = 'fathom'`).
- **D-03:** Dedup key: unique index on `(bank_id, share_token) WHERE share_token IS NOT NULL`. Re-paste of same URL into same workspace updates the existing row instead of creating a duplicate. If user pastes without a URL, no dedup — each paste creates a new row.
- **D-04:** No new tables for v1. The transcript_segments JSONB on the row scales fine until ~1MB (≈4hr meeting). Beyond that, we add a `transcript_chunks` child table later — non-blocking for v1.

### Endpoint architecture
- **D-05:** ONE new edge function: `save-pasted-transcript`. POST `{ share_url?, raw_transcript, title?, recorded_at?, attendees? }`. Returns `{ recording_id, action: 'created' | 'updated' }`.
- **D-06:** The edge function is the ONLY server-side touchpoint. Zero outbound HTTP from any CallVault server to fathom.video — confirmed by code review as part of the success criteria.
- **D-07:** Auth: standard Supabase JWT. The recording is scoped to the user's currently-active `bank_id` (workspace), passed in the request body.

### Parser
- **D-08:** Pure utility: `supabase/functions/_shared/fathom-transcript-parser.ts`. Stateless. Takes raw text, returns `{ title?, recorded_at?, attendees: string[], segments: { start_ms, speaker, text }[] }`.
- **D-09:** Handle Fathom's known copy-format: `Speaker Name (M:SS) text...` per turn. Pre-flight: detect by looking for the `(M:SS)` timestamp pattern.
- **D-10:** Graceful fallback: if format is unrecognized (no timestamps detected), save raw text into `full_transcript` and set `transcript_segments` to NULL with a `parse_status: 'raw'` flag in `source_metadata` JSONB. User-pasted text isn't lost.

### Frontend
- **D-11:** New component: `src/components/import/PasteTranscriptModal.tsx`. Triggered by a "Save Transcript" button on the existing import page (`src/pages/import/`).
- **D-12:** Modal layout: URL field (optional), large textarea for transcript paste, auto-extracted preview of title/date/attendees (editable), Save button.
- **D-13:** On paste into the textarea, run the parser CLIENT-SIDE (using the same `_shared/fathom-transcript-parser.ts` imported via Vite alias) to give immediate preview of detected fields. Submit then re-runs parser server-side as source of truth.
- **D-14:** On save: redirect to recording detail page (`/?callId=<new_id>`).

### Recording detail rendering
- **D-15:** `RecordingDetail.tsx` checks `source_app === 'fathom-paste'`. If true: hide video player affordance entirely. Show transcript + metadata + a "Source: Fathom share link" pill with optional outbound link to `share_url`.
- **D-16:** All other existing detail-pane features (notes, tags, folder assignment, summary generation via `summarize-call` edge function) work identically. Pasted recordings are first-class citizens.

### Search integration
- **D-17:** Existing `idx_recordings_transcript_fts` GIN index on `full_transcript` covers paste-source recordings automatically. No new search code. Verify by E2E test: paste → wait 5s → search for unique phrase → returns the new recording.

### Claude's Discretion
- Exact wording of the "Save Transcript" button and modal copy
- Where exactly to place the trigger button on the import page (header CTA vs separate "Add" menu)
- Whether to show a count of detected segments in the preview ("12 turns, 5 speakers detected")
- Toast/notification copy on success/failure
- Loading states during parse/save

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing recordings infrastructure (extend, don't recreate)
- `supabase/migrations/20260131000007_create_recordings_tables.sql` (lines 13-60) — modern `recordings` table: `bank_id`, `video_url`, `audio_url`, `full_transcript`, `summary`, `source_metadata`, `source_app`, `legacy_recording_id`
- `supabase/migrations/00000000000000_consolidated_schema.sql` (lines 87-148) — legacy `fathom_calls` and `fathom_transcripts` tables (already have `share_url`); reference only, do NOT extend
- Existing GIN index `idx_recordings_transcript_fts` covers FTS over `full_transcript` — paste-source recordings inherit search automatically

### Existing import flow patterns (mirror, don't duplicate)
- `src/components/import/FathomImportDetail.tsx` — Pane-3 import detail panel pattern; Phase 24's modal is a sibling, not a replacement
- `src/components/import/ZoomImportDetail.tsx` — Same pattern for Zoom; reference for source-detail rendering
- `src/services/fathom.service.ts` — Existing Fathom service; do NOT add server-fetch methods to it for Phase 24 (legal posture)
- `supabase/functions/fetch-meetings/index.ts`, `fetch-single-meeting/index.ts` — Existing Fathom API patterns (workspace scoping, error handling) to mirror for the save edge function

### Recording detail page
- `src/components/recordings/RecordingDetail.tsx` (or whatever the current detail component is — verify) — needs a branch for `source_app === 'fathom-paste'` to hide video player

### Architecture conventions
- `supabase/CLAUDE.md` — edge function conventions, RLS patterns, migration standards
- `src/CLAUDE.md` — frontend design system, hard constraints, Service + Hook pattern
- `docs/architecture/api-naming-conventions.md` — naming standards for edge functions, services, hooks
- `CLAUDE.md` (root) — One-Click Promise philosophy: paste-and-save should feel like one action

### Research artifacts (for context only, not authoritative)
- `.planning/BACKLOG.md` — full original scope spec for this phase including the 5 work items and acceptance criteria
- (no RESEARCH.md required — research already done in this session via 4 parallel research agents; key findings: Fathom share URLs are scrapeable but ToS prohibits server-side automated access, hence the user-paste model)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets
- `recordings` table schema is 90% complete — only `share_token` and `transcript_segments` columns are net-new
- `bank_id` workspace scoping pattern + RLS policies on `recordings` are already correct — paste recordings inherit them for free
- `idx_recordings_transcript_fts` covers FTS automatically
- `summarize-call` edge function (`supabase/functions/summarize-call/index.ts`) works on any recording with `full_transcript` populated — paste recordings get LLM summaries for free, no new code
- Existing detail-pane (notes, tags, folder, summary) is source-agnostic — Phase 24 just needs to suppress the video player block

### Established patterns
- Service + Hook separation: `src/services/*.service.ts` for pure async, `src/hooks/use*.ts` for React wrapping with TanStack Query
- Edge function structure: `supabase/functions/<name>/index.ts` + shared utilities in `_shared/`
- Modal + Pane 4 distinction (per JSDoc on AppShell): paste flow is a transient action → use a Dialog modal, not a Pane 4 panel

### Constraints to honor
- No outbound HTTP to fathom.video from any server-side code (legal — verified by code review)
- Remix Icons only (`@remixicon/react`)
- npm package manager (not pnpm/yarn/bun)
- Vibe orange = structural accent only

</code_context>

<specifics>
## Specific Ideas

- Trigger button label: "Save Transcript" (working title — Andrew may rename)
- Modal title: "Save a Transcript"
- URL field placeholder: "https://fathom.video/share/..." (optional)
- Transcript field placeholder: "Paste the transcript copied from Fathom's 'Copy transcript' button..."
- Source pill on recording detail: "From Fathom share link" with `RiLinkM` icon
- Empty-state copy for the textarea: "Click 'Copy transcript' in Fathom, then paste here"

</specifics>

<deferred>
## Deferred Ideas (v2+)

- Bookmarklet that scrapes Fathom DOM in user's session and auto-fills the modal (still user-as-actor; just better UX)
- Chrome extension version of the bookmarklet
- File upload for the MP4 the user downloaded themselves via Fathom's owner-only download button — stored in Supabase Storage, requires bucket setup
- Multi-source paste (auto-detect Otter, Zoom, Read.ai, Grain transcript formats)
- Per-segment embeddings (`transcript_chunks` table with pgvector) for timestamp-anchored semantic search
- Bulk paste UI for users with many shares to import at once

</deferred>

---

*Phase: 24-fathom-share-link-save*
*Context gathered: 2026-05-07 — derived from BACKLOG.md after multi-agent research session*
