# Backlog

User-requested features and improvements identified after v2.0 launch. Items here are not yet scoped into a phase and serve as input for future milestone planning.

---

## Fathom Data Sync

### Re-import / Overwrite Existing Calls from Fathom

**Priority:** Medium  
**Requested by:** User (data freshness concern)  
**Status:** Not yet scoped

**Description:**

When syncing calls from Fathom, if a call has been renamed or updated in Fathom, allow overwriting the existing CallVault recording. Currently, the pipeline dedup check skips existing recordings, preventing updates.

**Scope:**

- Add "force reimport" flag to sync pipeline
- Update title, transcript, summary, source_metadata, duration while preserving:
  - UUID (maintains call identity)
  - Workspace entries (doesn't re-assign)
  - Tags (user-assigned metadata intact)
  - Folder assignments (preserved)

**Touches:**

- `supabase/functions/sync-meetings/connector-pipeline.ts` — add force reimport flag to dedup logic
- `supabase/functions/sync-meetings/` — update recording mutation to support partial updates
- Frontend UI — needs toggle/button in Fathom import detail panel to enable force reimport on sync

**Related:**

- Fathom import detail component: `src/components/import/FathomImportDetail.tsx`
- Sync service: `src/services/fathom.service.ts`

**Notes:**

- User can already delete and re-import calls, but a direct "refresh" would be cleaner UX
- Consider showing which fields will be updated (title, transcript, summary, duration) vs preserved (UUID, tags, folders)

---

## Fathom Mirror — Read-from-Local for Fast Search

**Priority:** High (UX impact for every user)
**Requested by:** Andrew (during fetch-meetings perf debug, 2026-05-07)
**Status:** Not yet scoped

**Goal:**

Make Fathom search feel instant (~50ms) instead of slow and variable (1-7s with 14× spike risk) by reading meeting metadata from our existing webhook-fed mirror table (`fathom_raw_calls`) instead of hitting Fathom's API on every search.

**Why now:**

- Measured Fathom API latency variance: 165ms to 2,277ms per page, same call. With 10/page default and no `limit` param, a 30-day search burns 3-15s.
- Mirror table `fathom_raw_calls` already exists, indexed, and 99.5% populated (1,293 of 1,300 rows for the test account, going back to 2024-01-16).
- Webhook handler at `supabase/functions/webhook/index.ts:347` already routes events to the right user via `user_settings.host_email`. Team-account fan-out also already supported.
- The user-facing perf branch (`perf/fathom-fetch-improvements`) ships live pagination + Load More to mask the slowness — but this turns "masked" into "actually fast."

**What's already built (don't redo):**

- ✅ `webhook` edge function — handles Fathom event POSTs and writes to `fathom_raw_calls`
- ✅ `create-fathom-webhook` edge function — auto-registers webhook with Fathom via OAuth (function deployed but file currently untracked in source — needs `supabase functions download` and commit)
- ✅ `fathom_raw_calls` table — title, transcript, summary, recorded_by, calendar_invitees, etc., with `idx_calls_user_id` and `idx_calls_created_at DESC`
- ✅ Composite PK `(recording_id, user_id)` enabling team-account fan-out

**What's missing (the actual work):**

1. **Backfill on signup (~2-3 hr)** — A new user has historical Fathom meetings the webhook never saw. Need a one-time bulk pull when they connect OAuth: paginate Fathom's `/external/v1/meetings`, write each into `fathom_raw_calls`. Could reuse logic from `sync-meetings`.
2. **Reconciliation cron (~2 hr)** — Webhooks fail silently sometimes (the 7-row gap on the test account proves this). Daily job that diffs `fathom_raw_calls` vs Fathom's API for each user and backfills any missing rows.
3. **Verify OAuth-callback auto-fires `create-fathom-webhook` (~30 min)** — If it's a manual button click, new users silently have no webhook firing. Confirm or wire it.
4. **Multi-account-per-user routing (~1 hr)** — `import_sources` supports a user having N Fathom accounts (different emails), but `host_email` lives singularly on `user_settings`. Either move `host_email` to `import_sources` or store an array.
5. **Switch `fetch-meetings` to read from the mirror (~1-2 hr)** — Replace the Fathom API loop with a Postgres SELECT on `fathom_raw_calls`. Keep the sync-status check against `recordings` (already fast). Optional: for "Today" date ranges, top up with one Fathom API call to catch meetings recorded in the last ~5 minutes that haven't webhooked yet.
6. **Restore `create-fathom-webhook` to source control (~5 min)** — Currently deployed-but-untracked.

