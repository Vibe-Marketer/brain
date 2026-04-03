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

*Backlog created: 2026-04-03*
