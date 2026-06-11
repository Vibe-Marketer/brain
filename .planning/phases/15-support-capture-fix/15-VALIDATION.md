---
phase: 15
slug: support-capture-fix
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-11
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.0.16 (verified in package.json) |
| **Config file** | vitest.config.ts (integration tests excluded unless `VITEST_INTEGRATION_OK=true`) |
| **Quick run command** | `npx vitest run <test file>` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~60–120 seconds full suite |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <new/changed test file>`
- **After every plan wave:** Run `npm test && npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green + dev-browser visual verification (project hard rule)
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 1 | CAP-01 | — | N/A | component (mocked screenshot lib) | `npx vitest run src/components/support/__tests__/SupportTicketDialog.test.tsx` | ❌ W0 (created in-task) | ⬜ pending |
| 15-01-02 | 01 | 1 | CAP-01 | T-15-02/T-15-04 | own-folder INSERT policy; 5MB + mime allowlist | migration apply + SQL assertion | `supabase db push` (or 11-02 Management API fallback) + bucket/policy presence query | ❌ W0 | ⬜ pending |
| 15-01-03 | 01 | 1 | CAP-01 | T-15-01 | edge fn rejects foreign-prefix paths | unit (mocked supabase) | `npx vitest run src/services/__tests__/support-ticket.service.test.ts` | ❌ W0 (created in-task) | ⬜ pending |
| 15-02-01 | 02 | 2 | CAP-01 | — | N/A | unit (pure function) | `npx vitest run src/lib/__tests__/console-buffer.test.ts` | ❌ W0 (created in-task) | ⬜ pending |
| 15-02-02 | 02 | 2 | CAP-01 | T-15-05 | trimmed serialization bounds payload size | component + unit | `npx vitest run src/components/support/__tests__/SupportTicketDialog.test.tsx src/services/__tests__/support-ticket.service.test.ts` | ❌ W0 | ⬜ pending |
| 15-03-01 | 03 | 2 | CAP-01 | T-15-03 | signed URLs only (never getPublicUrl) | unit (mocked supabase) | `npx vitest run src/services/__tests__/tickets.service.test.ts` | created by 11-03 (extend) | ⬜ pending |
| 15-03-02 | 03 | 2 | CAP-01 | T-15-06 | attachment metadata rendered as React text nodes; img src from signed URL only | component (mocked service) | `npx vitest run src/components/settings/__tests__/TicketDetailDialog.test.tsx` | ❌ W0 (created in-task) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Test files are created inside the tasks that introduce the code (vitest already installed; no framework or fixture install needed). No standalone Wave 0 tasks.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Screenshot shows the problem view (not popover/dialog) on a real page | CAP-01 | html2canvas needs a real browser canvas; jsdom cannot render | dev-browser: log in, open a call view, Support → Submit a Ticket, confirm thumbnail shows the call view; submit; open AdminTab ticket detail, confirm screenshot preview + console JSON link render |
| Storage RLS denies cross-user object reads | CAP-01 | storage.objects policies not covered by rls-regression.test.ts table sweep | from a second non-admin account, attempt `createSignedUrl` on the first user's path — expect error/empty |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
