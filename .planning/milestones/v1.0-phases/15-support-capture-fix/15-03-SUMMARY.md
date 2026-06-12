---
phase: 15-support-capture-fix
plan: 03
subsystem: support
tags: [signed-urls, supabase-storage, tickets, admin-center, tdd]

# Dependency graph
requires:
  - phase: 11-ticket-foundation-flag-removal
    plan: 03
    provides: "tickets.service.ts, useTickets.ts, TicketDetailDialog.tsx (created)"
  - phase: 11-ticket-foundation-flag-removal
    plan: 04
    provides: "createTicket/useCreateTicket extensions of the same files"
  - phase: 15-support-capture-fix
    plan: 01
    provides: "private ticket-attachments bucket + AttachmentDescriptor shape + ticket_messages.attachments persistence"
provides:
  - "getAttachmentSignedUrl(path): createSignedUrl(path, 3600) on the private bucket — labeled throws on error/null (D-04)"
  - "useAttachmentUrl(path?): TanStack Query ['attachment-url', path], enabled when path truthy, staleTime under expiry"
  - "TicketDetailDialog per-message Attachments group: screenshot img preview + console JSON link, signed URLs only (D-05)"
affects: [tickets, admin-center]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Private-bucket reads go service (createSignedUrl) -> hook (useAttachmentUrl) -> component — no inline supabase calls, no public URLs"
    - "Tolerant jsonb parse: descriptor entries failing the contract are skipped silently (render nothing rather than crash)"

key-files:
  created:
    - src/components/settings/__tests__/TicketDetailDialog.test.tsx
  modified:
    - src/services/tickets.service.ts
    - src/hooks/useTickets.ts
    - src/components/settings/TicketDetailDialog.tsx
    - src/services/__tests__/tickets.service.test.ts

key-decisions:
  - "AttachmentDescriptor re-exported from support-ticket.service (single source from 15-01; not redeclared)"
  - "useAttachmentUrl staleTime = expiry minus 300s — a cached-but-expired URL is never served to an img"
  - "Screenshot preview wrapped in an anchor (new tab, noopener) — click-to-open without any JS handler"
  - "Comments avoid the literal public-URL API name so the phase grep sweep stays at 0 matches"

requirements-completed: [CAP-01]

# Metrics
duration: ~25min
completed: 2026-06-11
---

# Phase 15 Plan 03: Admin Attachment Visibility Summary

**Admins opening a ticket detail now see an Attachments group on any message carrying attachments — the screenshot as an inline signed-URL image preview and the console log as a download link — completing the CAP-01 loop from reporter capture to admin triage.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-06-11T16:05:00Z (approx)
- **Completed:** 2026-06-11T16:25:00Z (approx)
- **Tasks:** 2 (1 TDD, 1 UI + phase sweep)
- **Files modified:** 5

## Accomplishments

- D-04: `getAttachmentSignedUrl` calls `supabase.storage.from('ticket-attachments').createSignedUrl(path, 3600)`; throws `Failed to load attachment: ...` on error or null data — matches the 11-03 error style; private bucket, zero public-URL usage anywhere in src/
- D-05: `useAttachmentUrl` wraps it per the existing useTickets idiom (`['attachment-url', path]`, session+path gated, staleTime 3300s)
- D-05: TicketDetailDialog renders an Attachments group under any message whose attachments jsonb parses to ≥1 valid descriptor: screenshot → `img` (signed src, alt "Ticket screenshot", max-h-48 rounded-md border object-contain, anchor opens new tab noopener) with Skeleton-while-loading and "Attachment unavailable" on error; console_log → RiFileTextLine + "Console log (JSON)" link (new tab, noopener)
- T-15-08: all metadata rendered as React text nodes; img src exclusively from createSignedUrl's return — descriptor strings never become URLs
- No-regression: messages without attachments render byte-identical to 11-03 (no header, no spacing change); all 13 pre-existing tickets.service tests untouched and passing

## Task Commits

1. **Task 1 RED: failing getAttachmentSignedUrl tests** — `473e6d1` (test)
2. **Task 1 GREEN: signed-URL service + useAttachmentUrl hook** — `50ba0e9` (feat)
3. **Task 2: Attachments group in TicketDetailDialog + sweep** — `2c4b2f9` (feat)

