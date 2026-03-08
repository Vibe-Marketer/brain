---
phase: 17-import-connector-pipeline
plan: 04
subsystem: ui
tags: [react, tanstack-query, supabase, sonner, radix-ui, remix-icon, import-hub, drag-drop, file-upload]

# Dependency graph
requires:
  - phase: 17-import-connector-pipeline
    plan: 01
    provides: "import_sources table with RLS, get_import_counts() RPC, sync_jobs.skipped_count column"
provides:
  - "src/services/import-sources.service.ts — CRUD + file upload + retry service layer"
  - "src/hooks/useImportSources.ts — 7 React Query hooks for import source data"
  - "src/components/import/SourceCard.tsx — per-source card with status badge, toggle, sync, disconnect"
  - "src/components/import/FileUploadDropzone.tsx — drag-and-drop with 25MB validation"
  - "src/components/import/ImportSourceGrid.tsx — responsive grid with Add Source card"
  - "src/components/import/FailedImportsSection.tsx — collapsible failed imports with per-call retry"
  - "src/routes/_authenticated/import/index.tsx — Import Hub page replacing placeholder"
  - "queryKeys.imports.counts() and queryKeys.imports.failed() keys in query-config.ts"
affects:
  - 17-import-connector-pipeline (plans 05+: file-upload connector writes to import_sources)
  - 18-import-routing-rules (reads import_sources per-source status)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-source status derived from import_sources row: undefined=disconnected, error_message=error, is_active=false=paused, is_active=true=active"
    - "OAuth return auto-sync via URL query params (?source=fathom&connected=true) checked on mount, cleaned with history.replaceState"
    - "Dedup-aware toast: reads skipped_count from sync edge function response, appends 'Skipped N duplicates.' when > 0"
    - "File upload validates MIME type and 25MB client-side before calling edge function"
    - "FailedImportsSection hidden entirely when no failed imports; collapses per user preference"
    - "YouTube always treated as connected (API key, no per-user OAuth); sync opens URL input dialog"

key-files:
  created:
    - "src/services/import-sources.service.ts"
    - "src/hooks/useImportSources.ts"
    - "src/components/import/SourceCard.tsx"
    - "src/components/import/FileUploadDropzone.tsx"
    - "src/components/import/ImportSourceGrid.tsx"
    - "src/components/import/FailedImportsSection.tsx"
  modified:
    - "src/routes/_authenticated/import/index.tsx"
    - "src/lib/query-config.ts"

key-decisions:
  - "YouTube always shown as 'active' (no per-user OAuth; uses API key) — sync action opens URL input dialog"
  - "File Upload card toggle is a no-op (always available); card serves as visual affordance for the dropzone below"
  - "getImportCounts() calls supabase.auth.getUser() internally (RPC requires user ID) — returns empty object on unauthenticated"
  - "FailedImportsSection uses retryMutation.variables to show per-row loading state (not a global spinner)"
  - "Add Source card opens 'coming soon' dialog with Grain + Fireflies in disabled state — no navigation"

patterns-established:
  - "Import source service: flat exported async functions, same pattern as recordings.service.ts"
  - "Import source hooks: useQuery/useMutation with queryKeys.imports.*, toast on mutation error"
  - "SourceCard: status derived at parent (ImportPage), not inside card — card is purely display"
  - "FileUploadDropzone: internal state for per-file entries (uploading/done/error), external mutation for actual upload"

# Metrics
duration: 4min
completed: 2026-02-28
---

# Phase 17 Plan 04: Import Hub UI Summary

**Full Import Hub page with 4 source cards (Fathom/Zoom/YouTube/File Upload), drag-and-drop file upload dropzone with 25MB validation, failed imports section with per-call retry, auto-sync on OAuth return, and dedup-aware sync toasts.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-28T04:46:14Z
- **Completed:** 2026-02-28T04:50:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Created `import-sources.service.ts` with 8 exported functions covering full CRUD, file upload, retry dispatch, and failed import queries
- Created `useImportSources.ts` with 7 React Query hooks following established patterns (useQuery + useMutation, Sonner toasts on error)
- Built Import Hub page replacing placeholder: 4 source cards + Add Source card, file upload dropzone, failed imports section, OAuth auto-sync, dedup-aware completion toasts
- Added `queryKeys.imports.counts()` and `queryKeys.imports.failed()` to query-config.ts

## Task Commits

Each task was committed atomically:

