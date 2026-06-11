# Phase 15: Support Capture Fix - Context

**Gathered:** 2026-06-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix the support form's capture pipeline so submitted tickets carry an accurate picture of the problem. Andrew's original lost ticket is the canonical motivation, in his words: the support form's screen capture currently "screenshots the screen with the submission form — aka it's fuckin useless." Scope: pre-dialog screenshot capture with in-dialog preview, console-log ring-buffer auto-attachment, Supabase Storage upload, and attachment rendering in the admin ticket detail. Requirement: CAP-01. ISA refs: ISC-10.1 / ISC-10.2. No autonomous-fix machinery (Phases 13/14), no Sentry ingestion (Phase 12).

</domain>

<decisions>
## Implementation Decisions (locked)

### D-01: Screenshot captures the PROBLEM VIEW, not the dialog
- Capture BEFORE the dialog renders: trigger capture on dialog-open intent, await completion, then mount the dialog
- Use html2canvas-pro via the existing `src/lib/screenshot.ts` (already exports `ScreenshotOptions` / `ScreenshotResult` with dataUrl + blob + metadata)
- `excludeElements` (CSS-selector exclusion, already supported by screenshot.ts) is the FALLBACK if pre-capture is infeasible for some entry path — not the primary mechanism

### D-02: Thumbnail preview in the dialog
- User must see what's attached: thumbnail preview rendered in SupportTicketDialog
- Retake + remove controls on the preview

### D-03: Console buffer auto-attachment
- Ring buffer of last ~100 console entries, errors prioritized
- Capture via the existing debug-panel logging infrastructure if reusable (check `src/components/debug-panel/` — DebugPanelContext.tsx, debug-dump-utils.ts)
- Auto-attached as JSON to the ticket

### D-04: Storage
- Screenshots upload to a Supabase Storage bucket — private, RLS: reporter + admin
- Attachment path/reference written into `ticket_messages.attachments` (jsonb, NOT NULL DEFAULT '[]' — live per 11-02, migration 20260611000002_create_ticket_tables.sql)
- Verify bucket conventions before inventing one. Initial scan: NO existing `storage.from(...)` / bucket usage found in `src/` or `supabase/` and no bucket-creating migration exists — researcher must confirm (including Supabase dashboard/config) before the plan defines the bucket migration

### D-05: Admin visibility
- Both attachments (screenshot + console JSON) visible from the AdminTab ticket detail — this is 11-03's `TicketDetailDialog.tsx`. COORDINATE with 11-03, do not duplicate: render an attachment list + screenshot preview inside that dialog

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/screenshot.ts` — html2canvas-pro wrapper; `excludeElements` option, blob + dataUrl + viewport/userAgent metadata already implemented
- `src/components/support/SupportTicketDialog.tsx` + `SupportPopover.tsx` — the dialog-open intent point where pre-capture must hook in
- `src/components/debug-panel/` (DebugPanelContext.tsx, debug-dump-utils.ts, types.ts) — candidate console-logging infrastructure for the ring buffer
- `supabase/migrations/20260611000002_create_ticket_tables.sql` — `ticket_messages.attachments` jsonb already live with RLS mirroring parent ticket
- 11-03's `tickets.service.ts` / `useTickets` hooks / `TicketDetailDialog.tsx` — the admin detail surface to extend

### Established Patterns
- Service + Hook separation (src/services/ pure async, src/hooks/ TanStack Query)
- RLS regression test `src/test/rls-regression.test.ts` — storage policies need equivalent verification
- npm only; Remix icons only; no AI code in frontend (AI-02)
- Conventional commits scoped `feat(15-xx):`

### Integration Points / Sequencing
- **EXECUTION GATE: Phase 15 execution waits until 11-03 AND 11-04 are complete.** Shared files: SupportTicketDialog.tsx, tickets service, AdminTab ticket detail dialog. Planning can proceed now; execution must not race 11-03/11-04 edits
- `supabase/migrations/` — new storage bucket + policies migration
- `src/types/supabase.ts` — extend if attachment shape types are added

</code_context>

<specifics>
## Specific Ideas

- Dialog-open flow: user clicks support trigger → capture fires against the current view → capture resolves → dialog mounts with thumbnail already populated
- Attachments jsonb shape should reference Storage paths (not inline base64) for the screenshot; console buffer may inline as JSON or store alongside — researcher/planner decides based on size
- Errors prioritized in the ring buffer means: when trimming to ~100 entries, retain error-level entries preferentially

</specifics>

<deferred>
## Deferred Ideas

- User-facing attachment viewing (reporter-side ticket thread) — v2 (AP-V2-02)
- Video/replay capture — out of scope
- Attaching arbitrary user files to tickets — out of scope for CAP-01

</deferred>

---

*Headless session: defaults taken without interactive questioning; decisions above were supplied locked by Andrew.*
