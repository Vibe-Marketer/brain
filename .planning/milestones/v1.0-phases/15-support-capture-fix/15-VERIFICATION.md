---
phase: 15
slug: support-capture-fix
status: passed_with_waivers
verified: 2026-06-12
verifier: Codex retroactive milestone audit follow-up
---

# Phase 15 — Verification

> Phase 15 has strong code/test and live storage data-plane evidence. Visual browser proof that the screenshot thumbnail captures the problem view was waived for v1.0 by Andrew on 2026-06-12.

## Success Criteria

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Screenshot capture runs before opening the support dialog | passed_code_verified | 15-01/15-02 summaries record support dialog capture flow and component/service tests. |
| 2 | Console buffer is captured and bounded safely | passed | 15-02 summary records console-buffer tests and payload trimming; deferred live probe later verified JSON round-trip. |
| 3 | Attachments are stored privately and referenced as descriptors | passed_live_verified | `deferred-items.md` VERIFIED section records real upload -> ticket -> descriptor -> signed fetch -> cleanup for screenshot and console JSON. |
| 4 | Admin ticket detail renders attachments through signed URLs only | passed_code_verified | 15-03 summary records `getAttachmentSignedUrl`, `useAttachmentUrl`, TicketDetailDialog tests, and `getPublicUrl` grep 0. |
| 5 | Cross-user storage access is denied | passed_live_verified | `deferred-items.md` records second non-admin user blocked from signing first user's path while own-folder signing succeeded. |
| 6 | Browser visual confirms screenshot is the problem view | waived_for_v1 | Not present in the phase evidence; waived by principal for milestone archive. |

## Commands From Phase Evidence

| Command | Result |
|---|---|
| `npx vitest run src/services/__tests__/tickets.service.test.ts` | 16/16 pass in 15-03 |
| `npx vitest run src/components/settings/__tests__/TicketDetailDialog.test.tsx` | 5/5 pass in 15-03 |
| Full suite | 206 files passed / 1790 tests passed / 0 failures in 15-03 |
| `npm run build` | passed in 15-03 |
| `grep -rn "getPublicUrl" src/` | 0 matches in 15-03 |

## Waived Items

- Authenticated browser visual check confirming screenshot content is the problem view, not the support dialog.
- Legacy `support_attachments` bucket and policies remain inert housekeeping debt, explicitly out of Phase 15 scope.

## Sign-off

- [x] Phase-level evidence record now exists.
- [x] Code/test/build evidence exists.
- [x] Live storage data-plane probes passed.
- [x] Browser visual proof waived for v1.0.