1. **Task 1: Create import sources service and hooks** - `1e0c50b` (feat)
2. **Task 2: Build Import Hub UI with source cards and file upload dropzone** - `87be41f` (feat)

**Plan metadata:** (docs commit follows this SUMMARY)

## Files Created/Modified

- `src/services/import-sources.service.ts` — getImportSources, getImportCounts (RPC), toggleSourceActive, upsertImportSource, uploadFile, disconnectImportSource, retryFailedImport (dispatches to appropriate edge fn per source_app), getFailedImports (flattens failed_ids array to per-call rows)
- `src/hooks/useImportSources.ts` — useImportSources, useImportCounts (5-min stale), useFailedImports (30s poll), useToggleSource, useFileUpload (invalidates recordings + imports), useDisconnectSource (toast: "Source disconnected"), useRetryFailedImport
- `src/components/import/SourceCard.tsx` — status badge (emerald/amber/red/muted), active/inactive toggle (native button for simplicity), Sync Now (OAuth sources only when active), Disconnect with AlertDialog confirm ("Future syncs will stop. Your imported calls will be kept.")
- `src/components/import/FileUploadDropzone.tsx` — HTML5 drag-and-drop, ACCEPTED_MIME_TYPES Set, 25MB MAX_FILE_SIZE_BYTES, per-file state machine (uploading/done/error), processFiles handles multi-file drop
- `src/components/import/ImportSourceGrid.tsx` — 1/2/3/4-col responsive grid, Add Source card (dashed border, RiAddLine icon) opens AddSourceDialog
- `src/components/import/FailedImportsSection.tsx` — hides when no failures, collapsible with per-call retry buttons, per-row loading state via retryMutation.variables, file-upload shows "Re-upload file"
- `src/routes/_authenticated/import/index.tsx` — full rewrite; all 4 source cards, OAuth auto-sync on mount (URL params), YouTube URL dialog, dedup-aware sync toasts (reads skipped_count + synced_count from edge fn response)
- `src/lib/query-config.ts` — added counts() and failed() to imports domain

## Decisions Made

- **YouTube always active**: YouTube uses a shared API key (no per-user OAuth). The card always shows status "active". The "Sync" button opens a URL input dialog. No `import_sources` row required.
- **File Upload toggle no-op**: File upload is always available. The toggle in the File Upload card calls an empty handler — the card exists as a visual entry point to the dropzone below the grid.
- **getImportCounts internal auth**: The RPC function requires `p_user_id`. The service calls `supabase.auth.getUser()` internally rather than requiring callers to pass the user ID, matching the SECURITY DEFINER pattern.
- **Add Source opens dialog (not route)**: "Add Source" card opens a local dialog showing Grain and Fireflies as "Coming soon" — no routing needed for MVP.

## Deviations from Plan

None — plan executed exactly as written. All must_haves satisfied, all artifact paths match the plan spec.

## Issues Encountered

None. TypeScript passed on first run. Build passed with zero errors (pre-existing chunk size warning unrelated to this plan).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 05 (file-upload-transcribe edge function) can now be called by `uploadFile()` in the service — the client-side integration is ready
- `import_sources` table writes (`upsertImportSource`, `toggleSourceActive`, `disconnectImportSource`) are all wired and tested via TypeScript
- Plans 02/03 (YouTube/Zoom connector rewires) can verify their `import_sources` writes by checking the Import Hub page — the status badge will show "error" or "active" based on the row

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `src/services/import-sources.service.ts` exists | FOUND |
| `src/hooks/useImportSources.ts` exists | FOUND |
| `src/components/import/SourceCard.tsx` exists | FOUND |
| `src/components/import/FileUploadDropzone.tsx` exists | FOUND |
| `src/components/import/ImportSourceGrid.tsx` exists | FOUND |
| `src/components/import/FailedImportsSection.tsx` exists | FOUND |
| `src/routes/_authenticated/import/index.tsx` exists | FOUND |
| `queryKeys.imports.counts()` in query-config.ts | FOUND |
| `queryKeys.imports.failed()` in query-config.ts | FOUND |
| Task 1 commit `1e0c50b` exists | FOUND |
| Task 2 commit `87be41f` exists | FOUND |
| `pnpm build` passes zero errors | CONFIRMED |
| TypeScript `--noEmit` passes | CONFIRMED |

---
*Phase: 17-import-connector-pipeline*
*Completed: 2026-02-28*
