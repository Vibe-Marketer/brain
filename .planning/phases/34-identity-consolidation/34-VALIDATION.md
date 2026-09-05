---
phase: 34
slug: identity-consolidation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-05
---

# Phase 34 — Validation Strategy

## Test Infrastructure
Vitest. `npm run test:integration` (TEST project) + `npx vitest run` (unit).

## Sampling Rate
Per task: unit test for changed module. Per wave: integration suite. Phase gate: full suite green.

## Per-Requirement Verification
| Requirement | Test Type | Notes |
|---|---|---|
| IDENT-01 | integration | `identities`/`identity_aliases` created; existing readers of speakers/contacts/call_participants unchanged (regression via full suite) |
| IDENT-02 | unit | Resolution never auto-links on name similarity alone — negative test required |
| IDENT-03 | integration | Custom OTP add-email flow, end-to-end on TEST; RLS deny-by-default on OTP table |
| IDENT-08 | unit + integration | `get_identity_evidence()` RPC returns confidence+evidence, never raw email to non-owner |

## Wave 0 Requirements
- [ ] Full grep sweep for existing readers of speakers/contacts/call_participants BEFORE migration (research's flagged first task)
- [ ] New tests for all four requirements above

## Manual-Only Verifications
- Guarded TEST-then-prod migration apply (standard milestone pattern)
- Frontend "add email" UI — dev-browser verification per project's HARD RULE (test the actual flow, don't just unit-test)

**Approval:** pending
