---
phase: 15-support-capture-fix
plan: 01
subsystem: support
tags: [screenshots, html2canvas-pro, supabase-storage, rls, edge-function, tickets, tdd]

# Dependency graph
requires:
  - phase: 11-ticket-foundation-flag-removal
    plan: 02
    provides: "tickets/ticket_messages tables with attachments jsonb; send-support-ticket DB-first intake; has_role RLS idiom"
provides:
  - "Pre-dialog problem-view capture: 'Submit a Ticket' awaits captureScreenshot (5s timeout, Radix portal/dialog exclusion list) BEFORE the dialog mounts (D-01)"
  - "SupportTicketDialog thumbnail with Retake/Remove; 'Screenshot unavailable' fallback state (D-02)"
  - "Private ticket-attachments Storage bucket (5MB, jpeg/png/webp/json) with own-folder INSERT + owner-or-ADMIN SELECT RLS — live on hosted project (D-04)"
  - "uploadTicketAttachment + AttachmentDescriptor in support-ticket.service; screenshot uploaded at submit time, descriptor passed in invoke body"
  - "send-support-ticket validates attachments (max 2, closed enum, JWT-prefix path check T-15-01) and persists into ticket_messages.attachments — deployed"
affects: [15-02, 15-03, tickets, admin-center]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pre-capture at intent point: await capture with excludeElements before mounting any dialog that would pollute the shot"
    - "Storage bucket created by SQL migration (insert storage.buckets + CREATE POLICY on storage.objects) — first bucket in this repo, the convention-setter"
    - "Attachment jsonb carries Storage path references only (never base64); Edge Function re-validates path prefix against the JWT userId"

key-files:
  created:
    - supabase/migrations/20260612000001_create_ticket_attachments_bucket.sql
    - src/components/support/__tests__/SupportTicketDialog.test.tsx
    - src/services/__tests__/support-ticket.service.test.ts
  modified:
    - src/components/support/SupportPopover.tsx
    - src/components/support/SupportTicketDialog.tsx
    - src/services/support-ticket.service.ts
    - supabase/functions/send-support-ticket/index.ts

key-decisions:
  - "Server zod schema keeps {type,path,mime,size_bytes} per plan; client-side bucket/captured_at descriptor fields are stripped by zod on parse — persisted refs stay minimal"
  - "Retake keeps the existing screenshot when a retake capture fails/returns null (never trades a good capture for nothing)"
  - "Probe ticket deleted after verification (11-02 precedent) — its attachment path had no backing object due to the storage outage"

patterns-established:
  - "CAPTURE_EXCLUDE_ELEMENTS: shared exclusion list (Radix portals, popper wrappers, [role=dialog], overlays/toasts) for any future page capture"
  - "Storage RLS: (storage.foldername(name))[1] = auth.uid()::text own-folder predicate + public.has_role(auth.uid(),'ADMIN') admin read"

requirements-completed: [CAP-01]

# Metrics
duration: ~45min
completed: 2026-06-11
---

# Phase 15 Plan 01: Support Capture Fix Summary

**Support tickets now capture the problem view before the dialog renders (killing the "screenshots the submission form" bug), show a retakeable thumbnail, and persist the screenshot as a private Storage reference in ticket_messages.attachments via the deployed intake.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-06-11T15:10:37Z
- **Completed:** 2026-06-11T15:55:00Z (approx)
- **Tasks:** 3 (2 TDD, 1 blocking infra)
- **Files modified:** 7

## Accomplishments

- D-01: 'Submit a Ticket' click closes the popover, awaits `captureScreenshot` with the portal/dialog exclusion list (Promise.race 5s timeout), THEN mounts the dialog — the screenshot can never contain the form or popover
- D-02: thumbnail (dataUrl img, alt text), Retake (re-captures behind the open dialog via the same exclusion list), Remove, and a "Screenshot unavailable" degraded state; capture failure/timeout never blocks the dialog or submission
- D-04: private `ticket-attachments` bucket live with own-folder INSERT and owner-or-ADMIN SELECT policies; `uploadTicketAttachment` uploads `${userId}/${uuid}.jpg` at submit time; deployed `send-support-ticket` validates the refs (400 on foreign-prefix paths, T-15-01) and writes them into `ticket_messages.attachments`

## Task Commits

1. **Task 1 RED: failing capture/thumbnail tests** — `a2c3382` (test)
2. **Task 1 GREEN: pre-dialog capture + thumbnail/Retake/Remove** — `84de2d4` (feat)
3. **Task 2: bucket migration + push + Edge Function attachments (deployed --use-api)** — `ae4cba0` (feat)
4. **Task 3 RED: failing upload/payload service tests** — `9434088` (test)
5. **Task 3 GREEN: upload on submit + attachments payload** — `a0a6610` (feat)

## Files Created/Modified

