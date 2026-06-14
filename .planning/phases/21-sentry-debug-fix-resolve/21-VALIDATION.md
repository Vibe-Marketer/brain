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
| **Quick run (brain Edge Function unit, Deno)** | `cd ~/dev/brain && deno test supabase/functions/sentry-resolve/__tests__/` |
| **Quick run (brain vitest)** | `cd ~/dev/brain && npm run test -- supabase` |
| **Quick run (brain integration)** | `cd ~/dev/brain && npm run test:integration` |
| **Quick run (autopilot)** | `cd ~/dev/autopilot && bun test <file>` |
| **Full suite (brain)** | `cd ~/dev/brain && npm run test` |
| **Full suite (autopilot)** | `cd ~/dev/autopilot && bun test` |
| **Schema push ([BLOCKING], Plan 01)** | `cd ~/dev/brain && supabase db push --linked` (SUPABASE_ACCESS_TOKEN in .env) |

## Sampling Rate
- **After every task commit:** the closest quick command above for the changed file.
- **Per wave merge:** `cd ~/dev/autopilot && bun test` AND `cd ~/dev/brain && npm run test` (both repos green).
- **Phase gate:** full brain suite + full autopilot suite green; `sentry-resolve` integration test green against a MOCKED Sentry endpoint (NEVER fire a real resolve PUT against `ai-simple`), before `/gsd-verify-work`.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 21-01-01 | 01 | 1 | SEN-04 | T-21-05 | debounce predicate is a DB gate (no SELECT-then-decide); RLS on cap table | integration | `cd ~/dev/brain && npm run test:integration` | ❌ W0 | ⬜ pending |
| 21-01-02 | 01 | 1 | SEN-05 | T-21-04 | per-fingerprint cap table service-role-only; RLS enabled deny-all | integration | `cd ~/dev/brain && npm run test:integration` | ❌ W0 | ⬜ pending |
| 21-01-03 | 01 | 1 | SEN-04, SEN-05 | T-21-SC | [BLOCKING] schema push applies migration to linked project | manual+automated | `cd ~/dev/brain && supabase db push --linked` then re-run integration | ❌ W0 | ⬜ pending |
| 21-02-01 | 02 | 1 | SEN-05 | T-21-01 | zod-bound `issue_id` (numeric, max 256) before URL interpolation — path-injection guard | unit (Deno) | `cd ~/dev/brain && deno test supabase/functions/sentry-resolve/__tests__/` | ❌ W0 | ⬜ pending |
| 21-02-02 | 02 | 1 | SEN-05 | T-21-02, T-21-03 | caller authorized (service-role/admin), not public; token never logged/echoed; 503 if unconfigured | unit (Deno) + integration | `deno test ...` ; `npm run test:integration` | ❌ W0 | ⬜ pending |
| 21-02-03 | 02 | 1 | SEN-05 | T-21-03 | function secrets set (`SENTRY_AUTH_TOKEN`/`SENTRY_ORG`); deploy `--use-api` | checkpoint | `supabase secrets list` shows both names | ❌ W0 | ⬜ pending |
| 21-03-01 | 03 | 1 | D-06 | T-21-06 | legacy GitHub-issue Sentry path neutralized (no double-handling) | automated (grep) | `grep -c 'if: false' .github/workflows/sentry-autofix.yml` (>=1) | ✅ | ⬜ pending |
| 21-04-01 | 04 | 2 | SEN-03 | T-21-07 | prior-attempt history read by `sentry:<issue_id>`; service-role only; log-don't-throw | unit | `cd ~/dev/autopilot && bun test src/lib/sentry-memory.test.ts` | ❌ W0 | ⬜ pending |
| 21-04-02 | 04 | 2 | SEN-03 | T-21-07 | brief keeps HARD POLICY block verbatim; ticket text stays fenced DATA; one VERDICT line | unit | `cd ~/dev/autopilot && bun test src/lib/brief.test.ts` | ❌ W0 | ⬜ pending |
| 21-05-01 | 05 | 2 | SEN-04 | T-21-05 | claim debounce filter + frozen-fingerprint exclusion (category-scoped) before pickNext; ordering unchanged | unit | `cd ~/dev/autopilot && bun test src/lib/claim.test.ts` | ✅ (extend) | ⬜ pending |
| 21-05-02 | 05 | 2 | SEN-04 | — | severity→priority: verify SEVERITY_RANK already covers before adding a bump (A5) | unit | `cd ~/dev/autopilot && bun test src/lib/claim.test.ts` | ✅ (extend) | ⬜ pending |
| 21-06-01 | 06 | 3 | SEN-05 | T-21-04 | resolve ONLY when verifyDeploySha true AND 30-min quiet window elapsed AND cap not frozen | unit | `cd ~/dev/autopilot && bun test src/lib/sentry-resolve.test.ts` | ❌ W0 | ⬜ pending |
| 21-06-02 | 06 | 3 | SEN-05 | T-21-04 | 4th regression freezes the single fingerprint/category (never global) + pages via tier-2 digest | unit | `cd ~/dev/autopilot && bun test src/lib/sentry-resolve.test.ts` | ❌ W0 | ⬜ pending |
| 21-06-03 | 06 | 3 | SEN-05 | T-21-08 | NO-ANALOG call seam: daemon→Edge-Function invoke choice confirmed (checkpoint) | checkpoint | human-verify the invoke path + service-role auth | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

