# Phase 20-03 — Summary

**Status:** Complete
**Requirements:** QA-03 (severity-gated autonomous QA fix), QA-04 (per-source budget)
**Executed by:** Anvil (kimi-k2.6) under Codex-quota failover; finishing commit + verification by orchestrator (Claude).

## What shipped (`~/dev/autopilot`)
- Source-aware candidate selection (`7cdbe16`) — claimer selects QA-sourced tickets within the per-source budget.
- Severity gate + per-source QA budget (`b3e6ed0`) — `autopilot.config.ts`, `src/claimer.ts`, `src/claimer.test.ts`, `src/lib/db.ts`:
  - QA tickets capped at ≤50% of the daily run-cap; user + Sentry retain reserved capacity (QA churn cannot starve them).
  - Severity gate: low/medium QA tickets eligible for autonomous fix; high/critical routed to the tier-2/qa_review lane (never autonomous-fixed).
  - Concurrency held at 1; total volume/run-cap unchanged (budgeting within the existing cap only).

## Verification
- `cd ~/dev/autopilot && bun test` → **137 pass, 0 fail**
- `bun run typecheck` → clean
- Pre-existing runtime files (`qa/known-fingerprints.json`, `qa/runs.log`) left untouched.

## Note
Anvil ended its turn mid-flow (no structured marker) after writing the code; the orchestrator verified the suite green and committed the remaining work with explicit paths.