**Total estimate:** ~1 dev-day if done together.

**Touches:**

- `supabase/functions/fetch-meetings/index.ts` — swap Fathom API loop for Postgres query
- `supabase/functions/fathom-oauth-callback/index.ts` — verify/wire backfill kickoff + webhook registration
- `supabase/functions/create-fathom-webhook/index.ts` — bring under source control
- New: `supabase/functions/fathom-backfill/index.ts` — bulk pull for new users
- New: cron job (Supabase scheduled function or external) — daily reconciliation
- Migration: maybe move `host_email` from `user_settings` to `import_sources` for multi-account support
- `src/components/import/FathomImportDetail.tsx` — once mirror is the source, can drop pagination Load More button (just show all)

**Acceptance criteria:**

- A 30-day Fathom search returns in <200ms p95 (vs current 1-7s)
- A new user connecting Fathom sees their full history within 2 minutes of connecting (backfill complete)
- The 7-row gap is closed and reconciliation runs nightly to prevent future drift
- A user with 2+ Fathom accounts sees meetings from all of them routed to their library

**Risks:**

- Fathom webhook reliability — if events get dropped, mirror drifts. Mitigated by reconciliation cron.
- "Just-recorded" gap — call recorded 30s ago may not be in mirror yet. Acceptable for date-range searches; mitigated for "Today" via top-up call.
- Backfill API rate limit — Fathom is 60 req/min. A user with 1,000 meetings = ~17 minutes of backfill. Need to do this async with progress UI.

**Related:**

- `perf/fathom-fetch-improvements` branch — ships live pagination + 5min cache as a holdover until this lands
- Webhook handler: `supabase/functions/webhook/index.ts`
- Mirror schema: see `fathom_raw_calls` columns in DB

---

## Fathom Share-Link Save — User-Paste Inbox

**Priority:** High (unique product value, zero infra cost, clean legal posture)
**Requested by:** Andrew (during research session, 2026-05-06)
**Status:** Scoped, ready to plan

**Goal:**

Let any user save the contents of any Fathom share link into CallVault by pasting the URL + transcript themselves. CallVault becomes a permanent, searchable home for transcripts the user has been given access to — even ones recorded by other people, even after the original share is revoked.

**Why this framing (legal + ethical):**

Fathom ToS §2 prohibits automated tools accessing the Service AND storing/copying audiovisual works. CallVault therefore makes ZERO server-side requests to fathom.video. The user — Bob — does the copying himself, in his own browser, using Fathom's own "Copy transcript" button. CallVault is a notes app receiving user-generated content. Same legal posture as Notion, Evernote, Obsidian. We are not a Fathom client.

**v1 scope (1 day, ships immediately):**

One paste form. Three fields:

1. **Share URL** (optional) — stored as text reference, never fetched
2. **Transcript** (required) — pasted from Fathom's "Copy transcript" feature
3. **Title / Date / Attendees** — auto-parsed from pasted transcript header (Fathom's copy format includes these), editable before save

On save: parse transcript into structured segments (`[{start_ms, speaker, text}]`), insert/update `recordings` row in user's workspace, FTS-index automatically via existing `idx_recordings_transcript_fts`.

**v2+ unlocks (do not build with v1):**

- Bookmarklet — drag-to-bookmarks button that grabs transcript from Fathom DOM in user's session, posts to CallVault. Same legal posture (user clicked, user's browser).
- Chrome extension — same as bookmarklet, native UX.
- File upload — user drops MP4 they downloaded themselves via Fathom's owner-only download button. Stored in Supabase Storage.
- Multi-source — same form accepts Otter, Zoom, Read.ai, Grain transcripts.

