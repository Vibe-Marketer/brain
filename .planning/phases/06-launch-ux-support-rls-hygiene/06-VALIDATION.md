---
phase: 06
slug: launch-ux-support-rls-hygiene
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-31
---

# Phase 06 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + React Testing Library + real Supabase integration tests |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test -- --run src/pages/__tests__/SetupTrialUpsell.registry.test.ts src/components/ui/__tests__/sidebar-nav.test.tsx` |
| **Full suite command** | `npm run build && npm run test -- --run src/test/rls-regression.test.ts` |
| **Estimated runtime** | Quick: ~30-60s; full depends on Supabase integration reachability |

## Sampling Rate

- **After every task commit:** Run the narrowest matching Vitest/registry test.
- **After every plan wave:** Run `npm run build` plus all Phase 6 touched tests.
- **Before `$gsd-verify-work`:** Build must pass; RLS regression must pass or skip cleanly only when Supabase test env vars are absent.
- **Max feedback latency:** 10 minutes for full browser + integration verification.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | ONB-01/ONB-02 | - | First-run path lands on import with explicit historical sync | registry/component | `npm run test -- --run src/pages/__tests__/SetupTrialUpsell.registry.test.ts src/pages/__tests__/ImportPage.connector-routing.test.ts` | ✅ | ⬜ pending |
| 06-01-02 | 01 | 1 | ONB-03/ONB-04 | - | Empty states have one primary connector CTA and no file-upload promise | registry/component | `npm run test -- --run src/pages/__tests__/ImportPage.connector-routing.test.ts` | ✅ | ⬜ pending |
| 06-02-01 | 02 | 1 | ONB-05 | - | Support popout actions are reachable without exposing private context to docs URL | component | `npm run test -- --run src/components/ui/__tests__/sidebar-nav.test.tsx` | ✅ | ⬜ pending |
| 06-02-02 | 02 | 1 | ONB-05 | T-06-ticket-context | Ticket function requires auth and sends only bounded support context | edge/unit or registry | `npm run test -- --run src/components/ui/__tests__/sidebar-nav.test.tsx` | ⚠️ add if needed | ⬜ pending |
| 06-03-01 | 03 | 2 | ONB-02/HRD-02 | - | Paywall checkout successPath returns to gated surface | component/registry | `npm run test -- --run src/components/billing` | ⚠️ add if needed | ⬜ pending |
| 06-04-01 | 04 | 2 | HRD-02 | T-06-cross-org | Missing user-facing tables are covered bidirectionally by real JWT RLS checks | integration | `npm run test -- --run src/test/rls-regression.test.ts` | ✅ | ⬜ pending |
| 06-05-01 | 05 | 3 | CON follow-up | T-06-resync-preserve-local | Fathom resync updates provider-owned fields only and preserves local org/workspace/folder/tag/note data | edge/component | `npm run test -- --run src/hooks src/components/connectors` | ⚠️ add if included | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky/add needed*

## Wave 0 Requirements

- [ ] Add or update sidebar support popout tests once the component exists.
- [ ] Add ticket Edge Function input validation tests only if this repo has an existing Edge Function test harness; otherwise cover via browser/manual plus build.
- [ ] Add RLS fixtures for `mcp_tokens`, `personal_folders`, `personal_tags`, `personal_folder_recordings`, `personal_tag_recordings`, `call_notes`, `contact_folders`, `import_sources`, `import_routing_rules`.
- [ ] Add resync tests only if optional resync is implemented in Phase 6.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Full self-serve path | ONB-01/ONB-02 | Requires auth, OAuth/provider, and trial routing | Use browser automation against local dev app: signup/login -> setup source -> trial -> import page. |
| Founder video | ONB-02/ONB-05 | Video asset URL may be external/env-configured | Confirm modal appears once after trial completion and support action reopens it. |
| Support docs | ONB-05 | External docs host | Click Support Docs and confirm a new tab opens `https://docs.callvaultai.com`. |
| Ticket delivery | ONB-05 | Resend delivery requires env/API | Submit ticket with test account and confirm email payload arrives at support mailbox or Resend logs. |
| Polar checkout return | HRD-02 | Real checkout/webhook behavior | Trigger a gated action, start checkout, return via success URL, confirm original surface/action context is preserved. |
| Fathom remote update detection | Optional resync | Requires live provider account mutation | Rename a Fathom call, fetch the date range, confirm `Updated remotely`, resync, and verify preservation invariants. |

## Validation Sign-Off

- [x] All planned capabilities have automated or manual verification paths.
- [x] Sampling continuity: no 3 consecutive tasks without a verification point.
- [x] Wave 0 lists missing tests/fixtures.
- [x] No watch-mode flags.
- [x] Feedback latency target documented.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** pending
