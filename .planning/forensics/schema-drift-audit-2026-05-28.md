# Schema Drift Audit — 2026-05-28

**Trigger:** Earlier today, fix `33e2810b` restored a trigger (`tr_ensure_home_workspace` on `organizations`) that had been silently dropped from prod via out-of-band manual DDL. This audit checks for additional drift.

**Method:**
1. Parsed every migration in `supabase/migrations/*.sql` (210 files) with a timeline-aware extractor that tracks create/drop events for triggers, functions, RLS policies, indexes, and check constraints.
2. Queried prod (project `vltmrnjsubfzrgrtdqey`) via `supabase db query --linked` for the live state of each object class.
3. Cross-checked findings against `supabase_migrations.schema_migrations` to identify unapplied migrations.
4. Verified each suspected drift against actual column existence, alternate trigger names, and policy supersession.

**Scope:** READ-ONLY. No DDL run against prod.

---

## EXECUTIVE SUMMARY

**CRITICAL:** 5 unapplied migrations (root cause of most function/index drift)
**MEDIUM:** 4 orphan objects in prod with no migration provenance (manual DDL)
**LOW:** 1 missing trigger (semantic drift — table has `updated_at` col but no auto-touch)
**INFO:** 1 quirky-but-equivalent applied migration (renumbered timestamp)

### Top recommended actions
1. Apply the 5 missing migrations (`supabase migration up --linked` after review)
2. Decide retention of 4 orphan prod objects: either backfill into a new migration or DROP them
3. Add `update_ai_models_updated_at` trigger via new migration (low priority — admin-managed table)

Apparent volume of "missing" objects in raw diff is mostly noise from:
- Table renames (`banks` → `organizations`, `vaults` → `workspaces`, `vault_entries` → `workspace_entries`)
- Column renames (`bank_id` → `organization_id`)
- `fathom_calls`/`fathom_transcripts` converted from tables to **views** in v2 migration to `recordings`
- Policy renames (e.g., "Service role full access" → "Service role access" on `ai_models`)
- Composite index supersession (`idx_call_share_links_user_id` etc. → `idx_call_share_links_recording_user`)
- DO-block dynamic drops not caught by static regex (verified manually)

---

## CRITICAL — Unapplied Migrations (root cause)

The most actionable finding: **6 local migration files exist that have never been applied to prod**, and one applied migration has a phantom timestamp.

