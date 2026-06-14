---
phase: 21
slug: sentry-debug-fix-resolve
status: ready
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-13
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Cross-repo phase: schema + Edge Function in `~/dev/brain`; brief + memory + claim + resolve-caller in `~/dev/autopilot`.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (brain)** | vitest 4.0.16 (`vitest run`); Deno test for Edge Function pure logic; supabase linked for migrations |
| **Framework (autopilot)** | `bun test` (built-in) |
| **Quick run (brain Edge Function unit, Deno)** | `set -euo pipefail; cd ~/dev/brain && deno test supabase/functions/sentry-resolve/__tests__/` |
| **Quick run (brain vitest)** | `set -euo pipefail; cd ~/dev/brain && npm run test -- supabase` |
| **Quick run (brain integration)** | `set -euo pipefail; cd ~/dev/brain && npm run test:integration` |
| **Quick run (autopilot)** | `set -euo pipefail; cd ~/dev/autopilot && bun test <file>` |
| **Full suite (brain)** | `set -euo pipefail; cd ~/dev/brain && npm run test` |
| **Full suite (autopilot)** | `set -euo pipefail; cd ~/dev/autopilot && bun test` |
| **Schema push ([BLOCKING], Plan 01)** | `set -euo pipefail; cd ~/dev/brain && supabase db push --linked` (SUPABASE_ACCESS_TOKEN in .env; skip never counts as pass after schema/env are present) |

