# Schema Truth

This document records, permanently, how to know what the CallVault production schema
actually is — and corrects a specific claim from Phase 30 research that turned out to be
wrong on direct verification. Read this before trusting `supabase/migrations/` as a replay
script, and before writing a new "fix the schema" migration.

Prod ref: `vltmrnjsubfzrgrtdqey` (do not confuse with the `callvault-test` project).

---

## 1. The live database is the source of truth. The migration folder is a historical log.

`supabase/migrations/` records the *sequence* of DDL statements that produced today's schema.
It is not guaranteed to be a byte-for-byte replayable script, and it is not guaranteed to be
in sync with `src/types/supabase.ts`. Two independent failure modes can make either of those
untrue, and this milestone (Phase 30 / SAFE-07) found one real instance of each:

- **Committed types drifting from live schema (confirmed real, 2026-08-31).** Before this
  plan, `src/types/supabase.ts` was stale by roughly 7 migrations: missing the
  `fathom_calls_orphan_report` and `organization_invitation_workspaces` tables, missing
  `recordings.ai_generated_title` / `recordings.ai_title_generated_at`, missing ~9 columns
  each on `tickets` and `sync_jobs`, and missing 3 RPCs
  (`get_decrypted_source_credential`, `get_org_call_participant_contacts`,
  `reap_stale_sync_jobs`). This class of drift is mechanical: whoever last changed the schema
  didn't run a types regeneration afterward. **Fix:** regenerate — see Section 3.

- **A suspected "undocumented rename" that, on verification, was NOT undocumented (see
  Section 2).** Before assuming a migration gap exists, verify it directly against migration
  file contents — not just filenames, and not just training-data intuition about what a
  migration folder "usually" looks like.

**The standing rule:** when you need to know the current shape of the schema, run
`supabase gen types typescript --linked` against the linked prod project and read that
output. Do not assume `supabase/migrations/` alone tells you the truth, and do not assume it
*doesn't* without checking — both directions of assumption have already caused real problems
in this repo.

---

## 2. Investigated: the "banks -> organizations" transition (F16) — verified NOT a gap

Phase 30 research (`.planning/phases/30-schema-reconciliation-event-model-foundation/30-RESEARCH.md`)
flagged a suspected gap: that `recordings` was created referencing a `banks` table
(`20260131000007_create_recordings_tables.sql`, line 16:
`bank_id UUID NOT NULL REFERENCES banks(id) ON DELETE CASCADE`), the live table has
`organization_id` with no `bank_id`, and — the research claimed — "no migration performs
that rename," meaning a `supabase db push`/`db reset` from an empty database would fail at
that transition.

**This plan (30-01) verified that claim directly against migration file contents and found
it to be incorrect.** The rename IS captured, in the correct chronological position, inside
`supabase/migrations/20260301000001_rename_vaults_to_workspaces.sql` — a migration named
for the *vaults -> workspaces* rename that, in the same transaction, also performs the
*banks -> organizations* rename:

```sql
-- 20260301000001_rename_vaults_to_workspaces.sql, lines 16-17
ALTER TABLE banks RENAME TO organizations;
ALTER TABLE bank_memberships RENAME TO organization_memberships;

-- line 30 — the specific column the research flagged
ALTER TABLE recordings RENAME COLUMN bank_id TO organization_id;
```

The same migration also renames `bank_id` to `organization_id` on every other table that had
gained a `bank_id` column via the intermediate migrations between `banks` table creation and
this rename (`call_tags`, `chat_sessions`, `content_items`, `content_library`, `folders`,
`templates`, `workspaces`, `organization_memberships`, `import_routing_rules`,
`import_routing_defaults`) — cross-checked directly: every table that
`20260210170000_add_bank_id_to_folders_and_tags.sql` and
`20260211100000_add_bank_id_to_content_and_chat.sql` add a `bank_id` column to is covered by
the rename migration's column list. The live schema confirms the end state:
`organizations` has no `bank_id`/`cross_bank_default` (renamed to `cross_org_default` by the
later `20260303000003_naming_cleanup.sql`), and `recordings` has `organization_id`, not
`bank_id` — matching what the rename migration produces.

