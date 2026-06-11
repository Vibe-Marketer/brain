# Phase 15: Support Capture Fix - Research

**Researched:** 2026-06-11
**Domain:** Browser screen capture (html2canvas-pro), console-log buffering, Supabase Storage (private bucket + RLS), ticket attachments
**Confidence:** HIGH (all claims verified against the live codebase in this session unless tagged otherwise)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 — Screenshot captures the PROBLEM VIEW, not the dialog**
- Capture BEFORE the dialog renders: trigger capture on dialog-open intent, await completion, then mount the dialog
- Use html2canvas-pro via the existing `src/lib/screenshot.ts` (already exports `ScreenshotOptions` / `ScreenshotResult` with dataUrl + blob + metadata)
- `excludeElements` (CSS-selector exclusion, already supported by screenshot.ts) is the FALLBACK if pre-capture is infeasible for some entry path — not the primary mechanism

**D-02 — Thumbnail preview in the dialog**
- User must see what's attached: thumbnail preview rendered in SupportTicketDialog
- Retake + remove controls on the preview

**D-03 — Console buffer auto-attachment**
- Ring buffer of last ~100 console entries, errors prioritized
- Capture via the existing debug-panel logging infrastructure if reusable (check `src/components/debug-panel/` — DebugPanelContext.tsx, debug-dump-utils.ts)
- Auto-attached as JSON to the ticket

**D-04 — Storage**
- Screenshots upload to a Supabase Storage bucket — private, RLS: reporter + admin
- Attachment path/reference written into `ticket_messages.attachments` (jsonb, NOT NULL DEFAULT '[]' — live per 11-02, migration 20260611000002_create_ticket_tables.sql)
- Verify bucket conventions before inventing one (verified this session: none exist — see Architecture Patterns)

**D-05 — Admin visibility**
- Both attachments (screenshot + console JSON) visible from the AdminTab ticket detail — this is 11-03's `TicketDetailDialog.tsx`. COORDINATE with 11-03, do not duplicate: render an attachment list + screenshot preview inside that dialog

### Claude's Discretion
- Attachments jsonb shape (Storage path references, not inline base64 for the screenshot; console JSON placement decided by researcher/planner based on size)
- Exact ring-buffer trimming implementation ("errors prioritized" = retain error-level entries preferentially when trimming to ~100)

### Deferred Ideas (OUT OF SCOPE)
- User-facing attachment viewing (reporter-side ticket thread) — v2 (AP-V2-02)
- Video/replay capture — out of scope
- Attaching arbitrary user files to tickets — out of scope for CAP-01
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAP-01 | Support-form screen capture reflects the problem view (not the open dialog); console-log buffer auto-attached; attachments retrievable from ticket detail | Pre-capture flow (Pattern 1), ring buffer from DebugPanelContext (Pattern 2), private bucket + signed URLs (Pattern 3), attachments jsonb shape (Pattern 4), TicketDetailDialog extension (Pattern 5) |
</phase_requirements>

## Summary

Everything this phase needs already exists in the codebase except the Storage bucket. `src/lib/screenshot.ts` wraps html2canvas-pro 1.5.13 with `excludeElements` + a `captureDebugScreenshot()` variant that already excludes Radix portals and `[role="dialog"]`. The single dialog-open intent point is `SupportPopover.tsx` ('Submit a Ticket' action → `setShowTicketDialog(true)`). The globally-mounted `DebugPanelProvider` (App.tsx) intercepts console.error/warn, window.onerror, unhandledrejection, and fetch failures into a 500-entry `messages: DebugMessage[]` exposed by `useDebugPanel()` — the ~100-entry error-prioritized ring buffer is a pure derivation at submit time. The intake (`send-support-ticket` Edge Function, pivoted DB-first in 11-02) inserts tickets/ticket_messages/ticket_events with service-role; `ticket_messages.attachments` jsonb is live and empty-array-defaulted.

