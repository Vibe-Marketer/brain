---
phase: 30-schema-reconciliation-event-model-foundation
verified: 2026-09-01T15:30:00Z
status: passed
score: 6/6 must-haves verified
overrides_applied: 0
---

# Phase 30: Schema Reconciliation + Event Model Foundation Verification Report

**Phase Goal:** The event layer exists in the schema — truthfully — and changes no current behavior. This is the load-bearing foundation; F16/F17 mean the schema must be made truthful before a single migration is authored.
**Verified:** 2026-09-01T15:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Verification Method

This phase's deliverable is a production database schema change, so verification went beyond reading committed files. The Supabase CLI was already linked to the production project (`vltmrnjsubfzrgrtdqey`, `callvault-ai` — confirmed via the `●` marker in `supabase projects list`), which allowed direct, read-only introspection of the **live production schema, RLS policies, functions, and triggers** via `supabase db query --linked` (Management API, no Docker/DATABASE_URL required — the same auth path `gen types --linked` uses). All SQL run was `SELECT`-only against `pg_catalog`/`information_schema` — no data was read, written, or mutated. In addition, both test suites the phase produced (`rls-regression.test.ts`, `event-schema-noop.integration.test.ts`) were re-executed fresh against the TEST project in this session, not inferred from SUMMARY.md text.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Schema record made truthful (F16/F17 resolved) **before** any new migration was authored (SAFE-07) | VERIFIED | `supabase/SCHEMA_TRUTH.md` exists (148 lines). Its F16 claim — that the banks→organizations rename IS captured in `20260301000001_rename_vaults_to_workspaces.sql` — was independently re-verified by reading that file directly: lines 16/17/30 contain exactly `ALTER TABLE banks RENAME TO organizations;`, `ALTER TABLE bank_memberships RENAME TO organization_memberships;`, `ALTER TABLE recordings RENAME COLUMN bank_id TO organization_id;`. Live prod `recordings` table confirmed to have `organization_id`, no `bank_id` (direct SQL query). F17 (drift) resolved: `src/types/supabase.ts` contains `fathom_calls_orphan_report` (grep confirmed) and 21 occurrences of `event_id`. `package.json`'s `gen:types` script reads `"supabase gen types typescript --linked > src/types/supabase.ts"` — fixed, no `SUPABASE_DB_URL` reference. `npm run type-check` re-run in this session: `TYPE CHECK PASSED: 0 new errors. Baseline errors remaining: 319/319.` Git history confirms Plan 01 (schema truth) landed as its own commits before Plan 02 (the migration) — enforced by `depends_on: ["30-01"]`. |
| 2 | `events` table (UUID-keyed, canonical start/end/resolution-confidence, no content columns) + nullable additive `recordings.event_id` exist (EVT-01, EVT-02) | VERIFIED | Live prod query (`information_schema.columns`) confirms `events` has **exactly** 6 columns: `id` (uuid, default `gen_random_uuid()`), `canonical_start_time`/`canonical_end_time` (timestamptz, nullable), `resolution_confidence` (numeric, nullable), `created_at`/`updated_at` (timestamptz, not null, default `now()`). No `organization_id`, no content column. `recordings.event_id` confirmed live: uuid, nullable. Both indexes backing the RLS predicates (`idx_recordings_event_owner`, `idx_call_participants_event_email`) confirmed present in prod via `pg_indexes`. |
| 3 | Four read paths (`get_workspace_recordings`, `global_search`, MCP `search_calls`, MCP `ask_call`/chat) byte-identical while `event_id` is NULL, proven by test; reads join through `workspace_entries`, no `workspace_id` added to `recordings` (EVT-03, EVT-07) | VERIFIED | Re-ran `VITEST_INTEGRATION_OK=true npx vitest run src/test/event-schema-noop.integration.test.ts --reporter=verbose` fresh in this session against the TEST project: **5/5 passing**, including exact-key-set assertions for all four paths (no `event_id`/`role`/`has_confirmed_speech` leak). Live prod query confirms `recordings` has **no** `workspace_id` column (queried for both `event_id`/`workspace_id`; only `event_id` returned). "Chat" is documented as mapping to MCP `ask_call` (no dedicated chat feature exists in the repo — verified as a reasonable, disclosed interpretation, not a silent gap). |
| 4 | `call_participants` carries `event_id`/`role`/`has_confirmed_speech`; existing readers, `participant_type`, and the `sources[]` evidence trail are unchanged (EVT-05) | VERIFIED | Live prod query confirms all three new columns present with correct types/nullability, plus the new `call_participants_role_check` CHECK (`organizer\|invitee\|attendee\|speaker`). `call_participants_participant_type_check` (`attendee\|speaker\|host`) confirmed **untouched**. `sources` column confirmed still present (ARRAY type). The `populate_participants_from_source_metadata()` trigger (`populate_participants_on_insert`, `AFTER INSERT ON recordings`) confirmed live and unmodified — migration correctly extends `call_participants` without touching this trigger. |
| 5 | Cross-org isolation for `events` + `call_participants` is CI-enforced; `events` RLS grants visibility **only** through participation or an owned capture, never `organization_id`, with no org-admin bypass (SAFE-05, EVT-04) | VERIFIED | `call_participants` is registered in the `CROSS_ORG_TABLES` array (`src/test/rls-regression.test.ts:61`, `filterColumn: "recording_id"`) — confirmed by direct file read. `events` cannot join that array (its closed `filterColumn` union has no member compatible with a table deliberately designed without an org-scoping column — confirmed by reading the TypeScript union type); this is documented as an intentional design decision in the PLAN's own must-haves ("proven by a bespoke test block (not a CROSS_ORG_TABLES array entry)"), not a shortcut discovered after the fact. Instead, `events` is covered by a bespoke 3-fixture isolation block in the **same file**, which is wired into the **same CI job** — confirmed by reading `.github/workflows/ci.yml:215-217`: `run: npx vitest run src/test/rls-regression.test.ts --reporter=verbose` (whole file, no filter). Re-ran that file fresh in this session: **50/50 passing**, including all 3 `events`-specific tests. Live prod query of `pg_policy` for `public.events` returns exactly 2 policies — `"Service role full access"` (service_role, `USING (true)`) and `"participants_and_owners_can_view_events"` — **no third, org-scoped policy exists**. RLS confirmed both `ENABLE`d and `FORCE`d on `events` in prod. |
| 6 | Code review Critical finding CR-01 (`events` RLS participation grant silently unreachable) is genuinely fixed in **live production**, not just claimed fixed (special verification focus per task) | VERIFIED | Direct `pg_policy` query against prod returns the **current, live** `using_expr` for `participants_and_owners_can_view_events`: `(user_participates_in_event(id, lower(auth.email())) OR (EXISTS (SELECT 1 FROM recordings r WHERE ((r.event_id = events.id) AND (r.owner_user_id = auth.uid())))))` — this is the CR-01 **fixed** policy (SECURITY DEFINER helper), not the original broken direct-`EXISTS`-on-`call_participants` policy. `pg_proc` query confirms `public.user_participates_in_event(uuid, text)` is live, `SECURITY DEFINER`, and its body is byte-identical to migration `20260831020000`. Freshly re-ran the gap-closure isolation test in this session: `"a participant with no ownership/org-membership relationship still reads the event via participation alone"` — **PASSED** (65ms) against TEST. This is the exact fixture (a user with zero `organization_memberships` rows and no owned recording) that CR-01's own empirical proof showed returning 0 rows pre-fix; it now returns 1. `events_updated_at` trigger (WR-03) confirmed live via `pg_trigger`. WR-02 (stale deployment-status comment) confirmed corrected in the current file content, matching commit `de46f203`. |