## Files Created/Modified

- `src/services/tickets.service.ts` — `getAttachmentSignedUrl`, `ATTACHMENT_URL_EXPIRY_SECONDS`, `AttachmentDescriptor` re-export
- `src/hooks/useTickets.ts` — `useAttachmentUrl` following the file's query idiom
- `src/components/settings/TicketDetailDialog.tsx` — `parseAttachments` tolerant jsonb parse, `AttachmentItem` component, per-message Attachments group inside the 11-03 messages list (structure otherwise untouched)
- `src/services/__tests__/tickets.service.test.ts` — +3 tests (signed URL returned, labeled throw on error, labeled throw on null data); storage mock added to the hoisted supabase mock
- `src/components/settings/__tests__/TicketDetailDialog.test.tsx` — NEW: 5 tests (both types render with signed URLs via the hook, empty array → no group, invalid entries skipped, all-invalid → no group, error → unavailable state)

## TDD Gate Compliance

Task 1 has RED (`test(15-03)`: 473e6d1, verified failing — `getAttachmentSignedUrl` unexported, 3 fail / 13 prior pass) preceding GREEN (`feat(15-03)`: 50ba0e9, 16/16 pass). No refactor commit needed.

## Verification

- `npx vitest run src/services/__tests__/tickets.service.test.ts` — 16/16 pass (11-03/11-04 coverage untouched)
- `npx vitest run src/components/settings/__tests__/TicketDetailDialog.test.tsx` — 5/5 pass
- Full suite: 206 files passed / 4 skipped, 1790 tests passed / 93 skipped, 0 failures
- `npm run build` — exit 0
- `npx eslint` on all 5 touched files — 0 issues
- `grep -rn "getPublicUrl" src/` — **0 matches**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Doc comments tripped the phase grep gate**
- **Found during:** Task 2 sweep
- **Issue:** Two explanatory comments contained the literal forbidden API name, making the `grep -rn "getPublicUrl" src/` sweep return 2 instead of 0
- **Fix:** reworded both comments ("public-URL access is forbidden") — zero code change
- **Files modified:** src/services/tickets.service.ts, src/components/settings/TicketDetailDialog.tsx
- **Commit:** 2c4b2f9

## [VERIFIED] Items (storage recovered 2026-06-11)

**Signed-URL data-plane probes** — storage recovered; live probes executed against the hosted/prod project. **PASS.** Evidence in `deferred-items.md` → "✅ VERIFIED" section and storage ticket `ed6eadb4`.
1. Screenshot path end-to-end: real user uploaded a valid PNG to own folder → submitted via deployed `send-support-ticket` (200) → `ticket_messages.attachments` descriptor landed → object present → admin `createSignedUrl` fetched **HTTP 200, byte-exact** (70 bytes). ✅
2. RLS spot-check: a second authenticated non-admin user CANNOT `createSignedUrl` on the first user's path (`Object not found`); the same user signing their OWN path succeeds → proves RLS, not emptiness. ✅
3. Live signed-URL fetch returns 200 for valid objects (the "Attachment unavailable" state is reserved for genuine failures). ✅

Original deferral cause: the project's storage service returned `544 DatabaseTimeout` across three execution windows (15-01 ~15:30, 15-02 ~16:00, 15-03 ~16:20 UTC). Everything pg_policies/code-level was already proven at ship time (SELECT policy predicates in pg_policies, service/hook/component fully unit-tested); the byte-path is now proven live too.

## Known Stubs

None — "Attachment unavailable" is the designed signed-URL error state, not a stub.

## Threat Flags

None beyond the plan's threat model — T-15-07 (3600s expiry, on-demand fetch, never persisted), T-15-08 (text nodes only, src from createSignedUrl only), T-15-09 (RLS is the control) implemented as registered.

## Next Phase Readiness

- CAP-01 phase scope complete code-side: capture (15-01) → console buffer (15-02) → admin visibility (15-03)
- Outstanding for the verifier: all storage data-plane probes across the three plans, blocked by the platform outage (project storage on canary upstream — see deferred-items.md)

---
*Phase: 15-support-capture-fix*
*Completed: 2026-06-11*

## Self-Check: PASSED

All created files exist on disk; commits 473e6d1, 50ba0e9, 2c4b2f9 verified in git log.
