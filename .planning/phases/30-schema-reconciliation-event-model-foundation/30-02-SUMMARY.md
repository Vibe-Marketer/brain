---
phase: 30-schema-reconciliation-event-model-foundation
plan: 02
subsystem: database
tags: [supabase, postgres, rls, migrations, event-model, schema-foundation]

# Dependency graph
requires:
  - phase: 30-01
    provides: "Truthful schema baseline (src/types/supabase.ts regenerated from live prod; SCHEMA_TRUTH.md)"
provides:
  - "Migration authored, committed, and applied to TEST (callvault-test): supabase/migrations/20260831000001_create_events_and_extend_participants.sql"
  - "Task 1 reversibility-gate decision recorded: option-a, approved as-is"
  - "TEST project (callvault-test) caught up from 9-migration backlog to current, by Andrew's explicit authorization outside this executor invocation"
  - "TEST introspection confirmed shape: events (6 cols, no org-scoping/content columns), recordings.event_id, call_participants.event_id/role/has_confirmed_speech"
affects: [30-03, 30-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "events RLS mirrors the audited auth.email()/auth.uid() participation-or-ownership pattern from 20260309100000/20260309120000 -- never a raw auth.users join, never an org-admin bypass on a non-org-scoped table."
    - "Automated grep-based migration acceptance checks scan the WHOLE file including comments -- a negation-style explanatory comment ('no workspace_id added here') still trips a naive `grep -q workspace_id` check. Phrase negative-space comments without the literal forbidden substring."
    - "Before applying a migration to a shared Supabase TEST project, run `supabase migration list --linked` (read-only) first to confirm migration currency -- never assume a TEST project mirrors local supabase/migrations/."

key-files:
  created:
    - supabase/migrations/20260831000001_create_events_and_extend_participants.sql
  modified: []

key-decisions:
  - "Task 1 reversibility gate resolved as option-a, approved as-is, no knob changes -- pre-resolved by the human operator (Andrew) outside this executor agent's invocation, carried verbatim into Task 2's DDL."
  - "Once a read-only `supabase migration list --linked` check (after relinking to callvault-test) confirmed TEST is 9 migrations behind local, stopped the TEST-apply sub-step rather than catching up TEST's backlog or falling back to prod -- per this plan's explicit instruction and this invocation's critical_context."
  - "Relinked the Supabase CLI to callvault-test ONLY to run the read-only migration-currency check, then immediately relinked back to callvault-ai (prod) and verified restoration via both supabase/.temp/project-ref and `supabase projects list`. No write operation was issued against either project this plan."

requirements-completed: []

# Metrics
duration: ~20min (approximate -- start time not explicitly captured), plus ~10min orchestrator-side TEST catch-up
completed: 2026-08-31
status: complete
---

# Phase 30 Plan 02: Events Schema Migration Summary

**`events` table + `recordings`/`call_participants` extension migration authored, spec-verified, committed, and applied to TEST (option-a RLS shape). TEST catch-up: the executor correctly stopped when it found `callvault-test` 9 migrations behind rather than guessing; Andrew explicitly authorized catching TEST up, the orchestrator applied the 9 backlog migrations plus this one via `supabase db push --linked` against `callvault-test` (ref `swjzxiddcrtaqixsfaac`), and introspection confirmed the shape. CLI relinked back to prod and verified after every TEST operation.**

## Performance

- **Duration:** ~20 min (approximate)
- **Completed:** 2026-08-31T22:00:50Z (commit timestamp)
- **Tasks:** 2 of 2 attempted; Task 1 resolved (decision-only, pre-approved), Task 2 partially complete (file authored + committed; TEST apply blocked)
- **Files modified:** 1 (created)

## Accomplishments

- Task 1 (checkpoint:decision, reversibility gate) recorded as resolved: **option-a, approved as-is, no knob changes** -- this decision was made by the human operator outside this agent's invocation and is carried verbatim into the DDL below.
- Authored `supabase/migrations/20260831000001_create_events_and_extend_participants.sql` matching `supabase/CLAUDE.md`'s structure (header block, numbered `====` banners) and the `call_participants`/`fix_invitation_rls_auth_email` precedents exactly:
  - `events` table: 6 columns (`id`, `canonical_start_time`, `canonical_end_time`, `resolution_confidence` with a `0..1` CHECK, `created_at`, `updated_at`) -- no org-scoping column, no content columns.
  - `recordings.event_id` -- nullable FK, `ON DELETE SET NULL`. No workspace column added (EVT-07).
  - `call_participants.event_id` / `.role` (4-value CHECK) / `.has_confirmed_speech` -- all nullable, additive. `participant_type` and its populate trigger untouched.
  - `events` RLS: `ENABLE` + `FORCE`, one participation/ownership `SELECT` policy (`LOWER(auth.email())` / `auth.uid()`), one `service_role FOR ALL` policy. Deliberately no org-admin bypass, no authenticated write policy.
  - Two supporting indexes backing the RLS `EXISTS` predicates.
  - Full `COMMENT ON` coverage documenting NULL semantics for every new column.
- Ran the plan's own automated acceptance check locally (`grep`-based) against the finished file: **`MIGRATION_SHAPE_OK`** -- all six conditions pass (table/FORCE-RLS/`LOWER(auth.email())` present; `workspace_id`/`organization_id`/`participant_type_check` absent).
- Confirmed, with direct evidence, that TEST apply cannot proceed safely this plan (see "Blocked: TEST Project Apply" below) and stopped rather than working around it.

## Task Commits

Task 1 has no commit -- it is a decision-only gate (no files changed); the decision is recorded above and was resolved before this agent was invoked.

1. **Task 2: Author the additive migration and apply it to the TEST project** -- `87ef8ec` (feat) -- **file authored and committed; TEST-apply sub-step explicitly NOT performed (blocked, see below)**.

**Plan metadata:** committed in the same pass as this SUMMARY (see final commit below).

## Files Created/Modified

- `supabase/migrations/20260831000001_create_events_and_extend_participants.sql` -- new additive migration: `events` table + RLS, `recordings.event_id`, `call_participants.event_id`/`role`/`has_confirmed_speech`. Authored and committed. **Not yet applied to any database (local, TEST, or prod).**

## Decisions Made

See `key-decisions` in frontmatter. In short: (1) Task 1's reversibility gate was resolved as option-a by the human operator before this invocation, and is carried into the DDL as-is; (2) after confirming TEST is genuinely behind (not just "unavailable"), chose to stop and surface the blocker rather than either catching up TEST's 9-migration backlog (out of this plan's declared scope, ~2 months of unreviewed drift) or falling back to applying against prod (explicitly forbidden by this invocation's critical_context); (3) the CLI relink used to perform the read-only currency check was fully reverted and verified before continuing, so no shared local state was left pointing at TEST.

## Resolved: TEST Project Apply

**Task 2's second sub-step -- "apply the migration to the TEST project, then introspect to confirm the shape" -- was blocked during executor invocation, then resolved by the orchestrator immediately after with Andrew's explicit authorization.**

**Resolution (orchestrator-side, after the executor's blocker report):**
1. Andrew was presented the exact blocker (9-migration TEST backlog) and asked how to proceed. Chose "Catch up TEST now."
2. Linked Supabase CLI to `callvault-test` (`swjzxiddcrtaqixsfaac`), confirmed via `supabase/.temp/project-ref`.
3. `supabase db push --linked --dry-run` previewed exactly the 9 backlog migrations + `20260831000001_create_events_and_extend_participants.sql` -- matched the executor's read-only finding precisely.
4. `supabase db push --linked` applied all 10 cleanly. Two harmless `NOTICE`s ("policy ... does not exist, skipping") from defensive `DROP POLICY IF EXISTS` statements in migrations that predate this plan -- not from the events migration.
5. `supabase migration list --linked` confirmed all 10, including `20260831000001`, now show as applied on TEST.
6. Introspected via `supabase gen types typescript --linked` against TEST: confirmed `events` (6 columns: `id`, `canonical_start_time`, `canonical_end_time`, `resolution_confidence`, `created_at`, `updated_at` -- no org-scoping, no content columns), `call_participants.event_id`/`.role`/`.has_confirmed_speech`, `recordings.event_id` -- all present, matching the plan's acceptance criteria exactly.
7. Relinked CLI back to prod (`vltmrnjsubfzrgrtdqey`), verified via `supabase/.temp/project-ref`. Reverted incidental `supabase/.temp/*-version` metadata drift files via `git checkout --` (same class of noise the executor documented in Issues Encountered).

**What was checked before the block (by the executor), in order:**

**What was checked, in order:**
1. No `.env`, `.env.local`, or `.env.test` file exists in the repo root (only `.env.example` / `.env.test.example`, and the latter is denied by this environment's own permission settings). No `VITE_SUPABASE_TEST_URL`, `SUPABASE_TEST_SERVICE_ROLE_KEY`, or `DATABASE_URL`-family variable is set in the shell environment either. The documented TEST-project credential path (`supabase/CLAUDE.md`) is not usable from this session.
2. The Supabase CLI (v2.101.0) was already authenticated and linked to **prod** (`vltmrnjsubfzrgrtdqey`, `callvault-ai`) via its own cached session -- this is how Plan 30-01's `--linked` type regeneration worked without any `.env` file.
3. Per `supabase/CLAUDE.md`'s own documented TEST-project workflow ("Option A" -- `supabase link --project-ref <test-project-ref>` then `supabase db push --linked`), relinked the CLI to `callvault-test` (`swjzxiddcrtaqixsfaac`) -- confirmed via `supabase/.temp/project-ref` and `supabase projects list` (● moved to the TEST row).
4. Ran a **read-only** `supabase migration list --linked` against TEST **before any write**, per this plan's own explicit instruction to check migration currency first. Result: TEST's last-applied migration is `20260625120000`; **9 local migrations are missing on TEST**:
   `20260703120000`, `20260703130000`, `20260728120000`, `20260729120000`, `20260730150000`, `20260730160000`, `20260731170541`, `20260829224421`, `20260829231202`.
5. Immediately relinked the CLI back to prod (`vltmrnjsubfzrgrtdqey`) and verified the restoration via both `supabase/.temp/project-ref` and `supabase projects list` (● back on the `callvault-ai` row). No write (`db push`, `migration up`, or equivalent) was ever issued against either project.

**Why this stops here, per explicit instruction (not judgment call):** both this invocation's `critical_context` ("If the TEST project environment is unavailable or behind on migrations, STOP and report it clearly rather than working around it or falling back to prod") and the plan's own Task 2 action text ("If the TEST project is behind on migrations or its env is unavailable to you, STOP and surface it") anticipated exactly this scenario (30-RESEARCH.md Open Question #2). Catching up TEST's 9-migration, ~2-month backlog is a substantial, unreviewed action outside this plan's declared file scope (`supabase/migrations/20260831000001_...sql` only) and was not attempted.

**Resolved:** Andrew chose "Catch up TEST now" -- see "Resolved: TEST Project Apply" above for the exact steps taken.

**Impact:** Plan 30-03 (isolation + byte-identical regression tests) can now proceed -- the migration exists on a current, working TEST project. Plan 30-04 (prod apply) remains separately gated on Plan 30-03's tests passing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Self-caught authoring bug] Explanatory comments tripped the plan's own negative-match acceptance check**
- **Found during:** Task 2, immediately after authoring the migration, while running the plan's own automated acceptance command locally before committing.
- **Issue:** Three explanatory comments used the literal substrings `organization_id` and `workspace_id` in **negation** context (e.g. "No workspace_id is added here") to explain what the migration deliberately does NOT do. The acceptance check is a blunt `! grep -q "workspace_id"` / `! grep -q "organization_id"` over the whole file, which cannot distinguish negation from presence -- so the correct, spec-compliant DDL would have failed its own stated acceptance criteria on a wording technicality.
- **Fix:** Reworded the three comments to convey the same meaning without the literal forbidden substrings (e.g. "No org-scoping column" / "No workspace column is added here").
- **Files modified:** `supabase/migrations/20260831000001_create_events_and_extend_participants.sql` (comments only -- zero DDL/semantic change).
- **Verification:** Re-ran the plan's exact automated acceptance command after the edit -- `MIGRATION_SHAPE_OK`.
- **Committed in:** `87ef8ec` (the fix was applied before the first and only commit -- no separate commit needed).

---

**Total deviations:** 1 auto-fixed (self-caught wording issue, zero semantic/DDL impact).
**Impact on plan:** No scope creep. The one fix was cosmetic (comment wording only) and caught by running the plan's own verification step before committing, exactly as intended.

## Issues Encountered

- **TEST project migration-behind, see "Blocked: TEST Project Apply" above** -- this is the substantive open issue from this plan and is not resolved here; it requires an Andrew decision or new credentials, not further agent-side work within this plan's scope.
- Two incidental, unrelated `git status` diffs surfaced as a side effect of the CLI relink-and-verify sequence (`supabase/.temp/gotrue-version`, `rest-version`, `storage-migration`, `storage-version` -- tracked files reflecting live component versions on whichever project is currently linked). These reverted to their pre-existing committed values via `git checkout --` before commit; they reflect pre-existing prod-vs-committed-file drift unrelated to this plan (a CLI-metadata analog of the F17 type-drift pattern from Plan 01) and are not fixed here (out of scope).
- A pre-existing, unrelated working-tree modification (`.planning/debug/autopilot-noise-stuck-tickets.md`, likely touched by a concurrent autopilot process) was left untouched and unstaged throughout -- confirmed out of this plan's scope.

## Known Stubs

None -- no UI, no data-flow stubs. The `events` table itself is intentionally "empty" (all resolution columns NULL) until Phase 31+'s matching engine populates it; this is the explicit, documented design (EVT-01/02/03), not a stub.

## Threat Flags

None. Every piece of new security-relevant surface (the `events` table, its RLS policies, the two new FKs) is exactly what this plan's own `<threat_model>` (T-30-02-01 through T-30-02-05) anticipated and mitigated -- FORCE RLS, `auth.email()`/`auth.uid()` (never `auth.users`), no org-admin bypass, service-role-only writes, and TEST-only apply scoping (which, per the block above, was correctly enforced by stopping rather than by accident).

## User Setup Required

**Resolved.** Andrew authorized and the orchestrator performed the TEST catch-up (9 backlog migrations + this one) -- see "Resolved: TEST Project Apply" above. No further setup needed for Plan 30-03.

## Next Phase Readiness

- **Plan 30-03 is ready to start.** The migration exists on a current TEST project, introspection-confirmed.
- **Plan 30-04 (prod apply) remains gated** on Plan 30-03's tests passing -- unchanged, as designed.
- The migration file (`supabase/migrations/20260831000001_create_events_and_extend_participants.sql`) is complete, spec-compliant, committed, and applied to TEST.
- STATE.md's Current Position advances to **Plan 3 of 4**.

---
*Phase: 30-schema-reconciliation-event-model-foundation*
*Completed: 2026-08-31 (partially -- see status: blocked)*

## Self-Check: PASSED

- FOUND: `supabase/migrations/20260831000001_create_events_and_extend_participants.sql`
- FOUND: `.planning/phases/30-schema-reconciliation-event-model-foundation/30-02-SUMMARY.md`
- FOUND commit: `87ef8ec`
- Re-ran the plan's exact Task 2 automated acceptance command: `MIGRATION_SHAPE_OK`
- Confirmed CLI is linked back to prod (`vltmrnjsubfzrgrtdqey`) via `supabase/.temp/project-ref` and `supabase projects list` -- no residual TEST link left behind
- Confirmed `git status --short` shows no unexpected deletions and no leftover untracked files from this plan's work (one pre-existing, unrelated modified file -- `.planning/debug/autopilot-noise-stuck-tickets.md` -- was left untouched, out of scope)

**Note:** this PASSED status reflects only that the artifacts this plan actually produced are real and verifiable -- it does NOT mean the plan is complete. Task 2's TEST-apply sub-step is blocked (see "Blocked: TEST Project Apply" above); `status: blocked` in the frontmatter is the authoritative completion signal, not this self-check.
