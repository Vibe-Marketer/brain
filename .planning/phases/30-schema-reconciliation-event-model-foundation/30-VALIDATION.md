---
phase: 30
slug: schema-reconciliation-event-model-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-31
---

# Phase 30 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.0.16 (`vitest.config.ts`) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run src/test/rls-regression.test.ts --reporter=verbose` |
| **Full suite command** | `npm run test` (unit) / `npm run test:integration` (integration, requires `VITEST_INTEGRATION_OK=true` + TEST project env) |
| **Estimated runtime** | ~30-60s unit, ~2-3min integration (TEST project) |

---

## Sampling Rate

- **After every task commit:** `npm run type-check` after the types-regeneration task; SQL review for the migration task.
- **After every plan wave:** `npx vitest run src/test/rls-regression.test.ts --reporter=verbose` against the TEST project.
- **Before `/gsd-verify-work`:** Full RLS regression suite + new byte-identical test green; migration applied to TEST project first, then prod, per this repo's guarded process (`.env` prod-ref check).
- **Max feedback latency:** 60 seconds.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 30-01-01 | 01 | 1 | SAFE-07 | — | Regenerated types compile and match live schema | build/type-check | `npm run type-check` | ✅ `scripts/type-check.mjs` | ⬜ pending |
| 30-01-02 | 01 | 1 | EVT-01, EVT-02, EVT-05, EVT-07 | T-30-01 | New `events` table + additive columns don't break existing constraints | integration (DDL apply) | Apply migration to TEST project via Supabase CLI, then `supabase gen types typescript --linked` to confirm shape | N/A — DDL-level | ⬜ pending |
| 30-01-03 | 01 | 1 | EVT-03 | — | `get_workspace_recordings`/`global_search`/MCP paths byte-identical when `event_id` IS NULL | integration | New file `src/test/event-schema-noop.integration.test.ts` | ❌ W0 | ⬜ pending |
| 30-01-04 | 01 | 1 | EVT-04, SAFE-05 | T-30-02 | `events` RLS: participant/owner can read, unrelated org cannot; `events` + `call_participants` covered by cross-org isolation | integration | Extend `src/test/rls-regression.test.ts` with a bespoke `events` block (not the `CROSS_ORG_TABLES` array — no org-scoped column exists on `events`) | Extend existing file — ❌ new block needed | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/test/event-schema-noop.integration.test.ts` — new file, stubs for EVT-03's byte-identical proof across `get_workspace_recordings`, `global_search`, MCP `search_calls`, MCP `ask_call` (best-evidence match for "chat" — no dedicated chat feature found in repo, flag if wrong)
- [ ] New test block inside `src/test/rls-regression.test.ts` — `events` participation/ownership RLS (EVT-04 + SAFE-05's `events` half). `call_participants`'s SAFE-05 half is already covered by the existing `CROSS_ORG_TABLES` array entry — no Wave 0 work needed there.
- [ ] Confirm TEST project migration currency before writing integration tests against it (research Open Question #2 — could not verify from this environment).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Migration applied cleanly to production without incident | SAFE-07, EVT-01/02/05/07 | Prod DDL apply is a one-time guarded action (`.env` prod-ref check), not something to automate/repeat in CI | Apply via the repo's guarded migration runner reading `.env`; verify prod-ref `vltmrnjsubfzrgrtdqey` before connecting; confirm via `supabase gen types typescript --linked` immediately after |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
