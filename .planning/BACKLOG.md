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

## Edge Function Orphan Audit

**Priority:** Medium (dead code in production, security surface)
**Requested by:** Andrew (during deploy-CI debug, 2026-05-07)
**Status:** Not yet scoped

**Context:**

The March 2026 cleanup commit `e45c7787` deleted 30 "orphaned" edge functions from the repo but did NOT delete them from production. They've been zombie-running for months. Surfaced when the Deploy Supabase Edge Functions workflow started failing on missing `index.ts` files.

**Current state (as of 2026-05-07):**

- 76 functions deployed and ACTIVE in production
- 35 functions with source in repo
- **41 orphans** — deployed but no source

**Of those 41 orphans, only 2 are actually used by frontend** (already restored to source in this branch):

- `global-search` — used by `useGlobalSearch.ts`
- `teams` — used by `useTeamHierarchy.ts` (and 9 other team-related hooks)

**The remaining 39 are confirmed dead code** (no frontend caller):

```
automation-email           automation-engine          automation-scheduler
automation-sentiment       automation-webhook         bulk-apply-routing-rules
check-client-health        coach-notes                coach-relationships
coach-shares               content-builder            content-classifier
content-hook-generator     content-insight-miner      delete-all-calls
extract-action-items       extract-knowledge          extract-profits
get-available-models       get-config-status          google-meet-fetch-meetings
google-meet-sync-meetings  google-oauth-callback      google-oauth-refresh
google-oauth-url           google-poll-sync           manager-notes
migrate-recordings         resync-all-calls           save-fathom-key
save-webhook-secret        send-coach-invite          sync-openrouter-models
team-direct-reports        team-memberships           team-shares
test-env-vars              test-fathom-connection     test-secrets
```

**Why fix:**

- Dead code in production = unmonitored security surface (each function has its own URL, HTTP-callable)
- Confusing for future audits — "is this function safe to remove?" requires checking 41 things
- Smaller deploy footprint = clearer mental model

**The work:**

1. **Verify each is truly unused** (~30 min) — beyond `grep` of frontend, check:
   - External webhook URLs that might still POST to them (Fathom, Zoom, Polar webhooks point at our endpoints)
   - Cron / scheduled function definitions in Supabase
   - Direct API calls from agents/MCP servers
2. **Delete confirmed-dead functions from production** (~5 min) — `supabase functions delete <name>` in batch
3. **Optionally restore source for any that turn out to still be needed** — same pattern as `global-search`/`teams` we just restored

**Estimate:** 1-2 hours total.

**Mitigation in the meantime:**

The deploy workflow at `.github/workflows/deploy-edge-functions.yml` was changed (this commit) to deploy only locally-tracked functions, ignoring the orphans. Production deploys now succeed without needing the orphans to resolve. So this is non-blocking — just unfinished cleanup.

---

*Backlog created: 2026-04-03*

---

## Public Share Link (no-account view)

**Priority:** Medium
**Requested by:** Andrew (during v2.2 planning, 2026-05-11)
**Status:** Captured, deferred to v2.3+

**Goal:**

Add a "public" share-link mode where the recipient can view a shared call without creating a CallVault account — similar to a Loom public link.

**v2.2 in-scope (this milestone):** The "coming soon" CTA on the shared-call landing page indicates this is planned.

**v2.3+ work:**

- New `share_links.visibility` enum: `private` (current default — recipient must sign in) | `public` (anyone with the link)
- Public landing page renders the call without auth (transcript, summary, optional video)
- Org-owner toggle in Share Call modal: "Allow anyone with this link" with confirmation copy
- Audit log entry on every public view (IP, user-agent, timestamp)
- Optional expiry on public links

**Related:** SHARE-01 / SHARE-02 in v2.2 establish the landing-page surface this will plug into.

---

## View-Without-Account Mode (shared-call landing)

