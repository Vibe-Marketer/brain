---
plan: 40-03
status: complete
completed: 2026-05-12
---

# Plan 40-03 — Summary

Wired Refresh-from-Fathom into both UI surfaces per `40-UI-SPEC.md`.

**`src/components/call-detail/CallDetailHeader.tsx`** — adds a 4th hollow action button:
- Position: COPY · SHARE · **REFRESH** · EDIT
- Only renders when `source_platform === 'fathom'` AND not editing
- `data-testid="refresh-from-fathom-button"` for dev-browser hooks
- Spinner during mutation; dialog opens on click

**`src/components/import/FathomImportDetail.tsx`** — adds an icon-only ghost button on synced rows:
- Sibling of the "Already imported" badge
- Resolves BIGINT row id → UUID via `toRecordingUuid` from `@/lib/recording-ids` (handles legacy/UUID boundary)
- Shows toast if recording isn't in DB yet (orphan legacy id) — falls through to re-import flow
- Per-row pending state (`refreshTargetLegacyId === meeting.recording_id`) so concurrent rows don't fight
- `data-testid="refresh-from-fathom-row-button"`

Per QA-14 the call detail surface stays a MODAL — not refactored to Pane 4.

Production build clean (`npm run build` ✓), TypeScript clean.