## Sampling Rate
- **After every task commit:** the closest quick command above for the changed file.
- **Per wave merge:** `set -euo pipefail; cd ~/dev/autopilot && bun test` AND `set -euo pipefail; cd ~/dev/brain && npm run test` (both repos green).
- **Phase gate:** full brain suite + full autopilot suite green; `sentry-resolve` integration test green against a MOCKED Sentry endpoint (NEVER fire a real resolve PUT against `ai-simple`), before `/gsd-verify-work`.
- **Blocking deploy/schema rule:** For [BLOCKING] deploy/schema gates, a skipped integration test is only acceptable before required schema/env exists. Once the schema/env gate is in scope, the command must produce a real passing test run; skip does not count as pass.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 21-01-01 | 01 | 1 | SEN-04 | T-21-05 | debounce predicate is a DB gate (no SELECT-then-decide); RLS on cap table | integration | `set -euo pipefail; cd ~/dev/brain && npm run test:integration -- sentry-cap-debounce` | ❌ W0 | ⬜ pending |
| 21-01-02 | 01 | 1 | SEN-04 | T-21-05 | resolved Sentry ticket appears in resolve-ASAP tracking surface with cycle time + target status | integration | `set -euo pipefail; cd ~/dev/brain && npm run test:integration -- sentry-cap-debounce` | ❌ W0 | ⬜ pending |
| 21-01-03 | 01 | 1 | SEN-05 | T-21-04 | per-fingerprint cap table service-role-only; RLS enabled deny-all | integration | `set -euo pipefail; cd ~/dev/brain && npm run test:integration -- sentry-cap-debounce` | ❌ W0 | ⬜ pending |
| 21-01-04 | 01 | 1 | SEN-04, SEN-05 | T-21-SC | [BLOCKING] schema push applies migration to linked project; re-run integration must pass, not skip | manual+automated | `set -euo pipefail; cd ~/dev/brain && supabase db push --linked` then `set -euo pipefail; cd ~/dev/brain && npm run test:integration -- sentry-cap-debounce` | ❌ W0 | ⬜ pending |
| 21-02-01 | 02 | 1 | SEN-05 | T-21-01 | zod-bound `issue_id` (numeric, max 256) before URL interpolation — path-injection guard | unit (Deno) | `set -euo pipefail; cd ~/dev/brain && deno test supabase/functions/sentry-resolve/__tests__/` | ❌ W0 | ⬜ pending |
| 21-02-02 | 02 | 1 | SEN-05 | T-21-02, T-21-03 | service-role daemon auth only: no-auth 401; user/admin JWT 403; service-role 200; token never logged/echoed; 503 if unconfigured | unit (Deno) + integration | `set -euo pipefail; cd ~/dev/brain && deno test supabase/functions/sentry-resolve/__tests__/` then `set -euo pipefail; cd ~/dev/brain && npm run test:integration -- sentry-resolve` | ❌ W0 | ⬜ pending |
| 21-02-03 | 02 | 1 | SEN-05 | T-21-02 | sentry-resolve is not deployed with `verify_jwt=false` | automated (config) | `set -euo pipefail; cd ~/dev/brain && ! awk '/^\[functions\.sentry-resolve\]/{flag=1; next} /^\[functions\./{flag=0} flag && /verify_jwt *= *false/{bad=1} END{exit bad ? 1 : 0}' supabase/config.toml` | ❌ W0 | ⬜ pending |
| 21-02-04 | 02 | 1 | SEN-05 | T-21-03 | function secrets set (`SENTRY_AUTH_TOKEN`/`SENTRY_ORG` plus service-role env if needed); deploy `--use-api` | checkpoint | `set -euo pipefail; cd ~/dev/brain && supabase secrets list` shows required names | ❌ W0 | ⬜ pending |
| 21-03-01 | 03 | 1 | D-06 | T-21-06 | legacy GitHub-issue Sentry path neutralized (no double-handling) | automated (grep) | `set -euo pipefail; cd ~/dev/brain && grep -q 'if: false' .github/workflows/sentry-autofix.yml && grep -qi "Phase 21" .github/workflows/sentry-autofix.yml` | ✅ | ⬜ pending |
| 21-04-01 | 04 | 2 | SEN-03 | T-21-07 | prior-attempt history read by `sentry:<issue_id>`; service-role only; log-don't-throw | unit | `set -euo pipefail; cd ~/dev/autopilot && bun test src/lib/sentry-memory.test.ts` | ❌ W0 | ⬜ pending |
| 21-04-02 | 04 | 2 | SEN-03 | T-21-07 | brief keeps HARD POLICY block verbatim; ticket text stays fenced DATA; one VERDICT line | unit | `set -euo pipefail; cd ~/dev/autopilot && bun test src/lib/brief.test.ts` | ❌ W0 | ⬜ pending |
| 21-04-03 | 04 | 2 | SEN-03 | T-21-07 | runner fetches + renders prior attempts and generated Sentry brief contains memory before fix attempt | unit | `set -euo pipefail; cd ~/dev/autopilot && bun test src/runner.test.ts` | ❌ W0 | ⬜ pending |
| 21-05-01 | 05 | 2 | SEN-04 | T-21-05 | claim debounce filter + frozen-fingerprint exclusion (category-scoped) before pickNext; frozen fingerprints cannot be claimed again; ordering unchanged | unit | `set -euo pipefail; cd ~/dev/autopilot && bun test src/lib/claim.test.ts` | ✅ (extend) | ⬜ pending |
| 21-05-02 | 05 | 2 | SEN-04 | — | severity→priority: verify SEVERITY_RANK already covers before adding a bump (A5) | unit | `set -euo pipefail; cd ~/dev/autopilot && bun test src/lib/claim.test.ts` | ✅ (extend) | ⬜ pending |
| 21-06-01 | 06 | 3 | SEN-05 | T-21-04 | resolve ONLY when verifyDeploySha true AND 30-min quiet window elapsed AND cap not frozen | unit | `set -euo pipefail; cd ~/dev/autopilot && bun test src/lib/sentry-resolve.test.ts` | ❌ W0 | ⬜ pending |
| 21-06-02 | 06 | 3 | SEN-05 | T-21-04 | four repeated source='sentry' autonomous fix-attempt/regression records for one fingerprint cause exactly one fingerprint/category freeze + one tier-2 page | unit | `set -euo pipefail; cd ~/dev/autopilot && bun test src/lib/sentry-resolve.test.ts` | ❌ W0 | ⬜ pending |
| 21-06-03 | 06 | 3 | SEN-05 | T-21-08 | NO-ANALOG call seam: daemon→Edge-Function invoke choice confirmed (checkpoint) | checkpoint | human-verify the invoke path + service-role auth | ❌ W0 | ⬜ pending |
| 21-06-04 | 06 | 3 | SEN-05 | T-21-04 | Sentry resolve API 4xx/5xx with no actual fix attempt is an API/write-back error and does NOT increment the per-fingerprint cap | unit | `set -euo pipefail; cd ~/dev/autopilot && bun test src/lib/sentry-resolve.test.ts` | ❌ W0 | ⬜ pending |
| 21-06-05 | 06 | 3 | SEN-05 | T-21-04 | canary/reopen regression for a source='sentry' ticket records the cap independent of Sentry resolve API response; non-sentry regression does not | unit | `set -euo pipefail; cd ~/dev/autopilot && bun test src/lib/canary.test.ts` | ✅ (extend) | ⬜ pending |
| 21-06-06 | 06 | 3 | SEN-05 | T-21-04 | every source='sentry' autonomous fix attempt records the cap exactly once at the runner attempt/finalization ledger point; non-sentry attempts do not | unit | `set -euo pipefail; cd ~/dev/autopilot && bun test src/runner.test.ts src/lib/approval.test.ts` | ✅ (extend) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

