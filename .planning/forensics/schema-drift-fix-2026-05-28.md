# Schema Drift Fix — 2026-05-28

**Trigger:** Acting on the findings in `schema-drift-audit-2026-05-28.md`.

**Project:** `vltmrnjsubfzrgrtdqey`
**Operator:** Don (Claude Opus 4.7)

---

## Pre-fix state

Audit recorded:
- **CRITICAL:** 5 unapplied migrations (after the renumbered drop_composio)
- **MEDIUM:** 5 orphan prod objects (functions/triggers with no migration source)
- **LOW:** 1 missing trigger (`update_ai_models_updated_at`)
- **INFO:** 1 renumbered migration applied as `20260525000000` instead of `20260525170000`

### Why migrations stalled (investigation)

Tracing the unapplied migrations against the live prod schema revealed two distinct stalls:

1. **`20260523192117_composio_integration_ids.sql`** — adds `composio_connected_account_id` column + unique index. Was likely skipped because `20260525170000_drop_composio_artifacts.sql` (which removes it) was applied AHEAD of it under timestamp `20260525000000`. Net: column intentionally absent in prod. Applying the CREATE now would re-add the column we just dropped. **Fix:** `supabase migration repair --status applied 20260523192117` — mark as logically applied without running, since the drop already negates it.

2. **`20260524050000_connector_specific_routing_defaults.sql`** — adds `source_app` column + composite PK + CHECK constraint on `import_routing_defaults`. **Investigation found this DDL was already manually applied to prod** (column, PK, CHECK constraint all present, with connector-specific rows already inserted). All migration statements are `IF NOT EXISTS` / `IF EXISTS DROP` / `NOT VALID … VALIDATE` patterns so the file is safe to re-run — it will be a no-op on prod.

3. **`20260525083000_disconnect_connector_source_rpc.sql`** — creates `disconnect_connector_source(text, uuid)` RPC. All referenced columns on `user_settings` and `import_sources` exist in prod. Stalled because the migration BEFORE it (composio_integration_ids) stalled. Safe to apply.

4. **`20260525084500_single_account_connector_guard.sql`** — adds unique partial index `idx_import_sources_single_account_active` and replaces `store_encrypted_fireflies_credentials`. Neither exists in prod. Same stall cause as above. Safe to apply.

5. **`20260525160000_sort_recordings_by_recording_start_time.sql`** — replaces `get_workspace_recordings` to sort by `recording_start_time`. Function exists in prod with old sort. Same stall cause. Safe to apply.

### Local file rename

Renamed `20260525170000_drop_composio_artifacts.sql` → `20260525000000_drop_composio_artifacts.sql` to match the prod-applied timestamp. Sole change: filename. Content identical.

---

## Applied migrations

(Populated below as each succeeds.)