**Priority:** Medium
**Requested by:** Andrew (during v2.2 planning, 2026-05-11)
**Status:** Captured, deferred to v2.3+

**Goal:**

On the public shared-call landing page (SHARE-01), let the recipient choose "view without an account" instead of signing up. They get a read-only transcript view, gated to that single call, no library access.

**Why v2.3+ not v2.2:** v2.2 ships the landing page with a "coming soon" stub for this mode. Building the full view path needs its own auth model (signed token in URL, no Supabase session) which is its own design problem.

**Related:** Folds together with the public share-link entry above.

---

## Markdown Rendering Throughout

**Priority:** Medium
**Requested by:** Andrew (during v2.2 planning, 2026-05-11)
**Status:** Captured, deferred to v2.3+

**Goal:**

Any field that stores user-or-AI-authored markdown (call summaries, action item lists, manager review notes, coaching notes, transcript headers) should render as formatted markdown, not raw text. Image #7 (the table with raw markdown content) is the trigger example.

**Scope:**

- Audit every surface that displays markdown-typed content
- Standardize on one markdown renderer (likely `react-markdown` + `remark-gfm`) used app-wide
- Sanitize via DOMPurify or the renderer's safe-mode (no raw HTML pass-through)
- Apply to: call summary, action items, coaching notes, transcript segments, shared-call landing page transcript

**Why v2.3+ not v2.2:** The v2.2 milestone is already large. Markdown rendering is a polish item, not a blocker — surfaces remain readable in raw form. Better as a focused v2.3 polish phase.

---

## QA Sweep Orphans (Phase 29, 2026-05-11)

Eight P3 (and one P2) findings from the v2.2 Phase 29 QA Sweep that did NOT route to any v2.2 phase. Deferred to v2.3+ for triage. Each is a UX papercut, not a blocker. Full reproduction detail in `.planning/REQUIREMENTS.md` under the `### QA Sweep Findings (Phase 29, 2026-05-11)` section.

### QA-02 — Auth routes don't redirect signed-in users

**Priority:** Low (P3)
**Discovered:** 2026-05-11 (Phase 29 QA Sweep, Persona A)
**Status:** Captured, deferred to v2.3+

**Description:** Authenticated user navigating to `/login` or `/auth` sees the sign-in form rendered for an already-authenticated user. No automatic redirect to `/` or post-login home.

**Expected:** Authenticated users hitting `/login` or `/auth` should redirect to `/`.

**Persona:** A
**Surface:** `/login`, `/auth`
**Screenshot:** `.planning/phases/29-qa-sweep-regression-catalog/screenshots/qa-02-auth-routes-no-redirect.png`

---

### QA-03 — Sign-in password field shows pre-filled autofill dots

**Priority:** Low (P3)
**Discovered:** 2026-05-11 (Phase 29 QA Sweep, Persona A)
**Status:** Captured, deferred to v2.3+

**Description:** Password field is pre-filled with 7-8 obscured dots (browser autofill). UX should make the autofill obvious or clear it.

**Expected:** Empty password field on a fresh sign-in form, OR a visible "autofilled" affordance.

**Persona:** A
**Surface:** `/login`
**Screenshot:** `.planning/phases/29-qa-sweep-regression-catalog/screenshots/qa-03-signin-prefilled-dots.png`

---

### QA-12 — Cmd+K empty-state has repetitive placeholder text

**Priority:** Low (P3)
**Discovered:** 2026-05-11 (Phase 29 QA Sweep, Persona A)
**Status:** Captured, deferred to v2.3+

**Description:** Cmd+K modal opens with input placeholder "Search calls, transcripts, and summaries..." AND the same placeholder repeated in the body below. Repetitive UI.

**Expected:** Either the body shows recent searches / pinned items, OR removes the duplicate placeholder text.

**Persona:** A
**Surface:** Cmd+K global search modal
**Screenshot:** `.planning/phases/29-qa-sweep-regression-catalog/screenshots/qa-12-cmdk-empty-state-repetitive.png`

