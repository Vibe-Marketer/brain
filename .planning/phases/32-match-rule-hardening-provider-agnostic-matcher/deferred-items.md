# Phase 32 — Deferred Items

Out-of-scope discoveries logged per the executor's scope-boundary rule (fix only what the
current task's changes directly caused; log everything else here instead of fixing it).

## Pre-existing full-suite test failures, unrelated to Plan 01's changes

**Found during:** Plan 32-01, plan-level verification step (`npx vitest run` full suite,
required by the plan's own `<verification>` block: "Full unit suite `npx vitest run` shows
no new failures").

**What happened:** The full suite shows 13 failing tests across 5 files. None of the 5 files
import, reference, or transitively depend on `supabase/functions/_shared/dedup-fingerprint.ts`
or `supabase/functions/_shared/event-resolver.ts` (the only two source files this plan
modified), and Plan 01's other changes were a single scoped `resolve.alias` entry in
`vitest.config.ts` (exact-string-matched to one esm.sh URL) and one devDependency addition
(`fastest-levenshtein`) — neither plausibly affects unrelated admin-UI/RPC-type-smoke/JWT-auth
test files. These are pre-existing failures on the `v2.2-event-resolution` branch, not
introduced by this plan.

**The 5 failing files / 13 failing tests:**

| File | Failing tests | Domain |
|------|---------------|--------|
| `src/components/support/__tests__/SupportTicketDialog.test.tsx` | 2 (pre-dialog screenshot capture timing, D-01) | Support popover UI |
| `src/pages/admin/__tests__/AuditSection.test.tsx` | 4 (human source badges, error state, plain-English rendering, empty state) | Admin audit log UI |
| `src/pages/admin/__tests__/DashboardSection.recurrence.test.tsx` | 5 (autopilot ticket recurrence-class UI states) | Admin dashboard UI (autopilot ticket recurrence -- unrelated to meeting-recurrence/F5) |
| `src/test/rpc-type-smoke.test.ts` | 1 (`verify_rpc_type_signatures()` returns zero rows) | DB RPC type-signature drift |
| `supabase/functions/mcp-server/__tests__/sec-jwt-fix.test.ts` | 1 (`atob()` absent from `auth.ts`, ISC-8-12) | MCP JWT auth security regression |

**Why not fixed:** Plan 01's declared `<files>` are `dedup-fingerprint.ts`,
`dedup-fingerprint.test.ts`, `event-resolver.ts`, `event-resolver.test.ts`. Fixing any of the
5 files above would mean editing admin UI components, an RPC signature (DB migration), or the
MCP server's `auth.ts` -- all unrelated subsystems, out of scope per the executor's scope
boundary. Not baselined (no `type-check`-style baseline mechanism exists for test failures in
this repo) -- simply logged here for a future phase/plan to triage and fix.

**Follow-up:** A future plan (or a dedicated hardening pass) should investigate each of these
5 files independently. `rpc-type-smoke.test.ts` and `sec-jwt-fix.test.ts` in particular sound
security/correctness-relevant (RPC type drift, JWT pivot prevention) and may warrant priority
over the two UI-only files.

## Cross-file integration-test race reproduced again (Plan 32-03), same root cause as 31-02's STATE.md entry

**Found during:** Plan 32-03, plan-level verification (`npm run test:integration -- <2 new/changed
files>`). The `test:integration` npm script hardcodes its own globs
(`src/**/*.integration.test.ts supabase/functions/**/__tests__/*.integration.test.ts`) --
appending file paths via `--` does not restrict the run to those files, it unions them into the
full ~20-file glob. That full run showed 11 failing tests across 7 files, including both files
this plan touches (`event-resolution-kill-switch.integration.test.ts`,
`rls-regression.test.ts`) plus five entirely unrelated files (`event-match-apply-reverse`,
`event-resolution-shadow`, `qa-ticket-ingestion`, `reporter-comms`,
`supabase/functions/share-call/__tests__/share-call.integration.test.ts`).

**Proof this plan's two files are correct, not the cause:** re-running with a direct
`npx vitest run --reporter=verbose src/test/event-resolution-kill-switch.integration.test.ts
src/test/rls-regression.test.ts` invocation (bypassing the npm script's hardcoded glob, so only
these 2 files run, no other integration file races against the same TEST project concurrently)
passed 100% -- 59/59 (3 + 56), zero failures. `rls-regression.test.ts` alone was also run twice
consecutively in isolation, 56/56 both times, confirming both correctness and re-runnability.
The five unrelated files that also failed in the full run share no import, table, or fixture
overlap with this plan's changes.

**Why it happens:** Same root cause already identified in Phase 31 P02 (see STATE.md): every
integration test's `afterAll` calls `cleanup_test_fixture_users(p_max_age_minutes: 0)`, which
defeats that RPC's own documented age-threshold protection against racing in-flight test runs
when many integration files execute concurrently (vitest's default parallel file execution)
against the same shared TEST Supabase project.

**Why not fixed:** Confirmed repo-wide pattern, already logged out-of-scope in Phase 31 P02
("logged with two remediation options, out of scope to fix (repo-wide pattern)"). Fixing it
would mean changing `cleanup_test_fixture_users`' call contract or vitest's concurrency model
for the entire integration suite -- unrelated to this plan's SAFE-03/SAFE-04 deliverables.

**Follow-up:** Same as Phase 31 P02's recommendation -- a future hardening plan should either
(a) serialize integration test file execution (`vitest run --pool=forks --poolOptions.forks.singleFork=true`
or `--sequence.concurrent=false` for the integration project only), or (b) scope
`cleanup_test_fixture_users` calls to each suite's own fixture-email prefix instead of a
blanket age-threshold sweep.

## zoom-webhook/index.ts's entire dedup-merge pipeline is dead code (found while authoring Plan 32-02's MATCH-11 guard)

**Found during:** Plan 32-02 Task 3, while writing the MATCH-11 preservation guard test. The
plan's own text (sourced from 32-RESEARCH.md, marked HIGH confidence, "read directly this
session") asserted `checkMatch()` "is called today, on every Zoom webhook delivery, by
`handleDuplicateMerge()`... and it auto-applies its verdict immediately." Writing a guard test
that asserted the literal strings `dedup_priority_mode`/`dedup_platform_order` appear in
`zoom-webhook/index.ts` failed -- investigating why surfaced a materially different reality.

**What was actually found (exhaustive grep, this session, `v2.2-event-resolution` branch,
`zoom-webhook/index.ts` byte-unchanged throughout):**
- `findPotentialDuplicates` (line 227, calls `checkMatch`), `handleDuplicateMerge` (line 345,
  calls `shouldNewMeetingBePrimary`), and `updateMergedFrom` (line 404) are all defined in
  `zoom-webhook/index.ts` but **never called** from that file's `Deno.serve` handler or
  `processZoomWebhook` (line 437) -- confirmed via exhaustive `grep -n` across the entire
  951-line file: each function name appears exactly once (its own `function` declaration),
  with zero call-site occurrences anywhere else in the file.
- `zoom-sync-meetings/index.ts` only imports `generateFingerprint`/`generateFingerprintString`
  from `dedup-fingerprint.ts` -- it never imports or calls `checkMatch`/`findDuplicates` either.
- The literal column names `dedup_priority_mode`/`dedup_platform_order` (confirmed real,
  live `user_settings` columns per `src/types/supabase.ts`) are **not read anywhere** in the
  current live source -- neither `supabase/functions/` nor `src/` -- outside the generated
  types file itself. `shouldNewMeetingBePrimary`'s `priorityMode: DedupPriorityMode` /
  `platformOrder: string[]` parameters exist and its four branches (`first_synced`/
  `most_recent`/`platform_hierarchy`/`longest_transcript`) are intact, but nothing in the live
  handler flow ever calls it with real values sourced from those two columns.

**Practical implication:** the F5 false-merge bug Plan 01 hardened `checkMatch()` against may
never have been reachable through `zoom-webhook/index.ts`'s live `Deno.serve` path in the
first place (hardening it was still correct and harmless regardless -- `checkMatch` is a pure,
now-more-correct function either way, and Phase 32's new metadata tier reuses its sibling
`calculate*` primitives, not `checkMatch` itself). Separately, MATCH-11's "continues to work
unchanged" framing may need revisiting at the milestone level: there may be nothing live to
preserve in this specific file today, or the real settings consumer lives elsewhere
(unconfirmed -- not investigated further, out of scope for Plan 02).

**Why not fixed:** Wiring the dead functions into the live handler, or tracing where (if
anywhere) `dedup_priority_mode`/`dedup_platform_order` are genuinely consulted today, would be
a materially different scope than Plan 02's metadata-tier deliverable -- a Rule 4-class
architectural question (does this pipeline get revived, deleted, or left as-is?), not a Rule
1-3 auto-fix. `zoom-webhook/index.ts` was left byte-unchanged, confirmed via
`git diff --stat` after every task in this plan.

**Guard test adjustment made:** Plan 32-02's MATCH-11 preservation guard
(`src/test/event-resolution-metadata-tier.integration.test.ts`) was corrected to assert what's
actually true and load-bearing -- the selection ALGORITHM (`shouldNewMeetingBePrimary`'s four
branches, via proper paren-based parameter-list-end detection, not a naive first-brace search
that was itself found to truncate into the function's inline parameter type annotation) and the
schema-level TYPE contract (`src/types/supabase.ts` still declares both columns) are
byte-identical to before this plan -- not a false claim that a live read path exists today.

**Follow-up:** A future plan should either (a) confirm `dedup_priority_mode`/
`dedup_platform_order` are genuinely read somewhere outside this repo's current `main`/
`v2.2-event-resolution` tree (unlikely, but not exhaustively ruled out beyond `supabase/` +
`src/`), (b) decide whether to wire the existing dead functions into
`processZoomWebhook`'s live flow, or (c) formally deprecate/remove the dead code if the new
`event-resolver.ts` pipeline is meant to fully supersede it. Any of these is a real product/
architecture decision for Andrew, not an executor auto-fix.