## Wave 0 Requirements

Wave 0 lands the test scaffolds + a MOCKED Sentry endpoint before any code that can call the live resolve API. Each scaffold is created as the FIRST task of the plan that owns it (RED-first), so Wave 0 is distributed into the plans rather than a standalone plan:

- [ ] `~/dev/brain/supabase/functions/sentry-resolve/__tests__/sentry-resolve.deno.test.ts` — SEN-05 endpoint/payload/zod (Plan 02)
- [ ] `~/dev/brain/supabase/functions/sentry-resolve/__tests__/sentry-resolve.integration.test.ts` — SEN-05 no-auth 401, user/admin JWT 403, service-role 200, idempotency, MOCK Sentry (Plan 02)
- [ ] `~/dev/brain/supabase/migrations/*_sentry_debounce_cycletime_cap.sql` + integration test — SEN-04 debounce/resolve-ASAP cycle-time tracking + SEN-05 cap (Plan 01)
- [ ] `~/dev/autopilot/src/lib/sentry-memory.ts` + `sentry-memory.test.ts` — SEN-03 JSONB memory (Plan 04)
- [ ] `~/dev/autopilot/src/lib/brief.test.ts` (new) — SEN-03 discipline block (Plan 04)
- [ ] `~/dev/autopilot/src/runner.test.ts` — SEN-03 runner-generated Sentry brief includes prior-attempt memory before fix attempt (Plan 04)
- [ ] `~/dev/autopilot/src/lib/sentry-resolve.ts` + `sentry-resolve.test.ts` — SEN-05 daemon precondition + cap helper; API 4xx/no-cap negative test (Plan 06)
- [ ] Extend `~/dev/autopilot/src/lib/canary.ts` + `canary.test.ts` — SEN-05 canary/reopen regression records cap for source='sentry' (Plan 06)
- [ ] Extend `~/dev/autopilot/src/runner.ts` + `runner.test.ts` — SEN-05 source='sentry' autonomous fix attempts record cap exactly once (Plan 06)
- [ ] Extend `~/dev/autopilot/src/lib/claim.test.ts` — SEN-04 debounce predicate + frozen exclusion + severity→priority (Plan 05)

## Manual-Only Verifications
| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sentry resolve write-back on live org | SEN-05 | hits live ai-simple.sentry.io (irreversible-ish) | Verify ONLY on a real verified-stable deploy after the full gate is in place; never in automated tests (mock the endpoint). |
| Daemon→Edge-Function invoke seam | SEN-05 | no daemon precedent for `functions.invoke`; A4 assumption | Plan 06 checkpoint confirms invoke path + service-role auth reaches the deployed function. |
| Function secrets present | SEN-05 | secrets live in Supabase dashboard, not `.env` | Plan 02 checkpoint: `set -euo pipefail; cd ~/dev/brain && supabase secrets list` shows `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` plus service-role env if needed; verify token scope is `event:write`. |

## Validation Sign-Off
- [x] All tasks have `<automated>` verify or Wave 0 deps
- [x] SEN-05 cap lifecycle is sampled at create→increment→freeze→exclude: Plan 01 RPC, Plan 06 runner/approval/canary wiring, Plan 05 frozen exclusion
- [x] Sentry resolve API errors are sampled separately from fix regressions and do not increment the cap
- [x] `nyquist_compliant: true` set

**Approval:** ready for execution
