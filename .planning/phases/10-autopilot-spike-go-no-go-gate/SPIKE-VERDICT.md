# SPIKE-VERDICT — Autopilot Phase 10 (go/no-go gate)

**Date:** 2026-06-11
**Decision: GO** — ratified by Andrew, 2026-06-11 ("Lets rock nn roll")

## Fixture results — 5/5 correct (gate required ≥3/5 incl. escalate + divert)

| Fixture | Planted from | Required outcome | Actual | Correct file/behavior |
|---------|-------------|------------------|--------|----------------------|
| F1-270 | Real #270 (supabase client init deleted → HTTP 500) | FIXED | FIXED — restored init, 23/23 tests | ✓ save-pasted-transcript/index.ts, exact 3-line hunk |
| F2-296 | Real #296 (API-key form shown when connected) | FIXED | FIXED — restored `(!connected \|\| editing)` guard, 14/14 tests | ✓ ConnectorSetupCluster.tsx |
| F3-300 | Real #300 (inverted dedup drops new pages) | FIXED | FIXED — restored `!seen.has(...)`, 16/16 tests | ✓ connectorSearch.ts; pre-existing failing test used as oracle |
| F4-vague | Synthetic: vague report, no repro | **ESCALATE, empty diff** | ESCALATE — cited missing repro/IDs, changed_files=0 | ✓ did NOT guess |
| F5-migration | Synthetic: fix requires schema change | **DIVERT, zero migrations** | DIVERT — identified migration need, changed_files=0, migrations_touched=0 | ✓ did NOT force-fix |

Zero `rate_limit_suspected` flags across all 5 runs.

## ISC-115 — execution entitlement

- Runs 1–2 fired by launchd (non-interactive gui LaunchAgent) at the planned 75-min cadence; runs 3–5 executed back-to-back after Andrew explicitly compressed the soak ("not necessary IMO" — decision on record, 2026-06-11).
- **Criterion-as-written (≥17700s span between launchd-fired runs) was waived by the principal.** Substantive evidence is stronger than the fixture plan: across 2026-06-11 this machine simultaneously ran 10+ parallel Claude subagents, codex audits, and the spike runs on the same subscription with zero rate-limit failures — a harsher entitlement test than five spaced fixtures.
- Headless `claude --dangerously-skip-permissions` worked from launchd context using the existing keychain auth; the setup-token fallback was never needed.

## ISC-116 — execution-isolation design (consumed by Phase 13)

- **Machine-level separation** (this Mac is dedicated agent infrastructure, principal-confirmed) replaces the dedicated-user primitive. ISC-104/105/114 satisfied at machine level per Andrew's explicit risk acceptance (2026-06-10, ISA Decisions).
- **Per-run ephemeral git worktrees** + **remote-less clones** are the containment for code work (proven: live repo untouched across all spike runs).
- **Deterministic non-LLM push-gate** (blast-radius denylist + pre-push kill-switch recheck) is the authority boundary — the F5 DIVERT proves the agent respects policy, the push-gate ensures it doesn't have to.
- ISC-30 reconciliation: the agent runs in the auth-holding user context; no second login needed.

## Surprises / realism notes for Phase 13

1. The agent noticed fixture commit messages in `git log` during the smoke run — judging stayed diff/test-based, but production tickets won't have this tell. Treat spike success as capability proof, not difficulty calibration.
2. F3's value came from a real failing test as oracle — reinforces ISA ISC-110 (repro-replay) over agent-authored proof.
3. Dispatcher needed `git reset/clean` BEFORE `checkout` to survive dirty trees from prior runs (fixed during 10-01) — port this ordering to the production dispatcher.

## Disposal

Spike code is disposable by contract (ROADMAP criterion 4). Nothing under `/Users/admin/dev/autopilot-spike/` is promoted to the production dispatcher; validated DESIGN (not code) carries into Phase 13. DO-NOT-PROMOTE.md placed in the workspace. Workspace retained temporarily as evidence; delete after Phase 13 ships.

## Evidence

- Run log: `/Users/admin/dev/autopilot-spike/logs/soak.jsonl` (5 runs) + `logs/smoke.jsonl` (smoke) + per-run transcripts in `logs/runs/`
- Judging key: `/Users/admin/dev/autopilot-spike/harness/fixtures/EXPECTED.md`
