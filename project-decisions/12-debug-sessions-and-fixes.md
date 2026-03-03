# Debug Sessions & Fixes

Issues discovered and the fixes needed to resolve them.

---

## Bank/Workspace Isolation (Multi-Session Effort)

The core problem: tables lack `bank_id` columns, so data from all workspaces is visible regardless of the active workspace. This requires a multi-table isolation sweep.

### workspace-scope-isolation (Folders + Tags)

- [ ] Problem: Folders and tags show data from all workspaces — only calls are correctly scoped
- [ ] Root cause: `folders` table has no `bank_id`; `call_tags` has no `bank_id`
- [ ] Fix needed: Add `bank_id` column to both tables via migration
- [ ] Backfill existing rows from personal bank associations
- [ ] Update `useFolders.ts` and `useCategorySync.ts` to filter by active bank
- [ ] Update ~14 component files that consume folder/tag data
- [ ] Handle orphaned rows: users without personal banks may have NULL bank_id — DELETE these before adding NOT NULL constraint

### workspace-content-chat-isolation (Chat + Content)

- [ ] Problem: Chat sessions, content_library, content_items, and templates show data from all workspaces
- [ ] Root cause: All 4 tables have no `bank_id` column; queries filter by user_id only
- [ ] Fix needed: Add `bank_id` to all 4 tables via migration
- [ ] Update all lib functions: content-library.ts, content-items.ts, templates.ts, content-persistence.ts
- [ ] Update useChatSession hook to filter by bank
- [ ] Update all Zustand stores that cache this data
- [ ] Update all consumer components (~20+ files)
- [ ] Check for bare function calls that bypass the hook layer (e.g., PostsLibrary Retry, EmailsLibrary Retry, TemplatesPage handleTemplateSaved)

### bank-workspace-issues (5 Issues)

- [ ] Home page shows all calls regardless of workspace — add bank-aware filtering to TranscriptsTab via recordings table bridge
- [ ] No workspace deletion capability — create useDeleteBank hook and DeleteBankDialog component
- [ ] Settings buttons in VaultManagement are dead — wire onClick handler
- [ ] Dropdown highlights are solid orange — `--accent` CSS variable is set to Vibe Orange (32 100% 50%); change to neutral gray (0 0% 95%)
- [ ] Add missing "banks" entry to Settings.tsx topicMap

### missing-bank-switcher

- [ ] Problem: 6 of 11 users have no bank/vault records, so the bank switcher is completely absent
- [ ] Root cause: `handle_new_user` trigger only fires for new signups; migration function only creates banks when migrating calls; pre-Phase-9 users with 0 fathom_calls were never backfilled
- [ ] Fix needed: Create `ensure_personal_bank` SQL RPC (idempotent — creates personal bank+vault if missing)
- [ ] Run one-time backfill DO block for the affected users
- [ ] Update `useBankContext` hook to call the RPC when no banks are found

---

## YouTube Import (Multi-Layer Bugs)

### youtube-import-400-error

- [ ] Problem: YouTube imports fail with HTTP 400
- [ ] Root cause: `youtube-import` passes the service role key to `youtube-api`, but `youtube-api` calls `supabase.auth.getUser(token)` which only accepts JWT user tokens — causes internal 401, surfaced as 400
- [ ] Fix needed: Pass the original user's JWT token instead of the service role key in both internal API calls (video-details and transcript fetch)

### youtube-post-import-issues (7 UX Failures)

- [ ] No import progress feedback — add timer-based simulation during transcription
- [ ] Vault list not refreshed after auto-creation — add `queryClient.invalidateQueries` for vaults after import
- [ ] YouTube videos appearing in main recordings list — add filter to exclude `source_platform='youtube'` from general call list
- [ ] CallDetailPage shows sales-specific tabs for YouTube content — rewrite to detect `source_platform` and render YouTube-specific layout (thumbnail, metadata, About tab, AI Chat CTA)
- [ ] No timestamps in transcript — switch to `format=json + include_timestamp=true` and render [MM:SS] headers
- [ ] "Open in AI Chat" passes no recording context — fix to pass ChatLocationState with recording data
- [ ] AI Chat can't access YouTube transcripts — three-part fix needed in getCallDetails, system prompt, and Chat.tsx loadSession

### youtube-vault-visibility-ui

