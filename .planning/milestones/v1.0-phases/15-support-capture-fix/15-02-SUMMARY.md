---
phase: 15-support-capture-fix
plan: 02
subsystem: support
tags: [console-buffer, debug-panel, supabase-storage, tickets, tdd]

# Dependency graph
requires:
  - phase: 15-support-capture-fix
    plan: 01
    provides: "ticket-attachments bucket + uploadTicketAttachment/AttachmentDescriptor + Edge Function attachments validation (console_log already in the enum)"
provides:
  - "deriveConsoleBuffer: pure cap-100, error-prioritized, chronologically-ordered derivation over DebugMessage[] with allowlist field stripping (D-03)"
  - "serializeConsoleBuffer: application/json Blob with {capturedAt, entries} envelope"
  - "SupportTicketDialog derives the buffer from useDebugPanel().messages at submit time — no second console interceptor"
  - "submitSupportTicket uploads the buffer as a console_log attachment (screenshot first, console second; per-attachment failure isolation)"
affects: [15-03, tickets, admin-center]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Console snapshot = pure derivation over the existing global interceptor (DebugPanelProvider) — never a second console wrap"
    - "Multi-attachment upload with per-attachment try/catch: one failed upload never drops the others or blocks submission"

key-files:
  created:
    - src/lib/console-buffer.ts
    - src/lib/__tests__/console-buffer.test.ts
  modified:
    - src/components/support/SupportTicketDialog.tsx
    - src/services/support-ticket.service.ts
    - src/services/__tests__/support-ticket.service.test.ts
    - src/components/support/__tests__/SupportTicketDialog.test.tsx

key-decisions:
  - "Optional fields absent from a DebugMessage are OMITTED from the buffer entry (no undefined keys) — keeps the serialized JSON minimal and round-trip exact"
  - "consoleBuffer is always passed by the dialog (even when empty) — an empty console history is itself signal; the service uploads it unconditionally when a userId exists"
  - "Test harness reads Blobs via FileReader (jsdom Blob lacks .text()) — pattern for future Blob assertions"

patterns-established:
  - "ConsoleBufferEntry allowlist: timestamp/type/source/message/stack/httpStatus/url — responseBody, appStateSnapshot, rawMessage, details are stripped (T-15-06)"

requirements-completed: [CAP-01 (console-buffer slice)]

# Metrics
duration: ~25min
completed: 2026-06-11
---

# Phase 15 Plan 02: Console Buffer Auto-Attachment Summary

**Ticket submits now auto-attach a JSON console-log buffer (≤100 entries, errors retained preferentially, heavy/sensitive fields stripped) derived at submit time from the existing debug-panel interceptor and uploaded as a console_log attachment alongside the screenshot.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-06-11T15:50:10Z
- **Completed:** 2026-06-11T16:08:00Z (approx)
- **Tasks:** 2 (1 TDD, 1 wiring)
- **Files modified:** 6

## Accomplishments

- D-03: `deriveConsoleBuffer(messages, cap=100)` — all errors retained preferentially (most recent 100 if errors alone exceed the cap), remaining slots filled with the most recent non-errors, final sort timestamp ascending; message truncated to 500 chars, stack to 2000 (T-15-05); allowlist shape strips `responseBody`/`appStateSnapshot`/`rawMessage`/`details` (T-15-06)
- D-03: `serializeConsoleBuffer` produces an `application/json` Blob with a `{capturedAt, entries}` envelope; empty buffer serializes cleanly
- D-03/D-04: SupportTicketDialog consumes `useDebugPanel().messages` (global provider, no second interceptor — RESEARCH anti-pattern honored) and passes the serialized blob to `submitSupportTicket`, which uploads it via the 15-01 `uploadTicketAttachment` pipeline as `console_log` (`.json`, `application/json`), appending its descriptor after the screenshot's
- Failure policy preserved and strengthened: each attachment upload has its own try/catch — a failed console upload never blocks submission and never drops a successful screenshot descriptor

## Task Commits

1. **Task 1 RED: failing console-buffer tests** — `1465bf1` (test)
2. **Task 1 GREEN: deriveConsoleBuffer + serializeConsoleBuffer** — `c7b98f5` (feat)
3. **Task 2: dialog wiring + console_log upload on submit** — `ddcfd98` (feat)

## Files Created/Modified