---

### QA-15 — Invitees tab heading says "PARTICIPANTS" (label mismatch on ad-hoc calls)

**Priority:** Low (P3)
**Discovered:** 2026-05-11 (Phase 29 QA Sweep, Persona A)
**Status:** Captured, deferred to v2.3+

**Description:** Call Detail modal INVITEES tab on an ad-hoc call shows heading "PARTICIPANTS (2) Ad-hoc call". Tab is named INVITEES but content is participants. Reasonable fallback UX, but the heading text would be clearer if it acknowledged the tab name explicitly.

**Expected:** Heading clarifies fallback behavior (e.g., "INVITEES — Ad-hoc call, showing PARTICIPANTS").

**Persona:** A
**Surface:** Call Detail modal → INVITEES tab on ad-hoc calls
**Screenshot:** `.planning/phases/29-qa-sweep-regression-catalog/screenshots/qa-15-invitees-tab-label-mismatch.png`

---

### QA-16 — Workspace Detail "ADVANCED SETTINGS" label has no content

**Priority:** Low (P3)
**Discovered:** 2026-05-11 (Phase 29 QA Sweep, Persona A)
**Status:** Captured, deferred to v2.3+

**Description:** Label "ADVANCED SETTINGS" visible at bottom of Workspace Detail Pane 4, but no expand/collapse control and no content. Either a section header awaiting content (stub) or truncated by viewport.

**Expected:** Either content underneath, OR remove the heading if empty.

**Persona:** A
**Surface:** Pane 4 Workspace Detail
**Screenshot:** `.planning/phases/29-qa-sweep-regression-catalog/screenshots/qa-16-advanced-settings-empty.png`

---

### QA-17 — Org switcher dropdown repeats "owner" label redundantly

**Priority:** Low (P3)
**Discovered:** 2026-05-11 (Phase 29 QA Sweep, Persona A)
**Status:** Captured, deferred to v2.3+

**Description:** Top-right org selector dropdown shows "AI Simple owner / Business 1 member owner / GoVibey 1 member owner". The "owner" label after each org repeats — the owner is the same user for all 3.

**Expected:** Either remove redundant "owner" labels OR only show membership count for non-owner orgs.

**Persona:** A
**Surface:** Top-right org selector dropdown
**Screenshot:** `.planning/phases/29-qa-sweep-regression-catalog/screenshots/qa-17-org-switcher-owner-redundant.png`

---

### QA-18 — People page contacts table sometimes shows skeleton rows that don't resolve

**Priority:** Low (P3)
**Discovered:** 2026-05-11 (Phase 29 QA Sweep, Persona A)
**Status:** Captured, deferred to v2.3+

**Description:** On `/people` navigation, the table briefly shows 8 skeleton rows before populating. During the sweep, one navigation showed skeletons that never resolved to data — likely a cache/refresh edge case.

**Expected:** Skeletons resolve to actual data on every navigation, OR show an empty-state if no data exists.

**Persona:** A
**Surface:** `/people`
**Screenshot:** `.planning/phases/29-qa-sweep-regression-catalog/screenshots/qa-18-people-skeleton-rows.png`

---

### QA-23 — Phase 29 sweep created throwaway test signup account in production; cleanup needed

**Priority:** Low (P3)
**Discovered:** 2026-05-11 (Phase 29 QA Sweep, Persona B)
**Status:** Captured, deferred to v2.3+

**Description:** During Plan 29-03 sweep, a throwaway signup `qa***-***@vibeos.com` (timestamped) was created in production Supabase Auth to verify that brand-new signups work at the API level. The account is unconfirmed, has no associated data, and represents minimal data footprint, but does live in the auth.users table.

**Expected:** Decision needed — delete the account via Supabase Auth admin panel, OR keep it as a permanent free-tier canary alongside `so***@vibeos.com`. No security impact either way.

