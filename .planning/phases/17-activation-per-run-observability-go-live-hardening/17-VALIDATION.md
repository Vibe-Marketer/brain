---
phase: 17
slug: activation-per-run-observability-go-live-hardening
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-13
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Brain: Vitest 4.x + Testing Library; Autopilot: Bun test + shell gate fixtures |
| **Config file** | Brain: `vitest.config.ts`; Autopilot: `~/dev/autopilot/package.json`, `~/dev/autopilot/gate/push-gate-test.sh` |
| **Quick run command** | Brain: `npm test -- src/services/__tests__/admin-dashboard.service.test.ts src/components/settings/__tests__/TicketDetailDialog.test.tsx src/components/admin/__tests__/TicketEvidence.test.tsx`; Autopilot: `cd ~/dev/autopilot && bash gate/push-gate-test.sh && bun test src/lib/approval.test.ts src/lib/evidence.test.ts src/watchdog.test.ts` |
| **Full suite command** | Brain: `npm test && npm run build`; Autopilot: `cd ~/dev/autopilot && bun test && bun run typecheck` |
| **Estimated runtime** | Quick: ~60-120 seconds; full phase gate: ~5-10 minutes plus live activation |

---

## Sampling Rate

- **After every task commit:** Run the task's `<automated>` command from its PLAN.md.
- **After every plan wave:** Wave 1 runs schema/gate commands; Wave 2 runs Brain targeted tests/build and Autopilot approval/watchdog/typecheck; Wave 3 runs the full preflight plus live activation proof.
- **Before `/gsd-verify-work`:** `npm test && npm run build` in `/Users/admin/dev/brain`; `cd ~/dev/autopilot && bun test && bun run typecheck`; live `runner_runs` schema query; controlled production-ticket activation evidence.
- **Max feedback latency:** Automated code feedback under 10 minutes; live activation may exceed this and must record timestamps/run IDs.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 17-01-01 | 01 | 1 | ACT-04 | T-17-01/T-17-02 | Admin-only run ledger exists in live schema; generated types are not proof | schema | `supabase db diff --local --schema public >/tmp/phase17-runner-runs-local.diff && rg -n -e runner_runs -e gate_verdict -e duration_sec -e est_cost supabase/migrations src/types/supabase.ts` | ❌ W0 | ⬜ pending |
| 17-01-02 | 01 | 1 | ACT-04 | T-17-02 | Blocking schema push and live table query prove `runner_runs` | schema/live | `test -n "$SUPABASE_ACCESS_TOKEN" && supabase db push && supabase gen types typescript --linked --schema public > src/types/supabase.ts && supabase db query "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'runner_runs' order by ordinal_position;" >/tmp/runner-runs-columns.txt && rg -e gate_verdict -e duration_sec -e est_cost -e ticket_id /tmp/runner-runs-columns.txt` | ❌ W0 | ⬜ pending |
| 17-01-03 | 01 | 1 | ACT-01/ACT-04 | T-17-03/T-17-04 | Every daemon run writes durable ledger rows without bypassing gates | unit/typecheck | `cd ~/dev/autopilot && bun test src/lib/evidence.test.ts && bun run typecheck` | ✅ | ⬜ pending |
| 17-02-01 | 02 | 2 | ACT-04 | T-17-05 | Service/hook reads are admin data path only | unit | `npm test -- src/services/__tests__/admin-dashboard.service.test.ts` | ✅ | ⬜ pending |
| 17-02-02 | 02 | 2 | ACT-04 | T-17-07 | Runner card shows status/gate/duration/cost without misleading cost copy | unit/build | `npm test -- src/services/__tests__/admin-dashboard.service.test.ts && npm run build` | ✅ | ⬜ pending |
| 17-02-03 | 02 | 2 | ACT-04 | T-17-06 | Evidence rendering remains text-safe and in existing dialog | unit/build | `npm test -- src/components/settings/__tests__/TicketDetailDialog.test.tsx src/components/admin/__tests__/TicketEvidence.test.tsx && npm run build` | ✅ | ⬜ pending |
| 17-03-01 | 03 | 1 | ACT-05 | T-17-08/T-17-09/T-17-10 | Red fixtures prove test weakening is blocked before implementation | shell | `cd ~/dev/autopilot && bash gate/push-gate-test.sh; test "$?" != "0"` | ✅ | ⬜ pending |
| 17-03-02 | 03 | 1 | ACT-05 | T-17-08/T-17-11 | Push-gate blocks weakening mechanically, non-LLM | shell | `cd ~/dev/autopilot && bash gate/push-gate-test.sh` | ✅ | ⬜ pending |
| 17-03-03 | 03 | 1 | ACT-04/ACT-05 | T-17-11 | Blocked gate status records `test_integrity` for AdminTab | unit/shell | `cd ~/dev/autopilot && bun test src/lib/evidence.test.ts && bash gate/push-gate-test.sh` | ✅ | ⬜ pending |
| 17-04-01 | 04 | 2 | ACT-06 | T-17-12/T-17-14 | Rebase conflict requeues before capped escalation; no force-push | unit/static | `cd ~/dev/autopilot && bun test src/lib/approval.test.ts src/lib/claim.test.ts && ! rg -n -e "force-push" -e "--force" -e "skip.*rebase" src/lib/approval.ts` | ✅ | ⬜ pending |
| 17-04-02 | 04 | 2 | ACT-06 | T-17-12/T-17-13 | Repro replay runs on rebased state before gate/merge | unit/typecheck | `cd ~/dev/autopilot && bun test src/lib/approval.test.ts src/lib/evidence.test.ts && bun run typecheck` | ✅ | ⬜ pending |
| 17-04-03 | 04 | 2 | ACT-07 | T-17-15/T-17-16 | Reaper/disk/caffeinate guards keep host safe; concurrency remains 1 and max runs stay 3-5/day | unit/typecheck/static | `cd ~/dev/autopilot && bun test src/watchdog.test.ts && bun run typecheck && node -e 'const fs = require("node:fs"); const s = fs.readFileSync("autopilot.config.ts", "utf8"); if (!/concurrency:\s*1\b/.test(s) || !/maxRunsPerWindow:\s*\{[^}]*maxRuns:\s*[345]\b/s.test(s)) process.exit(1);'` | ✅ | ⬜ pending |
| 17-05-01 | 05 | 3 | ACT-01/ACT-03/ACT-04/ACT-05/ACT-06/ACT-07 | T-17-17/T-17-18 | Full preflight passes before kill switch is turned off, including deterministic low-volume cap assertion | full | `supabase db query "select to_regclass('public.runner_runs');" && npm test -- src/services/__tests__/admin-dashboard.service.test.ts src/components/settings/__tests__/TicketDetailDialog.test.tsx src/components/admin/__tests__/TicketEvidence.test.tsx && npm run build && cd ~/dev/autopilot && bash gate/push-gate-test.sh && bun test src/lib/approval.test.ts src/lib/claim.test.ts src/lib/evidence.test.ts src/watchdog.test.ts && bun run typecheck && node -e 'const fs = require("node:fs"); const s = fs.readFileSync("autopilot.config.ts", "utf8"); if (!/concurrency:\s*1\b/.test(s) || !/maxRunsPerWindow:\s*\{[^}]*maxRuns:\s*[345]\b/s.test(s)) process.exit(1);'` | ✅ | ⬜ pending |
| 17-05-02 | 05 | 3 | ACT-01/ACT-03/ACT-04 | T-17-17/T-17-19/T-17-20 | Real production ticket run is visible and human-approved before merge; staged low-risk live production tickets prove ACT-03 reject/rollback/revert and denylist; commit-advance and final state evidence is recorded with controlled live run IDs | live/manual | `cd ~/dev/autopilot && bun run src/claimer.ts && supabase --workdir /Users/admin/dev/brain db query "select * from public.runner_runs order by started_at desc limit 10;" && cd /Users/admin/dev/brain && rg -n -e "runner_runs.id" -e "ticket id" -e "base SHA" -e "HEAD SHA" -e "final state" -e "denylist" -e "reject" -e "rollback" -e "revert" .planning/phases/17-activation-per-run-observability-go-live-hardening/17-05-SUMMARY.md && curl -fsS https://app.callvaultai.com >/tmp/callvault-prod.html` | ✅ | ⬜ pending |
| 17-05-03 | 05 | 3 | ACT-03/ACT-05/ACT-06/ACT-07 | T-17-18/T-17-20 | Safety proofs require controlled live production-ticket evidence for ACT-03 reject/rollback/revert, commit-advance-by-exactly-one, and denylist; offline drills supplement only after mandatory live evidence exists | shell/unit/status | `cd ~/dev/autopilot && bash gate/push-gate-test.sh && bun test src/lib/approval.test.ts src/watchdog.test.ts && cd /Users/admin/dev/brain && rg -n -e "controlled live production-ticket" -e "runner_runs.id" -e "ticket id" -e "branch" -e "base SHA" -e "HEAD SHA" -e "final state" -e "commit-advance-by-exactly-one" -e "denylist" -e "reject/rollback/revert" .planning/phases/17-activation-per-run-observability-go-live-hardening/17-05-SUMMARY.md && test -z "$(git status --short -- src supabase package.json package-lock.json)"` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `supabase/migrations/20260613090000_create_or_extend_runner_runs.sql` - migration must exist before schema push.
- [ ] `SUPABASE_ACCESS_TOKEN` - required for non-interactive `supabase db push`.
- [ ] `~/dev/autopilot/gate/push-gate-test.sh` - extend fixtures for test deletion, skip/only, xit/xdescribe, test-case decrease, assertion decrease.
- [ ] `~/dev/autopilot/src/lib/approval.test.ts` - extend for rebase conflict requeue and replay-after-rebase.
- [ ] `~/dev/autopilot/src/watchdog.test.ts` - extend for reaper/disk guard.
- [ ] Existing test infrastructure covers the rest; no framework install required.

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Andrew approval of real ticket merge | ACT-01 | Phase 17 explicitly requires human approval for every merge | Open AdminTab, inspect awaiting_approval evidence, approve the merge, record ticket id/branch/fix SHA/merged SHA |
| Production deploy-SHA verification | ACT-01/ACT-03 | Requires observing the actual deployed app after merge | Hit `https://app.callvaultai.com`, record deployed SHA evidence and response |
| ACT-03 live safety evidence | ACT-03 | Reject/rollback/revert, commit-advance-by-exactly-one, and denylist must be demonstrated against controlled live production-ticket activation; offline fixtures are never substitutive | Stage low-risk real production tickets where rejecting the proposed fix and reverting commit-advance is safe, and where the existing denylist can block without modifying production code. Record `runner_runs.id` values, ticket ids, gate stage/verdict, branch names, base/HEAD SHAs, final states, and live denylist plus reject/rollback/revert events in `17-05-SUMMARY.md`; cite supplemental offline drills only after the live proof exists |
| AdminTab screenshot | ACT-04 | Visual proof that run list/detail are readable and not overlapping | Capture `/admin/dashboard` runner card and selected ticket detail after the run |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10 minutes for automated gates; live activation evidence records timestamps
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