**Chronological order is also correct.** `20260131000005_create_banks_tables.sql` creates
`banks` first; `20260131000007_create_recordings_tables.sql` creates `recordings` referencing
it; six intermediate migrations (2026-02-09 through 2026-02-11) add more `bank_id` columns;
`20260301000001_rename_vaults_to_workspaces.sql` renames everything; and the first migration
that *assumes* `organizations`/`organization_id` already exist
(`20260306000000_personal_organization_and_home.sql`) comes strictly after the rename. A
fresh `supabase db push` replaying migrations in filename order would hit the rename before
anything downstream depends on the renamed names.

**Conclusion:** the specific F16 gap as described in Phase 30 research does not exist. The
migration folder correctly captures the banks -> organizations transition. **Do not** author
a synthetic "rename banks to organizations" migration — there is nothing to fix here, and a
replay-only migration against a table that's already correctly named would be pure risk with
no benefit (it would either no-op destructively against already-renamed tables, or conflict
with the real rename migration's history).

**Scope of this verification:** this was a targeted check of the one transition the research
flagged (table renames + every `bank_id` column rename touching `recordings` and its six
sibling tables), not a full clean-room replay of all ~289 migrations against an empty
database (that would require a local Docker stack, which is not available on this machine —
see `supabase/CLAUDE.md` "Docker is NOT running on Andrew's machine"). If a *different* replay
gap is suspected in the future, verify it the same way this one was verified — read the
actual migration file contents in chronological order — before writing a corrective
migration or assuming the folder is broken.

---

## 3. How to regenerate types correctly

```bash
supabase gen types typescript --linked > src/types/supabase.ts
```

This requires the Supabase CLI to already be linked to the prod project (`supabase link
--project-ref vltmrnjsubfzrgrtdqey`, or check with `supabase projects list` — the linked
project shows a `●` in the LINKED column). It uses the CLI's own authenticated session; no
`DATABASE_URL` or service-role key is read or echoed anywhere in this command.

`npm run gen:types` now runs this same command (fixed in this plan — see git history for
`package.json`). Previously it gated on `$SUPABASE_DB_URL`, which this repo never sets (the
convention is `DATABASE_URL`), so the script silently did nothing and exited 0 with no file
change. If `npm run gen:types` ever again exits 0 with no diff to `src/types/supabase.ts`,
suspect the same class of bug and re-check the script against `package.json`.

After regenerating, run `npm run type-check`. Corrected types can shift TypeScript's
structural inference on code that pattern-matches Row types (`Pick`/`Omit` helpers,
exhaustive switches) even when nothing is actually broken — read what changed before running
`npm run type-check:update-baseline`, and never update the baseline blindly.

---

## 4. Guidance for future engineers

- Treat `supabase/migrations/` as a historical narrative, useful for understanding *how* the
  schema got here, but verify specific claims about it (a suspected gap, a suspected
  ordering issue) by reading the actual file contents — not by filename pattern-matching and
  not by assuming.
- Treat `src/types/supabase.ts` as correct only as of its last regeneration. If you're not
  sure it's current, regenerate it — it's cheap and safe (Section 3).
- Never write a "fix the schema" migration to patch a gap you haven't verified exists against
  the actual migration file contents, in chronological order.

---
*Written: 2026-08-31, Phase 30 Plan 01 (SAFE-07). Verified against prod ref
`vltmrnjsubfzrgrtdqey` via `supabase gen types typescript --linked` and direct reads of
`supabase/migrations/20260131000005_create_banks_tables.sql`,
`supabase/migrations/20260131000007_create_recordings_tables.sql`,
`supabase/migrations/20260210170000_add_bank_id_to_folders_and_tags.sql`,
`supabase/migrations/20260211100000_add_bank_id_to_content_and_chat.sql`,
`supabase/migrations/20260301000001_rename_vaults_to_workspaces.sql`, and
`supabase/migrations/20260303000003_naming_cleanup.sql`.*
