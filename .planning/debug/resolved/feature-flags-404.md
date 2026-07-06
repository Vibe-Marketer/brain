---
status: investigating
trigger: "feature-flags-404: 404 on `feature_flags` — auto-crawl captured this request failing on 5 route(s) (/, /transcripts, /analytics, /people, /import)."
created: 2026-06-28T13:29:17.565Z
updated: 2026-06-28T13:29:17.565Z
source: auto-crawl
evidence_run: ~/dev/auto-crawl/runs/crawl-2026-06-28T08-01-39-170Z
---

## Current Focus

hypothesis: CONFIRMED — Orphaned client query. The `feature_flags` table was intentionally DROPPED in phase 11-01 (FLAG-01, commit 0650c75e) and applied directly to the live Supabase project via the Management API. The current branch (`feat/fireflies-webhook-domain`) does NOT include that phase-11 cleanup, so it still ships the hook (`useFeatureFlags.ts`) and AdminTab query that hit the now-deleted table → PGRST205 / 404 on every authenticated page load. The "crm_tags" hint is a PostgREST nearest-name red herring, NOT a rename.
test: traced query origin (src/hooks/useFeatureFlags.ts + src/components/settings/AdminTab.tsx), confirmed migrations have zero feature_flags creation, found the deliberate DROP migration in git history, confirmed drop commit is NOT an ancestor of current HEAD.
expecting: removal of the orphaned client code (not table recreation) resolves the 404.
next_action: DIAGNOSIS COMPLETE — hand to fix owner. Recommended: remove/retire feature-flags client code, do NOT recreate the table.

## Symptoms

expected: `feature_flags` request should succeed (2xx)
actual: returns **404** on every load of the affected route(s)
errors: `[2026-06-28T08:01:39.769Z] [ERROR] Error fetching feature flags {"code":"PGRST205","details":null,"hint":"Perhaps you meant the table 'public.crm_tags'","message":"Could not find the table 'public.feature_flags' in the schema cache"}`
reproduction: Log in → visit / → request fires on load → 404. Affected routes: /, /transcripts, /analytics, /people, /import
started: detected by auto-crawl on 2026-06-28 (not bisected)

## Eliminated

- hypothesis: The table was renamed to `crm_tags` (suggested by the DB error hint).
  evidence: PostgREST's "Perhaps you meant 'public.crm_tags'" is a generic fuzzy nearest-table-name suggestion, not a rename record. No migration renames feature_flags → crm_tags; the two tables are semantically unrelated (feature flags vs CRM tags). The drop migration is an unconditional `DROP TABLE IF EXISTS public.feature_flags` with no rename.
  timestamp: 2026-06-30T00:00:00Z
- hypothesis: The migration to create `feature_flags` was never written/applied (table simply missing).
  evidence: A feature_flags table clearly existed previously — there is a deliberate DROP migration (commit 0650c75e, FLAG-01) and stale generated types still describe the table. The table existed and was intentionally removed; it is not a never-created table.
  timestamp: 2026-06-30T00:00:00Z
- hypothesis: The query syntax is malformed.
  evidence: `supabase.from("feature_flags").select("*")` is valid PostgREST. The error is PGRST205 (table not in schema cache), not a syntax/parse error. Same shape works for every other table.
  timestamp: 2026-06-30T00:00:00Z

## Evidence

- timestamp: 2026-06-28T13:29:17.565Z
  checked: auto-crawl network capture (cmux WebKit, fetch/XHR shim)
  found: 404 https://vltmrnjsubfzrgrtdqey.supabase.co/rest/v1/feature_flags?select=*
  implication: the app depends on this endpoint; it fails on every affected page load
- timestamp: 2026-06-28T13:29:17.565Z
  checked: browser console on /
  found: [2026-06-28T08:01:39.769Z] [ERROR] Error fetching feature flags {"code":"PGRST205","details":null,"hint":"Perhaps you meant the table 'public.crm_tags'","message":"Could not find the table 'public.feature_flags' in the schema cache"}
  implication: the failure is logged but swallowed — users don't see it (silent failure)
- timestamp: 2026-06-28T13:29:17.565Z
  checked: auto-crawl artifacts
  found: screenshot + raw console + network json at ~/dev/auto-crawl/runs/crawl-2026-06-28T08-01-39-170Z/home-transcripts
  implication: full evidence preserved for replay