## Wave 0 Requirements

Wave 0 lands the test scaffolds + a MOCKED Sentry endpoint before any code that can call the live resolve API. Each scaffold is created as the FIRST task of the plan that owns it (RED-first), so Wave 0 is distributed into the plans rather than a standalone plan:

- [ ] `~/dev/brain/supabase/functions/sentry-resolve/__tests__/sentry-resolve.deno.test.ts` — SEN-05 endpoint/payload/zod (Plan 02)
- [ ] `~/dev/brain/supabase/functions/sentry-resolve/__tests__/sentry-resolve.integration.test.ts` — SEN-05 idempotency, MOCK Sentry (Plan 02)
- [ ] `~/dev/brain/supabase/migrations/*_sentry_debounce_cycletime_cap.sql` + integration test — SEN-04 debounce/cycle-time + SEN-05 cap (Plan 01)
- [ ] `~/dev/autopilot/src/lib/sentry-memory.ts` + `sentry-memory.test.ts` — SEN-03 JSONB memory (Plan 04)
- [ ] `~/dev/autopilot/src/lib/brief.test.ts` (new) — SEN-03 discipline block (Plan 04)
- [ ] `~/dev/autopilot/src/lib/sentry-resolve.ts` + `sentry-resolve.test.ts` — SEN-05 daemon precondition + cap (Plan 06)
- [ ] Extend `~/dev/autopilot/src/lib/claim.test.ts` — SEN-04 debounce predicate + frozen exclusion + severity→priority (Plan 05)

## Manual-Only Verifications
| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sentry resolve write-back on live org | SEN-05 | hits live ai-simple.sentry.io (irreversible-ish) | Verify ONLY on a real verified-stable deploy after the full gate is in place; never in automated tests (mock the endpoint). |
| Daemon→Edge-Function invoke seam | SEN-05 | no daemon precedent for `functions.invoke`; A4 assumption | Plan 06 checkpoint confirms invoke path + service-role auth reaches the deployed function. |
| Function secrets present | SEN-05 | secrets live in Supabase dashboard, not `.env` | Plan 02 checkpoint: `supabase secrets list` shows `SENTRY_AUTH_TOKEN` + `SENTRY_ORG`; verify token scope is `event:write`. |

## Validation Sign-Off
- [x] All tasks have `<automated>` verify or Wave 0 deps
- [x] `nyquist_compliant: true` set

**Approval:** ready for execution
