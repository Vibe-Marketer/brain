---
phase: 12
slug: sentry-ingestion
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-11
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (repo unit/integration) + `deno test` (Edge Function units) |
| **Config file** | `vitest.config.ts` (integration gated by `VITEST_INTEGRATION_OK=true`) |
| **Quick run command** | `deno test supabase/functions/sentry-webhook/__tests__/` |
| **Full suite command** | `npm test` (unit) / `npm run test:integration` (real-Supabase) |
| **Estimated runtime** | ~10s quick / ~120s full |

---

## Sampling Rate

- **After every task commit:** Run `deno test supabase/functions/sentry-webhook/__tests__/`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green (integration suite green or cleanly skipped if test project absent)
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 12-01-* | 01 | 1 | SEN-01, SEN-02 | T-12-04 | schema relaxation does not widen RLS visibility (NULL reporter = admin-only) | integration | `npm run test:integration -- rls-regression` | ✅ (extend) | ⬜ pending |
| 12-02-* | 02 | 2 | SEN-01 | T-12-01 | bad/missing signature → 401, zero DB writes | unit (deno) | `deno test supabase/functions/sentry-webhook/__tests__/` | ❌ W0 | ⬜ pending |
| 12-02-* | 02 | 2 | SEN-01 | T-12-02 | oversized/non-POST/unparseable payloads rejected before DB | unit (deno) | `deno test supabase/functions/sentry-webhook/__tests__/` | ❌ W0 | ⬜ pending |
| 12-02-* | 02 | 2 | SEN-02 | — | same issue_id twice → one ticket, occurrence_count=2 | integration | `npm run test:integration -- sentry-webhook` | ❌ W0 | ⬜ pending |
| 12-02-* | 02 | 2 | SEN-01 | — | fatal-level payload → user_notifications row for admin (create-only) | integration | `npm run test:integration -- sentry-webhook` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `supabase/functions/sentry-webhook/__tests__/sentry-webhook.test.ts` — signature verification + severity mapping + fingerprint derivation units (SEN-01)
- [ ] `supabase/functions/sentry-webhook/__tests__/fixtures/issue-alert-payload.json` — representative `event_alert` payload fixture (docs-verified shape)
- [ ] `src/test/` or `supabase/functions/sentry-webhook/__tests__/` integration test — dedup + notification against the dedicated test project (SEN-01/02)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live Sentry alert delivers to deployed function | SEN-01 | Requires the human-provisioned Sentry internal integration + secret (the one human prerequisite) | After Andrew completes Sentry setup: trigger a synthetic error in production, confirm ticket row appears with source=sentry; check function logs |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