**There are zero existing Storage conventions in this repo** — verified: no `storage.from(`, no `createSignedUrl`/`getPublicUrl`, no bucket-creating migration, nothing in `supabase/config.toml`. The bucket is greenfield: create `ticket-attachments` (private) via SQL migration with `storage.objects` policies (reporter-own-folder INSERT/SELECT, admin SELECT via the existing `public.has_role(auth.uid(), 'ADMIN')` SECURITY DEFINER helper that the ticket tables' RLS already uses).

**Primary recommendation:** Client captures pre-dialog → holds blob in dialog state with thumbnail → on submit uploads screenshot JPEG + console JSON directly to Storage under `{auth.uid()}/...` paths → passes paths in the existing `send-support-ticket` payload (zod schema extended) → Edge Function validates path prefix === JWT userId and writes the attachments array into the `ticket_messages` insert it already performs → `TicketDetailDialog` renders the attachment list with `createSignedUrl` previews.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Screenshot capture (pre-dialog) | Browser / Client | — | html2canvas reads the live DOM; only the client can do this |
| Thumbnail preview / retake / remove | Browser / Client | — | Local dialog state on the held blob |
| Console ring buffer derivation | Browser / Client | — | DebugPanelContext lives in the client; derive at submit |
| File upload | Browser / Client → Storage | Database (policies) | Direct `storage.from().upload()` under the user JWT; RLS on storage.objects is the control |
| Attachment reference persistence | API / Backend (Edge Function) | Database | send-support-ticket already owns the ticket_messages insert; it validates and writes attachments |
| Attachment path authorization | API / Backend (Edge Function) | — | Server must verify claimed paths belong to the authenticated user (spoofing control) |
| Attachment viewing (admin) | Browser / Client | Storage (signed URLs) | TicketDetailDialog + `createSignedUrl` under admin JWT; storage SELECT policy is the control |

## Standard Stack

### Core (all already installed — no new packages)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| html2canvas-pro | ^1.5.13 (package.json, verified) | DOM → canvas screenshot | Already wrapped by `src/lib/screenshot.ts`; locked decision D-01 |
| @supabase/supabase-js | ^2.84.0 (verified) | `storage.from().upload()` / `.createSignedUrl()` | Already the data client everywhere |
| TanStack Query + sonner | installed | mutation/toast idiom | Locked service+hook pattern |
| vitest | ^4.0.16 (verified) | unit tests | Existing test runner |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Direct client → Storage upload | base64 in Edge Function payload, service-role upload | Avoids storage RLS, but balloons payload (JPEG +33% base64, easily >1MB), couples capture size to function body limits, and zod `max()` limits in the existing schema would need bypassing. Direct upload is the standard Supabase pattern. |
| Console JSON uploaded as Storage object | inline JSON inside `attachments` jsonb | Inline bloats every ticket detail query and the 5000-char-style limits don't apply to jsonb, but a ~100-entry buffer with stacks can reach hundreds of KB. Store as a `.json` Storage object; the attachments array stays a small reference list. Uniform handling with the screenshot. |

## Package Legitimacy Audit

**No new packages are installed by this phase.** html2canvas-pro and @supabase/supabase-js are already in package.json. slopcheck gate not applicable.

## Architecture Patterns

### System Architecture Diagram

```
[User clicks 'Submit a Ticket' in SupportPopover]
        │  (popover closes)
        ▼
captureScreenshot({excludeElements: radix portals/overlays})   ← D-01 pre-capture
        │  await ScreenshotResult {blob, dataUrl, metadata}
        ▼
SupportTicketDialog mounts with screenshot state ──► thumbnail + Retake/Remove (D-02)
        │ user fills form, clicks Send
        ▼
deriveConsoleBuffer(useDebugPanel().messages)  → ~100 entries, errors kept first (D-03)
        ▼
supabase.storage.from('ticket-attachments')
  .upload(`${uid}/${uuid}.jpg`,  screenshotBlob)     ┐ parallel, user JWT,
  .upload(`${uid}/${uuid}.json`, consoleJsonBlob)    ┘ storage RLS INSERT policy
        ▼
supabase.functions.invoke('send-support-ticket', { ...existing payload, attachments: [paths] })
        ▼
Edge Function: zod-validate attachments → verify every path starts with `${userId}/`
  → existing tickets + ticket_messages insert, attachments jsonb on the message (D-04)
        ▼
AdminTab → TicketDetailDialog (11-03) → attachments section:
  list entries from ticket_messages.attachments → createSignedUrl per path
  → <img> preview for screenshot, download link for console JSON (D-05)
```

### Pattern 1: Pre-dialog capture at the intent point (D-01)

**What:** `SupportPopover.tsx` 'Submit a Ticket' `onClick` is the ONLY place that opens `SupportTicketDialog` (verified: sole non-test importer besides the popover is the dialog file itself; `sidebar-nav.test.tsx` only references the popover). Change the onClick to: `setOpen(false)` (popover closes) → `await captureScreenshot({...})` → store result in state → `setShowTicketDialog(true)`.

**Key facts (verified in `src/lib/screenshot.ts`):**
- `captureScreenshot(options)` returns `{ dataUrl, blob, metadata: {timestamp, url, viewport, userAgent} }`
- `captureDebugScreenshot()` already excludes `[data-radix-portal]`, `[role="dialog"]`, `.modal-overlay`, `.toast-container` — reuse this exclusion list so the just-closing popover (Radix portal) never appears in the capture even mid-animation
- Capture defaults: jpeg, quality 0.8, scale 1, `backgroundColor: '#ffffff'`

**Retake (D-02 fallback path = locked `excludeElements` fallback):** while the dialog is open, a Retake action calls the same capture with the debug exclusion list — the dialog and overlay live in a Radix portal with `[role="dialog"]`, so the capture sees the problem view behind it. No unmount/remount dance needed.

### Pattern 2: Console ring buffer from DebugPanelContext (D-03)

**What:** `DebugPanelProvider` is mounted globally in `App.tsx` (verified, line 57). `useDebugPanel()` exposes `messages: DebugMessage[]` (capped at `config.maxMessages` = 500, verified) covering console.error, console.warn, window.onerror, unhandledrejection, and failed fetches. `DebugMessage` carries `type ('error'|'warning'|'info'|'network'|...)`, `message`, `source`, `timestamp`, `stack`, `httpStatus`, `url`.

**Derivation (pure function, unit-testable):** take `messages`, partition into errors (`type === 'error'`) and non-errors, keep all errors first up to 100, fill the remainder with the most recent non-errors, sort the final ~100 by timestamp ascending, serialize a trimmed shape (`timestamp, type, source, message (truncated), stack (truncated), httpStatus, url`) to JSON. Strip fields like `appStateSnapshot` to bound size.

**Caveat:** `SupportTicketDialog` currently has no debug-panel dependency; it must consume `useDebugPanel()` (provider is guaranteed above it in the tree — the dialog renders inside App). If the hook throws outside the provider (tests), mock it.

### Pattern 3: Storage bucket — greenfield, migration-created (D-04)

**Verified:** zero Storage usage in `src/` and `supabase/` (no `storage.from(`, no signed-URL calls, no `storage.buckets` migration, nothing in config.toml). There is NO existing convention to follow — this migration establishes it.

**Migration (new file `supabase/migrations/<ts>_create_ticket_attachments_bucket.sql`):**
- `insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('ticket-attachments', 'ticket-attachments', false, 5242880, array['image/jpeg','image/png','image/webp','application/json']) on conflict (id) do nothing;`
- `storage.objects` policies (CREATE POLICY works from hosted migrations; ALTER on storage tables does not):
  - INSERT: `bucket_id = 'ticket-attachments' AND (storage.foldername(name))[1] = auth.uid()::text` (reporter uploads only into own folder)
  - SELECT: same own-folder predicate `OR public.has_role(auth.uid(), 'ADMIN')` (mirrors ticket-table RLS, verified in 20260611000002)
  - No UPDATE/DELETE policies — attachments immutable, consistent with the append-only audit posture
- `[ASSUMED]` the exact `storage.buckets` column set (`file_size_limit`, `allowed_mime_types`) matches the current hosted Supabase schema — standard documented pattern but not verifiable from this repo; executor must confirm against the live project before push (A1)

**Deployment pitfall (from 11-02-SUMMARY, verified):** `supabase db push` was blocked by 5 foreign remote-only migration-history rows; 11-02 applied SQL via the Management API then `supabase migration repair --status applied`. Expect the same for this migration. supabase CLI 2.101.0 available (verified).

### Pattern 4: Attachments jsonb shape + Edge Function extension (D-04)

**attachments array element (Claude's-discretion shape, recommended):**
```json
{ "type": "screenshot" | "console_log", "bucket": "ticket-attachments", "path": "<uid>/<uuid>.jpg", "mime": "image/jpeg", "size_bytes": 123456, "captured_at": "<ISO>" }
```

**Edge Function (`supabase/functions/send-support-ticket/index.ts`, 232 lines, verified):** extend `supportTicketSchema` with an optional `attachments` array (zod: max 2 items, each `{type: z.enum(['screenshot','console_log']), path: z.string().max(300), mime, size_bytes}`). After auth (`userId` from JWT), reject any attachment whose `path` does not start with `` `${userId}/` `` — this is the spoofing control (a client could otherwise reference another user's objects). Pass the validated array into the existing `ticket_messages` insert as `attachments` (currently omitted → defaults to `[]`).

### Pattern 5: Admin attachment rendering in TicketDetailDialog (D-05)

11-03 (planned, NOT yet executed) creates `src/components/settings/TicketDetailDialog.tsx` with sections: header/badges/status select, context block, messages list, Activity timeline. Phase 15 extends the messages list area: for each message with non-empty `attachments`, render an "Attachments" group — screenshot entries get an `<img>` whose src comes from `supabase.storage.from('ticket-attachments').createSignedUrl(path, expiry)` (private bucket → signed URLs, never `getPublicUrl`); console_log entries get a download/open link from the same signed URL. Wrap signed-URL fetching in the service layer (`tickets.service.ts`, also created by 11-03) per the locked service+hook pattern.

**Hard sequencing fact:** `tickets.service.ts`, `useTickets.ts`, and `TicketDetailDialog.tsx` DO NOT EXIST yet — they are 11-03 deliverables; `NewTicketDialog.tsx` and `createTicket` are 11-04 deliverables sharing `tickets.service.ts`/`AdminTab.tsx`. **Phase 15 execution MUST wait until 11-03 and 11-04 are complete.** Shared-file overlap: `SupportTicketDialog.tsx` (15 modifies; 11-04 reads as analog), `tickets.service.ts` (11-03 creates, 11-04 extends, 15 extends), `TicketDetailDialog.tsx` (11-03 creates, 15 extends).

### Anti-Patterns to Avoid
- **Base64 screenshot through the Edge Function** — payload bloat, zod limits, function body limits. Upload direct to Storage.
- **`getPublicUrl` on a private bucket** — returns a URL that 400s. Signed URLs only.
- **Capturing after dialog mount with no exclusions** — the original bug ("screenshots the screen with the submission form").
- **Hand-rolling a second console interceptor** — DebugPanelProvider already intercepts globally; a second `console.error` wrap risks recursion with its `isCapturing` guard.
- **Inline supabase calls in components** — service+hook pattern is locked (src/CLAUDE.md).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DOM screenshot | canvas drawing of DOM | `src/lib/screenshot.ts` (html2canvas-pro) | exists, locked D-01 |
| Console interception | new console.* wrapper | `useDebugPanel().messages` | global provider already intercepts 5 signal types with recursion guards |
| Private file access | proxy endpoint streaming bytes | `createSignedUrl` | built into supabase-js storage |
| Admin check in storage policy | new role plumbing | `public.has_role(auth.uid(), 'ADMIN')` | existing SECURITY DEFINER helper already used by ticket RLS |

## Common Pitfalls

### Pitfall 1: Popover still in the DOM at capture time
**What goes wrong:** `setOpen(false)` then immediate capture races the Radix close animation; popover appears in the screenshot.
**How to avoid:** include `[data-radix-portal]` and `[data-radix-popper-content-wrapper]` in `excludeElements` (the popover renders in a portal) — same list `captureDebugScreenshot` uses. Don't rely on timing.
**Warning signs:** popover visible in thumbnail during manual verification.

### Pitfall 2: html2canvas capture latency blocks the dialog open
**What goes wrong:** capture takes 1–3s on heavy pages; the user clicks and nothing happens.
**How to avoid:** acceptable per locked D-01 (await then mount), but set a capture timeout (e.g. Promise.race ~5s) and open the dialog WITHOUT a screenshot on failure/timeout — capture failure must never block ticket submission. Show "Screenshot unavailable" with Retake offered.

### Pitfall 3: Cross-origin images render blank
**What goes wrong:** html2canvas with `useCORS: true, allowTaint: false` (current settings) blanks images lacking CORS headers (avatars, external thumbnails).
**How to avoid:** accept — partial screenshot is fine for support context. Do NOT flip allowTaint (taints the canvas → `toBlob` throws, killing the whole capture).

### Pitfall 4: Orphaned Storage objects
**What goes wrong:** upload-then-invoke means a failed function call leaves objects with no ticket reference; remove/cancel after upload would too.
**How to avoid:** upload only at submit time (blob held in memory until then); on function-invoke failure surface the existing error toast — orphan rate is bounded by failed submits, acceptable; note cleanup as out-of-scope.

### Pitfall 5: Attachment path spoofing
**What goes wrong:** client sends `attachments: [{path: "other-user-id/x.jpg"}]`; admin later gets a signed URL to another user's file rendered inside a ticket.
**How to avoid:** Edge Function rejects paths not prefixed `` `${userId}/` `` (T-15 mitigation). Storage INSERT policy already prevents writing outside own folder; this check closes the reference side.

### Pitfall 6: `supabase db push` blocked by migration history
**What goes wrong:** 5 foreign remote-only history rows (11-02, verified in SUMMARY) block push.
**How to avoid:** follow 11-02's pattern — Management API SQL apply + `supabase migration repair --status applied`.

### Pitfall 7: vitest jsdom has no real canvas
**What goes wrong:** unit tests invoking real `captureScreenshot` fail (no canvas impl).
**How to avoid:** mock `@/lib/screenshot` in component tests; unit-test the pure ring-buffer derivation directly (no DOM needed).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Email-only support tickets | DB-first tickets + email side-effect (`send-support-ticket` pivoted) | 11-02 (2026-06-11, shipped) | Phase 15 attaches to `ticket_messages.attachments`, not to the email |
| html2canvas (original) | html2canvas-pro | already adopted | modern CSS color support (oklch) — keep using the pro wrapper |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `storage.buckets` insert columns (`file_size_limit`, `allowed_mime_types`) and `storage.foldername()` policy helper match the live hosted schema | Pattern 3 | Migration fails on push — executor verifies against live project (read-only query) before applying; fallback is bucket creation via Dashboard/Management API + policy-only migration |
| A2 | Edge Function request body comfortably fits the path-reference payload (paths only, no binary) | Pattern 4 | None in practice — payload grows by <1KB |

## Open Questions (RESOLVED)

1. **Does the hosted project allow `CREATE POLICY` on `storage.objects` from CLI migrations?**
   - What we know: standard documented Supabase pattern; migrations run as a privileged role; 11-02 already needed the Management API workaround for unrelated history reasons.
   - RESOLVED: the executor applies the migration via `supabase db push`, falling back to the 11-02 Management API SQL-apply + `supabase migration repair --status applied` path; if CLI policy creation is rejected, the identical SQL goes through the Management API endpoint. Plan 15-01 Task 2 encodes this exact sequence as a [BLOCKING] task, so the uncertainty is handled at execution time with a deterministic fallback — no planning decision hangs on it.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| supabase CLI | migration push / repair | ✓ | 2.101.0 | Management API SQL apply (11-02 pattern) |
| node / npm | build + tests | ✓ | v26.0.0 / 11.12.1 | — |
| html2canvas-pro | capture | ✓ (installed) | ^1.5.13 | — |
| Docker | NOT required | ✗ (not running) | — | `--use-api` for function deploy (supabase/CLAUDE.md rule) |

**Missing dependencies with no fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.0.16 (verified package.json) |
| Config file | vitest.config.ts (integration tests excluded by default) |
| Quick run command | `npx vitest run <file>` |
| Full suite command | `npm test` (= `vitest run`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CAP-01 | Ring buffer derivation: ≤100 entries, errors retained preferentially, chronological order, trimmed fields | unit | `npx vitest run src/lib/__tests__/console-buffer.test.ts` | ❌ Wave 0 (created in-plan) |
| CAP-01 | Capture flow: open-intent triggers capture before dialog mounts; failure/timeout still opens dialog | component (mocked screenshot lib) | `npx vitest run src/components/support/__tests__/SupportTicketDialog.test.tsx` | ❌ Wave 0 (created in-plan) |
| CAP-01 | Submit uploads 2 objects and invokes function with validated attachments payload | unit (mocked supabase) | `npx vitest run src/services/__tests__/support-ticket.service.test.ts` | ❌ Wave 0 (created in-plan) |
| CAP-01 | Edge fn rejects foreign-prefix attachment paths; writes attachments into ticket_messages | unit (Deno-style logic extracted) / manual + dev-browser | covered by service test mocks + execution-time dev-browser verification | ❌ |
| CAP-01 | Admin detail renders attachment list + signed-URL image | component (mocked service) | `npx vitest run src/components/settings/__tests__/TicketDetailDialog.test.tsx` (extends 11-03's surface) | ❌ Wave 0 (created in-plan) |

### Sampling Rate
- **Per task commit:** targeted `npx vitest run <new test file>`
- **Per wave merge:** `npm test` + `npm run build`
- **Phase gate:** full suite green + dev-browser visual verification (project hard rule) before `/gsd-verify-work`

### Wave 0 Gaps
- Test files listed above are created inside the plans that introduce the code (no pre-existing coverage of capture surfaces). Framework already installed — no Wave 0 install tasks.

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | existing `authenticateRequest` shared helper in send-support-ticket (already wired) |
| V3 Session Management | no | Supabase-managed JWT |
| V4 Access Control | yes | storage.objects RLS (own-folder INSERT/SELECT + has_role ADMIN SELECT); existing ticket-table RLS; Edge Fn path-prefix check |
| V5 Input Validation | yes | zod schema extension in send-support-ticket (closed type enum, path max length, array max 2) |
| V6 Cryptography | no | signed URLs are supabase-js built-ins |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Attachment path spoofing (reference another user's object) | Spoofing/Information Disclosure | Edge Fn rejects paths not prefixed with JWT userId |
| Upload outside own folder | Tampering | storage INSERT policy `(storage.foldername(name))[1] = auth.uid()::text` |
| Screenshot contains sensitive page content served to non-admins | Information Disclosure | private bucket; SELECT limited to owner + ADMIN; signed URLs short-lived |
| Oversized/hostile uploads | DoS | bucket `file_size_limit` 5MB + `allowed_mime_types` allowlist |
| XSS via attachment metadata rendered in admin dialog | Injection | render as React text nodes / `<img src>` from signed URL only — no dangerouslySetInnerHTML (consistent with T-11-12) |

## Sources

### Primary (HIGH confidence — verified in-session against the live repo)
- `src/lib/screenshot.ts` (full read) — capture API, exclusion lists
- `src/components/support/SupportPopover.tsx`, `SupportTicketDialog.tsx`, `src/services/support-ticket.service.ts` (full reads) — intent point, dialog, payload builder
- `src/components/debug-panel/DebugPanelContext.tsx` (interception + context value), `types.ts`, `index.ts` — DebugMessage shape, maxMessages 500, exported hooks
- `supabase/functions/send-support-ticket/index.ts` (full read) — zod schema, DB-first insert flow
- `supabase/migrations/20260611000002_create_ticket_tables.sql` (full read) — attachments jsonb, has_role RLS idiom
- `.planning/phases/11-ticket-foundation-flag-removal/11-03-PLAN.md`, `11-04-PLAN.md`, `11-02-SUMMARY.md` (full reads) — shared-file map, deployment workaround, detail-dialog contract
- `package.json` — versions; rg sweeps proving zero Storage usage

### Secondary (MEDIUM confidence)
- Supabase Storage bucket-by-migration + `storage.foldername` policy pattern — standard documented pattern, tagged A1 for live-schema confirmation (no in-repo precedent to verify against)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — everything installed and read in-session
- Architecture: HIGH — all integration points read in full; storage pattern MEDIUM (A1)
- Pitfalls: HIGH — derived from read code (recursion guard, exclusion lists, 11-02 push history)

**Research date:** 2026-06-11
**Valid until:** 2026-07-11 (stable domain) — EXCEPT the 11-03/11-04 sequencing facts, which expire the moment those plans execute