- timestamp: 2026-06-30T00:00:00Z
  checked: `rg -i "feature_flags" src` to locate the query origin
  found: Query lives in `src/hooks/useFeatureFlags.ts:14` (`supabase.from("feature_flags").select("*")`), wrapped by `useFeatureFlags(role)`. It is called from `src/components/Layout.tsx:36` and `src/components/ui/sidebar-nav.tsx:127` — both render on EVERY authenticated route, which is why all 5 crawled routes fire it. A second, independent query exists in `src/components/settings/AdminTab.tsx` (lines 164 & 210) for the admin CRUD UI.
  implication: This is a globally-mounted hook (app shell + sidebar), so the failing request fires once per page load everywhere, matching the auto-crawl evidence (/, /transcripts, /analytics, /people, /import).
- timestamp: 2026-06-30T00:00:00Z
  checked: `rg -i "feature_flags|crm_tags" supabase/migrations` and listed the migrations dir
  found: ZERO migrations in the current working tree create (or reference) a `feature_flags` table. No `crm_tags` creation either. Latest migration present is 20260523130000.
  implication: On this branch there is nothing that would provision the table — the schema the code expects does not exist here.
- timestamp: 2026-06-30T00:00:00Z
  checked: `git log --all --grep=feature_flag` and `git show 0650c75e`
  found: Commit `0650c75e` — "chore(11-01): drop feature_flags table via migration (FLAG-01)" — added `supabase/migrations/20260611000001_drop_feature_flags.sql` containing `DROP TABLE IF EXISTS public.feature_flags;`. Commit body: "Applied to linked project via Management API; history recorded via migration repair (supabase db push blocked by phase-10 remote migrations not yet merged to main)."
  implication: The table was DELIBERATELY removed (feature-flags feature retired in phase 11) and the DROP was applied DIRECTLY to the live/linked Supabase project out-of-band. The live DB no longer has the table.
- timestamp: 2026-06-30T00:00:00Z
  checked: `git merge-base --is-ancestor 0650c75e HEAD` and `ls` for the drop migration file
  found: The drop commit is NOT an ancestor of current HEAD (branch `feat/fireflies-webhook-domain`), and `20260611000001_drop_feature_flags.sql` is absent from the working tree. The phase-11 FLAG-01 cleanup (both the migration AND, presumably, the client-code removal) lives on an unmerged branch.
  implication: ROOT CAUSE — schema/code divergence. The live DB had the table dropped (phase 11), but this branch predates/excludes that cleanup and still ships the querying code. Code expects a table the DB intentionally no longer has.
- timestamp: 2026-06-30T00:00:00Z
  checked: `src/types/supabase.ts:1565`
  found: Generated Supabase types STILL describe `feature_flags` (Row/Insert/Update), i.e. types were not regenerated after the drop.
  implication: Stale generated types masked the breakage — TypeScript still believes the table exists, so the dead query compiled cleanly. The error is silently swallowed at runtime (hook returns `[]`), making this a silent failing request on every page load.

## Resolution

root_cause: Orphaned/dead client query against a deliberately-removed table. The `feature_flags` table was intentionally dropped in phase 11-01 (FLAG-01, commit 0650c75e) via `DROP TABLE IF EXISTS public.feature_flags`, applied directly to the live Supabase project through the Management API. The current branch (`feat/fireflies-webhook-domain`) does NOT include that phase-11 cleanup, so it still ships `src/hooks/useFeatureFlags.ts` (and the AdminTab CRUD) which call `supabase.from("feature_flags").select("*")`. Because `useFeatureFlags(role)` is mounted in the app shell (`Layout.tsx`) and `sidebar-nav.tsx`, the request fires on every authenticated route and returns PGRST205 / 404 ("Could not find the table 'public.feature_flags' in the schema cache"). The DB's "Perhaps you meant 'public.crm_tags'" is a PostgREST nearest-name suggestion — a red herring, NOT a rename. Stale generated types (`src/types/supabase.ts` still lists feature_flags) hid the breakage at compile time, and the swallowed error (returns `[]`) hides it at runtime.
fix: REMOVE the orphaned feature-flags client code — do NOT recreate the table (its removal was intentional). Recommended path: merge/cherry-pick the phase-11 FLAG-01 removal work into this branch rather than reinvent it. Concretely: (1) delete/retire `src/hooks/useFeatureFlags.ts`; (2) remove its callers in `src/components/Layout.tsx` and `src/components/ui/sidebar-nav.tsx`, replacing each `isFeatureEnabled(...)` gate with the phase-11-decided static default; (3) remove the Feature Flags section + the two `from("feature_flags")` queries in `src/components/settings/AdminTab.tsx`; (4) regenerate `src/types/supabase.ts` so the stale `feature_flags` type is dropped. Net effect: zero requests to the deleted endpoint, no 404. (Alternative — only if the feature is actually being revived — write a real create migration for `feature_flags`; but evidence says it was retired, so removal is correct.)
verification: (pending — diagnose-only; no code changed)
files_changed: []