**Score:** 6/6 truths verified

### Code Review Gap-Closure Verification (special focus per task)

`30-REVIEW.md` found 1 Critical + 3 Warning findings. All 4 are confirmed resolved — not just marked resolved:

| Finding | Claimed Fix | Verified How | Result |
|---|---|---|---|
| CR-01 (Critical) — `events` participation RLS grant unreachable (inherited `call_participants`' own org-membership-only RLS) | `SECURITY DEFINER` helper `user_participates_in_event`, migration `20260831020000` | Live prod `pg_policy`/`pg_proc` introspection (exact text match to migration) **+** fresh test execution of the isolated participant-only fixture (PASS) | CONFIRMED FIXED IN PROD |
| WR-01 — new `events` RLS test couldn't detect CR-01 (only fixture satisfied both ownership and participation) | Third fixture (participant with no ownership/org-membership) added in gap closure | Read `rls-regression.test.ts` lines 705-737, 1115-1132; re-ran the file, confirmed the new test present and passing | CONFIRMED FIXED |
| WR-02 — `global_search` fix migration's header comment claimed "TEST only," but it had shipped to prod | Header amended | Read current file content of `20260831010000_...sql`: now states "applied to production on 2026-08-31... Amended: 2026-09-01 (code review WR-02...)"; matches commit `de46f203` | CONFIRMED FIXED |
| WR-03 — `events.updated_at` had no refresh trigger | Trigger + function added in `20260831020000` | Live prod `pg_trigger` query: `events_updated_at BEFORE UPDATE ON public.events ... EXECUTE FUNCTION update_events_updated_at()` present and enabled | CONFIRMED FIXED |

Migration list (`supabase migration list --linked`, currently linked to prod `vltmrnjsubfzrgrtdqey`) shows all three phase-30 migrations (`20260831000001`, `20260831010000`, `20260831020000`) with matching Local/Remote timestamps — applied cleanly, no drift.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/types/supabase.ts` | Regenerated Database type matching live prod; contains `fathom_calls_orphan_report`, `event_id` | VERIFIED | grep confirms both; `events:` Row type block at line 1582 |
| `supabase/SCHEMA_TRUTH.md` | Permanent schema-truth doc, ≥20 lines, names the F16 investigation | VERIFIED | 148 lines; F16 claim independently re-verified against cited migration file |
| `package.json` | `gen:types` uses `--linked`, no `SUPABASE_DB_URL` | VERIFIED | Line 26: `"supabase gen types typescript --linked > src/types/supabase.ts"` |
| `supabase/migrations/20260831000001_create_events_and_extend_participants.sql` | The additive migration: `events` + RLS, `recordings.event_id`, `call_participants` extension | VERIFIED | Read in full; matches `supabase/CLAUDE.md` structure; applied to prod (migration list) |
| `supabase/migrations/20260831020000_fix_events_participation_rls_and_updated_at_trigger.sql` | CR-01 + WR-03 gap-closure fix | VERIFIED | Read in full; live prod policy/trigger match this file exactly |
| `src/test/event-schema-noop.integration.test.ts` | EVT-03 byte-identical proof, ≥60 lines | VERIFIED | 444 lines; 5/5 passing on fresh re-run |
| `src/test/rls-regression.test.ts` | Bespoke `events` isolation block, contains "events" | VERIFIED | Extended with 3-fixture block; 50/50 passing on fresh re-run |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `package.json` `gen:types` script | `supabase gen types typescript --linked` | npm script | WIRED | Confirmed exact string in package.json |
| `events` RLS SELECT policy | `call_participants.email` / `recordings.owner_user_id` | `user_participates_in_event()` (post-CR-01) + `auth.uid()` EXISTS | WIRED | Live prod `pg_policy` text matches; both grant paths independently proven by test (positive/negative/participant-only) |
| `recordings.event_id` | `events.id` | nullable FK, `ON DELETE SET NULL` | WIRED | Confirmed in migration text and live column type |
| Bespoke `events` isolation tests | `events` RLS policy | 3 signed-in JWT clients (owner+participant / unrelated org / participant-only) | WIRED | Fresh run: all 3 pass, including the CR-01-proving participant-only case |
| Byte-identical test | `get_workspace_recordings` / `global_search` / `search_calls` / `ask_call` | exact key-set assertions with `event_id` NULL | WIRED | Fresh run: 5/5 pass |
| Prod migration apply | prod-ref guard | `vltmrnjsubfzrgrtdqey` verification before connecting | WIRED | Independently confirmed: linked project is `vltmrnjsubfzrgrtdqey` (`●` marker); all 3 migrations show matching Local/Remote in `migration list --linked` |

### Data-Flow Trace (Level 4)

Not applicable in the frontend-component sense — Phase 30 is a backend schema/migration phase with no UI rendering dynamic state. The equivalent check (does the RLS policy's data source actually gate on real, live data rather than a stub) was performed as live production policy introspection: see Truth 5/6 and the Code Review Gap-Closure table above. The `events` policy's participation branch was directly confirmed to call a real, live `SECURITY DEFINER` function against production, not a placeholder.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full RLS regression suite, incl. all 3 `events` tests | `npx vitest run src/test/rls-regression.test.ts --reporter=verbose` | 50/50 passing (fresh run, TEST project) | PASS |
| EVT-03 byte-identical proof, all 4 read paths | `VITEST_INTEGRATION_OK=true npx vitest run src/test/event-schema-noop.integration.test.ts` | 5/5 passing (fresh run, TEST project) | PASS |
| Type-check against baseline | `npm run type-check` | `TYPE CHECK PASSED: 0 new errors. Baseline errors remaining: 319/319.` | PASS |
| Confirmation-bias spot check: does Phase 30's new `SECURITY DEFINER` function (`user_participates_in_event`) trip the pre-existing, unrelated `rpc-type-smoke` failure? | `npx vitest run src/test/rpc-type-smoke.test.ts --reporter=verbose` | Fails with 29 pre-existing failures (trigger-return-type false positives + 2 known array-param false positives); `user_participates_in_event` and `update_events_updated_at` do **not** appear among them | PASS (confirms Phase 30 introduced no new regression here; the failure is genuinely pre-existing, corroborating `deferred-items.md`) |

### Probe Execution

SKIPPED — no `scripts/*/tests/probe-*.sh` convention exists in this repo, and no probes are declared in this phase's PLAN/SUMMARY files.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| SAFE-07 | 30-01, 30-04 | Regenerate types from live DB, reconcile against migrations, resolve F16/F17 before any new migration | SATISFIED | Truth 1 |
| EVT-01 | 30-02, 30-04 | `events` table exists, UUID-keyed, canonical start/end/confidence, no content columns | SATISFIED | Truth 2 |
| EVT-02 | 30-02, 30-04 | `recordings.event_id` nullable and additive | SATISFIED | Truth 2 |
| EVT-03 | 30-03 | Four read paths byte-identical while `event_id` NULL, proven by test | SATISFIED | Truth 3 |
| EVT-04 | 30-02, 30-03 | `events` not org-scoped; RLS via participation/ownership only | SATISFIED | Truth 5, Truth 6 |
| EVT-05 | 30-02, 30-04 | `call_participants` extended with `event_id`/role/`has_confirmed_speech`, not replaced | SATISFIED | Truth 4 |
| EVT-07 | 30-02, 30-03 | Event-level reads join through `workspace_entries`, no `workspace_id` on `recordings` | SATISFIED | Truth 3 |
| SAFE-05 | 30-03 | `events` + extended `call_participants` covered by cross-org isolation CI gate | SATISFIED | Truth 5 |

**Orphaned requirements check:** REQUIREMENTS.md traceability table maps exactly `SAFE-07, EVT-01, EVT-02, EVT-03, EVT-04, EVT-05, EVT-07, SAFE-05` to Phase 30 — identical to the task's given requirement-ID list and to the union of all 4 plans' `requirements:` frontmatter fields. No orphans. EVT-06 (`copy_recording_to_org`/`route_recording_cross_org` preserve `event_id`) is explicitly and correctly deferred to Phase 38 per REQUIREMENTS.md's own note, not Phase 30's scope.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER found in any of the 6 phase-critical files (3 migrations, 2 test files, SCHEMA_TRUTH.md) | — | None — clean |
| `.planning/ROADMAP.md` | ~96 | Stale text "`**Plans**: 2/4 plans executed`" directly above 4 checkboxes that are all `[x]` and above a phase heading already marked "✅ ... completed 2026-09-01" | INFO | Cosmetic doc inconsistency only. STATE.md correctly shows 4/4 plans complete. Does not affect any verified truth. |
| repo-wide | — | `event-schema-noop.integration.test.ts` (like all 25 other pre-existing `*.integration.test.ts` files in this repo) is not wired into any CI workflow — only `npm run test:integration` runs it, manually | INFO | Consistent with established, pre-existing repo-wide convention (confirmed: zero `*.integration.test.ts` files are CI-gated anywhere in `.github/workflows/`). Not a Phase-30-specific gap. |
| various (pre-existing) | — | 13 pre-existing, unrelated test failures (5 files) + ~29 pre-existing `rpc-type-smoke` SECURITY DEFINER type-signature false positives, logged in `deferred-items.md` | INFO | Confirmed via adversarial spot-check that Phase 30's own new functions (`user_participates_in_event`, `update_events_updated_at`) are NOT among these failures — genuinely pre-existing and unrelated, not a disguised Phase 30 regression. |

### Human Verification Required

None. This phase is a pure backend/database schema change with no UI surface. Every truth was verified directly against either the committed source, the live production database (read-only SQL introspection), or a freshly-executed test run in this session — nothing was accepted on SUMMARY.md's word alone. Both `checkpoint:decision` (Plan 02 Task 1) and `checkpoint:human-verify` (Plan 04 Task 1) gates were already resolved by Andrew prior to this verification pass, per the SUMMARYs' own explicit records; no dangling human checkpoints remain.

### Gaps Summary

None. All 6 derived observable truths (covering all 8 requirement IDs and all 5 ROADMAP success criteria) verified with direct, adversarial evidence — including live production database introspection for the security-critical RLS claims. The Critical code-review finding (CR-01: `events` participation RLS grant silently unreachable due to inheriting `call_participants`' own restrictive policy) is confirmed fixed in **live production**, not merely claimed fixed in a SUMMARY: the exact `SECURITY DEFINER`-based policy text was read directly from `pg_policy` on the linked prod database, and the isolation test that specifically targets this failure mode was re-executed fresh and passes. All 3 code-review Warnings (WR-01/02/03) are also confirmed resolved. No debt markers, no stubs, no orphaned requirements, no unverifiable claims. The one literal-wording nuance (`events` satisfies SAFE-05's cross-org-isolation intent via a bespoke CI-wired test block rather than a literal `CROSS_ORG_TABLES` array entry) was pre-declared as the correct design in the PLAN's own must-haves frontmatter — before code was written — because `events` is structurally incompatible with that array's closed column-name union by EVT-04's own design; it is not a shortcut, and the resulting test coverage (positive + negative + participation-only) is more rigorous than a standard array entry provides.

---

_Verified: 2026-09-01T15:30:00Z_
_Verifier: Claude (gsd-verifier)_
