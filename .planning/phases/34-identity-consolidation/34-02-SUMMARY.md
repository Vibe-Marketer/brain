---
phase: 34-identity-consolidation
plan: 02
subsystem: database
tags: [postgres, supabase, rls, identity-resolution, security-definer, rls-regression, types-generation]

# Dependency graph
requires:
  - phase: 34-identity-consolidation
    provides: "Plan 01's reader-inventory.json (46-entry SELECT-bearing coverage list) and the locked identity-spine schema/RLS design (option-a, approved as-is)"
  - phase: 30-schema-reconciliation-event-model-foundation
    provides: "the non-org-scoped RLS precedent (events table) and its CR-01 fix (SECURITY DEFINER participation helper), mirrored here from the start"
provides:
  - "identities + identity_aliases tables live on TEST: non-org-scoped person-spine, participation/ownership RLS via user_can_view_identity() SECURITY DEFINER helper, partial-unique verified-alias index, redacted get_identity_evidence() RPC"
  - "Nullable identity_id on speakers/contacts/call_participants, proven byte-identical/noop for every EXPLICIT-COLUMNS reader and structurally-documented for every REQUIRES-ATTENTION bare-select reader from Plan 01's inventory"
  - "identities/identity_aliases registered in rls-regression.test.ts's cross-org isolation gate (bespoke block, mirroring events)"
  - "src/types/supabase.ts regenerated with the identity-spine delta only, via a verified prod-baseline splice (TEST has confirmed unrelated schema drift vs prod)"
affects: [34-03-PLAN, 34-04-PLAN, 34-05-PLAN, 34-07-PLAN, 35-speaker-resolution, 39-discovery-and-claim]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SECURITY DEFINER RLS helper written correctly from the start (user_can_view_identity), not bolted on after a leak like events' CR-01 fix -- the events precedent's own gap-closure migration is treated as a design input, not just a structural template"
    - "Redacted-RPC PII boundary: identity_aliases.value (email PII) is owner-only SELECT; the broad-audience read path is a SECURITY DEFINER RPC projecting only non-PII columns, proven by a non-owner-caller test that first confirms direct table access is denied, then confirms the RPC still succeeds"
    - "Types-regen drift guard: when a TEST-generated types file's key-set diff includes items outside the current migration's scope, treat the whole file as compromised -- diff a fresh prod-linked generation against the committed baseline (0-diff confirms baseline is not stale), then splice only the migration's own new blocks (extracted via brace-depth parsing) onto the prod-verified baseline instead of committing the drifted TEST file wholesale"

key-files:
  created:
    - supabase/migrations/20260905140000_create_identities_and_link_tables.sql
    - src/test/identity-schema-noop.integration.test.ts
    - src/test/identity-evidence-rpc.integration.test.ts
  modified:
    - src/test/rls-regression.test.ts
    - src/types/supabase.ts
    - src/types/contacts.ts
    - type-baseline.json

key-decisions:
  - "TEST-generated types file was NOT committed wholesale: it carries 18 pre-existing, unrelated drift items (15 tables present on TEST but not prod: admin_automation_settings, agents, ai_processing_jobs, connections, crm_contacts, crm_interactions, crm_tags, enrichment_queue, human_tasks, resolution_notes, tasks, tenants, token_usage, trial_purchases, users; 3 tables present on TEST but not prod: call_share_access_log, generated_content, quotes). Confirmed via a fresh prod-linked gen (0-diff vs committed baseline) that this drift is TEST-only, pre-existing, and unrelated to this migration. Spliced only identities/identity_aliases/get_identity_evidence/user_can_view_identity plus the three identity_id column additions onto the prod-verified baseline."
  - "Added identity_id?: string | null to the hand-written Contact TS interface (src/types/contacts.ts) as an optional field -- useContacts.ts's bare select('*') at line 498 now structurally returns it (confirmed by reader-inventory.json's own BARE-SELECT-STAR classification), and leaving the interface unchanged broke tsc. Optional (not required) so existing synthetic/test Contact objects that don't originate from a live select() don't need updating."
  - "Deliberately ran type-check:update-baseline for one reshuffled (not new) error: useContacts.ts's pre-existing contact_type-vs-ContactType TS2322 mismatch's message-hash changed because identity_id shifted tsc's truncated object-literal property count (\"10 more\" -> \"11 more\"). Confirmed the root cause (contact_type: string vs ContactType union) is identical and unrelated to identity_id before updating."
  - "get_people_summary/get_recordings_for_person integration assertions call the RPC via a signed-in fixture-user JWT, not the service-role admin client -- both RPCs gate on is_organization_member(p_organization_id, auth.uid()), and auth.uid() is NULL under service-role (no JWT claim), which would make the assertion vacuously return zero rows regardless of the migration's correctness."