**Steps:**
1. Sign in to Supabase Auth admin for production project `vltmrnjsubfzrgrtdqey`
2. Search users for `qa***-***@vibeos.com`
3. Confirm the row is unconfirmed (no `email_confirmed_at`), has no organizations, and no payment method
4. Delete the user row

**Persona:** B
**Surface:** Supabase Auth admin panel (production)
**Screenshot:** `.planning/phases/29-qa-sweep-regression-catalog/screenshots/qa-23-throwaway-account-cleanup.png`


## MCP `private_key_jwt` Token Endpoint Auth (RFC 7523)

**Priority:** Low (no current client requires it)
**Requested by:** Followup from mcp-dcr-public-downgrade debug session (2026-05-12)
**Status:** Not yet scoped

**Context:**

Today, MCP clients that ask for `token_endpoint_auth_method: "private_key_jwt"` / `"tls_client_auth"` / `"self_signed_tls_client_auth"` during Dynamic Client Registration are remapped to `client_secret_basic` by our `/mcp-register` proxy. This works — it preserves the confidential-client contract and ships a `client_secret` — but it uses shared-secret auth instead of asymmetric crypto, which is what the client originally requested.

Build proper RFC 7523 JWT-bearer client authentication if/when an enterprise customer specifically requires it, or if a major MCP client (Perplexity, ChatGPT, Claude) starts hard-failing on the remap.

**Scope:**

1. **DB migration** — add `jwks` (JSONB) and `jwks_uri` (text) columns to the Supabase-managed `oauth_clients` table. This may require coordinating with Supabase support since `oauth_clients` is managed by the auth provider.
2. **Update `/mcp-register`** — accept and persist `jwks` / `jwks_uri` fields per RFC 7591 §2. Stop remapping `private_key_jwt` to `client_secret_basic` when the client also provides a key.
3. **JWT-verifying proxy layer in Cloudflare Worker** (`cloudflare/api-proxy/worker.ts`) — sits in front of Supabase's `/auth/v1/oauth/token` endpoint. For confidential clients with `token_endpoint_auth_method: "private_key_jwt"`:
   - Parse `client_assertion` JWT from the form body.
   - Look up the registered client's public key (from `jwks` column or by fetching `jwks_uri`).
   - Verify signature, `iss` = `sub` = client_id, `aud` = our token endpoint URL, `exp` in the future, `jti` not seen recently (anti-replay).
   - On success, swap the assertion for HTTP Basic `client_secret_basic` credentials and forward the request to Supabase.
4. **Update `/.well-known/oauth-authorization-server`** — advertise `token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post", "private_key_jwt"]`.
5. **Tests** — unit tests for JWT verification edge cases (expired, wrong audience, wrong signature, missing claims, kid mismatch, replay), integration test for full DCR + JWT-bearer dance.

**Touches:**

- `supabase/functions/mcp-oauth-register/index.ts` (accept jwks/jwks_uri)
- `cloudflare/api-proxy/worker.ts` (JWT verification layer in front of /auth/v1/oauth/token)
- `supabase/functions/mcp-oauth-metadata/index.ts` (advertise method support)
- New migration if Supabase allows extending `oauth_clients`, else a sidecar table (`mcp_oauth_client_keys`).

**Estimate:** 1–2 days of focused work. Most of the time is the Cloudflare Worker JWT-verifier and its test coverage.

**Trigger to build:** an enterprise client specifically requires it, OR the MCP spec gets stricter and Perplexity/ChatGPT/Claude start hard-rejecting the remap fallback. Today the remap to `client_secret_basic` works for every RFC 7591 client we've tested (verified 2026-05-12 in `.planning/debug/mcp-dcr-public-downgrade.md`).

---
---

*QA Sweep Orphans section added 2026-05-11 by Phase 29 Plan 05 (catalog write-back).*

