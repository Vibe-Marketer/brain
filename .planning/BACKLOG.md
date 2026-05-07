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

*Backlog created: 2026-04-03*