patterns-established:
  - "Pattern: when introspecting a freshly-applied TEST migration for a types-regen drift guard, always cross-check with a prod-linked gen BEFORE assuming a `db push`-clean TEST project is types-safe to regenerate from wholesale -- a project being current on migrations does not guarantee it has zero unrelated historical drift from prod."

requirements-completed: [IDENT-01, IDENT-08]

# Metrics
duration: ~55min
completed: 2026-09-05
---

# Phase 34 Plan 02: Identity Spine Migration + Participation RLS + Redacted Evidence RPC Summary

**Additive identity-spine migration (identities, identity_aliases, 3x identity_id columns, participation/ownership RLS, redacted get_identity_evidence RPC) authored, applied to TEST, and proven GREEN via 72 integration-test assertions -- IDENT-01 (readers unchanged) and IDENT-08 (redacted evidence) both hold**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-09-05T19:58:00Z (approx.)
- **Completed:** 2026-09-05T20:32:00Z
- **Tasks:** 3 (all `type="auto"`)
- **Files modified:** 8 (3 new: migration + 2 test files; 5 modified: rls-regression.test.ts, supabase.ts, contacts.ts, type-baseline.json, and this SUMMARY)

## Accomplishments

- Authored `supabase/migrations/20260905140000_create_identities_and_link_tables.sql`: `identities` (non-org-scoped, nullable `owner_user_id`) + `identity_aliases` (typed evidence ledger, partial `UNIQUE(alias_type, value) WHERE verified = true`), nullable `identity_id` added to `speakers`/`contacts`/`call_participants`, `user_can_view_identity()` SECURITY DEFINER RLS helper written correctly from the start (mirroring the events CR-01 fix as a lesson, not repeating the original bug), `get_identity_evidence()` redacted RPC. Applied cleanly to TEST (`swjzxiddcrtaqixsfaac`); prod (`vltmrnjsubfzrgrtdqey`) confirmed untouched via dry-run at the end.
- Wrote and proved three integration test files GREEN on TEST (72 total assertions across all three files): `identity-schema-noop.integration.test.ts` (9 tests: EXPLICIT-COLUMNS readers `get_people_summary`/`get_recordings_for_person` stay byte-identical; all 3 REQUIRES-ATTENTION bare-select readers from Plan 01's inventory gain `identity_id` as NULL without corrupting any other field; plus 3 reader-inventory.json coverage-completeness checks), `identity-evidence-rpc.integration.test.ts` (3 tests: redacted payload for owner AND non-owner, proving the RPC -- not RLS -- is the security boundary), and `rls-regression.test.ts`'s new bespoke `identities`/`identity_aliases` isolation block (4 new tests, all 60 tests in the file GREEN including every pre-existing assertion).
- Hit and correctly resolved a types-regen drift trap: a naive `supabase gen types --linked` against TEST would have silently deleted 15 real prod tables' types and added 3 TEST-only tables' types into the committed file. Diagnosed by cross-checking a fresh prod-linked generation against the committed baseline (exact match, proving the committed file is not stale) before concluding the drift was TEST-only and pre-existing, then spliced only the identity-spine delta onto the prod-verified baseline via a brace-depth-aware extraction script.
- Functionally verified (beyond the plan's literal ask) that the partial unique index rejects a second verified alias with the same email while allowing an unverified duplicate, and that FORCE RLS holds even for a fully unauthenticated (no-JWT) client.

## Task Commits

Each task was committed atomically:

1. **Task 1: Wave-0 scaffold -- failing IDENT-01 noop, IDENT-08 evidence, and cross-org isolation tests** - `11185243` (test)
2. **Task 2: Author the additive identity-spine migration and apply it to TEST** - `9285a8c1` (feat)
3. **Task 3: Prove green on TEST and regenerate types** - `d26b3e52` (test)

**Plan metadata:** committed alongside this SUMMARY (docs: complete plan)

## Files Created/Modified

- `supabase/migrations/20260905140000_create_identities_and_link_tables.sql` - The additive identity-spine migration (tables, indexes, RLS, functions, comments)
- `src/test/identity-schema-noop.integration.test.ts` - IDENT-01 proof: EXPLICIT-COLUMNS readers unchanged; REQUIRES-ATTENTION readers documented honestly (gain the key, NULL value, no corruption); reader-inventory.json coverage-completeness checks
- `src/test/identity-evidence-rpc.integration.test.ts` - IDENT-08 proof: redacted payload for owner and non-owner callers; unverified alias excluded
- `src/test/rls-regression.test.ts` - Bespoke `identities`/`identity_aliases` cross-org isolation block, mirroring the `events` precedent
- `src/types/supabase.ts` - Regenerated with the identity-spine delta only (drift-guarded splice, not a raw TEST dump)
- `src/types/contacts.ts` - `Contact.identity_id?: string | null` added so the widened `contacts` row type still satisfies `ContactWithCallCount`
- `type-baseline.json` - One pre-existing, unrelated error's hash reshuffled (confirmed root cause unchanged) via deliberate `--update-baseline`

## Decisions Made

**TEST-vs-prod types drift handled via prod-verified splice, not a raw regen.** See `key-decisions` in frontmatter for the full diagnostic trail (15 removed + 3 added unrelated tables, confirmed pre-existing and TEST-only via a 0-diff prod-linked cross-check).

**`Contact.identity_id` made optional, not required.** A required field would have broken every hand-constructed `Contact`/`ContactWithCallCount` test fixture and the synthetic "participant" pseudo-contact object `useContacts.ts` builds directly from `call_participants` data (which has no `contacts` row to source the field from). Optional matches the DB's own nullable-and-not-universally-populated semantics.

**`get_people_summary`/`get_recordings_for_person` test calls switched to a signed-in JWT client.** Both RPCs' `WHERE` clauses call `is_organization_member(p_organization_id, auth.uid())`; under the service-role client `auth.uid()` is NULL (no JWT claim), so the predicate is always false regardless of the migration's correctness -- this was a bug in the test's first draft, not the schema, caught by RED-state investigation in Task 3 and fixed inline per the deviation rules.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed identity-schema-noop's RPC test calls to use a signed-in client instead of service-role**
- **Found during:** Task 3 (proving GREEN on TEST)
- **Issue:** `get_people_summary`/`get_recordings_for_person` gate on `is_organization_member(p_organization_id, auth.uid())`; `auth.uid()` is NULL under the service-role admin client, so both RPCs returned zero rows regardless of migration correctness -- a test bug, not a migration bug.
- **Fix:** Added a signed-in `userClient` (anon key + `signInWithPassword`) and called both RPCs through it instead of `admin`.
- **Files modified:** `src/test/identity-schema-noop.integration.test.ts`
- **Verification:** Both assertions GREEN afterward; all 9 tests in the file pass.
- **Committed in:** `d26b3e52` (Task 3 commit)

**2. [Rule 1 - Bug] Added `identity_id?: string | null` to the `Contact` TypeScript interface**
- **Found during:** Task 3 (`npx tsc -p tsconfig.app.json` after types regen)
- **Issue:** `contacts` gaining `identity_id` widened the shape a bare `select('*')` (`useContacts.ts:498`, the REQUIRES-ATTENTION reader Plan 01 flagged) structurally returns; the hand-written `Contact` interface didn't declare it, breaking the build (`Type '...' is not assignable to type 'ContactWithCallCount[]'`).
- **Fix:** Added the field as optional (see Decisions Made above for why optional, not required).
- **Files modified:** `src/types/contacts.ts`
- **Verification:** `npm run type-check` -> `0 new errors, 320/320 baseline` (after the deliberate baseline update below).
- **Committed in:** `d26b3e52` (Task 3 commit)

**3. [Rule 1 - Bug, deliberate baseline update] Reshuffled one pre-existing type-baseline entry**
- **Found during:** Task 3, after fixing #2 above
- **Issue:** `useContacts.ts`'s pre-existing, unrelated `contact_type: string` vs `ContactType` union mismatch (TS2322) is already accepted in `type-baseline.json`; adding `identity_id` shifted tsc's truncated object-literal preview text ("... 10 more ..." -> "... 11 more ..."), which changed the baseline's message-hash key even though the underlying bug is identical and untouched by this plan.
- **Fix:** Confirmed the root cause (nested "Types of property 'contact_type' are incompatible" detail line) was unchanged before running `npm run type-check:update-baseline`.
- **Files modified:** `type-baseline.json`
- **Verification:** `npm run type-check` -> `TYPE CHECK PASSED: 0 new errors.`
- **Committed in:** `d26b3e52` (Task 3 commit)

**4. [Rule 3 - Blocking] Drift-guarded types splice instead of a raw TEST regen**
- **Found during:** Task 3, immediately after `supabase gen types typescript --linked` against TEST
- **Issue:** The naive regen's key-set diff vs the committed file showed 15 removed + 3 added tables having nothing to do with this migration -- the plan's own guard ("If ANY other unexpected table/column delta appears, STOP") tripped.
- **Fix:** Relinked to prod, regenerated types from prod, confirmed 0-diff vs the committed baseline (proving the baseline isn't stale and the drift is TEST-only), then wrote a brace-depth-aware Node splice script to extract exactly the 4 new blocks (`identities`, `identity_aliases`, `get_identity_evidence`, `user_can_view_identity`) plus the `identity_id`-bearing `speakers`/`contacts`/`call_participants` blocks from the TEST generation, and applied them onto the prod-verified base.
- **Files modified:** `src/types/supabase.ts`
- **Verification:** Post-splice key-set diff vs prod shows exactly the 4 expected additions and zero unexpected removals/additions; `identity_id` occurrence counts confirmed present in all 3 extended tables and absent from `identities` itself.
- **Committed in:** `d26b3e52` (Task 3 commit)

---

**Total deviations:** 4 auto-fixed (2 Rule 1 bug fixes, 1 deliberate baseline update, 1 Rule 3 blocking-issue workaround)
**Impact on plan:** All four were necessary to reach a truthful GREEN state and a non-drifted types file. No scope creep -- no application code, UI, or resolver logic was touched; every fix was either inside the new test files this plan authors or a minimal, additive type-declaration change directly caused by the migration's own additive column.

## Issues Encountered

- **RTK-wrapped vitest output silently misreports beforeAll failures as "skipped" rather than "failed."** Running all three integration test files concurrently through the `rtk vitest`/hook-wrapped path reported `PASS (3) FAIL (0) skipped (69)` even when `beforeAll` was throwing real errors -- concurrent `auth.admin.createUser` calls across 3 parallel-worker files transiently exhausted the free-tier TEST project's connection/auth pool, producing FK-violation errors that RTK's summarizer folded into "skipped" instead of surfacing. Resolved by using `rtk proxy npx vitest run ...` (unfiltered passthrough) and running files individually rather than concurrently, which gave truthful signal and avoided the concurrency flake entirely. Flagging this as a real gap in RTK's vitest filter for future integration-test runs in this repo.

## User Setup Required

None - no external service configuration required. TEST project credentials were already present in `.env.test`.

## Next Phase Readiness

- Plans 03 (OTP email verification) and 04 (resolver) can build directly on TEST: `identities`/`identity_aliases` are live, RLS-proven, and the redacted evidence RPC is ready for Plan 05's UI.
- Plan 07 (prod apply) has a clean, isolated migration file to push (`20260905140000_create_identities_and_link_tables.sql`) plus a verified TEST introspection trail to cite; the CLI is currently linked to prod (verified via dry-run that this migration is the only one pending there).
- **Flag for whoever next touches `src/types/supabase.ts`:** TEST (`swjzxiddcrtaqixsfaac`) has 18 tables of drift vs prod (15 tables prod has that TEST doesn't; 3 tables TEST has that prod doesn't) predating this plan. A future full regen from TEST without the same drift-guard diligence this plan applied would silently corrupt the committed types file. Not fixed here (out of this plan's scope) -- worth a dedicated TEST-project reconciliation pass before any future plan does a wholesale `gen types --linked` against TEST.

---
*Phase: 34-identity-consolidation*
*Completed: 2026-09-05*

## Self-Check: PASSED

- FOUND: `supabase/migrations/20260905140000_create_identities_and_link_tables.sql`
- FOUND: `src/test/identity-schema-noop.integration.test.ts`
- FOUND: `src/test/identity-evidence-rpc.integration.test.ts`
- FOUND: `src/test/rls-regression.test.ts`
- FOUND: `src/types/supabase.ts`
- FOUND: `src/types/contacts.ts`
- FOUND: `type-baseline.json`
- FOUND commit: `11185243`
- FOUND commit: `9285a8c1`
- FOUND commit: `d26b3e52`