**What's already built (don't redo):**

- ✅ `recordings` table — `full_transcript`, `share_url`, `summary`, `source_metadata` JSONB, workspace-scoped via `bank_id` (`supabase/migrations/20260131000007_create_recordings_tables.sql:13-60`)
- ✅ FTS GIN index `idx_recordings_transcript_fts` — search just works
- ✅ Workspace RLS on `recordings`

**What's missing (the actual work):**

1. **Migration: ALTER `recordings`** (~10 min)
   - Add `share_token TEXT` (parsed from URL — dedup key)
   - Add `transcript_segments JSONB` (structured speaker+timestamp turns)
   - Add `source_app TEXT` already exists (set to `'fathom-paste'`)
   - Add unique index `(bank_id, share_token) WHERE share_token IS NOT NULL`

2. **Edge function: `save-pasted-transcript`** (~2 hr)
   - POST `{ share_url?, raw_transcript, title?, recorded_at?, attendees? }`
   - Parse Fathom's copy-transcript format → structured segments
   - Auto-extract title/date/attendees from transcript header if user didn't override
   - Compute `share_token` from URL if provided
   - Upsert `recordings` row keyed on `(bank_id, share_token)` (or new UUID if no token)
   - Return recording_id

3. **Frontend: paste modal** (~3 hr)
   - New "Save Transcript" button on import page
   - Modal: big textarea + URL field + auto-detected title/date/attendees preview
   - Smart-detect Fathom format on paste, auto-fill metadata fields
   - Submit → call edge function → redirect to recording detail
   - Component path: `src/components/import/PasteTranscriptModal.tsx`

4. **Transcript-format parser util** (~1 hr)
   - Pure function: `parseFathomCopyFormat(text) → { title?, date?, attendees, segments }`
   - Lives in `supabase/functions/_shared/` so edge fn + future client-side preview both use it
   - Handle Fathom's known format: `Speaker Name (M:SS) text...`
   - Graceful fallback: if format unrecognized, save raw text + flag `parse_status='raw'`

5. **Recording detail rendering** (~1 hr)
   - `recordings.source_app === 'fathom-paste'` → render with same UI as imported recordings, but no "play video" affordance (we don't have the file)
   - Show "Source: Fathom share link" pill with optional outbound link to `share_url`

**Total estimate: ~1 dev-day for v1.**

**Acceptance criteria:**

- User can paste a Fathom transcript + URL into a modal and have it appear in their library within 2 seconds
- Pasted transcript is searchable via existing global search within 5 seconds of save
- Repeat-paste of same share URL updates the existing record (no dup)
- Recording detail page renders pasted recording cleanly (no broken video player)
- Zero outbound HTTP requests to fathom.video from any CallVault server

**Risks:**

- Fathom changes their copy-transcript format — graceful fallback to raw text mitigates
- User pastes garbage — parse_status flag surfaces it for cleanup
- ToS reinterpretation — keep ALL fetching in user's browser, never server-side

**Touches:**

- New migration: `supabase/migrations/<ts>_recordings_paste_columns.sql`
- New: `supabase/functions/save-pasted-transcript/index.ts`
- New: `supabase/functions/_shared/fathom-transcript-parser.ts`
- New: `src/components/import/PasteTranscriptModal.tsx`
- Modified: `src/pages/import/*` — add "Save Transcript" CTA
- Modified: `src/components/recordings/RecordingDetail.tsx` — handle missing video case

**Related backlog:**

- Fathom Mirror entry above — both are about Fathom data, but mirror is owner-only-via-API, this is anyone-via-paste. They coexist.

---

*Backlog created: 2026-04-03*