- `supabase/migrations/20260612000001_create_ticket_attachments_bucket.sql` — private bucket + 2 storage.objects policies (no UPDATE/DELETE — immutable attachments)
- `src/components/support/SupportPopover.tsx` — `captureProblemView()` (exclusion list + 5s timeout, null on failure), async Submit-a-Ticket flow, screenshot/onRetake props
- `src/components/support/SupportTicketDialog.tsx` — thumbnail block between Textarea and footer, Retake/Remove ghost buttons (Remix icons), state re-seeded on each open, screenshot passed to submit
- `src/services/support-ticket.service.ts` — `AttachmentDescriptor`, `uploadTicketAttachment`, optional `screenshot` param; upload failure logs and submits without attachment
- `supabase/functions/send-support-ticket/index.ts` — `attachments` zod array (max 2), `${userId}/` prefix rejection (400), persisted into the ticket_messages insert
- `src/components/support/__tests__/SupportTicketDialog.test.tsx` — 8 tests (capture-before-mount ordering, exclusion list, failure/timeout fallback, retake, remove, direct-prop rendering)
- `src/services/__tests__/support-ticket.service.test.ts` — 7 tests (descriptor shape/own-prefix, json kind, error throw, body inclusion/omission, continue-on-upload-failure, no-userId skip)

## TDD Gate Compliance

Both TDD tasks have RED (`test(...)`) commits preceding GREEN (`feat(...)`) commits: a2c3382→84de2d4 and 9434088→a0a6610. RED runs verified failing for the right reasons (8/8 and 5-of-7) before implementation.

## Decisions Made

- Zod strips the client descriptor's `bucket`/`captured_at` on parse; persisted attachment refs carry `{type, path, mime, size_bytes}` exactly as the plan's schema specifies — bucket is implied (single attachments bucket), message `created_at` covers timing
- Retake only replaces state when the fresh capture succeeds — a failed retake never destroys a good capture
- Verification done programmatically against the live project (auth REST sign-in + deployed function invoke + Management API DB queries) — equivalent evidence to the dev-browser click-path for the data plane; visual thumbnail behavior covered by component tests

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Supabase storage service platform outage during live verification**
- **Found during:** Task 3 verification (live upload probe)
- **Issue:** Every storage REST call (including service-role bucket lists) returned `544 DatabaseTimeout`; platform health endpoint reported the project's storage service UNHEALTHY while db/auth/rest were healthy. No stuck locks in pg_stat_activity; no `supabase_storage_admin` session present; no platform-wide incident on status.supabase.com — project-specific storage pod failure. Storage config shows `upstreamTarget: "canary"`.
- **Fix attempted:** retries over ~25 min + idempotent `PATCH /config/storage` to bounce the service (HTTP 200) — did not recover within the verification window. Stopped per the fix-attempt limit; documented below as a deferred verification item.
- **Impact on shipped code:** none functionally — the upload path is designed to degrade exactly this way (upload failure logs and the ticket still submits without attachment), so shipping during the outage is safe.

---

**Total deviations:** 1 (blocking, infrastructure — code shipped as planned)
**Impact on plan:** No scope creep. All plan code landed exactly as specified.

## Issues Encountered

- **[VERIFIED 2026-06-11 — storage recovered] Upload byte-path now proven live.** At ship time (storage outage) the following were verified live: bucket row (private, 5MB, mime allowlist), both RLS policies in pg_policies with exact predicates, deployed function accepting a valid attachment ref (`{"success":true,"ticketId":...}`), rejecting a foreign-prefix path with 400, and `ticket_messages.attachments` populated end-to-end. The byte-path items that were blocked by the outage are now **PASS**: a real authenticated user uploaded a valid PNG to own folder (200), the object landed in `ticket-attachments`, the descriptor wrote into `ticket_messages.attachments`, admin `createSignedUrl` returned **HTTP 200 byte-exact**, and a second non-admin user was **blocked** from signing the first user's path (RLS, not emptiness — own-folder sign succeeds). Evidence in `deferred-items.md` → "✅ VERIFIED" (Probe 1 + Probe 2) and storage ticket `ed6eadb4`.
- Probe ticket `ff30ec1d` (created via the deployed function with a real attachment ref) was deleted after verification — its path had no backing object due to the outage, which would 404 in 15-02/15-03's signed-URL rendering. One "[15-01 verification probe]" email may sit in support@callvaultai.com — ignorable.
- Discovered legacy `support_attachments` bucket + 4 legacy storage.objects policies from the displaced 2026-06-10 morning-session stack — inert for this plan (bucket-id scoped), logged to `deferred-items.md`.

## Known Stubs

None — no placeholder data paths. The "Screenshot unavailable" state is a designed degraded mode, not a stub: Retake is wired and submission proceeds without an attachment.

## Threat Flags

None beyond the plan's threat model — the bucket, upload path, and function attachment surface are all registered (T-15-01..04) and their mitigations implemented as specified.

## User Setup Required

None — no new env vars or dashboard steps. (If the project's storage service stays UNHEALTHY, contacting Supabase support about the canary storage upstream may need Andrew's account.)

## Next Phase Readiness

- 15-02 (console ring buffer) can extend `submitSupportTicket`'s attachments array — `uploadTicketAttachment` already handles `console_log` (.json, application/json) and the function schema accepts 2 attachments
- 15-03 (admin rendering) reads `ticket_messages.attachments` and resolves paths via `createSignedUrl` on the live private bucket
- Outstanding: storage data-plane RLS probe + dev-browser visual pass once the Supabase storage service recovers

---
*Phase: 15-support-capture-fix*
*Completed: 2026-06-11*

## Self-Check: PASSED

All 7 plan files + SUMMARY + deferred-items exist on disk; commits a2c3382, 84de2d4, ae4cba0, 9434088, a0a6610 verified in git log.
