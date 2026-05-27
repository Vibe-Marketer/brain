---
id: "01-D"
phase: 1
title: "Remove FileUploadDropzone from Import UI (MAN-06)"
type: implementation
status: pending
files_modified:
  - src/config/source-registry.ts
  - src/components/onboarding/OnboardingModal.tsx
  - src/components/import/FileUploadDropzone.tsx
  - src/components/panes/ImportSourcePane.tsx
  - src/lib/import-source-flow.ts
---

# Plan 01-D: Remove FileUploadDropzone from Import UI (MAN-06)

## Goal

Hide all file-upload (audio/video) entry points from the UI. The `file-upload-transcribe` Edge Function stays deployed for any in-flight callers, but is no longer reachable from the UI. The `.vtt/.txt` transcript file upload button inside `PasteTranscriptModal` is explicitly **kept** (it's a transcript text helper, not audio upload).

## What to Remove

| Surface | What to change |
|---------|---------------|
| `source-registry.ts` | Add `uiVisible: false` to `file-upload` entry (existing `VISIBLE_SOURCE_REGISTRY` filter will hide it) |
| `OnboardingModal.tsx` | Remove `<OnboardingSourceCard sourceApp="file-upload" ...>` block |
| `ImportSourcePane.tsx` | Verify file-upload is not rendered (it should be filtered by VISIBLE_SOURCE_REGISTRY already; remove any direct references) |
| `FileUploadDropzone.tsx` | Add `/* MAN-06: hidden until v2 async transcription pipeline */` comment at top; do NOT delete the file |
| `import-source-flow.ts` | If it routes to FileUploadDropzone, add a guard comment; keep the underlying function for the Edge Function path |
| `src/config/source-registry.ts` adapter entry | Mark file-upload entry as `status: 'hidden'` and `uiVisible: false` |

## What to Keep

- `FileUploadDropzone.tsx` file (don't delete — git history + v2 reuse)
- `file-upload-transcribe` Edge Function (deployed, no behavior change)
- `src/components/connectors/registry/adapters/file-upload.ts` (not surfaced in UI but kept for completeness)
- The `.vtt/.txt` file upload button inside `PasteTranscriptModal.tsx` (transcript text helper, not audio)

## Tasks

### Task 1: Mark file-upload as hidden in source-registry.ts

In `src/config/source-registry.ts`, update the file-upload entry:
```typescript
{
  id: "file-upload",
  label: "File Upload",
  subtitle: "Upload audio or video files directly",
  icon: RiUploadCloud2Line,
  indicatorClass: "bg-muted-foreground",
  adapter: "internal",
  authMode: "none",
  hasWebhook: false,
  status: "stable",
  uiVisible: false,  // MAN-06: hidden until v2 async transcription pipeline
},
```

The `VISIBLE_SOURCE_REGISTRY` already filters on `source.uiVisible !== false`, so this is the single change to hide it from all surfaces that use the registry.

**Check `SourceConfig` type** to ensure `uiVisible?: boolean` is in the type definition. If not, add it.

### Task 2: Remove file-upload card from OnboardingModal.tsx

Remove the block at line ~307-314:
```tsx
// REMOVE this block (MAN-06):
<OnboardingSourceCard
  sourceApp="file-upload"
  icon={<RiUpload2Line className="h-5 w-5 text-vibe-orange" />}
  title="Upload a recording"
  description="Drop in an audio or video file and we'll transcribe it"
  actionLabel="Upload file"
  onAction={() => window.open("/import", "_blank")}
/>
```

Also remove the `RiUpload2Line` import if it's only used there.

### Task 3: Verify ImportSourcePane.tsx is clean

Check `src/components/panes/ImportSourcePane.tsx` — if it renders from `VISIBLE_SOURCE_REGISTRY`, the Task 1 change is sufficient. If it has a hardcoded file-upload reference, remove it with a `// MAN-06` comment.

### Task 4: Add MAN-06 comment to FileUploadDropzone.tsx

At the top of the file, add:
```typescript
/**
 * FileUploadDropzone — Audio/video file upload component.
 *
 * MAN-06 (2026-05-27): This component is hidden from all UI entry points until
 * the v2 async transcription pipeline lands (MAN-01). The `file-upload-transcribe`
 * Edge Function remains deployed for any in-flight callers but this UI is not
 * surfaced. Do not import or render this component in v1 surfaces.
 *
 * RESTORE: When MAN-01 (async transcription pipeline) is implemented in v2,
 * re-enable this component and reconnect the import flow.
 */
```

### Task 5: Run build and verify

```bash
npm run build 2>&1
```

Must exit 0 with no dead-import errors. If any import of FileUploadDropzone generates an error (due to unused import in some file), trace and remove it.

Also run:
```bash
npm run type-check
```

### Task 6: Search for any remaining file-upload references

```bash
grep -rn "file-upload\|FileUploadDropzone\|file-upload-transcribe" src/ --include="*.tsx" --include="*.ts" | grep -v "node_modules" | grep -v "__tests__" | grep -v "FileUploadDropzone.tsx" | grep -v "source-registry.ts" | grep -v "connectors/registry/adapters/file-upload.ts"
```

Any results here should be reviewed. References in tests are OK. References in production code should have `// MAN-06` comments or be removed.

## Verification

- `npm run build` exits 0, no dead-import errors
- Navigating to `/import` in dev environment shows paste transcript option but NOT file upload audio/video option
- OnboardingModal does not show "Upload a recording" card
- `PasteTranscriptModal` "Upload transcript file" button (`.vtt/.txt`) still works
- `FileUploadDropzone.tsx` still exists in repo (not deleted)

## Threat Model

- No security surface change — the `file-upload-transcribe` Edge Function remains deployed but UI entry points are removed. Authenticated direct API calls could still reach it, which is acceptable (it requires a valid Supabase JWT).
- No data migration needed — existing recordings ingested via file upload are unaffected.