- [ ] Fragile PostgREST join query in edge function Step 0 fails silently (bank_id becomes null)
- [ ] Fix needed: Replace with two simple sequential queries; reuse resolved personalBankId in Step 6
- [ ] Videos invisible after source_platform filter — need a YouTube hub/view to show them
- [ ] Massive full-width thumbnail — switch to compact 168x94px thumbnail with metadata alongside

---

## Chat & Search Issues

### call-dialog-eliminated

- [ ] Problem: Chat citation links open a side panel instead of the original popup dialog — user preference is the original dialog
- [ ] Fix needed: Revert `handleViewCall` in Chat.tsx to the original async flow — fetch from fathom_calls, set `selectedCall` state, call `showCallDialog(true)`. Remove `usePanelStore` import.

### inline-view-details-pill

- [ ] Problem: AI-generated "View Details" markdown links render as underlined external links instead of pill buttons
- [ ] Fix needed: Add `onViewCall` prop to Markdown component, create `extractRecordingId` helper supporting numeric IDs and Fathom URLs, detect "View Details" text in link component and render a `Badge variant="outline"` with "VIEW" text wired to handleViewCall

### view-details-pill

- [ ] Problem: "View full call" in chat source hover card links to Fathom's share URL in a new tab
- [ ] Fix needed: Replace text link with `Badge variant="outline"` showing "VIEW", wire to open CallDetailDialog instead of external URL

### mcp-semantic-search-track-speaker

- [ ] `search.semantic` returns non-2xx — OpenAI API key is expired/revoked
- [ ] `analysis.track_speaker` returns 0 results — `parseInt("406a116b-...")` on UUID silently returns 406 (the UUID prefix digits)
- [ ] `hybrid_search_transcripts` RPC has wrong JOIN: `fc.id` instead of `fc.recording_id` (fathom_calls has no `id` column); also uses inline `to_tsvector()` instead of indexed `fts` column
- [ ] Fixes needed: Correct the RPC join + indexed fts column, add graceful BM25 fallback when OpenAI is unavailable, fix trackSpeaker to detect UUID format and resolve to legacy_recording_id via recordings table lookup

---

## Other Issues

### date-picker-same-day-range

- [ ] Problem: Selecting same date for start and end returns zero results (identical timestamps create zero-width range)
- [ ] Fix needed: Add `normalizeDateRange()` helper — detect same-calendar-day and set `from` to 00:00:00.000 and `to` to 23:59:59.999; also fix display to show single date instead of redundant range

### sync-source-filter-persistence

- [ ] Problem: Toggling a sync source OFF then refreshing resets it to ON
- [ ] Root cause: When `connectedPlatforms` transitions from `[]` to actual values (async load), auto-enable logic treats this as "newly connected" and overwrites saved filter
- [ ] Fix needed: Detect initial platform arrival (previousConnected.length === 0 && connectedPlatforms.length > 0) and apply saved filter instead of auto-enabling

### team-memberships-rls-recursion

- [ ] Problem: HTTP 500 with "infinite recursion detected in policy for relation 'team_memberships'"
- [ ] Root cause: `content_library` SELECT policy references `team_memberships`, which has a self-referencing SELECT policy
- [ ] Fix needed: Create migration introducing SECURITY DEFINER functions (`is_active_team_member`, `is_team_admin`) that bypass RLS, then drop and recreate all 4 team_memberships policies using them
- [ ] **Verify this migration has been applied to production**

---

## Deferred Architecture Decisions

- [ ] **automation-rules-data-wiring**: `/automation-rules` currently redirects to `/sorting-tagging/rules` — decide if this redirect is final, or if the route should render the same underlying data
- [ ] **call-detail-pane-architecture**: Keep `/call/:callId` as standalone page for now — future decision needed: standalone full page, 3rd-pane detail view, or 4th-pane slide-in
- [ ] **design-guidelines-v5-replacement**: Draft spec exists at `docs/specs/SPEC-pane-first-design-guidelines-refresh.md` — needs to be promoted to canonical and enforced
- [ ] **shared-with-me-data-wiring**: DB-backed shared links path works, but legacy tables (`call_share_access_log`, `team_memberships`) cause runtime errors — confirm canonical sharing schema and add defensive fallbacks
- [ ] **ui-alignment-phase2**: Token normalization, spacing/typography normalization, loading/empty/error state normalization all pending
