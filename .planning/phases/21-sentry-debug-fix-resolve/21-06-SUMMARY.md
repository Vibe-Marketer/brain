# Phase 21 Plan 06 Summary — Daemon Sentry Resolve Gate + Cap Lifecycle

**Status:** COMPLETE  
**Started:** 2026-06-14T01:52:19Z  
**Completed:** 2026-06-14T02:18:00Z  
**Executor:** gsd-executor / Codex

## Checkpoint Decision

Task 1 was a `checkpoint:decision`; Andrew explicitly authorized making the recommended choice and proceeding. Selected `functions-invoke`.

Confirmation: from `~/dev/autopilot`, a service-role Supabase client called `client.functions.invoke("sentry-resolve", { body: { issue_id: "not-numeric" } })` against the deployed linked function and received:

```json
{
  "status": 400,
  "body": "{\"error\":\"issue_id must be numeric\"}"
}
```

That proves daemon service-role auth reaches the deployed Edge Function and the function validation path executes, without making a live Sentry resolve call.

## Commits

| Repo | Commit | Type | Notes |
| --- | --- | --- | --- |
| `~/dev/autopilot` | `473ca98` | `test(21)` | RED coverage for Sentry resolve gate and runner/approval/canary cap lifecycle hooks. |
| `~/dev/autopilot` | `82a66be` | `feat(21)` | Implemented daemon `sentry-resolve` caller, per-fingerprint cap helper, runner attempt hook, approval post-merge hook, and canary regression hook. |

No remote push was performed for `~/dev/autopilot`, per instruction.

## What Changed

- Added `src/lib/sentry-resolve.ts` in `~/dev/autopilot`.
  - `resolveSentryIfVerifiedStable(...)` checks fingerprint frozen state, reuses `verifyDeploySha`, enforces the 30-minute quiet window, invokes deployed `sentry-resolve` through `functions.invoke`, and stamps `tickets.sentry_resolved_at` only on success.
  - `recordSentryFixAttemptAndMaybeFreeze(...)` calls `record_fingerprint_fix_attempt` only for real Sentry fix lifecycle events and pages exactly once when `newly_frozen=true`.
- Wired Sentry cap lifecycle into:
  - `runner.ts`: records source=`sentry` runner attempts and marks `runner_runs.detail.sentry_cap_recorded_at`.
  - `approval.ts`: skips runner double-counts, records cap only if needed, and calls the resolve gate after status becomes `resolved`.
  - `canary.ts`: records real source=`sentry` canary/reopen regressions independent of Sentry resolve API results.
- Extended `DbLike` to include the existing Supabase client `rpc` and `functions.invoke` surfaces.

## Verification

```text
set -euo pipefail; cd ~/dev/autopilot && bun test src/lib/sentry-resolve.test.ts
PASS: 7 tests, 20 assertions
```

```text
set -euo pipefail; cd ~/dev/autopilot && bun test src/runner.test.ts src/lib/approval.test.ts src/lib/canary.test.ts src/lib/sentry-resolve.test.ts
PASS: 45 tests, 167 assertions
```

```text
cd ~/dev/autopilot && bun run typecheck
PASS: tsc --noEmit
```

```text
cd ~/dev/autopilot && git diff --exit-code -- package.json bun.lock package-lock.json
PASS: no package or lockfile changes
```

Static invariant checks:
- `record_fingerprint_fix_attempt` appears only in `recordSentryFixAttemptAndMaybeFreeze`.
- The Sentry resolve path goes through `verifyDeploySha`, quiet window, cap lookup, and `functions.invoke`.
- No concurrency setting was changed.

## Deviations / Notes

- The checkpoint was auto-decided as `functions-invoke` because the prompt explicitly directed reasonable checkpoint decisions to proceed.
- The Sentry resolve API error path logs and returns `api-error`; it does not call the cap RPC.
- The approval hook is additive and log-don't-throw; it does not alter existing merge outcome shapes.
- Existing dirty autopilot files were not staged: `qa/known-fingerprints.json`, `qa/runs.log`.