- `src/lib/console-buffer.ts` — pure module (no React, no side effects, no console interception); exports `deriveConsoleBuffer`, `serializeConsoleBuffer`, `ConsoleBufferEntry`
- `src/lib/__tests__/console-buffer.test.ts` — 10 tests: 150-mixed/30-error cap case, 120-errors case, under-cap, empty, custom cap, field allowlist, optional-field omission, truncation limits, Blob round-trip, empty serialization
- `src/components/support/SupportTicketDialog.tsx` — `useDebugPanel()` consumed; buffer derived + serialized inside `handleSubmit`; `consoleBuffer` passed to submit
- `src/services/support-ticket.service.ts` — `SubmitSupportTicketParams.consoleBuffer?: { blob: Blob }`; attachments array built screenshot-first/console-second with per-attachment failure isolation
- `src/services/__tests__/support-ticket.service.test.ts` — +4 tests: both descriptors ordered, console-only, neither → no attachments key, console-fail-screenshot-survives
- `src/components/support/__tests__/SupportTicketDialog.test.tsx` — `@/components/debug-panel` mock added; +1 test asserting the submitted blob round-trips the mocked debug messages

## TDD Gate Compliance

Task 1 has RED (`test(15-02)`: 1465bf1, verified failing — module unresolved) preceding GREEN (`feat(15-02)`: c7b98f5, 10/10 pass). No refactor commit needed.

## Verification

- `npx vitest run src/lib/__tests__/console-buffer.test.ts` — 10/10 pass
- `npx vitest run src/services/__tests__/support-ticket.service.test.ts src/components/support/__tests__/SupportTicketDialog.test.tsx` — 20/20 pass
- Full suite: 205 files passed / 4 skipped, 1781 tests passed / 93 skipped, 0 failures
- `npm run build` — exit 0 (built in 7.65s)
- `npx eslint` on all 6 touched files — 0 issues
- Edge Function compatibility confirmed code-level: deployed `send-support-ticket` (v32, ACTIVE, deployed by 15-01) zod enum includes `console_log`, `max(2)` attachments, `${userId}/` prefix check — no function changes this plan, no redeploy

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] jsdom Blob lacks `.text()`**
- **Found during:** Task 1 GREEN run
- **Issue:** Two serializer tests failed with `TypeError: blob.text is not a function` — jsdom's Blob doesn't implement the W3C `text()` method
- **Fix:** test-harness `readBlobText` helper via `FileReader.readAsText` (jsdom-supported); production code unchanged
- **Files modified:** src/lib/__tests__/console-buffer.test.ts
- **Commit:** c7b98f5

## [VERIFIED] Items (storage recovered 2026-06-11)

**Live data-plane probe of the console_log upload** — storage recovered; probe executed live. **PASS.** A real authenticated user uploaded a 144-byte `application/json` console-log buffer to own folder `ticket-attachments/{uid}/<uuid>.json` (200/ok), submitted via deployed `send-support-ticket` (200), the `ticket_messages.attachments` descriptor landed (`{type:console_log, mime:application/json, size_bytes:144}`), and the admin signed-URL fetch returned **HTTP 200** with the JSON round-trip intact (`entries[0].level === "error"`). Evidence in `deferred-items.md` → "✅ VERIFIED" (Probe 3) and storage ticket `ed6eadb4`.

Original deferral cause: storage returned `544 DatabaseTimeout` (carried over from the 15-01 outage; probe at ~16:00 UTC 544'd). Implemented + unit-tested fully at ship time; the byte-path is now proven live too. Shipping during the outage was safe by design (failed upload logs, ticket still submits).

## Known Stubs

None — the empty-buffer path is a designed behavior (empty entries array still uploads), not a stub.

## Threat Flags

None beyond the plan's threat model — T-15-05 (size cap + truncation) and T-15-06 (field allowlist) implemented exactly as registered.

## Next Phase Readiness

- 15-03 reads `ticket_messages.attachments` descriptors (`screenshot` + `console_log`) and resolves them via `createSignedUrl` — descriptor shape unchanged from 15-01, single source in `support-ticket.service.ts`
- Outstanding: data-plane probes (upload RLS, signed URL reads, dev-browser end-to-end) once storage recovers — applies to 15-01, 15-02, and 15-03 equally

---
*Phase: 15-support-capture-fix*
*Completed: 2026-06-11*

## Self-Check: PASSED

All created files exist on disk; commits 1465bf1, c7b98f5, ddcfd98 verified in git log.
