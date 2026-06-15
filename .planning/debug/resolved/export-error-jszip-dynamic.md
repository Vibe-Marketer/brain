---
status: resolved
trigger: "Export error: TypeError: Failed to fetch dynamically imported module: https://app.callvaultai.com/assets/jszip.min-D5tNnXG_.js during Obsidian friendly export"
created: "2026-06-15T23:05:00.000Z"
updated: "2026-06-15T23:14:00.000Z"
---

# Debug Session: export-error-jszip-dynamic

## Symptoms

- expected_behavior: "Selecting matching calls and choosing the Obsidian friendly export should download the export successfully."
- actual_behavior: "The export failed and the toast only said \"export failed try again\"."
- error_messages: "Export error: TypeError: Failed to fetch dynamically imported module: https://app.callvaultai.com/assets/jszip.min-D5tNnXG_.js"
- timeline: "Observed on 2026-06-15 at 18:58 America/New_York in production Chrome 149 on macOS."
- reproduction: "Open https://app.callvaultai.com/, select all matching calls, click Download, choose Obsidian friendly export, click Export."

## Current Focus

- hypothesis: "The selected-call Obsidian export path lazy-loads JSZip as a separate hashed Vite chunk; production can fail if the client requests a stale or unavailable JSZip chunk."
- test: "Inspect export code and build output for dynamic JSZip imports; reproduce via build/test where practical."
- expecting: "A dynamic import of jszip in the selected export path or a manual chunk named jszip.min."
- next_action: "resolved; deploy the committed frontend build through Vercel"
- reasoning_checkpoint:
- tdd_checkpoint:

## Evidence

- timestamp: "2026-06-15T22:58:37.951Z"
  source: "user bug report"
  observation: "Production console logged Failed to fetch dynamically imported module for /assets/jszip.min-*.js immediately after Export click."
- timestamp: "2026-06-15T23:08:00.000Z"
  source: "source inspection"
  observation: "src/components/SmartExportDialog.tsx routes Obsidian friendly selected-call export to exportToObsidian()."
- timestamp: "2026-06-15T23:09:00.000Z"
  source: "source inspection"
  observation: "src/lib/export-utils.ts had six lazy JSZip imports across ZIP export paths, including exportToObsidian()."
- timestamp: "2026-06-15T23:12:00.000Z"
  source: "verification"
  observation: "npm test -- src/lib/__tests__/export-utils.obsidian.test.ts passed: 9 tests."
- timestamp: "2026-06-15T23:13:00.000Z"
  source: "verification"
  observation: "npm run build passed and dist/assets no longer contained a jszip.min-*.js asset."

## Eliminated

## Resolution

- root_cause: "JSZip was lazy-loaded for ZIP exports, causing production to request a separate hashed jszip.min asset at export click time. A stale client or unavailable chunk made that dynamic import fail before the ZIP could be generated."
- fix: "Changed src/lib/export-utils.ts to statically import JSZip once and reuse it across ZIP export functions, removing the click-time dynamic JSZip chunk."
- verification: "npm test -- src/lib/__tests__/export-utils.obsidian.test.ts; npm run build; find dist/assets -maxdepth 1 -type f -name '*jszip*' returned no files."
- files_changed: "src/lib/export-utils.ts"