| Local file | Status | Objects affected |
|---|---|---|
| `20260523192117_composio_integration_ids.sql` | NOT applied | Composio integration columns/indexes |
| `20260524050000_connector_specific_routing_defaults.sql` | NOT applied | Routing-default rows |
| `20260525083000_disconnect_connector_source_rpc.sql` | NOT applied | `disconnect_connector_source(text, uuid)` function |
| `20260525084500_single_account_connector_guard.sql` | NOT applied | `idx_import_sources_single_account_active` UNIQUE index |
| `20260525160000_sort_recordings_by_recording_start_time.sql` | NOT applied | Recording-sort behavior |
| `20260525170000_drop_composio_artifacts.sql` | applied **as** `20260525000000` (renumbered) | Composio column drops |
| `20260528052504_restore_home_workspace_invariant.sql` | applied | `tr_ensure_home_workspace` (today's fix) |

**Severity:** CRITICAL — `disconnect_connector_source` is referenced by application code as an RPC but doesn't exist in prod. `idx_import_sources_single_account_active` enforces a unique guard against duplicate connector accounts.

**Proposed fix:** Resolve why these migrations weren't applied. Likely one earlier failure blocked the rest. Apply via `supabase db push --linked` after review. The `20260525170000` file is functionally identical to the applied `20260525000000` — either delete the local file or rename it to match.

---

## MEDIUM — Orphan Objects in Prod (manual DDL drift)

These objects exist in production with no defining migration anywhere in the repo. Same drift class as the trigger restored this morning.

| Object | Type | Location | Body | Severity | Proposed fix |
|---|---|---|---|---|---|
| `sync_profile_email()` + `trg_sync_profile_email ON auth.users` | function + trigger | prod only | Syncs `auth.users.email` → `public.user_profiles.email` on UPDATE | MEDIUM | Add migration that codifies (or DROPs if unintended) |
| `trigger_assign_free_role ON user_profiles` | trigger | prod only | (function not in this list — likely calls existing `assign_free_role`-related code) | MEDIUM | Verify behavior, add migration |
| `update_ai_processing_jobs_updated_at()` + `ai_processing_jobs_updated_at ON ai_processing_jobs` | function + trigger | prod only | Standard `NEW.updated_at = now()` touch trigger | MEDIUM | Codify in migration |
| `parse_transcript_to_segments(bigint, text)` | function | prod only | Splits transcript into `call_speakers` segments — REFERENCED by `parse_transcript_chunks_for_recording()` in migration `20260310000002` but never CREATEd there | MEDIUM | Codify (load-bearing — production code depends on it) |
| `update_transcript_tags_updated_at()` | function | prod only | Standard touch trigger | MEDIUM | Codify or drop |

`parse_transcript_to_segments` is the most concerning — it's clearly load-bearing (called by an applied migration) but its source is nowhere in the repo. If this DB is ever rebuilt from migrations alone, transcript parsing breaks.

---

## LOW — Real Schema Drift (table exists, object missing, no supersession)

| object_type | object_name | table | expected_per_migration | present_in_prod | drift_severity | proposed_fix |
|---|---|---|---|---|---|---|
| trigger | `update_ai_models_updated_at` | `ai_models` | created by `20251212000001_create_ai_models.sql`; never dropped; column `updated_at` still exists | NOT present (only `ensure_single_default_model_trigger` exists) | LOW | Add migration recreating it. Low impact — `ai_models` is admin-managed, rarely updated |

---

## INFO — Resolved (no action needed)

Categories of "missing" objects that surfaced in the raw diff but are NOT drift:

### Triggers on dropped tables (10) — cascade-dropped, expected
- `set_coach_notes_updated_at`, `update_call_categories_updated_at`, `update_generated_content_updated_at`, `update_quotes_updated_at`, `update_session_message_count_trigger`, `vault_entries_updated_at`, `vaults_updated_at`, `banks_updated_at`, `protect_default_workspace`, `enforce_max_categories`

### Triggers superseded by rename (3)
- `update_workspaces_updated_at` → prod has `workspaces_updated_at` (renamed in vaults→workspaces migration)
- `update_insights_updated_at` → table was restructured by `20260111000002_create_insights_table.sql.disabled` content; no `updated_at` column
- `auto_tag_skip_on_insert/update ON fathom_calls` → triggers exist on renamed `fathom_raw_calls`

### Functions dropped via DO block (7) — expected
Dropped by `20260430123000_trial_provisioning_and_dead_code_cleanup.sql` (RAG/embedding/chat removal):
- `claim_embedding_tasks()`, `finalize_embedding_jobs()`, `increment_embedding_progress()`, `hybrid_search_transcripts()`, `hybrid_search_transcripts_scoped()`

Cascade-dropped with `coach_notes` table (`20260131190000_drop_coach_tables.sql`):
- `update_coach_notes_updated_at()`

Unapplied migration (covered in CRITICAL above):
- `disconnect_connector_source()`

### Policies on dropped tables (~98) — cascade-dropped, expected
Tables retired: `banks`, `vaults`, `vault_entries`, `vault_memberships`, `bank_memberships`, `coach_notes`, `coach_shares`, `coach_relationships`, `manager_notes`, `teams`, `team_memberships`, `team_shares`, `call_categories`, `call_category_assignments`, `quotes`, `chat_messages`, `chat_sessions`, `chat_tool_calls`, `embedding_queue`, `embedding_jobs`, `embedding_usage_logs`, `categorization_rules`, `call_share_access_log`, `business_profiles` (legacy variant), `generated_content`

### Policies superseded by rename (14)
All "missing" policies on `recordings`, `ai_models`, `call_share_links`, `workspaces`, `insights`, `content_library`, `templates`, `fathom_calls` (now view), `fathom_transcripts` (now view) — prod has equivalent policies with renamed labels (3–7 active policies per table).

### Indexes on dropped tables/columns (~95) — cascade-dropped
All `idx_*_bank_id` indexes (column renamed to `organization_id` and replaced with `idx_*_organization_id`).
All `idx_insights_confidence`, `idx_insights_type` (columns don't exist in restructured `insights` table).

### Indexes superseded by composite indexes (5)
- `idx_call_share_links_user_id`, `idx_call_share_links_share_token`, `idx_call_share_links_call_recording_id` → `idx_call_share_links_recording_user` (composite)
- `idx_insights_recording_user` → `idx_insights_user_recording` (composite, columns swapped)
- `idx_workspaces_created_at`, `idx_workspaces_user_id` → `idx_workspaces_organization_id` (column renamed)
- `idx_routing_rules_bank_priority` → `idx_routing_rules_organization_priority` (column renamed)
- `idx_transcript_tags_transcript_id` → restructured as `(user_id, name)` unique

### CHECK constraints
1 originally flagged on `fathom_calls`: `fathom_calls_transcript_source_check`. Table is now a view, so check constraints don't apply — expected.

---

## Final tally

| Class | Raw diff (table-exists filter) | After supersession-review | Real drift |
|---|---|---|---|
| Triggers missing | 3 | 1 (`update_ai_models_updated_at`) | 1 LOW |
| Functions missing | 7 | 1 (`disconnect_connector_source`, root cause = unapplied migration) | 1 CRITICAL |
| Policies missing | 14 | 0 (all are renames/restructures) | 0 |
| Indexes missing | 23 | 1 (`idx_import_sources_single_account_active`, root cause = unapplied migration) | 1 CRITICAL |
| Check constraints missing | 1 | 0 (target is now a view) | 0 |
| Orphan in prod (not in any migration) | 5 | 5 | 5 MEDIUM |
| Unapplied migrations | — | 5 | 5 CRITICAL |

---

## Proposed migration filenames

```
supabase/migrations/20260528120000_apply_pending_connector_migrations.sql   -- re-runs the 5 missing migrations
supabase/migrations/20260528120100_codify_orphan_prod_objects.sql           -- captures sync_profile_email, trg_sync_profile_email, trigger_assign_free_role, update_ai_processing_jobs_updated_at, parse_transcript_to_segments, update_transcript_tags_updated_at
supabase/migrations/20260528120200_restore_ai_models_updated_at_trigger.sql -- LOW severity
```

Note: per `CLAUDE.md` audit constraints, no migration files have been written. These names are recommendations only.

---

## How to reproduce this audit

1. Extract expected state: `python3 /tmp/extract_expected.py > /tmp/expected.json` (script preserved in `/tmp/`)
2. Query prod object inventories:
   ```bash
   SUPABASE_ACCESS_TOKEN=$SUPABASE_ACCESS_TOKEN supabase db query --linked \
     "SELECT tgname, n.nspname || '.' || c.relname AS tbl FROM pg_trigger t JOIN pg_class c ON t.tgrelid=c.oid JOIN pg_namespace n ON c.relnamespace=n.oid WHERE NOT t.tgisinternal AND n.nspname IN ('public','auth')" \
     --output json > /tmp/prod_triggers.json
   ```
   (similar queries for `pg_proc`, `pg_policy`, `pg_indexes`, `pg_constraint`)
3. Diff: `python3 /tmp/diff3.py`
4. Cross-check unapplied migrations:
   ```bash
   supabase db query --linked "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;"
   ```
   compare against `ls supabase/migrations/*.sql`.

---

**Auditor:** Claude (Opus 4.7) | **Project:** `vltmrnjsubfzrgrtdqey` | **Read-only:** confirmed (no DDL executed)
